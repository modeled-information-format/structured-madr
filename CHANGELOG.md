# Changelog

All notable changes to Structured MADR will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
