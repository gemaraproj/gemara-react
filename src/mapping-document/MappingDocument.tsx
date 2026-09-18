// SPDX-License-Identifier: Apache-2.0
import type { ReactNode } from "react";
import { ArtifactRef } from "../primitives/ArtifactRef.js";
import { DateTime } from "../primitives/DateTime.js";
import { EntityRef } from "../primitives/EntityRef.js";
import { Prose } from "../primitives/Prose.js";
import { Heading, HeadingScope } from "../primitives/Heading.js";
import type {
  MappingDocument as MappingDocumentData,
  SchemaGroup,
} from "../generated/types.js";

/**
 * Headless MappingDocument renderer (Gemara mapping layer).
 *
 * Server-component-clean: no useState, no useEffect, no "use client". Compound
 * pattern via Object.assign so consumers can either:
 *   <MappingDocument data={doc} />            // default composition
 *   <MappingDocument data={doc}>              // DIY composition
 *     <MappingDocument.Header data={doc} />
 *     <MappingDocument.Mappings data={doc} />
 *   </MappingDocument>
 *
 * Children, if provided, take over rendering entirely.
 */

type Mapping = NonNullable<MappingDocumentData["mappings"]>[number];
type MappingTarget = NonNullable<Mapping["targets"]>[number];
type TypedReference = MappingDocumentData["source-reference"];

/**
 * `#TypedMapping` in CUE extends `#ArtifactMapping` (`reference-id`,
 * `remarks`), but the OpenAPI generator drops the embedded fields, leaving
 * only `entry-type` in the generated type. Real documents carry
 * `reference-id` (the fixture does), so read the embedded fields defensively
 * via a widening cast instead of hand-editing the generated types.
 */
function typedReferenceExtras(
  ref: TypedReference | undefined,
): { "reference-id"?: string; remarks?: string } {
  // Tolerate documents missing the schema-required reference objects so a
  // type-tagged but invalid document renders degraded instead of throwing.
  return (ref ?? {}) as TypedReference & {
    "reference-id"?: string;
    remarks?: string;
  };
}

/**
 * `#Metadata` in CUE has an optional `applicability-groups` list (used by
 * mapping targets' `applicability` values), but the OpenAPI generator drops
 * it from the `Metadata` schema. The fixture carries it and it is central to
 * interpreting per-target applicability, so read it defensively.
 */
function applicabilityGroupsOf(
  metadata: MappingDocumentData["metadata"],
): SchemaGroup[] {
  const widened = metadata as MappingDocumentData["metadata"] & {
    "applicability-groups"?: SchemaGroup[];
  };
  return widened["applicability-groups"] ?? [];
}

/** Look up a mapping-reference's URL by id so refs resolve to real links. */
function referenceUrl(
  data: MappingDocumentData,
  referenceId: string | undefined,
): string | undefined {
  if (!referenceId) return undefined;
  const refs = data.metadata["mapping-references"] ?? [];
  return refs.find((r) => r.id === referenceId)?.url;
}

export interface MappingDocumentProps {
  data: MappingDocumentData;
  /**
   * Heading level (1-6) used for the document title. Nested sections add
   * fixed offsets: section (scope / references / groups / mappings) = +1,
   * individual mapping = +2. Defaults to 1. Set to 2 (or higher) when
   * composing into a host page that already owns the `<h1>`.
   */
  headingLevel?: number;
  children?: ReactNode;
}

function MappingDocumentRoot({
  data,
  headingLevel = 1,
  children,
}: MappingDocumentProps) {
  return (
    <HeadingScope level={headingLevel}>
      <article
        data-gemara-artifact="MappingDocument"
        data-gemara-id={data.metadata.id ?? ""}
      >
        {children ?? (
          <>
            <Header data={data} />
            <MappingReferences data={data} />
            <Scope data={data} />
            <ApplicabilityGroups data={data} />
            <Mappings data={data} />
          </>
        )}
      </article>
    </HeadingScope>
  );
}

interface PartProps {
  data: MappingDocumentData;
}

