---
description: Preview the MIF JSON-LD object derived from one ADR at a chosen level (read-only).
---

Show the MIF projection of a single ADR without validating the whole repo.

Given an ADR path (and optional level) in `$ARGUMENTS` (default level from
`.github/mif/config.yml`):

```bash
node --input-type=module -e '
import { readFileSync } from "node:fs"; import yaml from "yaml";
import { projectAdr } from "./.github/mif/bin/mif-project.js";
const [file, lvl="2"] = process.argv.slice(1);
const L = readFileSync(file, "utf8").split("\n");
const e = L.indexOf("---", 1);
const fm = yaml.parse(L.slice(1, e).join("\n"));
const body = L.slice(e + 1).join("\n");
console.log(JSON.stringify(projectAdr(fm, body, { level: Number(lvl), filename: file }), null, 2));
' "<ADR_PATH>" "<LEVEL>"
```

Print the assembled object and explain which fields were derived from which
frontmatter keys. Use this to debug why an ADR does or does not project clean.
