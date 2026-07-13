#!/usr/bin/env node

/**
 * Structured MADR Validator
 *
 * Validates Architectural Decision Records against the Structured MADR specification.
 * Can be run as a CLI tool or as part of a GitHub Action.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'glob';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Default body sections — overridable via schema.body
const REQUIRED_SECTIONS = [
  'Status',
  'Context',
  'Decision Drivers',
  'Considered Options',
  'Decision',
  'Consequences',
  'Decision Outcome',
  'Related Decisions',
  'Links',
  'More Information',
  'Audit',
];

// Default subsections — overridable via schema.body
const REQUIRED_SUBSECTIONS = {
  Context: ['Background and Problem Statement'],
  'Decision Drivers': ['Primary Decision Drivers', 'Secondary Decision Drivers'],
  Consequences: ['Positive', 'Negative', 'Neutral'],
};

// Optional sections — populated from schema.body.optional_sections
let OPTIONAL_SECTIONS = new Set();

// Title pattern — overridable from schema.body.title_pattern
let TITLE_PATTERN = /^ADR-(\d+):\s*(.+)$/;

// Whether to require ### headings under Considered Options
let REQUIRE_OPTION_HEADINGS = true;

// Valid status values for frontmatter
const VALID_STATUSES = ['proposed', 'accepted', 'deprecated', 'superseded'];

// Valid audit statuses
const VALID_AUDIT_STATUSES = ['Pending', 'Compliant', 'Non-Compliant', 'Partial'];

/**
 * ValidationResult holds the outcome of validating a single ADR file.
 */
class ValidationResult {
  constructor(filePath) {
    this.filePath = filePath;
    this.errors = [];
    this.warnings = [];
    this.valid = true;
  }

  addError(message, line = null) {
    this.errors.push({ message, line });
    this.valid = false;
  }

  addWarning(message, line = null) {
    this.warnings.push({ message, line });
  }
}

/**
 * Parse YAML frontmatter from markdown content.
 * Returns { frontmatter, body, frontmatterEndLine } or null if no frontmatter.
 */
function parseFrontmatter(content) {
  const lines = content.split('\n');

  if (lines[0] !== '---') {
    return null;
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return null;
  }

  const frontmatterLines = lines.slice(1, endIndex);
  const frontmatterText = frontmatterLines.join('\n');
  const body = lines.slice(endIndex + 1).join('\n');

  try {
    const frontmatter = parseYaml(frontmatterText);
    return {
      frontmatter,
      body,
      frontmatterEndLine: endIndex + 1,
    };
  } catch (error) {
    return {
      error: error.message,
      frontmatterEndLine: endIndex + 1,
    };
  }
}

/**
 * Extract headings from markdown body.
 * Returns array of { level, text, line }
 */
function extractHeadings(body, startLine = 1) {
  const lines = body.split('\n');
  const headings = [];
  let inCodeFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) { inCodeFence = !inCodeFence; continue; }
    if (inCodeFence) continue;
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        line: startLine + i,
      });
    }
  }

  return headings;
}

/**
 * Find a heading by text (case-insensitive partial match).
 */
function findHeading(headings, text, level = null) {
  return headings.find(
    (h) =>
      h.text.toLowerCase().includes(text.toLowerCase()) &&
      (level === null || h.level === level)
  );
}

/**
 * Validate frontmatter against JSON Schema.
 */
function validateFrontmatterSchema(frontmatter, schema, result) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const validate = ajv.compile(schema);
  const valid = validate(frontmatter);

  if (!valid) {
    for (const error of validate.errors) {
      const path = error.instancePath || 'root';
      result.addError(`Frontmatter schema error at ${path}: ${error.message}`);
    }
  }

  return valid;
}

/**
 * Validate frontmatter fields beyond schema (semantic validation).
 */
