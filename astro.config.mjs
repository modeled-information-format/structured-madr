import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://smadr.dev",
  integrations: [
    starlight({
      title: "Structured MADR",
      logo: {
        light: "./src/assets/logo-light.svg",
        dark: "./src/assets/logo-dark.svg",
        replacesTitle: true,
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/modeled-information-format/structured-madr",
        },
      ],
      sidebar: [
        {
          label: "Welcome",
          items: [{ label: "Introduction", slug: "index" }],
        },
        {
          label: "Tutorials",
          items: [
            { label: "Getting Started", slug: "tutorials/getting-started" },
            { label: "Your First ADR", slug: "tutorials/first-adr" },
          ],
        },
        {
          label: "How-to Guides",
          items: [
            { label: "Set Up CI Validation", slug: "guides/ci-validation" },
            { label: "Validate Locally", slug: "guides/local-validation" },
            {
              label: "Integrate with AI Tools",
              slug: "guides/ai-integration",
            },
          ],
        },
        {
          label: "Reference",
          items: [
            {
              label: "Specification",
              items: [
                {
                  label: "Overview",
                  slug: "reference/specification/overview",
                },
                {
                  label: "Frontmatter",
                  slug: "reference/specification/frontmatter",
                },
                {
                  label: "Body Sections",
                  slug: "reference/specification/body-sections",
                },
                {
                  label: "File Naming & Validation",
                  slug: "reference/specification/file-naming",
                },
                {
                  label: "Extensions & Security",
                  slug: "reference/specification/extensions",
                },
              ],
            },
            { label: "Schema", slug: "reference/schema" },
            { label: "GitHub Action", slug: "reference/github-action" },
            { label: "Templates", slug: "reference/templates" },
            { label: "Changelog", slug: "reference/changelog" },
          ],
        },
        {
          label: "Explanation",
          items: [
            {
              label: "Why Structured MADR",
              slug: "explanation/why-structured-madr",
            },
            {
              label: "Format Comparison",
              slug: "explanation/format-comparison",
            },
            {
              label: "Design Decisions",
              slug: "explanation/design-decisions",
            },
          ],
        },
      ],
    }),
  ],
});
