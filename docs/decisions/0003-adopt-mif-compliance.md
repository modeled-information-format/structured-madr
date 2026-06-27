---
title: "Adopt MIF Compliance (selectable L1/L2/L3)"
description: "Make every structured-MADR ADR MIF-conformant at a user-selected level, with MIF authored in frontmatter and validated as a derived JSON-LD projection by a plugin homed in .github/mif."
type: adr
category: architecture
tags:
  - mif
  - conformance
  - json-ld
  - validation
  - plugin
status: accepted
created: 2026-06-26
updated: 2026-06-26
author: zircote
project: structured-madr
technologies:
  - json-schema
  - json-ld
  - ajv
  - github-actions
audience:
  - developers
  - architects
related:
  - 0001-adopt-structured-madr-format.md
  - 0002-github-action-validator.md
---

# ADR-0003: Adopt MIF Compliance (selectable L1/L2/L3)

## Status

Accepted

## Context

### Background and Problem Statement

structured-MADR lives in the `modeled-information-format` org, whose MIF (Modeled
Information Format) specification defines a portable concept model with three
conformance levels. structured-MADR has had no MIF integration: its ADRs are
MADR + YAML frontmatter validated by a bespoke draft-07 schema, with no MIF
identity, namespace, relationships, or provenance. To dogfood the org's own
standard and let downstream consumers treat ADRs as modeled information, every
ADR should be MIF-conformant at a level the repository selects.

### Current Limitations

- ADR frontmatter carries decision metadata (title, status, dates, related,
  technologies) that maps cleanly onto MIF fields, but nothing emits or validates
  a MIF representation.
- MIF defines Levels 1 (core), 2 (standard), and 3 (full); a project must be able
  to pick the level it commits to rather than being forced to the maximum.
- The MADR validator is draft-07; MIF schemas are JSON Schema 2020-12, so a second
  validation dialect is required.

## Decision Drivers

### Primary Decision Drivers

1. **Single source of truth**: an ADR must not duplicate its body; MIF `content`
   is the markdown body (MIF ADR-011, markdown-canonical with derived JSON-LD).
2. **User-selected level**: the conformance level is a configuration choice
   (1, 2, or 3), enforced fail-closed at the selected level.
3. **No false rejections**: a sparse-but-valid ADR (no technologies, no related)
   must still pass; optional collections are validated only when present.

### Secondary Decision Drivers

1. **Mirror the org architecture**: configuration and plugin shape follow the
   research-harness-template pattern (a single config contract; a vendored,
   pinned schema set; a CI gate).
2. **Downstream reuse**: consumers of the published Action should be able to opt
   into MIF validation from the same Action they already use.

## Considered Options

### Option 1: MIF authored in frontmatter, validated as a derived JSON-LD projection

**Description**: Author MIF metadata in the ADR frontmatter (short keys, as MIF's
own example concept files do); assemble a MIF JSON-LD object from frontmatter +
body and validate it against the level profile. Most MIF fields are derived from
existing MADR fields; `content` is always the body.

**Technical Characteristics**:
- One source file per ADR; no separate authored artifact.
- A `mif-project.js` assembler and an Ajv2020 `mif-validate.js` gate.
- Vendored, pinned MIF schemas under `.github/mif/schema/`.

**Advantages**:
- No body duplication; consistent with MIF ADR-011 and ADR-002.
- Authors keep writing MADR; MIF is mostly derived.
- The level is one config value; the gate enforces it.

**Disadvantages**:
- `content` is the one MIF field that lives in the body, not frontmatter.
- Two validation dialects (draft-07 MADR + 2020-12 MIF) coexist.

**Risk Assessment**:
- **Technical Risk**: Low. The Ajv2020 wiring and per-level profiles are proven
  against golden objects before any ADR mapping.
- **Schedule Risk**: Low.
- **Ecosystem Risk**: Low. Vendored schemas are pinned to a MIF commit.

### Option 2: Separate committed `.mif.json` sidecar per ADR

**Description**: Generate and commit a MIF JSON-LD sidecar next to each ADR.