function Header({ data }: PartProps) {
  const { metadata, title } = data;
  const lexicon = metadata.lexicon;
  return (
    <header data-gemara-part="header">
      {title ? (
        <Heading offset={0} data-gemara-part="title">
          {title}
        </Heading>
      ) : null}
      {metadata.description ? (
        <Prose content={metadata.description} as="p" />
      ) : null}
      <dl data-gemara-part="meta">
        {metadata.id ? (
          <>
            <dt>ID</dt>
            <dd>{metadata.id}</dd>
          </>
        ) : null}
        {metadata.version ? (
          <>
            <dt>Version</dt>
            <dd>{metadata.version}</dd>
          </>
        ) : null}
        {metadata["gemara-version"] ? (
          <>
            <dt>Gemara version</dt>
            <dd>{metadata["gemara-version"]}</dd>
          </>
        ) : null}
        {metadata.date ? (
          <>
            <dt>Date</dt>
            <dd>
              <DateTime value={metadata.date} />
            </dd>
          </>
        ) : null}
        {metadata.author ? (
          <>
            <dt>Author</dt>
            <dd>
              <EntityRef entity={metadata.author} />
            </dd>
          </>
        ) : null}
        {metadata.draft !== undefined ? (
          <>
            <dt>Draft</dt>
            <dd data-gemara-part="draft">{metadata.draft ? "Yes" : "No"}</dd>
          </>
        ) : null}
        {lexicon ? (
          <>
            <dt>Lexicon</dt>
            <dd data-gemara-part="lexicon">
              <ArtifactRef
                kind="artifact"
                id={lexicon["reference-id"] ?? ""}
                url={referenceUrl(data, lexicon["reference-id"])}
                relation="lexicon"
              >
                {lexicon["reference-id"]}
              </ArtifactRef>
              {lexicon.remarks ? <> — {lexicon.remarks}</> : null}
            </dd>
          </>
        ) : null}
      </dl>
    </header>
  );
}

