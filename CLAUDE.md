# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This repo (`gemara-react`) is one of four sibling projects in the `gemaraproj/` workspace. The parent `../CLAUDE.md` documents the workspace as a whole — how `gemara/` (CUE spec), `go-gemara/` (Go SDK), `gemara-hub/` (deployment stack), and this repo relate. Read that for cross-repo context; this file covers gemara-react specifics only.

## What this package is

`@gemaraproj/gemara-react` — headless React renderers for Gemara artifacts. Server-component-clean by default: no `useState`, no `useEffect`, no `"use client"` in the default renderers. Interactive islands (e.g. `CollapsibleGroup`) live behind a separate subpath export so RSC consumers who don't reach for them never pay the client-bundle cost. Renderers emit semantic HTML with `data-gemara-*` attributes for headless styling; consumers bring their own CSS.

Peer dep is `react >= 18`. The package targets ESM-first with a CJS fallback; `sideEffects: false` and per-renderer subpath exports enable tree-shaking per artifact.

## Common commands

All from this directory:

- `npm test` — vitest run (jsdom, fixtures pulled from `../gemara/test/test-data/`).
- `npm run test:watch` — vitest in watch mode.
- Run a single test file: `npx vitest run tests/ControlCatalog.test.tsx`. Filter by name: `npx vitest run -t "renders the catalog metadata"`.
- `npm run lint` — eslint over `src/`, `tests/`, `scripts/`. Ignores `dist/`, `examples/`, `src/generated/`.
- `npm run typecheck` — `tsc --noEmit`.
- `npm run build` — `tsup` builds ESM + CJS + `.d.ts` for each subpath entry, then re-injects `"use client"` into `dist/interactive/*` (tsup/rollup strips directive prologues during bundling; RSC bundlers require it in the *built* file).
- `npm run generate` — regenerates `src/generated/types.ts` from the Gemara OpenAPI schema. See "Type generation" below.

The Astro example under `examples/astro/` depends on the library via `file:../..` — `npm ci` there expects `dist/` to already exist. CI builds the library first, then `cd examples/astro && npm ci && npm run build`. Replicate that order locally.

## Type generation (critical workflow)

`src/generated/types.ts` is generated and committed. CI regenerates it and **fails on diff** (the `verify-types` job in `.github/workflows/ci.yml`). Workflow:

1. The script (`scripts/generate-types.ts`) resolves the source `openapi.yaml` in this order:
   - `$GEMARA_SPEC_DIR/generated/openapi.yaml` if set
   - `../gemara/generated/openapi.yaml` (default sibling-checkout layout)
   - Future: GitHub release asset for the version in `.spec-version` (not yet implemented upstream)
2. The Gemara repo does **not** commit `generated/openapi.yaml` — its CI explicitly rejects it. Materialize it with `make gendocs` in `../gemara` before running `npm run generate`, then `make cleanup` in `../gemara` to remove it.
3. After `openapi-typescript` runs, a postamble is appended that:
   - Emits the typed `ArtifactType` union (mirrors `gemara/metadata.cue` `#ArtifactType` — keep `ARTIFACT_TYPES` in `scripts/generate-types.ts` in sync if the spec gains a type).
   - Emits narrowed `ControlCatalog` / `GuidanceCatalog` aliases with `metadata.type` pinned to the literal.
   - Restores `reference-id` / `entry-id` on `MultiEntryMapping` / `EntryMapping` — the upstream OpenAPI inlines a partial shape that drops them; the override is intentional and needs to stay until the spec is fixed.
   - Emits the `isControlCatalog` / `isGuidanceCatalog` / `detectArtifactType` runtime guards.

This is the TS analogue of `go-gemara/cmd/typestagger`. Bumping `.spec-version` is how the package adopts a new spec release. Never hand-edit `src/generated/types.ts`.

## Architecture

### Subpath exports drive the tree-shake story

The top-level `index.ts` only re-exports the `provider` + `primitives` + a few generated types/guards. **Renderers are not in the root barrel by design** — consumers import them from subpaths (`@gemaraproj/gemara-react/control-catalog`, `/guidance-catalog`, `/interactive`, etc.) so each artifact renderer is its own bundling unit. The `package.json` `"exports"` map and `tsup.config.ts` `entry` map must stay in sync; adding a new renderer means a new subdir under `src/`, a new entry in both maps, and (if it has any client-only code) the `injectUseClient` post-process step already covers `dist/interactive/*` — anything else that needs `"use client"` would need to be added to that allowlist.

