// SPDX-License-Identifier: Apache-2.0
import { ArtifactRef } from "./ArtifactRef.js";
import { Prose } from "./Prose.js";
import type { Metadata, MultiEntryMapping, Schemas } from "../generated/types.js";

/** Resolve a reference-id to the url declared in `metadata["mapping-references"]`. */
export function mappingReferenceUrl(
  refs: Schemas["MappingReference"][] | undefined,
  id: string | undefined,
): string | undefined {
  if (!id) return undefined;
  return refs?.find((r) => r.id === id)?.url;
}

export interface DocumentReferencesProps {
  data: {
    metadata: Pick<Metadata, "lexicon" | "mapping-references">;
    extends?: Schemas["ArtifactMapping"][];
    imports?: MultiEntryMapping[];
  };
}

/**
 * Document-level cross-references: `metadata.lexicon`, top-level `extends` /
 * `imports`, and the `metadata["mapping-references"]` bibliography. Every
 * reference-id resolves to its mapping-reference url so the link resolver can
 * turn declared dependencies into navigation. Renders nothing when the
 * document declares none of them.
 */
export function DocumentReferences({ data }: DocumentReferencesProps) {
  const { metadata } = data;
  const refs = metadata["mapping-references"] ?? [];
  const extended = data.extends ?? [];
  const imports = data.imports ?? [];
  if (
    !metadata.lexicon &&
    refs.length === 0 &&
    extended.length === 0 &&
    imports.length === 0
  ) {
    return null;
  }
  return (
    <details data-gemara-part="document-references">
      <summary data-gemara-part="document-references-summary">
        References to Other Documents
      </summary>
      {metadata.lexicon ? (
        <p data-gemara-part="lexicon">
          Lexicon:{" "}
          <ArtifactRef
            kind="artifact"
            id={metadata.lexicon["reference-id"] ?? ""}
            url={mappingReferenceUrl(refs, metadata.lexicon["reference-id"])}
            relation="lexicon"
          />
          {metadata.lexicon.remarks ? <> — {metadata.lexicon.remarks}</> : null}
        </p>
      ) : null}
      {extended.length > 0 ? (
        <ul data-gemara-part="document-extends">
          {extended.map((e, i) => (
            <li
              key={`${e["reference-id"]}-${i}`}
              data-gemara-part="extends-ref"
              data-gemara-reference-id={e["reference-id"]}
            >
              <ArtifactRef
                kind="artifact"
                id={e["reference-id"]}
                url={mappingReferenceUrl(refs, e["reference-id"])}
                relation="extends"
              />
              {e.remarks ? <> — {e.remarks}</> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {imports.length > 0 ? (
        <ul data-gemara-part="document-imports">
          {imports.map((imp, i) => (
            <li
              key={`${imp["reference-id"] ?? "import"}-${i}`}
              data-gemara-part="import"
              data-gemara-import-id={imp["reference-id"] ?? ""}
            >
              <ArtifactRef
                kind="artifact"
                id={imp["reference-id"] ?? ""}
                url={mappingReferenceUrl(refs, imp["reference-id"])}
                relation="imports"
              />
              {imp.remarks ? <> — {imp.remarks}</> : null}
              {imp.entries && imp.entries.length > 0 ? (
                <ul>
                  {imp.entries.map((entry, j) => (
                    <li
                      key={`${entry["entry-id"] ?? "entry"}-${j}`}
                      data-gemara-entry-id={entry["entry-id"] ?? ""}
                    >
                      <ArtifactRef
                        kind="entry"
                        id={entry["entry-id"] ?? ""}
                        referenceId={imp["reference-id"]}
                        url={mappingReferenceUrl(refs, imp["reference-id"])}
                        relation="imports"
                      />
                      {entry.remarks ? <> — {entry.remarks}</> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {refs.length > 0 ? (
        <ul data-gemara-part="mapping-references">
          {refs.map((r) => (
            <li
              key={r.id}
              data-gemara-part="mapping-reference"
              data-gemara-reference-id={r.id}
            >
              <ArtifactRef
                kind="mapping-reference"
                id={r.id}
                url={r.url}
                relation="mapping-reference"
              >
                {r.title}
              </ArtifactRef>{" "}
              {r.version ? (
                <span data-gemara-part="reference-version">
                  (version {r.version})
                </span>
              ) : null}
              {r.description ? <Prose content={r.description} as="p" /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </details>
  );
}