function MappingReferences({ data }: PartProps) {
  const refs = data.metadata["mapping-references"] ?? [];
  if (refs.length === 0) return null;
  return (
    <section data-gemara-part="mapping-references">
      <Heading offset={1}>Mapping references</Heading>
      <ul>
        {refs.map((r) => (
          <li
            key={r.id}
            data-gemara-part="mapping-reference"
            data-gemara-reference-id={r.id ?? ""}
          >
            <ArtifactRef
              kind="mapping-reference"
              id={r.id ?? ""}
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
    </section>
  );
}

interface DirectionRefProps {
  data: MappingDocumentData;
  reference: TypedReference;
  /** Free-form relation forwarded to the link resolver ("source" | "target"). */
  relation: string;
}

function DirectionRef({ data, reference, relation }: DirectionRefProps) {
  const extras = typedReferenceExtras(reference);
  const refId = extras["reference-id"];
  return (
    <>
      {refId ? (
        <ArtifactRef
          kind="mapping-reference"
          id={refId}
          url={referenceUrl(data, refId)}
          relation={relation}
        >
          {refId}
        </ArtifactRef>
      ) : null}{" "}
      {reference["entry-type"] ? (
        <span data-gemara-part="entry-type">
          ({reference["entry-type"]} entries)
        </span>
      ) : null}
      {extras.remarks ? <> — {extras.remarks}</> : null}
    </>
  );
}

function Scope({ data }: PartProps) {
  // `source-reference` / `target-reference` are schema-required, but render
  // each entry only when present so an invalid document degrades gracefully.
  const source: TypedReference | undefined = data["source-reference"];
  const target: TypedReference | undefined = data["target-reference"];
  return (
    <section data-gemara-part="scope">
      <Heading offset={1}>Scope</Heading>
      <dl>
        {source ? (
          <>
            <dt>Source</dt>
            <dd data-gemara-part="source-reference">
              <DirectionRef data={data} reference={source} relation="source" />
            </dd>
          </>
        ) : null}
        {target ? (
          <>
            <dt>Target</dt>
            <dd data-gemara-part="target-reference">
              <DirectionRef data={data} reference={target} relation="target" />
            </dd>
          </>
        ) : null}
      </dl>
      {data.remarks ? (
        <div data-gemara-part="remarks">
          <Prose content={data.remarks} as="p" />
        </div>
      ) : null}
    </section>
  );
}

function ApplicabilityGroups({ data }: PartProps) {
  const groups = applicabilityGroupsOf(data.metadata);
  if (groups.length === 0) return null;
  return (
    <section data-gemara-part="applicability-groups">
      <Heading offset={1}>Applicability groups</Heading>
      <dl>
        {groups.map((g) => (
          <div
            key={g.id}
            data-gemara-part="applicability-group"
            data-gemara-group-id={g.id ?? ""}
          >
            <dt>{g.title}</dt>
            <dd>
              {g.description ? <Prose content={g.description} as="div" /> : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Mappings({ data }: PartProps) {
  const mappings = data.mappings ?? [];
  const sourceReferenceId = typedReferenceExtras(data["source-reference"])[
    "reference-id"
  ];
  const targetReferenceId = typedReferenceExtras(data["target-reference"])[
    "reference-id"
  ];
  return (
    <section data-gemara-part="mappings">
      <Heading offset={1}>Mappings</Heading>
      {mappings.length === 0 ? (
        <p data-gemara-empty="mappings">No mappings in this document.</p>
      ) : (
        <ol data-gemara-part="mapping-list">
          {mappings.map((m) => (
            <li key={m.id}>
              <MappingView
                mapping={m}
                sourceReferenceId={sourceReferenceId}
                targetReferenceId={targetReferenceId}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

interface MappingViewProps {
  mapping: Mapping;
  /** The document's source-reference id, forwarded to entry refs. */
  sourceReferenceId?: string;
  /** The document's target-reference id, forwarded to entry refs. */
  targetReferenceId?: string;
}

function MappingView({
  mapping,
  sourceReferenceId,
  targetReferenceId,
}: MappingViewProps) {
  const targets = mapping.targets ?? [];
  return (
    <article
      data-gemara-part="mapping"
      data-gemara-mapping-id={mapping.id ?? ""}
      data-gemara-relationship={mapping.relationship ?? ""}
      id={mapping.id ? `mapping-${mapping.id}` : undefined}
    >
      <header>
        <Heading offset={2}>
          <span data-gemara-part="mapping-source">
            <ArtifactRef
              kind="entry"
              id={mapping.source ?? ""}
              referenceId={sourceReferenceId}
              relation="source"
            >
              {mapping.source}
            </ArtifactRef>
          </span>{" "}
          <span data-gemara-part="relationship">{mapping.relationship}</span>
        </Heading>
      </header>
      {mapping.remarks ? (
        <div data-gemara-part="remarks">
          <Prose content={mapping.remarks} as="p" />
        </div>
      ) : null}
      {targets.length > 0 ? (
        <ul data-gemara-part="mapping-targets">
          {targets.map((t, i) => (
            <li key={`${t["entry-id"] ?? "target"}-${i}`}>
              <TargetView target={t} targetReferenceId={targetReferenceId} />
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

interface TargetViewProps {
  target: MappingTarget;
  /** The document's target-reference id, forwarded to entry refs. */
  targetReferenceId?: string;
}

function TargetView({ target, targetReferenceId }: TargetViewProps) {
  return (
    <div
      data-gemara-part="mapping-target"
      data-gemara-entry-id={target["entry-id"] ?? ""}
    >
      <ArtifactRef
        kind="entry"
        id={target["entry-id"] ?? ""}
        referenceId={targetReferenceId}
        relation="target"
      >
        {target["entry-id"]}
      </ArtifactRef>
      {target.strength ? (
        <>
          {" — "}
          <span data-gemara-part="strength">
            Strength: {target.strength}/10
          </span>
        </>
      ) : null}
      {target["confidence-level"] ? (
        <>
          {" — "}
          <span
            data-gemara-part="confidence-level"
            data-gemara-confidence={target["confidence-level"]}
          >
            Confidence: {target["confidence-level"]}
          </span>
        </>
      ) : null}
      {target.applicability && target.applicability.length > 0 ? (
        <p data-gemara-part="applicability">
          Applicability: {target.applicability.join(", ")}
        </p>
      ) : null}
      {target.rationale ? (
        <div data-gemara-part="rationale">
          <Prose content={target.rationale} as="p" />
        </div>
      ) : null}
      {target.remarks ? (
        <div data-gemara-part="remarks">
          <Prose content={target.remarks} as="p" />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Compound API. Object.assign keeps the default top-level renderer callable
 * as `<MappingDocument>` while still exposing parts at `<MappingDocument.X>`.
 */
export const MappingDocument = Object.assign(MappingDocumentRoot, {
  Header,
  MappingReferences,
  Scope,
  ApplicabilityGroups,
  Mappings,
  Mapping: MappingView,
  Target: TargetView,
});
