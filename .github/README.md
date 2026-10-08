# structured-madr-mif

A self-contained Claude Code plugin + CI tooling that makes structured-MADR ADRs
**MIF (Modeled Information Format) compliant** at a user-selected level.

structured-MADR markdown stays canonical; a MIF JSON-LD object is **derived** from
each ADR's frontmatter + body (MIF ADR-011) and validated against the level chosen in
[`config.yml`](./config.yml) (`mifConformanceLevel: 1|2|3`, default 2).

## Layout

```
.github/
  config.yml            # the one file you edit — selects the conformance level
  schema/               # VENDORED MIF schemas (pinned in VENDOR.lock) + config + level profiles
  ontologies/           # ADR-typing ontology (opt-in)
  bin/                  # mif-project.js (assemble), mif-validate.js (gate)
  test/                 # Ajv2020 golden wiring test
  .claude-plugin/, commands/, agents/, skills/, hooks/   # the Claude Code plugin
```

## Use

- **Locally / CI:** `npm run validate:mif` (uses `config.yml`). Override with
  `--level N`, `--path DIR`, `--pattern GLOB`, `--config FILE`, `--strict`.
- **As the published Action:** `uses: <owner>/structured-madr@v1` with `mode: mif`.
- **In Claude Code:** the `mif-compliance` skill + `/mif-validate` and `/mif-project`
  commands + the `adr-mif-author` agent + an authoring-time enforcement hook.

## Vendored schemas

`schema/` is vendored verbatim from the immutable MIF 1.4.1 release mirror
(`https://mif-spec.dev/schema/1.4.1/`); `VENDOR.lock` pins
`mifSpecVersion` and a per-file sha256, and `config.yml`'s `mifVersion` must
match it. Do not hand-edit — bump the vendor and re-run `node .github/bin/vendor-check.js`.
To re-vendor: copy the files from `https://mif-spec.dev/schema/<version>/`, then
regenerate `VENDOR.lock` (version, source, checksums) and set `mifVersion`.
