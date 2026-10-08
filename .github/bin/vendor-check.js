#!/usr/bin/env node
// Verify every vendored MIF schema matches its sha256 in VENDOR.lock. Fail-closed.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import yaml from "yaml";

const here = dirname(fileURLToPath(import.meta.url));
const mifDir = join(here, ".."); // .github
const repoRoot = join(here, "..", ".."); // repo root (VENDOR.lock paths are repo-relative)
const lock = JSON.parse(readFileSync(join(mifDir, "VENDOR.lock"), "utf8"));

let bad = 0;
for (const f of lock.files) {
  const got = createHash("sha256").update(readFileSync(join(repoRoot, f.path))).digest("hex");
  if (got !== f.sha256) {
    bad++;
    console.log(`::error::vendored ${f.path} drifted from VENDOR.lock (got ${got.slice(0, 12)}…, want ${f.sha256.slice(0, 12)}…)`);
  }
}
// config.yml's mifVersion must name the release the schemas were vendored from.
const mifVersion = (yaml.parse(readFileSync(join(mifDir, "config.yml"), "utf8")) || {}).mifVersion;
if (String(mifVersion) !== lock.mifSpecVersion) {
  bad++;
  console.log(`::error::.github/config.yml mifVersion (${mifVersion ?? "missing"}) != VENDOR.lock mifSpecVersion (${lock.mifSpecVersion})`);
}
if (bad === 0) console.log(`vendor-check: ${lock.files.length} files match VENDOR.lock (MIF ${lock.mifSpecVersion}, ${lock.source})`);
process.exit(bad ? 1 : 0);
