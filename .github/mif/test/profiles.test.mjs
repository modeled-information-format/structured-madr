// Golden wiring test: load vendored MIF schemas + level profiles via Ajv2020 and
// validate hand-built per-level objects. Run: node .github/mif/test/profiles.test.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const here = dirname(fileURLToPath(import.meta.url));
const S = join(here, "..", "schema");
const load = (p) => JSON.parse(readFileSync(join(S, p), "utf8"));

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
// register in dependency order; refs resolve by $id
ajv.addSchema(load("definitions/entity-reference.schema.json"));
ajv.addSchema(load("mif.schema.json"));
ajv.addSchema(load("profiles/level-1.schema.json"));
ajv.addSchema(load("profiles/level-2.schema.json"));
ajv.addSchema(load("profiles/level-3.schema.json"));

const P = {
  1: ajv.getSchema("https://smadr.dev/schemas/mif-profile-level-1.schema.json"),
  2: ajv.getSchema("https://smadr.dev/schemas/mif-profile-level-2.schema.json"),
  3: ajv.getSchema("https://smadr.dev/schemas/mif-profile-level-3.schema.json"),
};

const L1 = {
  "@context": "https://mif-spec.dev/schema/context.jsonld",
  "@type": "Concept",
  "@id": "urn:mif:smadr:subcog:0001-use-rust",
  conceptType: "semantic",
  content: "We adopt Rust as the implementation language.",
  created: "2025-12-28T00:00:00Z",
  title: "Rust as Implementation Language",
};
const L2 = {
  ...L1,
  namespace: "_semantic/decisions/architecture",
  modified: "2026-01-04T00:00:00Z",
  tags: ["rust", "language-choice"],
  temporal: { recordedAt: "2025-12-28T00:00:00Z" },
  relationships: [
    { type: "relates-to", target: "/decisions/0002-three-layer-storage.md" },
    { type: "supersedes", target: "/decisions/0000-prior.md" },
  ],
  entities: [
    { "@type": "EntityReference", entity: { "@id": "urn:mif:entity:technology:rust" }, entityType: "Technology", name: "rust" },
  ],
};
const L3 = {
  ...L2,
  temporal: { recordedAt: "2025-12-28T00:00:00Z", validFrom: "2025-12-28T00:00:00Z" },
  provenance: { sourceType: "user_explicit", trustLevel: "user_stated" },
  summary: "Rewrite from Python to Rust for performance and distribution.",
  citations: [
    { "@type": "Citation", citationType: "documentation", citationRole: "background", title: "Rust Book", url: "https://doc.rust-lang.org/book/" },
  ],
};

let fail = 0;
const check = (label, fn, obj, want) => {
  const ok = fn(obj);
  const pass = ok === want;
  if (!pass) { fail++; console.log(`  FAIL ${label}: got ${ok}, want ${want}`, fn.errors?.slice(0, 2)); }
  else console.log(`  ok   ${label}`);
};

console.log("Positive: each level object validates against its profile");
check("L1 vs level-1", P[1], L1, true);
check("L2 vs level-2", P[2], L2, true);
check("L3 vs level-3", P[3], L3, true);
console.log("Monotonic: higher objects also satisfy lower profiles");
check("L2 vs level-1", P[1], L2, true);
check("L3 vs level-2", P[2], L3, true);
console.log("Negative control: a thin object must FAIL a higher profile");
check("L1 vs level-2 (must fail)", P[2], L1, false);
check("L2 vs level-3 (must fail)", P[3], L2, false);

console.log(fail === 0 ? "\nSPIKE PASS" : `\nSPIKE FAIL (${fail})`);
process.exit(fail === 0 ? 0 : 1);