### Compound-component pattern

Each catalog renderer is shipped as a callable with parts attached via `Object.assign`:

```tsx
<ControlCatalog data={catalog} />                  // default composition
<ControlCatalog data={catalog}>                    // DIY composition
  <ControlCatalog.Header data={catalog} />
  <ControlCatalog.Groups data={catalog} />
</ControlCatalog>
```

When `children` is provided, it **takes over** rendering entirely — the root doesn't compose its default body. Parts receive the catalog via props (not context) so they work standalone too.

### Headless contract

Renderers emit semantic HTML with `data-gemara-*` attributes and no styling. The attribute taxonomy is the public API for CSS:
- `data-gemara-artifact="ControlCatalog"` on the root `<article>`.
- `data-gemara-part="header" | "groups" | "group" | "control" | "control-id" | "control-title" | "objective" | "requirements" | "requirement" | "applicability" | "mappings" | "control-list"` for structural slots.
- `data-gemara-control-id`, `data-gemara-group-id`, `data-gemara-requirement-id`, `data-gemara-id` for stable selectors.
- `data-gemara-mappings-label="guidelines" | "threats"` to distinguish mapping sections.
- `data-gemara-ref="artifact" | "entry" | "mapping-reference"` + `data-gemara-ref-id` on resolver output.
- `data-gemara-prose=""` on the wrapper element emitted by the `Prose` primitive (text fields rendered as plain text with `white-space: pre-wrap`).

Tests assert against these attributes; treat them as a stable contract and update tests in lockstep when changing them.

### Link resolution via context

Cross-references go through `GemaraProvider`'s `linkResolver` (`src/provider/GemaraProvider.tsx`). The resolver receives an `ArtifactReference` (`kind: "artifact" | "entry" | "mapping-reference"`, plus `id`, optional `referenceId`, `url`, `relation`) and returns a `ReactElement` — letting consumers slot in their router's `<Link>`, Astro's `<a>`, or anything else. Default behavior: plain `<a>` when `url` is present, inert `<span>` otherwise. The `ArtifactRef` primitive is the only thing renderers call; never construct anchors directly inside a renderer.

`useLinkResolver` uses `useContext` (not `use`) so the API stays callable from React 18 and 19 server components.

### Primitives are the leaf API

`ArtifactRef`, `EntityRef`, `DateTime`, `Prose` are the only leaf components. The v1 contract for catalog text fields (`objective`, `description`, `front-matter`, `recommendations.text`, etc.) is **plain text** — `Prose` renders the string inside the requested element with `white-space: pre-wrap` to preserve authored line breaks. The Gemara CUE schema does not type any of these as Markdown; that's only a convention, so the library makes no parsing promise.

If a consumer eventually needs rich formatting, there are two clean seams: swap `Prose`'s implementation behind the same prop surface (component-level), or pre-render Markdown to sanitized HTML upstream in go-gemara and ship a new field alongside the source (data-level). Either path is deferred until a concrete consumer asks for it.

### Tests load real fixtures

`tests/*.test.tsx` reads YAML fixtures directly from `../gemara/test/test-data/good-*.yaml` and validates them with the runtime guards before rendering. This means tests are tightly coupled to the sibling `../gemara/` checkout being present and at the spec version that matches `.spec-version`. If a fixture rename or shape change in `../gemara/` breaks tests here, that's the signal to either bump `.spec-version` (and regenerate types) or pin the fixture to a path the test owns.

## Conventions worth noting

- All commits must be DCO-signed (`git commit -s`). CI's `dco` job verifies `Signed-off-by:` on every PR commit and matches it against the commit author.
- Never commit `dist/` or `src/generated/openapi.yaml` (the latter isn't generated here, but don't import one into the tree). `src/generated/types.ts` *is* committed and CI enforces it matches the spec.
- `"use client"` is stripped by tsup/rollup during bundling. If a new interactive component lands outside `src/interactive/`, extend `injectUseClient` in `tsup.config.ts` to cover it.
- `noUncheckedIndexedAccess` is on — array element accesses return `T | undefined`. The narrowed catalog types (`ControlCatalog`, `GuidanceCatalog`) and their use of `NonNullable<...>[number]` rely on this; preserve the `?? []` / `??` defaulting patterns when adding new fields.
- ESLint ignores `src/generated/**` — generated code is exempt from the `no-explicit-any` warn rule.
- `peerDependencies: { react: ">=18" }` is deliberate. Don't add features that require React 19 APIs without also bumping the peer range.