function validateFrontmatterSemantics(frontmatter, result) {
  // Check date ordering
  if (frontmatter.created && frontmatter.updated) {
    const created = new Date(frontmatter.created);
    const updated = new Date(frontmatter.updated);
    if (updated < created) {
      result.addError(
        `'updated' date (${frontmatter.updated}) cannot be before 'created' date (${frontmatter.created})`
      );
    }
  }

  // Check status is valid
  if (frontmatter.status && !VALID_STATUSES.includes(frontmatter.status)) {
    result.addError(
      `Invalid status '${frontmatter.status}'. Must be one of: ${VALID_STATUSES.join(', ')}`
    );
  }

  // Check tags format
  if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
    const tagPattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
    for (const tag of frontmatter.tags) {
      if (!tagPattern.test(tag)) {
        result.addError(
          `Invalid tag '${tag}'. Tags must be lowercase alphanumeric with hyphens, no leading/trailing hyphens.`
        );
      }
    }

    // Check for duplicate tags
    const uniqueTags = new Set(frontmatter.tags);
    if (uniqueTags.size !== frontmatter.tags.length) {
      result.addWarning('Duplicate tags found in frontmatter');
    }
  }
}

/**
 * Validate the H1 title format matches specification.
 */
function validateTitle(headings, frontmatter, result) {
  const h1Headings = headings.filter((h) => h.level === 1);

  if (h1Headings.length === 0) {
    result.addError('Missing H1 title. Expected format: # ADR-{NUMBER}: {TITLE}');
    return;
  }

  if (h1Headings.length > 1) {
    result.addWarning(
      `Multiple H1 headings found. ADR should have exactly one H1 title.`,
      h1Headings[1].line
    );
  }

  const titleMatch = h1Headings[0].text.match(TITLE_PATTERN);
  if (!titleMatch) {
    result.addError(
      `H1 title does not match required pattern: ${TITLE_PATTERN}`,
      h1Headings[0].line
    );
    return;
  }

  // Check title matches frontmatter
  if (frontmatter?.title) {
    const bodyTitle = (titleMatch[2] ?? titleMatch[0]).trim();
    if (
      bodyTitle.toLowerCase() !== frontmatter.title.toLowerCase() &&
      !bodyTitle.toLowerCase().includes(frontmatter.title.toLowerCase())
    ) {
      result.addWarning(
        `H1 title "${bodyTitle}" differs from frontmatter title "${frontmatter.title}"`,
        h1Headings[0].line
      );
    }
  }
}

/**
 * Match a section heading, handling cases where section names are prefixes of others
 * (e.g., "Decision" vs "Decision Drivers" vs "Decision Outcome").
 */
function matchSection(headingText, sectionName) {
  const headingLower = headingText.toLowerCase();
  const sectionLower = sectionName.toLowerCase();

  // For "Decision", we need exact match (not "Decision Drivers" or "Decision Outcome")
  if (sectionName === 'Decision') {
    return headingLower === 'decision';
  }

  // For other sections, use startsWith
  return headingLower.startsWith(sectionLower);
}

/**
 * Validate required sections are present and in order.
 */
function validateSections(headings, result) {
  const h2Headings = headings.filter((h) => h.level === 2);
  const h2Texts = h2Headings.map((h) => h.text);

  // Check each required section exists
  let lastFoundIndex = -1;
  for (const section of REQUIRED_SECTIONS) {
    const foundIndex = h2Texts.findIndex((t) => matchSection(t, section));

    if (foundIndex === -1) {
      if (OPTIONAL_SECTIONS.has(section.toLowerCase())) continue;
      result.addError(`Missing required section: ## ${section}`);
    } else {
      // Check order
      if (foundIndex < lastFoundIndex) {
        result.addWarning(
          `Section "## ${section}" appears out of order`,
          h2Headings[foundIndex].line
        );
      }
      lastFoundIndex = Math.max(lastFoundIndex, foundIndex);
    }
  }
}

/**
 * Validate required subsections within main sections.
 */
