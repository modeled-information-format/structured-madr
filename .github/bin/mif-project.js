// MIF projector: assemble a MIF JSON-LD object from a structured-MADR ADR's
// frontmatter + body, at a given conformance level (1|2|3).
//
// Markdown is canonical (MIF ADR-011): `content` is the body; everything else is
// derived from frontmatter (related[]->relationships, technologies[]->entities,
// created/updated/status->temporal, author/project->provenance) with author
// overrides honored when MIF-native keys are present. Output is validated by the
// level profiles (see mif-validate.js); this module only assembles.

import { createHash } from "node:crypto";

const MIF_CONTEXT = "https://mif-spec.dev/schema/context.jsonld";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// RFC 9562 UUIDv5 (SHA-1, name-based) of `name` in `namespace` (a UUID string).
export function uuidV5(name, namespace) {
  const ns = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(ns).update(Buffer.from(String(name), "utf8")).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const h = hash.subarray(0, 16).toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// uuid5(NAMESPACE_URL, "https://mif-spec.dev"): the namespace MIF's
// scripts/migrate_0_1_to_1_0.py, mif-rs, and mif-docs also derive concept ids
// in. The name hashed here is project-qualified (see conceptId), so two repos'
// `0001-use-rust` ADRs do not share an id.
export const MIF_NAMESPACE = uuidV5("https://mif-spec.dev", "6ba7b811-9dad-11d1-80b4-00c04fd430c8");

// MIF 1.4.0+ (spec §6.1): a concept @id is urn:mif:<uuid>. A frontmatter `id`
// that already holds a UUID (bare, `urn:mif:`, `urn:uuid:`, or `{...}`) is used
// as is, lowercased. Anything else becomes a deterministic UUIDv5 of the id the
// pre-1.4 projector emitted (`smadr:<project>:<slug>`, or a legacy
// `urn:mif:...` id verbatim), so each old id maps to exactly one new one and
// re-projecting an ADR keeps its @id. Returns { id, replaced } where
// `replaced` is the author's id when it was not already a UUID.
export function conceptId(f, project, slug) {
  const raw = f.id == null ? "" : String(f.id).trim();
  const bare = raw.replace(/^urn:(mif|uuid):/i, "").replace(/^\{(.*)\}$/, "$1");
  if (UUID_RE.test(bare)) return { id: `urn:mif:${bare.toLowerCase()}`, replaced: null };
  const name = raw.startsWith("urn:mif:")
    ? raw.slice("urn:mif:".length)
    : `smadr:${slugify(project)}:${raw ? slugify(raw) : slug || "adr"}`;
  return { id: `urn:mif:${uuidV5(name, MIF_NAMESPACE)}`, replaced: raw || null };
}

export function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "x";
}

// ISO date (YYYY-MM-DD) or date-time -> date-time. Idempotent.
export function toDateTime(d) {
  if (d == null) return d;
  const s = String(d);
  if (/[T ]\d{2}:\d{2}/.test(s)) return s.replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s + "T00:00:00Z";
  return s;
}

function fileSlug(filename) {
  return slugify(String(filename || "").replace(/\.md$/i, "").replace(/^.*\//, ""));
}

// Extract [label](url) http(s) links from the body's reference-ish sections.
function extractCitations(body) {
  const out = [];
  const seen = new Set();
  const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const url = m[2];
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({
      "@type": "Citation",
      citationType: "documentation",
      citationRole: "background",
      title: m[1].trim(),
      url,
    });
  }
  return out;
}

/**
 * @param {object} fm   parsed frontmatter
 * @param {string} body markdown body
 * @param {object} opts { level=2, filename, ontologyEnabled=false }
 * @returns {object} MIF JSON-LD object
 */
export function projectAdr(fm, body, opts = {}) {
  const level = Number(opts.level || 2);
  const f = fm || {};
  const project = f.project || "smadr";
  const slug = fileSlug(opts.filename);
  const { id, replaced } = conceptId(f, project, slug);

  // ---- Level 1 (core) ----
  const obj = {
    "@context": MIF_CONTEXT,
    "@type": "Concept",
    "@id": id,
    // MIF 1.4.0: the deprecated memoryType alone also satisfies the type check.
    ...(f.conceptType || !f.memoryType ? { conceptType: f.conceptType || "semantic" } : {}),
    ...(f.memoryType ? { memoryType: f.memoryType } : {}),
    content: String(body || "").trim(),
    created: toDateTime(f.created),
  };
  if (f.title) obj.title = f.title;
  // Keep the author's non-UUID id findable after it is replaced by a UUID.
  if (replaced) obj.aliases = [...new Set([...(Array.isArray(f.aliases) ? f.aliases : []), replaced])];
  if (level === 1) return obj;

  // ---- Level 2 (standard) ----
  obj.namespace =
    f.namespace ||
    `_semantic/decisions${f.category ? "/" + slugify(f.category) : ""}`;
  obj.modified = toDateTime(f.updated || f.created);
  if (Array.isArray(f.tags) && f.tags.length) obj.tags = f.tags;
  obj.temporal = { recordedAt: toDateTime(f.created) };

  // relationships: author-supplied win; else derive from related[] + x-superseded-by
  if (Array.isArray(f.relationships) && f.relationships.length) {
    obj.relationships = f.relationships;
  } else {
    const rels = [];
    if (f["x-superseded-by"]) {
      // This ADR is the superseded one: the edge points at its replacement.
      rels.push({ type: "superseded-by", target: `/decisions/${f["x-superseded-by"]}` });
    }
    // Guard: a stray `related: "x"` (not an array) must not iterate char-by-char
    // into bogus relationships — mode:mif skips the MADR schema that would catch it.
    for (const r of Array.isArray(f.related) ? f.related : []) {
      rels.push({ type: "relates-to", target: `/decisions/${r}` });
    }
    if (rels.length) obj.relationships = rels;
  }

  // entities: author-supplied win; else derive from technologies[]
  if (Array.isArray(f.entities) && f.entities.length) {
    obj.entities = f.entities;
  } else if (Array.isArray(f.technologies) && f.technologies.length) {
    obj.entities = f.technologies.map((t) => ({
      "@type": "EntityReference",
      entity: { "@id": `urn:mif:entity:technology:${slugify(t)}` },
      entityType: "Technology",
      name: t,
    }));
  }

  if (opts.ontologyEnabled) {
    obj.ontology = { id: "structured-madr", version: "0.1.0" };
    obj.entity = { name: f.title || slug, entity_type: "adr" };
  }
  if (level === 2) return obj;

  // ---- Level 3 (full) ----
  obj.summary = f.summary || f.description;
  obj.provenance = f.provenance || { sourceType: "user_explicit", trustLevel: "user_stated" };
  obj.temporal.validFrom = toDateTime(f.created);
  if (f.status === "deprecated" || f.status === "superseded") {
    obj.temporal.validUntil = toDateTime(f.updated || f.created);
  }
  const cites = Array.isArray(f.citations) && f.citations.length
    ? f.citations
    : extractCitations(body);
  if (cites.length) obj.citations = cites;

  // fold remaining x-* extension keys (except the superseded hint) into extensions
  const ext = {};
  for (const [k, v] of Object.entries(f)) {
    if (k.startsWith("x-") && k !== "x-superseded-by") ext[k] = v;
  }
  if (Object.keys(ext).length) obj.extensions = ext;

  return obj;
}

export default projectAdr;
