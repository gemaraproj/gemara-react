# @gemara/react

Headless React renderers for [Gemara](https://github.com/gemaraproj/gemara) artifacts.

- Server-component-clean by default — no `useState`, no `useEffect`, no `"use client"` in the catalog renderers.
- Interactive components (e.g. `CollapsibleGroup`) live behind a separate subpath export so RSC consumers never pay the client-bundle cost.
- Headless: every renderer emits semantic HTML with `data-gemara-*` attributes. You bring the CSS.
- Tree-shakeable per artifact via subpath imports.

## Install

```bash
npm install @gemara/react
```

Requires `react >= 18`.

## Quick start (Astro)

```astro
---
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { ControlCatalog } from "@gemara/react/control-catalog";
import { GemaraProvider } from "@gemara/react/provider";
import { isControlCatalog } from "@gemara/react";

const raw = readFileSync("./content/my-catalog.yaml", "utf8");
const data = parseYaml(raw);
if (!isControlCatalog(data)) throw new Error("Not a ControlCatalog");
---
<html lang="en">
  <body>
    <h1>My catalog</h1>
    <GemaraProvider>
      <ControlCatalog data={data} headingLevel={2} />
    </GemaraProvider>
  </body>
</html>
```

The library does not ship a YAML/JSON loader — consumers parse with their tool of choice. The runtime guards (`isControlCatalog`, `isGuidanceCatalog`, `isCapabilityCatalog`, `isPrincipleCatalog`, `isThreatCatalog`, `isVectorCatalog`, and `detectArtifactType`) narrow the discriminated union.

## Subpath imports

Renderers are deliberately not in the root barrel — each lives behind its own subpath so consumers tree-shake to exactly what they use.

| Import                                         | What it gives you                                    |
| ---------------------------------------------- | ---------------------------------------------------- |
| `@gemara/react`                     | `GemaraProvider`, primitives, type guards, types     |
| `@gemara/react/control-catalog`     | `ControlCatalog` renderer + compound parts (Layer 2) |
| `@gemara/react/guidance-catalog`    | `GuidanceCatalog` renderer + compound parts (Layer 1)|
| `@gemara/react/capability-catalog`  | `CapabilityCatalog` renderer + compound parts (Layer 2)|
| `@gemara/react/principle-catalog`   | `PrincipleCatalog` renderer + compound parts (Layer 1)|
| `@gemara/react/threat-catalog`      | `ThreatCatalog` renderer + compound parts (Layer 2)  |
| `@gemara/react/vector-catalog`      | `VectorCatalog` renderer + compound parts (Layer 1)  |
| `@gemara/react/primitives`          | `ArtifactRef`, `EntityRef`, `DateTime`, `Prose`, `Heading`, `HeadingScope` |
| `@gemara/react/provider`            | `GemaraProvider`, `useLinkResolver`, `ArtifactReference`, `LinkResolver` |
| `@gemara/react/interactive`         | `CollapsibleGroup` (carries `"use client"`)         |
| `@gemara/react/types`               | Raw `Schemas` and discriminated artifact types       |

## Styling: the `data-gemara-*` taxonomy

The library ships no CSS. The public styling contract is the set of `data-gemara-*` attributes emitted on rendered elements.

- `data-gemara-artifact="ControlCatalog" | "GuidanceCatalog" | "CapabilityCatalog" | "PrincipleCatalog" | "ThreatCatalog" | "VectorCatalog"` on each renderer's root `<article>`.
- `data-gemara-id` — the artifact `metadata.id`.
- `data-gemara-part="header" | "title" | "meta" | "groups" | "group" | "control" | "guideline" | "capability" | "principle" | "threat" | "vector" | "control-id" | "control-title" | "guideline-id" | "guideline-title" | "capability-id" | "capability-title" | "principle-id" | "principle-title" | "threat-id" | "threat-title" | "vector-id" | "vector-title" | "objective" | "rationale" | "description" | "requirements" | "requirement" | "applicability" | "actors" | "actor" | "mappings" | "control-list" | "guideline-list" | "capability-list" | "principle-list" | "threat-list" | "vector-list" | "front-matter" | "extends"` for structural slots.
- `data-gemara-control-id`, `data-gemara-guideline-id`, `data-gemara-capability-id`, `data-gemara-principle-id`, `data-gemara-threat-id`, `data-gemara-vector-id`, `data-gemara-group-id`, `data-gemara-requirement-id` for stable selectors.
- `data-gemara-mappings-label="guidelines" | "threats" | "principles" | "capabilities" | "vectors"` on mapping sections.
- `data-gemara-ref="artifact" | "entry" | "mapping-reference"` + `data-gemara-ref-id` on resolver output.
- `data-gemara-prose=""` on the `Prose` wrapper element (plain-text fields).

These attributes are stable across patch releases. Treat them like a CSS API.

## Composing into your page outline: `headingLevel`

Every catalog renderer accepts an optional `headingLevel` prop (default `1`) that sets the level of the catalog title. Nested sections add fixed offsets (group = +1, entry = +2, subsections = +3) and are clamped at `<h6>`.

Set `headingLevel={2}` when the host page already owns the `<h1>`.

```tsx
<ControlCatalog data={data} headingLevel={2} />
```

## Customizing links: `linkResolver`

Cross-references (`extends`, `imports`, inline mapping entries) route through a single resolver provided via context. The default emits a plain `<a>` when a `url` is present and an inert `<span>` otherwise. Override it to plug in your router's `<Link>`, Astro's `<a>`, or anything else.

```tsx
import { GemaraProvider } from "@gemara/react/provider";

<GemaraProvider
  linkResolver={(ref, children) => (
    <a href={`/control/${ref.referenceId}#${ref.id}`}>{children}</a>
  )}
>
  <ControlCatalog data={data} />
</GemaraProvider>
```

The resolver receives an `ArtifactReference` (`kind: "artifact" | "entry" | "mapping-reference"`, plus `id`, optional `referenceId`, `url`, `relation`).

## Prose fields are plain text

The catalog text fields (`objective`, `description`, `front-matter`, `recommendations.text`, etc.) are rendered as plain text with `white-space: pre-wrap` so authored line breaks survive. The Gemara CUE schema does not type any of these as Markdown — that is a convention, not a contract — so the library makes no parsing promise. If a consumer needs rich formatting, swap the `Prose` primitive locally or pre-render upstream (e.g. in go-gemara) and feed pre-rendered output through your own wrapper.

## React Server Components

The default catalog renderers and all primitives are server-component-safe. The only interactive component (`CollapsibleGroup`) lives in `@gemara/react/interactive` and carries a `"use client"` directive in its built output — RSC bundlers route it into the client graph automatically.

## Spec version

This package is pinned to a specific Gemara schema release. The version lives in `.spec-version` at the repo root. Bumping it triggers a regeneration of `src/generated/types.ts` (CI fails on drift).

## License

Apache-2.0. See [LICENSE](./LICENSE).