function validateSubsections(headings, result) {
  for (const [parentSection, requiredSubs] of Object.entries(REQUIRED_SUBSECTIONS)) {
    // Find the parent section
    const parentIndex = headings.findIndex(
      (h) => h.level === 2 && h.text.toLowerCase().startsWith(parentSection.toLowerCase())
    );

    if (parentIndex === -1) continue;

    // Find the next H2 section (or end)
    let nextH2Index = headings.findIndex(
      (h, i) => i > parentIndex && h.level === 2
    );
    if (nextH2Index === -1) nextH2Index = headings.length;

    // Get H3 headings between parent and next H2
    const subsections = headings
      .slice(parentIndex + 1, nextH2Index)
      .filter((h) => h.level === 3)
      .map((h) => h.text.toLowerCase());

    // Check each required subsection
    for (const sub of requiredSubs) {
      const found = subsections.some((s) => s.includes(sub.toLowerCase()));
      if (!found) {
        result.addError(
          `Missing required subsection "### ${sub}" under "## ${parentSection}"`,
          headings[parentIndex].line
        );
      }
    }
  }
}

/**
 * Validate the Audit section has at least one entry.
 */
function validateAuditSection(body, headings, result) {
  const auditHeading = findHeading(headings, 'Audit', 2);
  if (!auditHeading) return;

  // Find H3 headings after Audit
  const auditIndex = headings.indexOf(auditHeading);
  const nextH2Index = headings.findIndex(
    (h, i) => i > auditIndex && h.level === 2
  );
  const endIndex = nextH2Index === -1 ? headings.length : nextH2Index;

  const auditEntries = headings
    .slice(auditIndex + 1, endIndex)
    .filter((h) => h.level === 3);

  if (auditEntries.length === 0) {
    result.addError(
      'Audit section must contain at least one dated entry (### YYYY-MM-DD)',
      auditHeading.line
    );
    return;
  }

  // Check each audit entry has a valid date format
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  for (const entry of auditEntries) {
    if (!datePattern.test(entry.text)) {
      result.addWarning(
        `Audit entry heading should be a date (YYYY-MM-DD), found: "${entry.text}"`,
        entry.line
      );
    }
  }

  // Check for required audit fields in the body
  const lines = body.split('\n');
  let inAuditSection = false;
  let hasStatus = false;
  let hasFindings = false;
  let hasSummary = false;
  let hasActionRequired = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## Audit')) {
      inAuditSection = true;
    } else if (line.startsWith('## ') && inAuditSection) {
      break;
    }

    if (inAuditSection) {
      if (line.includes('**Status:**') || line.startsWith('**Status:**')) {
        hasStatus = true;
        // Validate status value
        const statusMatch = line.match(/\*\*Status:\*\*\s*(\w+)/);
        if (statusMatch && !VALID_AUDIT_STATUSES.includes(statusMatch[1])) {
          result.addWarning(
            `Audit status "${statusMatch[1]}" should be one of: ${VALID_AUDIT_STATUSES.join(', ')}`
          );
        }
      }
      if (line.includes('**Findings:**')) hasFindings = true;
      if (line.includes('**Summary:**')) hasSummary = true;
      if (line.includes('**Action Required:**')) hasActionRequired = true;
    }
  }

  if (!hasStatus) {
    result.addWarning('Audit entry should include **Status:** field', auditHeading.line);
  }
  if (!hasFindings) {
    result.addWarning('Audit entry should include **Findings:** section', auditHeading.line);
  }
  if (!hasSummary) {
    result.addWarning('Audit entry should include **Summary:** field', auditHeading.line);
  }
  if (!hasActionRequired) {
    result.addWarning(
      'Audit entry should include **Action Required:** field',
      auditHeading.line
    );
  }
}

/**
 * Validate options in the Considered Options section.
 */
