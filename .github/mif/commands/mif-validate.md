---
description: Validate every ADR's MIF projection against the level in .github/mif/config.yml (fail-closed at the level).
---

Run the MIF conformance gate over the repository's ADRs.

1. Read `.github/mif/config.yml` for `mifConformanceLevel` and `adrPath`.
2. Run: `npm run validate:mif` (which invokes `node .github/mif/bin/mif-validate.js`).
   - Pass `$ARGUMENTS` through if the user specified a level or path
     (e.g. `--level 3`, `--path docs/decisions`).
3. Report the result: total / passed / failed, and for any failure quote the
   `::error::` annotation (it names the missing or invalid MIF field) and point at
   the frontmatter source to fix. Do not edit ADRs unless asked — this command validates.
