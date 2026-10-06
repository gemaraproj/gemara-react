// SPDX-License-Identifier: Apache-2.0
import type { ComponentType } from "react";
import { FormatTabs, type FormatTab } from "@gemara/react/interactive";
import { GemaraProvider } from "@gemara/react/provider";
import type { ArtifactType } from "@gemara/react";
import { ControlCatalog } from "@gemara/react/control-catalog";
import { GuidanceCatalog } from "@gemara/react/guidance-catalog";
import { PrincipleCatalog } from "@gemara/react/principle-catalog";
import { VectorCatalog } from "@gemara/react/vector-catalog";
import { RiskCatalog } from "@gemara/react/risk-catalog";
import { ThreatCatalog } from "@gemara/react/threat-catalog";
import { CapabilityCatalog } from "@gemara/react/capability-catalog";
import { Policy } from "@gemara/react/policy";
import { Lexicon } from "@gemara/react/lexicon";
import { MappingDocument } from "@gemara/react/mapping-document";
import { AuditLog } from "@gemara/react/audit-log";
import { EnforcementLog } from "@gemara/react/enforcement-log";
import { EvaluationLog } from "@gemara/react/evaluation-log";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Renderer = ComponentType<{ data: any; headingLevel?: number; idPrefix?: string }>;

/**
 * One renderer per artifact type. Importing all thirteen here is fine for a
 * demo; a real page should import only the renderer it needs so the island
 * bundle tree-shakes to that one artifact.
 */
const RENDERERS: Record<ArtifactType, Renderer> = {
  ControlCatalog,
  GuidanceCatalog,
  PrincipleCatalog,
  VectorCatalog,
  RiskCatalog,
  ThreatCatalog,
  CapabilityCatalog,
  Policy,
  Lexicon,
  MappingDocument,
  AuditLog,
  EnforcementLog,
  EvaluationLog,
};

interface Props {
  /** Discriminator from `detectArtifactType`, used to pick the renderer. */
  type: ArtifactType;
  /** Parsed artifact, used for the rendered Preview tab. */
  data: unknown;
  /** The raw source the page already read — no go-gemara round-trip needed. */
  yaml: string;
  /** Markdown projection produced server-side by go-gemara's `ToMarkdown`. */
  markdown?: string;
  /** OSCAL projection produced server-side by go-gemara's `oscalexport`. */
  oscal?: string;
  /** OSCAL Profile emitted alongside the Catalog by `oscalexport guidance`. */
  oscalProfile?: string;
}

/**
 * Composes `FormatTabs` inside a React island.
 *
 * The `preview` tab is a *rendered node*, which can't be passed as a prop
 * across Astro's island boundary — only serializable props survive. So the
 * page hands this wrapper plain data + strings, and the preview element is
 * constructed here, client-side, inside React.
 *
 * Three lessons live in this file, not in the library:
 *  1. `FormatTabs` renders `content` verbatim — any formatting is the
 *     consumer's job. We pretty-print the OSCAL below.
 *  2. The raw YAML tab is just the source string the page already has.
 *  3. The component never converts or validates; go-gemara produced the OSCAL.
 */
export default function MultiFormatViewer({ type, data, yaml, markdown, oscal, oscalProfile }: Props) {
  const Preview = RENDERERS[type];
  const tabs: FormatTab[] = [
    { id: "preview", label: "Preview", preview: <Preview data={data} headingLevel={3} idPrefix="preview-" /> },
    { id: "yaml", label: "YAML", language: "yaml", content: yaml },
  ];
  if (markdown !== undefined) {
    tabs.push({ id: "markdown", label: "Markdown", language: "markdown", content: markdown });
  }
  if (oscal !== undefined) {
    // `JSON.stringify(JSON.parse(x), null, 2)` normalizes a compact API response
    // into indented JSON. It's a no-op on already-indented OSCAL like ours, but
    // shows the idiom for when the string arrives as one flat line from the hub.
    const prettyOscal = JSON.stringify(JSON.parse(oscal), null, 2);
    tabs.push({ id: "oscal", label: "OSCAL", language: "json", content: prettyOscal });
  }
  if (oscalProfile !== undefined) {
    const pretty = JSON.stringify(JSON.parse(oscalProfile), null, 2);
    tabs.push({ id: "oscal-profile", label: "OSCAL Profile", language: "json", content: pretty });
  }

  return (
    <GemaraProvider>
      <FormatTabs aria-label={`${type} formats`} tabs={tabs} />
    </GemaraProvider>
  );
}