function validateOptions(content, headings, result) {
  const optionsHeading = findHeading(headings, 'Considered Options', 2);
  if (!optionsHeading) return;

  const optionsIndex = headings.indexOf(optionsHeading);
  const nextH2Index = headings.findIndex(
    (h, i) => i > optionsIndex && h.level === 2
  );
  const endIndex = nextH2Index === -1 ? headings.length : nextH2Index;

  const optionHeadings = headings
    .slice(optionsIndex + 1, endIndex)
    .filter((h) => h.level === 3);

  if (optionHeadings.length === 0) {
    result.addError(
      'Considered Options section must contain at least one option (### Option N: Name)',
      optionsHeading.line
    );
    return;
  }

  // For each option, check for required subsections
  const allLines = content.split('\n');
  for (let i = 0; i < optionHeadings.length; i++) {
    const option = optionHeadings[i];
    const optionLineIndex = option.line - 1; // Convert to 0-indexed

    // Find end of this option (next H3/H2 or next option or end of options section)
    const nextOption = optionHeadings[i + 1];
    const nextH2 = headings.find(
      (h) => h.level === 2 && h.line > option.line
    );

    let endLineIndex = allLines.length;
    if (nextOption) {
      endLineIndex = nextOption.line - 1;
    } else if (nextH2) {
      endLineIndex = nextH2.line - 1;
    }

    const optionContent = allLines.slice(optionLineIndex, endLineIndex).join('\n');

    // Check for required elements (using SHOULD level - warnings not errors)
    // Match both bold format (**Advantages**:) and plain text (Advantages:)
    const hasAdvantages = /\*\*Advantages\*\*|Advantages:/i.test(optionContent);
    const hasDisadvantages = /\*\*Disadvantages\*\*|Disadvantages:/i.test(optionContent);
    const hasRiskAssessment = /\*\*Risk Assessment\*\*|Risk Assessment:/i.test(optionContent);

    if (!hasAdvantages) {
      result.addWarning(
        `Option "${option.text}" should include Advantages section`,
        option.line
      );
    }
    if (!hasDisadvantages) {
      result.addWarning(
        `Option "${option.text}" should include Disadvantages section`,
        option.line
      );
    }
    if (!hasRiskAssessment) {
      result.addWarning(
        `Option "${option.text}" should include Risk Assessment`,
        option.line
      );
    }
  }
}

/**
 * Validate a single ADR file.
 */
function validateFile(filePath, schema) {
  const result = new ValidationResult(filePath);

  // Read file
  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (error) {
    result.addError(`Failed to read file: ${error.message}`);
    return result;
  }

  // Parse frontmatter
  const parsed = parseFrontmatter(content);

  if (!parsed) {
    result.addError('Missing YAML frontmatter. File must start with ---');
    return result;
  }

  if (parsed.error) {
    result.addError(`Invalid YAML frontmatter: ${parsed.error}`);
    return result;
  }

  const { frontmatter, body, frontmatterEndLine } = parsed;

  // Validate frontmatter against schema
  if (schema) {
    validateFrontmatterSchema(frontmatter, schema, result);
  }

  // Validate frontmatter semantics
  validateFrontmatterSemantics(frontmatter, result);

  // Extract and validate body structure
  const headings = extractHeadings(body, frontmatterEndLine);

  validateTitle(headings, frontmatter, result);
  validateSections(headings, result);
  validateSubsections(headings, result);
  validateAuditSection(body, headings, result);
  if (REQUIRE_OPTION_HEADINGS) {
    validateOptions(content, headings, result);
  }

  return result;
}

/**
 * Output GitHub Actions annotation.
 */
function outputAnnotation(type, message, file, line = null) {
  const lineParam = line ? `,line=${line}` : '';
  console.log(`::${type} file=${file}${lineParam}::${message}`);
}

/**
 * Main entry point.
 */