**Technical Characteristics**:
- A generated artifact tracked in git beside every ADR.

**Advantages**:
- The MIF object is directly inspectable as a file.

**Disadvantages**:
- Duplicates canonical data; sidecars drift from the markdown.
- Adds a generated artifact to review and keep in sync.

**Risk Assessment**:
- **Technical Risk**: Medium. Drift between source and sidecar.
- **Schedule Risk**: Low.
- **Ecosystem Risk**: Medium. Two artifacts to trust per decision.

### Option 3: No MIF integration (status quo)

**Description**: Keep MADR validation only; do not model ADRs as MIF.

**Technical Characteristics**:
- No MIF schemas, config, or gate.

**Advantages**:
- No new surface to maintain.

**Disadvantages**:
- The org's ADR standard does not conform to the org's information standard.
- No machine-readable identity, relationships, or provenance for decisions.

**Risk Assessment**:
- **Technical Risk**: Low.
- **Schedule Risk**: Low.
- **Ecosystem Risk**: High. Misses the point of living in the MIF org.

## Decision

Adopt **Option 1**. MIF is authored in ADR frontmatter and validated as a derived
JSON-LD projection at the level selected in `.github/mif/config.yml`
(`mifConformanceLevel`, default 2). A self-contained Claude Code plugin homed in
`.github/mif/` carries vendored, pinned MIF schemas, per-level profiles, a
projector, a validator, an ADR-typing ontology, and authoring aids. The published
composite Action gains a `mode: mif` so downstream consumers get MIF validation;
the repository dogfoods the gate in its own CI.

## Consequences

### Positive

1. Every ADR is MIF-conformant at the configured level, validated in CI.
2. The markdown stays canonical; MIF adds no duplicate body.
3. Downstream repositories can validate their ADRs as MIF via the same Action.

### Negative

1. Two validation dialects (draft-07 and 2020-12) are maintained side by side.
2. Vendored MIF schemas must be re-pinned when the spec evolves.

### Neutral

1. MIF fields are mostly derived from existing MADR frontmatter; authors may
   override with MIF-native keys when derivation needs help.

## Decision Outcome

The plugin validates all current ADRs and examples at Levels 1, 2, and 3, with a
content-dependent fail-closed gate so sparse ADRs are not rejected. Mitigations:

- Vendored schemas are checksum-pinned in `VENDOR.lock`; a `vendor-check` gate
  fails on drift.
- The level is a single config knob; raising it can only add constraints.

## Related Decisions

- [ADR-0001: Adopt Structured MADR Format](0001-adopt-structured-madr-format.md) — defines the frontmatter + body this projection maps from.
- [ADR-0002: GitHub Action Validator](0002-github-action-validator.md) — the composite action extended here with `mode: mif`.

## Links

- [MIF specification](https://mif-spec.dev) — the conformance model and schemas this ADR targets.
- [JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema) — the dialect of the vendored MIF schemas.

## More Information

- **Date:** 2026-06-26
- **Source:** `.github/mif/` (config, schemas, projector, validator, ontology, plugin); `action.yml`; `.github/workflows/ci.yml`.
- **Related ADRs:** ADR-0001, ADR-0002

## Audit

### 2026-06-26

**Status:** Compliant

**Findings:**

| Finding | Files | Lines | Assessment |
|---------|-------|-------|------------|
| MIF schemas vendored and checksum-pinned to MIF develop/v1.0.0 | `.github/mif/VENDOR.lock` | L1-L44 | compliant |
| Projector + validator pass at L1/L2/L3 over all ADRs and examples | `.github/mif/bin/` | n/a | compliant |
| Composite action exposes `mode: mif`; CI dogfoods the gate | `action.yml`, `.github/workflows/ci.yml` | n/a | compliant |

**Summary:** The MIF compliance plugin is in place and green: vendored schemas
match `VENDOR.lock`, every ADR projects clean at the configured level, and the CI
gate plus the `mode: mif` action surface are wired. The conformance level is
selectable in `.github/mif/config.yml`.

**Action Required:** None.
