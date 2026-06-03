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
| `@gemara/react/interactive`         | `CollapsibleGroup`, `FormatTabs` (carry `"use client"`) |
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
- `CollapsibleGroup` (interactive) emits `data-gemara-part="collapsible" | "collapsible-trigger" | "collapsible-content"`, plus `data-gemara-open=""` on the wrapper when expanded.
- `FormatTabs` (interactive) emits `data-gemara-part="format-tabs" | "format-tablist" | "format-tab" | "format-panel" | "format-code"`, plus `data-gemara-tab-id` on tabs/panels, `data-gemara-selected=""` on the active tab, and `data-gemara-language` on each code `<pre>`.

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

## Multiple formats: `FormatTabs`

Gemara artifacts can be projected into other formats — `go-gemara`'s `gemaraconv` turns a Control Catalog into OSCAL and Markdown, a Guidance Catalog into an OSCAL Catalog + Profile, an Evaluation Log into SARIF. `FormatTabs` puts a styled **Preview** alongside tabs that show those raw projections as code blocks.

`gemaraconv` is Go, so it can't run in the browser or an RSC render. The component does **no conversion or fetching** — your server produces the format strings (call the hub API, or run go-gemara) and passes them in, and you supply the Preview as a rendered node. That keeps the library decoupled and headless; `FormatTabs` just displays and manages tab state.

```tsx
import { FormatTabs } from "@gemara/react/interactive";
import { ControlCatalog } from "@gemara/react/control-catalog";

<FormatTabs
  aria-label="Catalog formats"
  tabs={[
    { id: "preview",  label: "Preview",  preview: <ControlCatalog data={catalog} /> },
    { id: "yaml",     label: "YAML",     language: "yaml",     content: rawYaml },
    { id: "markdown", label: "Markdown", language: "markdown", content: markdown },
    { id: "oscal",    label: "OSCAL",    language: "json",     content: oscalJson },
  ]}
/>
```

Each tab is either a `preview` node (rendered as-is) or `content` text (rendered in a `<pre><code>` with `data-gemara-language` for your highlighter — the library ships no highlighting). A tab with neither is the seam for loading/empty states: pass `preview={<Spinner />}` while a conversion is still in flight.

**`content` is rendered verbatim — formatting and tab selection are yours.** The component does no conversion, pretty-printing, or validation, so what you pass is exactly what renders:

- **Pretty-print upstream.** A compact OSCAL string from the hub API (`{"catalog":{…}}`) shows as one flat line. Indent it before passing it in: `JSON.stringify(JSON.parse(oscalJson), null, 2)`. go-gemara's `oscalexport` CLI already emits indented JSON; a raw `fetch()` may not.
- **You own which tabs exist.** There's no automatic format discovery. The raw **YAML** tab is just the source string you already parsed — no go-gemara round-trip needed (`content: rawYaml`). Only add an OSCAL or Markdown tab for artifact types that actually have a `gemaraconv` converter; for others, omit the tab.
- **Validation lives upstream**, in go-gemara and the spec — `FormatTabs` will faithfully display malformed input. Use the empty-tab seam (`preview={<ErrorNote />}`) to surface a conversion that failed.

A worked Astro example wiring all three (Preview + raw YAML + pre-converted OSCAL) lives in [`examples/astro/`](./examples/astro/src/components/MultiFormatViewer.tsx).

It implements the ARIA tabs pattern with **automatic activation** — Arrow keys move focus and switch the panel in one step (Left/Right wrap; Home/End jump to first/last). Provide `aria-label` (or `aria-labelledby`) so the tablist has an accessible name — important when several viewers share a page. Because it holds tab state, it lives in `@gemara/react/interactive` and carries `"use client"`.

## React Server Components

The default catalog renderers and all primitives are server-component-safe. The interactive components (`CollapsibleGroup`, `FormatTabs`) live in `@gemara/react/interactive` and carry a `"use client"` directive in their built output — RSC bundlers route them into the client graph automatically.

## Spec version

This package is pinned to a specific Gemara schema release. The version lives in `.spec-version` at the repo root. Bumping it triggers a regeneration of `src/generated/types.ts` (CI fails on drift).

## License

Apache-2.0. See [LICENSE](./LICENSE).