async function main() {
  // Get configuration from environment (GitHub Actions inputs)
  const inputPath = process.env.INPUT_PATH || 'docs/decisions';
  const inputPattern = process.env.INPUT_PATTERN || '**/*.md';
  const inputSchema = process.env.INPUT_SCHEMA || '';
  const strict = process.env.INPUT_STRICT === 'true';
  const failOnError = process.env.INPUT_FAIL_ON_ERROR !== 'false';
  const actionPath = process.env.ACTION_PATH || dirname(__dirname);

  // Resolve paths
  const searchPath = resolve(process.cwd(), inputPath);
  const fullPattern = join(searchPath, inputPattern);

  // Load schema
  let schema = null;
  const schemaPath = inputSchema
    ? resolve(process.cwd(), inputSchema)
    : join(actionPath, 'schemas', 'structured-madr.schema.json');

  if (existsSync(schemaPath)) {
    try {
      schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
    } catch (error) {
      console.log(`::warning::Failed to load schema: ${error.message}`);
    }
  }

  // Apply body config from schema if present
  if (schema?.body) {
    const b = schema.body;
    if (b.sections || b.optional_sections) {
      REQUIRED_SECTIONS.length = 0;
      REQUIRED_SECTIONS.push(...(b.sections ?? []));
    }
    if (b.title_pattern) {
      TITLE_PATTERN = new RegExp(b.title_pattern);
    }
    if (b.optional_sections) {
      OPTIONAL_SECTIONS = new Set(b.optional_sections.map((s) => s.toLowerCase()));
    }
    if (b.subsections) {
      Object.keys(REQUIRED_SUBSECTIONS).forEach((k) => delete REQUIRED_SUBSECTIONS[k]);
      Object.assign(REQUIRED_SUBSECTIONS, b.subsections);
    }
    if (b.require_option_headings === false) {
      REQUIRE_OPTION_HEADINGS = false;
    }
  }

  // Find ADR files
  const files = await glob(fullPattern, { nodir: true });

  if (files.length === 0) {
    console.log(`::warning::No ADR files found matching pattern: ${fullPattern}`);
    console.log('valid=true');
    console.log('total=0');
    console.log('passed=0');
    console.log('failed=0');
    console.log('warnings=0');

    // Set outputs for GitHub Actions
    if (process.env.GITHUB_OUTPUT) {
      const outputs = ['valid=true', 'total=0', 'passed=0', 'failed=0', 'warnings=0'];
      const fs = await import('node:fs');
      fs.appendFileSync(process.env.GITHUB_OUTPUT, outputs.join('\n') + '\n');
    }
    return;
  }

  console.log(`\nValidating ${files.length} ADR file(s)...\n`);

  let totalErrors = 0;
  let totalWarnings = 0;
  let passedCount = 0;
  let failedCount = 0;

  for (const file of files) {
    const result = validateFile(file, schema);

    // Output results
    const relativePath = file.replace(process.cwd() + '/', '');

    if (result.valid && result.warnings.length === 0) {
      console.log(`\u2713 ${relativePath}`);
      passedCount++;
    } else if (result.valid) {
      console.log(`\u26A0 ${relativePath} (${result.warnings.length} warning(s))`);
      passedCount++;
    } else {
      console.log(`\u2717 ${relativePath} (${result.errors.length} error(s))`);
      failedCount++;
    }

    // Output errors
    for (const error of result.errors) {
      outputAnnotation('error', error.message, relativePath, error.line);
      totalErrors++;
    }

    // Output warnings
    for (const warning of result.warnings) {
      outputAnnotation('warning', warning.message, relativePath, warning.line);
      totalWarnings++;
    }
  }

  // Summary
  console.log('\n---');
  console.log(`Total: ${files.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log(`Errors: ${totalErrors} | Warnings: ${totalWarnings}`);

  // Determine overall validity
  const valid = failedCount === 0 && (!strict || totalWarnings === 0);

  // Set outputs for GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    const fs = await import('node:fs');
    const outputs = [
      `valid=${valid}`,
      `total=${files.length}`,
      `passed=${passedCount}`,
      `failed=${failedCount}`,
      `warnings=${totalWarnings}`,
    ];
    fs.appendFileSync(process.env.GITHUB_OUTPUT, outputs.join('\n') + '\n');
  }

  // Exit with appropriate code
  if (!valid && failOnError) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`::error::${error.message}`);
  process.exit(1);
});
