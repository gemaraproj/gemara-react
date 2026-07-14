// SPDX-License-Identifier: Apache-2.0
import type { ReactNode } from "react";
import { ArtifactRef } from "../primitives/ArtifactRef.js";
import { DateTime } from "../primitives/DateTime.js";
import { EntityRef } from "../primitives/EntityRef.js";
import { Prose } from "../primitives/Prose.js";
import { Heading, HeadingScope } from "../primitives/Heading.js";
import type {
  EnforcementLog as EnforcementLogData,
  Schemas,
} from "../generated/types.js";

/**
 * Headless EnforcementLog renderer (Gemara Layer 6).
 *
 * Server-component-clean: no useState, no useEffect, no "use client". Compound
 * pattern via Object.assign so consumers can either:
 *   <EnforcementLog data={log} />            // default composition
 *   <EnforcementLog data={log}>              // DIY composition
 *     <EnforcementLog.Header data={log} />
 *     <EnforcementLog.Actions data={log} />
 *   </EnforcementLog>
 *
 * Children, if provided, take over rendering entirely.
 */

type ActionResult = EnforcementLogData["actions"][number];
type Justification = ActionResult["justification"];
type AssessmentFinding = NonNullable<Justification["assessments"]>[number];
type EntryMapping = Schemas["EntryMapping"];
type ArtifactMapping = Schemas["ArtifactMapping"];
type MappingReference = Schemas["MappingReference"];

/**
 * The OpenAPI generator drops CUE embeds and conditionally-constrained fields:
 *  - `#Resource` embeds `#Entity` (id/name/type/uri/version/description), but
 *    the generated `Resource` keeps only `environment`/`owner`.
 *  - `#Metadata`'s optional `mapping-references` (guarded by a CUE `if` for
 *    id uniqueness) is elided from the generated `Metadata`.
 * Real documents carry these fields (see
 * ../gemara/test/test-data/good-enforcement-log.yaml), so widen locally and
 * read them defensively — every widened field stays optional.
 */
type TargetResource = Schemas["Resource"] &
  Partial<
    Pick<
      Schemas["Entity"],
      "id" | "name" | "type" | "uri" | "version" | "description"
    >
  >;
type MetadataWithRefs = EnforcementLogData["metadata"] & {
  "mapping-references"?: MappingReference[];
};

export interface EnforcementLogProps {
  data: EnforcementLogData;
  /**
   * Heading level (1-6) used as the base for the log's sections. Nested
   * sections add fixed offsets: Target/Actions = +1, each action = +2, action
   * subsections (Steps, Justification) = +3, Exceptions = +4. Defaults to 1.
   * Set to 2 (or higher) when composing into a host page that already owns
   * the `<h1>`.
   */
  headingLevel?: number;
  children?: ReactNode;
}

function EnforcementLogRoot({ data, headingLevel = 1, children }: EnforcementLogProps) {
  return (
    <HeadingScope level={headingLevel}>
      <article
        data-gemara-artifact="EnforcementLog"
        data-gemara-id={data.metadata.id ?? ""}
        data-gemara-disposition={data.disposition ?? ""}
      >
        {children ?? (
          <>
            <Header data={data} />
            <Disposition data={data} />
            <Target data={data} />
            <Actions data={data} />
          </>
        )}
      </article>
    </HeadingScope>
  );
}

interface SectionProps {
  data: EnforcementLogData;
}

function Header({ data }: SectionProps) {
  // Defensive widening: metadata["mapping-references"] exists in real
  // documents but is dropped by the OpenAPI generator (see MetadataWithRefs).
  const metadata = data.metadata as MetadataWithRefs;
  const mappingReferences = metadata["mapping-references"] ?? [];
  return (
    <header data-gemara-part="header">
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
        {metadata.lexicon ? (
          <>
            <dt>Lexicon</dt>
            <dd data-gemara-part="lexicon">
              <ArtifactRef
                kind="artifact"
                id={metadata.lexicon["reference-id"] ?? ""}
                relation="lexicon"
              />
              {metadata.lexicon.remarks ? <> — {metadata.lexicon.remarks}</> : null}
            </dd>
          </>
        ) : null}
      </dl>
      {mappingReferences.length > 0 ? (
        <References mappingReferences={mappingReferences} />
      ) : null}
    </header>
  );
}

