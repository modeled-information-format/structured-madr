---
name: mif-compliance
description: Author and validate structured-MADR ADRs so they project clean as MIF (Modeled Information Format) at the configured conformance level. Use when writing or upgrading an ADR, when a MIF gate fails, when asked to make an ADR MIF-compliant, or to explain the MIF level model for ADRs.
version: 1.0.0
---

# MIF Compliance for structured-MADR ADRs

structured-MADR markdown stays canonical. A MIF JSON-LD object is **derived** from
each ADR's frontmatter + body and validated against the level selected in
`.github/mif/config.yml` (`mifConformanceLevel: 1|2|3`, default 2). You do not write
JSON-LD; you fill frontmatter, and the projector assembles + validates it.

## What each level requires (content-dependent)

- **Level 1 (core):** every ADR — `@id` (synthesized urn), `conceptType` (semantic),
  `content` (the body), `created`, `title`. Already satisfied by a valid ADR.
- **Level 2 (standard, default):** adds `namespace` (derived `_semantic/decisions/<category>`),
  `modified` (from `updated`), `temporal`. Relationships and entities are derived and
  validated **only when present**.
- **Level 3 (full):** adds `provenance` (from author/project) and `temporal.validFrom`.
  Citations are extracted from body links; validated only when present.

A sparse ADR (no `technologies`, no `related`) still passes every level — optional
collections are validated only when present.

## How frontmatter maps to MIF

| You write (frontmatter) | Becomes (MIF) |
|---|---|
| `title`, `created`, `updated`, `description`, `tags` | `title`, `created`, `modified`, `summary`, `tags` |
| `category` | `namespace` = `_semantic/decisions/<category-slug>` |
| `technologies: [rust, tokio]` | `entities[]` (EntityReference, entityType Technology) |
| `related: [0002-foo.md]` | `relationships[] {type: relates-to, target: /decisions/0002-foo.md}` |
| `x-superseded-by: 0009-new.md` | `relationships[] {type: supersedes, target: /decisions/0009-new.md}` |
| `author`, `project` | `provenance` (sourceType user_explicit) |
| body `[label](https://…)` links | `citations[]` (L3) |

You may also author MIF-native keys directly in frontmatter (`conceptType`, `namespace`,
`relationships`, `entities`, `temporal`, `provenance`, `citations`, `id`) to override the
derivation; they are deep-validated against the MIF schema after projection.

## Make an ADR conform

1. Confirm the ADR passes the MADR validator: `npm run validate`.
2. Project + validate as MIF at the configured level: `npm run validate:mif`
   (or preview one ADR's MIF object with the `/mif-project` command).
3. If it fails: read the `::error::` annotation (it names the missing/invalid MIF field),
   fix the frontmatter source, re-run. To link a superseding decision, add
   `x-superseded-by: <file>.md` and set `status: superseded`.

## Notes

- The MIF schemas are vendored under `.github/mif/schema/` and pinned in `VENDOR.lock`
  (MIF `develop/v1.0.0`). Do not hand-edit vendored files; bump the vendor instead.
- To type ADRs as MIF entities, enable the `structured-madr` ontology in
  `.github/mif/config.yml` `ontologies[]`; the projection then stamps `entity.entity_type: adr`.
