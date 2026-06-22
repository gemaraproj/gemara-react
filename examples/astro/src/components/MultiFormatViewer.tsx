// SPDX-License-Identifier: Apache-2.0
import { FormatTabs } from "@gemara/react/interactive";
import { ControlCatalog } from "@gemara/react/control-catalog";
import { GemaraProvider } from "@gemara/react/provider";
import type { ControlCatalog as ControlCatalogData } from "@gemara/react/types";

interface Props {
  /** Parsed catalog, used for the rendered Preview tab. */
  data: ControlCatalogData;
  /** The raw source the page already read — no go-gemara round-trip needed. */
  yaml: string;
  /** Markdown projection produced server-side by go-gemara's `ToMarkdown`. */
  markdown: string;
  /** OSCAL projection produced server-side by go-gemara's `oscalexport`. */
  oscal: string;
}

/**
 * Composes `FormatTabs` inside a React island.
 *
 * The `preview` tab is a *rendered node* (`<ControlCatalog />`), which can't be
 * passed as a prop across Astro's island boundary — only serializable props
 * survive. So the page hands this wrapper plain data + strings, and the preview
 * element is constructed here, client-side, inside React.
 *
 * Three lessons live in this file, not in the library:
 *  1. `FormatTabs` renders `content` verbatim — any formatting is the
 *     consumer's job. We pretty-print the OSCAL below.
 *  2. The raw YAML tab is just the source string the page already has.
 *  3. The component never converts or validates; go-gemara produced the OSCAL.
 */
export default function MultiFormatViewer({ data, yaml, markdown, oscal }: Props) {
  // `JSON.stringify(JSON.parse(x), null, 2)` normalizes a compact API response
  // into indented JSON. It's a no-op on already-indented OSCAL like ours, but
  // shows the idiom for when the string arrives as one flat line from the hub.
  const prettyOscal = JSON.stringify(JSON.parse(oscal), null, 2);

  return (
    <GemaraProvider>
      <FormatTabs
        aria-label="Catalog formats"
        tabs={[
          {
            id: "preview",
            label: "Preview",
            preview: <ControlCatalog data={data} headingLevel={3} />,
          },
          { id: "yaml", label: "YAML", language: "yaml", content: yaml },
          { id: "markdown", label: "Markdown", language: "markdown", content: markdown },
          { id: "oscal", label: "OSCAL", language: "json", content: prettyOscal },
        ]}
      />
    </GemaraProvider>
  );
}
