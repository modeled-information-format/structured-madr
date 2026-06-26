---
title: "Shareable GitHub Action for Structured MADR Validation"
description: "Decision to create a reusable GitHub Action that validates Structured MADR documents, enabling other projects to enforce format compliance in their CI/CD pipelines."
type: adr
category: tooling
tags:
  - github-actions
  - validation
  - ci-cd
  - reusable-action
  - automation
status: accepted
created: 2026-01-15
updated: 2026-01-15
author: Project Maintainers
project: structured-madr
technologies:
  - github-actions
  - node-js
  - yaml
  - json-schema
audience:
  - developers
  - devops
  - architects
related:
  - 0001-adopt-structured-madr-format.md
---

# ADR-0002: Shareable GitHub Action for Structured MADR Validation

## Status

Accepted

## Context

### Background and Problem Statement

The Structured MADR specification defines a precise format for architectural decision records with YAML frontmatter, required sections, and specific validation rules. While the specification provides JSON Schema for frontmatter validation, there is no automated tooling for projects to validate their ADRs as part of their CI/CD pipeline. Manual validation is error-prone and inconsistent, leading to format drift over time.

Projects adopting Structured MADR need a reliable, automated way to validate their ADRs. A shareable GitHub Action would allow any project to add validation to their workflow with minimal configuration, ensuring consistent format compliance across the ecosystem.

### Current Limitations

1. **No Automated Validation**: Projects must manually verify ADR compliance, which is time-consuming and error-prone.

2. **Schema-Only Validation**: The existing JSON Schema validates frontmatter but cannot verify body structure, section ordering, or semantic rules.

3. **Adoption Friction**: Without easy-to-use tooling, projects may avoid the format or implement incomplete validation.

4. **Inconsistent Enforcement**: Different projects may interpret the specification differently without standardized tooling.

## Decision Drivers

### Primary Decision Drivers

1. **Ecosystem Adoption**: Providing official validation tooling lowers the barrier for projects to adopt Structured MADR.

2. **Format Consistency**: Automated validation ensures all ADRs in a project conform to the specification.

3. **CI/CD Integration**: Modern development workflows require validation to be automated and integrated into pull request checks.

### Secondary Decision Drivers

1. **Immediate Feedback**: Developers should receive validation errors during PR review, not after merge.

2. **Clear Error Messages**: Validation failures must provide actionable guidance for fixing issues.

3. **Configuration Flexibility**: Different projects may need to customize validation strictness or paths.

## Considered Options

### Option 1: Composite GitHub Action with Node.js Validator

**Description**: Create a reusable composite GitHub Action that runs a Node.js-based validator script. The action is published to the GitHub Marketplace and can be referenced from any workflow.

**Technical Characteristics**:
- Composite action using `action.yml`
- Node.js script for validation logic
- Uses `ajv` for JSON Schema validation
- Custom logic for body structure validation
- Configurable via action inputs

**Advantages**:
- Easy integration: single line in workflow file
- Rich ecosystem for JSON Schema validation (ajv)
- Cross-platform Node.js runtime available on all GitHub runners
- Supports detailed error reporting with annotations
- Can use existing JSON Schema from this repository
- Versioned releases enable stable integrations

**Disadvantages**:
- Requires Node.js runtime (available on all GitHub runners)
- Additional repository maintenance for the action
- Version management across consuming projects

**Risk Assessment**:
- **Technical Risk**: Low. Node.js and GitHub Actions are mature technologies.
- **Schedule Risk**: Low. The implementation is straightforward.
- **Ecosystem Risk**: Low. GitHub Actions is the dominant CI platform for open source.

### Option 2: Docker-Based GitHub Action

**Description**: Package a validator in a Docker container that runs on GitHub Actions.

**Technical Characteristics**:
- Dockerfile with validator runtime
- Language-agnostic validator (could use any language)
- Container pulled and executed on each run

**Advantages**:
- Complete control over runtime environment
- Can use any programming language
- Reproducible builds

**Disadvantages**:
- Slower startup due to container pull
- More complex to maintain
- Larger resource footprint
- Overkill for a validation task

**Risk Assessment**:
- **Technical Risk**: Low. Docker is well-supported.
- **Schedule Risk**: Medium. Container setup adds complexity.
- **Ecosystem Risk**: Low. Docker actions are supported.

### Option 3: Shell Script Action

**Description**: Create a simple shell script that uses standard Unix tools (grep, awk, yq) for validation.

**Technical Characteristics**:
- Pure bash implementation
- Relies on tools available on runners
- Minimal dependencies

**Advantages**:
- No additional runtime dependencies
- Fast execution
- Simple to understand

