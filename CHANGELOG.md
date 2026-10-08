# Changelog

All notable changes to Structured MADR will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2026-10-08

This release is breaking for consumers of `mode: mif`: projected concept `@id`s
change from `urn:mif:smadr:<project>:<slug>` to `urn:mif:<uuid>` (see the
projected-ids entry under **Changed**). Reference the Action as `@v2`.

### Changed

- **[MIF Compliance]**: aligned with MIF specification **1.4.2**. The vendored
  schemas come from the immutable `https://mif-spec.dev/schema/1.4.2/` mirror
  (were pinned to MIF `develop/v1.0.0` at `e597da69`, whose schemas match MIF
  1.2.1); `config.yml` `mifVersion` is 1.4.2 (was 1.0.0), and `vendor-check`
  fails if it disagrees with `VENDOR.lock`'s `mifSpecVersion`. The MIF gate
  warns when a consumer's `mifVersion` differs from the vendored release.
- **[MIF Compliance]**: the vendor pin moved from MIF 1.4.1 to **1.4.2**, the
  coordinated MIF release with published artifacts. The 1.4.2 schemas are
  byte-identical to 1.4.1 and 1.4.0, so the `VENDOR.lock` sha256s are unchanged.
- **[MIF Compliance]** (breaking for consumers of projected ids): MIF 1.4.0+
  requires a concept `@id` of `urn:mif:<uuid>`. The projector uses a UUID `id`
  as is (lowercased; bare, `urn:mif:`, `urn:uuid:` or `{…}`) and turns a slug,
  a legacy `urn:mif:smadr:…` id, or a missing `id` into a deterministic UUIDv5
  of the id the old projector emitted (`smadr:<project>:<id-or-file-slug>`) in
  the MIF namespace `uuid5(NAMESPACE_URL, "https://mif-spec.dev")`, keeping the
  replaced id in `aliases`. The gate fails when two ADRs project to the same
  `@id`. A `memoryType`-only ADR projects with `memoryType` and no synthesized
  `conceptType`, which satisfies Level 1.
- **[Versioning]**: usage examples reference the Action as `@v2` (were `@v1`);
  the `structured-madr-mif` plugin version follows the project version (2.0.0).
- **[Project]**: repository, docs and package metadata now point at the
  `modeled-information-format` org and its canonical domains.
- **[CI]**: adopted the org's attested quality-gate backbone, gated on every PR;
  `npm run lint` now has an ESLint flat config and runs in CI; Node is pinned
  to 24.

### Security

- **[Deps]**: `osv-scanner.toml` records braces GHSA-vfj7-8cjw-p6xm (no fixed
  release; build-time only) as the one remaining accepted advisory.
- **[Deps]**: postcss-selector-parser GHSA-rj75-hqrm-r3gf is fixed rather than
  waived: an npm `overrides` entry forces `^7.1.6` past postcss-nested's `^6`
  range, and its `osv-scanner.toml` waiver is removed.

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
- **[Docs Site]**: `llms.txt` is generated at build time (starlight-llms-txt).

## [1.2.0] - 2026-04-09

Reconstructed from the v1.2.0 release notes and `git log v1.1.0..v1.2.0`; this
section was not written when 1.2.0 was tagged.

### Added

- **[GitHub Action]**: configurable body structure via the JSON schema's `body`
  key (required and optional sections, subsections, title pattern, option
  heading requirements). Without a `body` key the validator falls back to the
  structured-madr defaults.
- **[Project]**: `CITATION.cff` with academic citation metadata.

### Fixed

- **[GitHub Action]**: headings inside fenced code blocks no longer count as
  body sections (false positives).

### Changed

- **[Deps]**: astro 5.17.2 → 6.1.3, @astrojs/starlight 0.37.6 → 0.38.2,
  eslint 9.39.2 → 10.2.0, ajv 8.17.1 → 8.18.0, glob 11.1.0 → 13.0.6,
  yaml 2.8.2 → 2.8.3; GitHub Actions updated to current majors.

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

[Unreleased]: https://github.com/modeled-information-format/structured-madr/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/modeled-information-format/structured-madr/compare/v1.2.0...v2.0.0
[1.2.0]: https://github.com/modeled-information-format/structured-madr/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/modeled-information-format/structured-madr/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/modeled-information-format/structured-madr/releases/tag/v1.0.0
