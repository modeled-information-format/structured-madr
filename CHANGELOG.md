# Changelog

All notable changes to Structured MADR will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **[MIF Compliance]**: aligned with MIF specification **1.4.1**. The vendored
  schemas come from the immutable `https://mif-spec.dev/schema/1.4.1/` mirror
  (were pinned to MIF `develop/v1.0.0` at `e597da69`, whose schemas match MIF
  1.2.1); `config.yml` `mifVersion` is 1.4.1 (was 1.0.0), and `vendor-check`
  fails if it disagrees with `VENDOR.lock`'s `mifSpecVersion`. The MIF gate
  warns when a consumer's `mifVersion` differs from the vendored release.
- **[MIF Compliance]** (breaking for consumers of projected ids): MIF 1.4.0+
  requires a concept `@id` of `urn:mif:<uuid>`. The projector uses a UUID `id`
  as is (lowercased; bare, `urn:mif:`, `urn:uuid:` or `{…}`) and turns a slug,
  a legacy `urn:mif:smadr:…` id, or a missing `id` into a deterministic UUIDv5
  of the id the old projector emitted (`smadr:<project>:<id-or-file-slug>`) in
  the MIF namespace `uuid5(NAMESPACE_URL, "https://mif-spec.dev")`, keeping the
  replaced id in `aliases`. The gate fails when two ADRs project to the same
  `@id`. A `memoryType`-only ADR projects with `memoryType` and no synthesized
  `conceptType`, which satisfies Level 1.

### Security

- **[Deps]**: `osv-scanner.toml` records the two advisories with no fix in
  range after the astro 7.3.8 refresh: braces (no fixed release) and
  postcss-selector-parser (fix needs a major that postcss-nested does not
  accept), both build-time only.

### Fixed

- **[MIF Compliance]**: `x-superseded-by: B` on ADR A projects as
  `superseded-by` → B; it was `supersedes` → B, the reverse of the fact.

### Added

- **[MIF Compliance]**: validate ADRs as MIF (Modeled Information Format) at a
  user-selected level (`.github/config.yml` `mifConformanceLevel: 1|2|3`,
  default 2). Markdown stays canonical; a MIF JSON-LD object is derived from
  frontmatter + body and validated against per-level profiles.
  - Self-contained Claude Code plugin homed at `.github/` (plugin root with
    `.claude-plugin/plugin.json`, `commands/`, `agents/`, `skills/`, `hooks/`, plus
    vendored + checksum-pinned MIF schemas, config, projector, validator, ADR-typing ontology).
  - Installable: the repository is a plugin marketplace (`.claude-plugin/marketplace.json`,
    `source: ./.github`); `.claude/settings.json` registers it and enables the plugin at
    project scope, so `/plugin install structured-madr-mif@structured-madr` works.
  - `npm run validate:mif`; composite action gains `mode: mif` for downstream consumers.
  - CI gates: `mif-vendor-check` (schema drift) and dogfooded `validate-mif`.
  - ADR-0003 records the decision and is itself MIF-conformant (dogfooded).

## [1.1.0] - 2026-01-15

### Added

- **[GitHub Action]**: Shareable validation action for CI/CD pipelines
  - Composite action with configurable inputs (`path`, `pattern`, `schema`, `strict`, `fail-on-error`)
  - Node.js validator with JSON Schema (ajv) and body structure validation
  - GitHub-compatible annotations for PR feedback
  - Outputs for workflow integration (`valid`, `total`, `passed`, `failed`, `warnings`)
- **[Project ADRs]**: Exemplar ADRs demonstrating the format (dogfooding)
  - ADR-0001: Adopt Structured MADR Format for Project Documentation
  - ADR-0002: Shareable GitHub Action for Structured MADR Validation
- **[CI/CD]**: GitHub workflow to validate project and example ADRs
- **[Documentation]**: README updated with action usage, inputs/outputs, and local validation instructions

### Changed

- **[Tooling]**: Added npm package.json with validation dependencies (ajv, ajv-formats, glob, yaml)

## [1.0.0] - 2026-01-15

### Added

- Initial release of Structured MADR specification
- YAML frontmatter schema with required and optional fields
- Hierarchical decision drivers (Primary/Secondary)
- Per-option risk assessment (Technical/Schedule/Ecosystem)
- Categorized consequences (Positive/Negative/Neutral)
- Required Audit section with compliance tracking
- JSON Schema for frontmatter validation (`schemas/structured-madr.schema.json`)
- Full template with guidance text (`templates/template.md`)
- Bare template for experienced users (`templates/template-bare.md`)
- Real-world example ADR (`examples/0001-use-rust-implementation-language.md`)
- Formal specification document (`SPECIFICATION.md`)
- Contributing guidelines

### Design Decisions

- **MADR Compatibility**: Section structure follows MADR 4.0.0 conventions for familiarity
- **Machine-Readable Frontmatter**: YAML chosen for broad tooling support
- **Audit Requirements**: Mandatory audit section ensures decisions are tracked and validated
- **Risk Assessment**: Three-dimension risk model (Technical/Schedule/Ecosystem) provides comprehensive evaluation
- **Status Values**: Limited to MADR-compatible values (proposed, accepted, deprecated, superseded)

[Unreleased]: https://github.com/modeled-information-format/structured-madr/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/modeled-information-format/structured-madr/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/modeled-information-format/structured-madr/releases/tag/v1.0.0
