#!/usr/bin/env node
// MIF conformance validator for structured-MADR ADRs.
//
// Reads the conformance level from .github/config.yml (in the CONSUMER repo /
// cwd), projects every ADR to a MIF object (mif-project.js), and validates it
// against the level profile using the VENDORED MIF schemas (resolved from the
// ACTION path so a downstream `uses: ./` resolves them). Fail-closed at the level.
//
// Usage: node .github/bin/mif-validate.js [--level N] [--path DIR]
//                                             [--pattern GLOB] [--config FILE]
// MIF mode is error-only (fail-closed); there is no warning tier, so no --strict.
// Outputs (GITHUB_OUTPUT): mif-valid, mif-total, mif-passed, mif-failed.

import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { globSync } from "glob";
import yaml from "yaml";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { projectAdr } from "./mif-project.js";

const here = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--level") a.level = Number(argv[++i]);
    else if (k === "--path") a.path = argv[++i];
    else if (k === "--pattern") a.pattern = argv[++i];
    else if (k === "--config") a.config = argv[++i];
  }
  return a;
}

// Vendored schemas live with the action; ADRs + config live in the consumer cwd.
function schemaDir() {
  const ap = process.env.GITHUB_ACTION_PATH;
  if (ap && existsSync(join(ap, ".github/schema/mif.schema.json")))
    return join(ap, ".github/schema");
  return join(here, "..", "schema"); // .github/bin -> .github/schema
}

function buildValidators(S) {
  const load = (p) => JSON.parse(readFileSync(join(S, p), "utf8"));
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  ajv.addSchema(load("definitions/entity-reference.schema.json"));
  ajv.addSchema(load("mif.schema.json"));
  for (const n of [1, 2, 3]) ajv.addSchema(load(`profiles/level-${n}.schema.json`));
  return (n) => ajv.getSchema(`https://smadr.dev/schemas/mif-profile-level-${n}.schema.json`);
}

function loadConfig(file) {
  if (!existsSync(file)) return {};
  return yaml.parse(readFileSync(file, "utf8")) || {};
}

// Fail-closed on a malformed config: an invalid/typo'd config (e.g. a misspelled
// mifConformanceLevel) must not silently fall back to the default level. Validate
// the parsed config against the project-owned config.schema.json when present.
function assertConfigValid(S, file, cfg) {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  const schema = JSON.parse(readFileSync(join(S, "config.schema.json"), "utf8"));
  const validate = ajv.compile(schema);
  if (!validate(cfg)) {
    for (const err of (validate.errors || []).slice(0, 5))
      console.log(`::error file=${file}::MIF config invalid: ${err.instancePath || "/"} ${err.message}`);
    console.log(`::error::Refusing to run with an invalid ${file} (fail-closed). Validate it against .github/schema/config.schema.json.`);
    process.exit(2);
  }
}

function splitFrontmatter(content) {
  const lines = content.split("\n");
  if (lines[0] !== "---") return null;
  const end = lines.indexOf("---", 1);
  if (end === -1) return null;
  return { fm: yaml.parse(lines.slice(1, end).join("\n")) || {}, body: lines.slice(end + 1).join("\n") };
}

function annotate(kind, file, msg) {
  console.log(`::${kind} file=${file}::${msg}`);
}

function setOutputs(o) {
  const f = process.env.GITHUB_OUTPUT;
  const lines = Object.entries(o).map(([k, v]) => `${k}=${v}`).join("\n");
  if (f) appendFileSync(f, lines + "\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  // Resolve the config path. The plugin now homes config at .github/config.yml, but a
  // consumer set up against the published action may still have the legacy
  // .github/mif/config.yml. If the resolved path is absent and the legacy one exists,
  // use the legacy file so the consumer's level/adrPath are honored, not silently dropped.
  let configFile = args.config || ".github/config.yml";
  if (!existsSync(configFile) && existsSync(".github/mif/config.yml")) {
    configFile = ".github/mif/config.yml";
  }
  const cfg = loadConfig(configFile);
  const S = schemaDir();
  if (existsSync(configFile)) assertConfigValid(S, configFile, cfg);
  // Fail-closed: an explicit --level that isn't 1|2|3 (typo, empty, NaN) must error,
  // not silently fall back to the default level and gate at the wrong strictness.
  if (args.level !== undefined && ![1, 2, 3].includes(args.level)) {
    console.log(`::error::Invalid --level (expected 1|2|3)`);
    process.exit(2);
  }
  // The consumer pins a MIF version; this Action validates against the one it
  // vendors. Say so when they differ, since rules change between releases
  // (MIF 1.4.0 made a concept @id urn:mif:<uuid>).
  const lock = JSON.parse(readFileSync(join(S, "..", "VENDOR.lock"), "utf8"));
  if (cfg.mifVersion !== undefined && String(cfg.mifVersion) !== lock.mifSpecVersion) {
    console.log(`::warning file=${configFile}::mifVersion ${cfg.mifVersion} differs from the MIF ${lock.mifSpecVersion} schemas this Action validates against`);
  }
  const level = args.level || cfg.mifConformanceLevel || 2;
  const adrPath = args.path || cfg.adrPath || "docs/decisions";
  const pattern = args.pattern || "**/*.md";
  const ontologyEnabled = (cfg.ontologies || []).some((o) => o.id === "structured-madr" && o.enabled);

  const profileFor = buildValidators(S);
  const validate = profileFor(level);
  if (!validate) {
    console.log(`::error::Unknown MIF level ${level} (expected 1|2|3)`);
    process.exit(2);
  }

  const files = globSync(join(adrPath, pattern), { nodir: true });
  console.log(`MIF conformance gate: level ${level}, ${files.length} ADR(s) under ${adrPath}`);

  // Fail-closed: a gate that matches no ADRs must not report success. An empty
  // glob is a misconfiguration (wrong path/pattern), not a clean pass.
  if (files.length === 0) {
    console.log(`::error::MIF conformance gate matched no ADRs at ${join(adrPath, pattern)} — refusing to pass (fail-closed). Check path/pattern/adrPath.`);
    setOutputs({ "mif-valid": false, "mif-total": 0, "mif-passed": 0, "mif-failed": 0 });
    process.exit(1);
  }

  let passed = 0, failed = 0;
  const seenIds = new Map(); // @id -> first file that projected to it
  for (const file of files) {
    const rel = relative(process.cwd(), file);
    let obj;
    try {
      const parsed = splitFrontmatter(readFileSync(file, "utf8"));
      if (!parsed) { failed++; annotate("error", rel, "no YAML frontmatter"); continue; }
      obj = projectAdr(parsed.fm, parsed.body, { level, filename: file, ontologyEnabled });
    } catch (e) {
      failed++; annotate("error", rel, `parse/projection failed: ${e.message}`); continue;
    }
    const dup = seenIds.get(obj["@id"]);
    if (dup) {
      failed++;
      annotate("error", rel, `MIF @id ${obj["@id"]} duplicates ${dup}; give one of them a distinct id`);
      continue;
    }
    seenIds.set(obj["@id"], rel);
    if (validate(obj)) {
      passed++;
    } else {
      failed++;
      for (const err of (validate.errors || []).slice(0, 5))
        annotate("error", rel, `MIF L${level}: ${err.instancePath || "/"} ${err.message}`);
    }
  }

  const valid = failed === 0;
  console.log(`MIF: ${passed} passed, ${failed} failed (level ${level})`);
  setOutputs({ "mif-valid": valid, "mif-total": files.length, "mif-passed": passed, "mif-failed": failed });
  process.exit(valid ? 0 : 1);
}

main();
