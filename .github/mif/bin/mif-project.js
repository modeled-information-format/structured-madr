// MIF projector: assemble a MIF JSON-LD object from a structured-MADR ADR's
// frontmatter + body, at a given conformance level (1|2|3).
//
// Markdown is canonical (MIF ADR-011): `content` is the body; everything else is
// derived from frontmatter (related[]->relationships, technologies[]->entities,
// created/updated/status->temporal, author/project->provenance) with author
// overrides honored when MIF-native keys are present. Output is validated by the
// level profiles (see mif-validate.js); this module only assembles.

const MIF_CONTEXT = "https://mif-spec.dev/schema/context.jsonld";

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
  const id = f.id && /^urn:mif:/.test(f.id)
    ? f.id
    : `urn:mif:smadr:${slugify(project)}:${slug || slugify(f.id) || "adr"}`;

  // ---- Level 1 (core) ----
  const obj = {
    "@context": MIF_CONTEXT,
    "@type": "Concept",
    "@id": id,
    conceptType: f.conceptType || "semantic",
    content: String(body || "").trim(),
    created: toDateTime(f.created),
  };
  if (f.title) obj.title = f.title;
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
      rels.push({ type: "supersedes", target: `/decisions/${f["x-superseded-by"]}` });
    }
    for (const r of f.related || []) {
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