**Disadvantages**:
- Limited JSON Schema validation capabilities
- Complex parsing logic in bash is error-prone
- Difficult to provide rich error messages
- Cross-platform compatibility issues (macOS vs Linux runners)
- Hard to maintain and extend

**Disqualifying Factor**: Shell scripts cannot reliably perform JSON Schema validation or complex markdown parsing required for full format validation.

**Risk Assessment**:
- **Technical Risk**: High. Bash parsing is fragile for complex formats.
- **Schedule Risk**: High. Significant effort for reliable implementation.
- **Ecosystem Risk**: Medium. Platform differences cause issues.

### Option 4: Pre-commit Hook Only

**Description**: Provide only a pre-commit hook configuration without GitHub Action integration.

**Technical Characteristics**:
- `.pre-commit-config.yaml` configuration
- Local execution only
- No CI/CD integration

**Advantages**:
- Catches errors before commit
- No CI configuration needed

**Disadvantages**:
- Developers can bypass pre-commit hooks
- No enforcement on pull requests
- Different pre-commit versions may behave differently
- Not all developers use pre-commit

**Disqualifying Factor**: Pre-commit hooks alone cannot enforce validation at the repository level; they are easily bypassed.

**Risk Assessment**:
- **Technical Risk**: Low. Pre-commit is mature.
- **Schedule Risk**: Low. Simple configuration.
- **Ecosystem Risk**: High. No guaranteed enforcement.

## Decision

We will create a composite GitHub Action with a Node.js-based validator.

The implementation will include:
- **`action.yml`**: Composite action definition with inputs for configuration
- **`validate.js`**: Node.js validation script using `ajv` for schema validation and custom logic for body structure
- **Configurable inputs**: ADR directory path, strictness level, fail behavior
- **Rich error output**: GitHub annotations pointing to specific line numbers
- **Version releases**: Semantic versioning for stable consumption

The action will be usable in any workflow:
```yaml
- uses: modeled-information-format/structured-madr@v1
  with:
    path: docs/decisions
```

## Consequences

### Positive

1. **Lowered Adoption Barrier**: Projects can add validation with a single workflow line, encouraging Structured MADR adoption.

2. **Consistent Enforcement**: All projects using the action validate against the same rules, ensuring ecosystem consistency.

3. **Immediate PR Feedback**: Developers see validation errors as PR check annotations, enabling quick fixes.

4. **Official Tooling**: An official action from the specification maintainers carries authority and trust.

### Negative

1. **Maintenance Responsibility**: The action must be maintained alongside the specification, with version updates for spec changes.

2. **Breaking Change Risk**: Major specification changes require careful version management to avoid breaking consuming projects.

3. **Support Burden**: Users may file issues about validation edge cases or request features.

### Neutral

1. **Node.js Dependency**: Relying on Node.js is standard for GitHub Actions and imposes no practical limitations.

## Decision Outcome

By creating a shareable GitHub Action, we achieve:
- Easy integration for any project using Structured MADR
- Consistent validation across the ecosystem
- Automated enforcement in CI/CD pipelines
- Clear, actionable error messages

Mitigations for maintenance burden:
- Semantic versioning allows specification evolution without breaking consumers
- Clear documentation reduces support requests
- Automated testing ensures action reliability

## Related Decisions

- [ADR-0001: Adopt Structured MADR Format](0001-adopt-structured-madr-format.md) - This project uses the format the action validates

## Links

- [GitHub Actions Documentation](https://docs.github.com/en/actions/creating-actions) - Guide for creating actions
- [AJV JSON Schema Validator](https://ajv.js.org/) - JSON Schema validation library
- [GitHub Annotations](https://docs.github.com/en/actions/reference/workflow-commands-for-github-actions#setting-a-warning-message) - PR annotation API

## More Information

- **Date:** 2026-01-15
- **Source:** Ecosystem tooling requirements and user feedback
- **Related ADRs:** ADR-0001

## Audit

### 2026-01-15

**Status:** Compliant

**Findings:**

| Finding | Files | Lines | Assessment |
|---------|-------|-------|------------|
| Composite action definition | `action.yml` | L1-L61 | compliant |
| Node.js validator script | `src/validate.js` | L1-L420 | compliant |
| Package configuration with dependencies | `package.json` | L1-L45 | compliant |
| README updated with action usage | `README.md` | L209-L284 | compliant |
| Frontmatter schema validation using ajv | `src/validate.js` | L115-L130 | compliant |
| Body structure validation | `src/validate.js` | L170-L280 | compliant |
| GitHub annotations output | `src/validate.js` | L330-L335 | compliant |

**Summary:** GitHub Action implementation complete. Action validates frontmatter against JSON Schema using ajv, validates body structure including required sections and ordering, and outputs GitHub-compatible annotations for PR feedback.

**Action Required:** None