interface ReferencesProps {
  mappingReferences: MappingReference[];
}

/**
 * Document-level mapping references, collapsed by default via an uncontrolled
 * native <details> — same pattern as the catalog renderers' per-entry
 * references, so it stays server-component-clean.
 */
function References({ mappingReferences }: ReferencesProps) {
  return (
    <details data-gemara-part="references">
      <summary data-gemara-part="references-summary">
        References to Other Documents
      </summary>
      <ul data-gemara-part="mapping-references">
        {mappingReferences.map((r, i) => (
          <li
            key={`${r.id ?? "ref"}-${i}`}
            data-gemara-part="mapping-reference"
          >
            <ArtifactRef
              kind="mapping-reference"
              id={r.id ?? ""}
              url={r.url}
              relation="mapping-reference"
            >
              {r.title ?? r.id}
            </ArtifactRef>
            {r.version ? <> (version {r.version})</> : null}
            {r.description ? <Prose content={r.description} as="p" /> : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

function Disposition({ data }: SectionProps) {
  if (!data.disposition) return null;
  return (
    <p
      data-gemara-part="disposition"
      data-gemara-disposition={data.disposition}
    >
      Disposition: {data.disposition}
    </p>
  );
}

function Target({ data }: SectionProps) {
  // Defensive widening: the #Entity embed (id/name/type/uri/…) is dropped by
  // the generator (see TargetResource). `target` itself is optional because
  // the generator also drops the #Log embed — restored optional upstream.
  const target = data.target as TargetResource | undefined;
  if (!target) return null;
  const owner = target.owner;
  return (
    <section data-gemara-part="target" data-gemara-target-id={target.id ?? ""}>
      <Heading offset={1}>Target</Heading>
      <p>
        <EntityRef entity={target} />
      </p>
      {target.description ? <Prose content={target.description} as="p" /> : null}
      <dl data-gemara-part="target-meta">
        {target.version ? (
          <>
            <dt>Version</dt>
            <dd>{target.version}</dd>
          </>
        ) : null}
        {target.uri ? (
          <>
            <dt>URI</dt>
            <dd>
              <ArtifactRef
                kind="artifact"
                id={target.id ?? target.name ?? ""}
                url={target.uri}
                relation="target"
              >
                {target.uri}
              </ArtifactRef>
            </dd>
          </>
        ) : null}
        {target.environment ? (
          <>
            <dt>Environment</dt>
            <dd data-gemara-part="target-environment">{target.environment}</dd>
          </>
        ) : null}
        {owner ? (
          <>
            <dt>Owner</dt>
            <dd data-gemara-part="target-owner">
              {owner.name}
              {owner.affiliation ? <> ({owner.affiliation})</> : null}
              {owner.email ? <> · {owner.email}</> : null}
              {owner.social ? <> · {owner.social}</> : null}
            </dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}

function Actions({ data }: SectionProps) {
  const actions = data.actions ?? [];
  return (
    <section data-gemara-part="actions">
      <Heading offset={1}>Actions</Heading>
      {actions.length === 0 ? (
        <p data-gemara-empty="actions">No enforcement actions recorded.</p>
      ) : (
        <ol data-gemara-part="action-list">
          {actions.map((a, i) => (
            <li key={`${a.method?.["entry-id"] ?? "action"}-${i}`}>
              <ActionView action={a} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

interface ActionViewProps {
  action: ActionResult;
}

function ActionView({ action }: ActionViewProps) {
  const steps = action.steps ?? [];
  return (
    <article
      data-gemara-part="action"
      data-gemara-disposition={action.disposition ?? ""}
    >
      <header>
        <Heading offset={2}>
          <span data-gemara-part="action-disposition">{action.disposition}</span>
        </Heading>
      </header>
      {action.message ? (
        <div data-gemara-part="action-message">
          <Prose content={action.message} as="p" />
        </div>
      ) : null}
      <dl data-gemara-part="action-meta">
        {action.method ? (
          <>
            <dt>Method</dt>
            <dd data-gemara-part="action-method">
              <EntryRef mapping={action.method} relation="method" />
            </dd>
          </>
        ) : null}
        {action.start ? (
          <>
            <dt>Started</dt>
            <dd>
              <DateTime value={action.start} />
            </dd>
          </>
        ) : null}
        {action.end ? (
          <>
            <dt>Ended</dt>
            <dd>
              <DateTime value={action.end} />
            </dd>
          </>
        ) : null}
      </dl>
      {steps.length > 0 ? (
        <section data-gemara-part="action-steps">
          <Heading offset={3}>Steps</Heading>
          <ol>
            {steps.map((s, i) => (
              <li key={`${s}-${i}`} data-gemara-part="action-step">
                <code>{s}</code>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {action.justification ? (
        <JustificationView justification={action.justification} />
      ) : null}
    </article>
  );
}

interface JustificationViewProps {
  justification: Justification;
}

function JustificationView({ justification }: JustificationViewProps) {
  const assessments = justification.assessments ?? [];
  const exceptions = justification.exceptions ?? [];
  return (
    <section data-gemara-part="justification">
      <Heading offset={3}>Justification</Heading>
      {assessments.length > 0 ? (
        <ul data-gemara-part="assessments">
          {assessments.map((f, i) => (
            <AssessmentFindingView key={i} finding={f} />
          ))}
        </ul>
      ) : null}
      {exceptions.length > 0 ? (
        <section data-gemara-part="exceptions">
          <Heading offset={4}>Exceptions</Heading>
          <ul>
            {exceptions.map((e, i) => (
              <ExceptionView key={`${e["reference-id"] ?? "exception"}-${i}`} exception={e} />
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

interface AssessmentFindingViewProps {
  finding: AssessmentFinding;
}

function AssessmentFindingView({ finding }: AssessmentFindingViewProps) {
  return (
    <li data-gemara-part="assessment" data-gemara-result={finding.result ?? ""}>
      <span data-gemara-part="assessment-result">{finding.result}</span>
      <dl>
        {finding.requirement ? (
          <>
            <dt>Requirement</dt>
            <dd data-gemara-part="assessment-requirement">
              <EntryRef mapping={finding.requirement} relation="requirement" />
            </dd>
          </>
        ) : null}
        {finding.plan ? (
          <>
            <dt>Plan</dt>
            <dd data-gemara-part="assessment-plan">
              <EntryRef mapping={finding.plan} relation="plan" />
            </dd>
          </>
        ) : null}
        {finding.log ? (
          <>
            <dt>Log</dt>
            <dd data-gemara-part="assessment-log">
              <EntryRef mapping={finding.log} relation="log" />
            </dd>
          </>
        ) : null}
      </dl>
    </li>
  );
}

interface ExceptionViewProps {
  exception: ArtifactMapping;
}

function ExceptionView({ exception }: ExceptionViewProps) {
  return (
    <li data-gemara-part="exception">
      <ArtifactRef
        kind="mapping-reference"
        id={exception["reference-id"] ?? ""}
        relation="exception"
      />
      {exception.remarks ? <Prose content={exception.remarks} as="p" /> : null}
    </li>
  );
}

interface EntryRefProps {
  mapping: EntryMapping;
  relation: string;
}

/**
 * Inline EntryMapping: entry-id resolved via the link resolver, with the
 * parent reference-id rendered after it for context.
 */
function EntryRef({ mapping, relation }: EntryRefProps) {
  return (
    <>
      <ArtifactRef
        kind="entry"
        id={mapping["entry-id"] ?? ""}
        referenceId={mapping["reference-id"]}
        relation={relation}
      >
        {mapping["entry-id"]}
      </ArtifactRef>
      {mapping["reference-id"] ? <> ({mapping["reference-id"]})</> : null}
    </>
  );
}

/**
 * Compound API. Object.assign keeps the default top-level renderer callable
 * as `<EnforcementLog>` while still exposing parts at `<EnforcementLog.X>`.
 */
export const EnforcementLog = Object.assign(EnforcementLogRoot, {
  Header,
  References,
  Disposition,
  Target,
  Actions,
  Action: ActionView,
  Justification: JustificationView,
});
