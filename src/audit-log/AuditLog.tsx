// SPDX-License-Identifier: Apache-2.0
import { Fragment, type ReactNode } from "react";
import { ArtifactRef } from "../primitives/ArtifactRef.js";
import { DateTime } from "../primitives/DateTime.js";
import { EntityRef } from "../primitives/EntityRef.js";
import { Prose } from "../primitives/Prose.js";
import { Heading, HeadingScope } from "../primitives/Heading.js";
import { mappingReferenceUrl } from "../primitives/DocumentReferences.js";
import type {
  AuditLog as AuditLogData,
  MultiEntryMapping,
  Schemas,
} from "../generated/types.js";

/**
 * Headless AuditLog renderer (Gemara Layer 4).
 *
 * Server-component-clean: no useState, no useEffect, no "use client". Compound
 * pattern via Object.assign so consumers can either:
 *   <AuditLog data={log} />                  // default composition
 *   <AuditLog data={log}>                    // DIY composition
 *     <AuditLog.Header data={log} />
 *     <AuditLog.Results data={log} />
 *   </AuditLog>
 *
 * Children, if provided, take over rendering entirely.
 */

type AuditResult = AuditLogData["results"][number];
type Evidence = NonNullable<AuditResult["evidence"]>[number];
type Recommendation = NonNullable<AuditResult["recommendations"]>[number];
type Contact = Schemas["Contact"];

/**
 * The OpenAPI generator drops the `#Entity` embed on `Resource`
 * (id/name/type/version/description/uri) — same collapse as the restored
 * `#Log.target`. Widen locally and read every field defensively; real
 * documents (e.g. good-audit-log.yaml) carry all of these.
 */
type TargetResource = Schemas["Resource"] & {
  id?: string;
  name?: string;
  type?: string;
  version?: string;
  description?: string;
  uri?: string;
};

/**
 * `Recommendation.required` is `*false | bool` in CUE but the OpenAPI
 * generator emits it as `string`; loaded YAML carries a real boolean. Accept
 * both without trusting either.
 */
function isRequired(value: unknown): boolean {
  return value === true || value === "true";
}

export interface AuditLogProps {
  data: AuditLogData;
  /**
   * Heading level (1-6) used for the log title. Nested sections add fixed
   * offsets: top-level section (target, owner, summary, criteria, results,
   * referenced documents) = +1, result = +2, result subsection labels
   * (evidence, recommendations, mappings) = +3. Defaults to 1. Set to 2 (or
   * higher) when composing into a host page that already owns the `<h1>`.
   */
  headingLevel?: number;
  children?: ReactNode;
}

function AuditLogRoot({ data, headingLevel = 1, children }: AuditLogProps) {
  return (
    <HeadingScope level={headingLevel}>
      <article data-gemara-artifact="AuditLog" data-gemara-id={data.metadata.id ?? ""}>
        {children ?? (
          <>
            <Header data={data} />
            <Target data={data} />
            <Owner data={data} />
            <Summary data={data} />
            <Criteria data={data} />
            <Results data={data} />
            <MappingReferences data={data} />
          </>
        )}
      </article>
    </HeadingScope>
  );
}

interface PartProps {
  data: AuditLogData;
}

function Header({ data }: PartProps) {
  const { metadata } = data;
  return (
    <header data-gemara-part="header">
      {/* Logs carry no `title` field; the artifact-type label keeps the
          document outline intact under the consumer's headingLevel. */}
      <Heading offset={0} data-gemara-part="title">
        Audit Log
      </Heading>
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
                url={mappingReferenceUrl(
                  metadata["mapping-references"],
                  metadata.lexicon["reference-id"],
                )}
                relation="lexicon"
              />
              {metadata.lexicon.remarks ? <> — {metadata.lexicon.remarks}</> : null}
            </dd>
          </>
        ) : null}
      </dl>
    </header>
  );
}

function Target({ data }: PartProps) {
  const target: TargetResource | undefined = data.target;
  if (!target) return null;
  return (
    <section data-gemara-part="target">
      <Heading offset={1}>Target</Heading>
      <dl>
        {target.name || target.id ? (
          <>
            <dt>Resource</dt>
            <dd>
              <EntityRef entity={target} />
            </dd>
          </>
        ) : null}
        {target.type ? (
          <>
            <dt>Type</dt>
            <dd>{target.type}</dd>
          </>
        ) : null}
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
                id={target.id ?? target.uri}
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
            <dd data-gemara-part="environment">{target.environment}</dd>
          </>
        ) : null}
        {target.owner ? (
          <>
            <dt>Owner</dt>
            <dd>
              <ContactView contact={target.owner} />
            </dd>
          </>
        ) : null}
      </dl>
      {target.description ? <Prose content={target.description} as="p" /> : null}
    </section>
  );
}

const RACI_ROLES = [
  ["responsible", "Responsible"],
  ["accountable", "Accountable"],
  ["consulted", "Consulted"],
  ["informed", "Informed"],
] as const;

function Owner({ data }: PartProps) {
  const owner = data.owner;
  if (!owner) return null;
  return (
    <section data-gemara-part="owner">
      <Heading offset={1}>Ownership</Heading>
      <dl>
        {RACI_ROLES.map(([key, label]) => {
          const contacts = owner[key] ?? [];
          if (contacts.length === 0) return null;
          return (
            <Fragment key={key}>
              <dt>{label}</dt>
              <dd data-gemara-part="raci-role" data-gemara-raci-role={key}>
                <ul>
                  {contacts.map((c, i) => (
                    <li key={`${c.name ?? "contact"}-${i}`}>
                      <ContactView contact={c} />
                    </li>
                  ))}
                </ul>
              </dd>
            </Fragment>
          );
        })}
      </dl>
    </section>
  );
}

interface ContactViewProps {
  contact: Contact;
}

function ContactView({ contact }: ContactViewProps) {
  return (
    <span data-gemara-part="contact">
      <EntityRef entity={{ name: contact.name }} />
      {contact.affiliation ? (
        <span data-gemara-part="contact-affiliation"> ({contact.affiliation})</span>
      ) : null}
      {contact.email ? (
        <span data-gemara-part="contact-email"> · {contact.email}</span>
      ) : null}
      {contact.social ? (
        <span data-gemara-part="contact-social"> · {contact.social}</span>
      ) : null}
    </span>
  );
}

function Summary({ data }: PartProps) {
  if (!data.summary) return null;
  return (
    <section data-gemara-part="summary">
      <Heading offset={1}>Summary</Heading>
      <Prose content={data.summary} as="p" />
    </section>
  );
}

function Criteria({ data }: PartProps) {
  const criteria = data.criteria ?? [];
  if (criteria.length === 0) return null;
  return (
    <section data-gemara-part="criteria">
      <Heading offset={1}>Criteria</Heading>
      <ul>
        {criteria.map((c, i) => (
          <li key={`${c["reference-id"] ?? "criterion"}-${i}`} data-gemara-part="criterion">
            <ArtifactRef
              kind="artifact"
              id={c["reference-id"] ?? ""}
              url={mappingReferenceUrl(
                data.metadata["mapping-references"],
                c["reference-id"],
              )}
              relation="criteria"
            />
            {c.remarks ? <> — {c.remarks}</> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Results({ data }: PartProps) {
  const results = data.results ?? [];
  return (
    <section data-gemara-part="results">
      <Heading offset={1}>Results</Heading>
      {results.length === 0 ? (
        <p data-gemara-empty="results">No results recorded.</p>
      ) : (
        <ol data-gemara-part="result-list">
          {results.map((r) => (
            <li key={r.id}>
              <ResultView result={r} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

interface ResultViewProps {
  result: AuditResult;
}

function ResultView({ result }: ResultViewProps) {
  return (
    <article
      data-gemara-part="result"
      data-gemara-result-id={result.id ?? ""}
      data-gemara-result-type={result.type ?? ""}
      id={result.id ? `result-${result.id}` : undefined}
    >
      <header>
        <Heading offset={2}>
          <span data-gemara-part="result-id">{result.id}</span>
          {result.title ? (
            <>
              {" "}
              <span data-gemara-part="result-title">{result.title}</span>
            </>
          ) : null}
        </Heading>
        {result.type ? <p data-gemara-part="result-type">{result.type}</p> : null}
      </header>
      {result.description ? (
        <section data-gemara-part="description">
          <Prose content={result.description} as="p" />
        </section>
      ) : null}
      {result.evidence && result.evidence.length > 0 ? (
        <EvidenceList evidence={result.evidence} />
      ) : null}
      {result.recommendations && result.recommendations.length > 0 ? (
        <Recommendations recommendations={result.recommendations} />
      ) : null}
      {result["criteria-reference"] ? (
        <References>
          <Mappings label="Criteria" mappings={[result["criteria-reference"]]} />
        </References>
      ) : null}
    </article>
  );
}

interface EvidenceListProps {
  evidence: Evidence[];
}

function EvidenceList({ evidence }: EvidenceListProps) {
  return (
    <section data-gemara-part="evidence">
      <Heading offset={3}>Evidence</Heading>
      <ul>
        {evidence.map((e, i) => (
          <li
            key={`${e.id ?? "evidence"}-${i}`}
            data-gemara-part="evidence-item"
            data-gemara-evidence-id={e.id ?? ""}
            data-gemara-evidence-type={e.type ?? ""}
          >
            <p>
              {e.id ? (
                <>
                  <span data-gemara-part="evidence-id">{e.id}</span>
                  {" — "}
                </>
              ) : null}
              <span data-gemara-part="evidence-type">{e.type}</span>
            </p>
            {e.description ? <Prose content={e.description} as="p" /> : null}
            {e["collected-at"] ? (
              <p data-gemara-part="evidence-collected">
                Collected: <DateTime value={e["collected-at"]} />
              </p>
            ) : null}
            {e.payload !== undefined && e.payload !== null ? (
              <pre data-gemara-part="evidence-payload">
                {typeof e.payload === "string"
                  ? e.payload
                  : JSON.stringify(e.payload, null, 2)}
              </pre>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

interface RecommendationsProps {
  recommendations: Recommendation[];
}

function Recommendations({ recommendations }: RecommendationsProps) {
  return (
    <section data-gemara-part="recommendations">
      <Heading offset={3}>Recommendations</Heading>
      <ul>
        {recommendations.map((r, i) => {
          const required = isRequired(r.required);
          return (
            <li
              key={`${r.id ?? "rec"}-${i}`}
              data-gemara-part="recommendation"
              data-gemara-recommendation-id={r.id ?? ""}
              data-gemara-required={required ? "true" : "false"}
            >
              {r.id ? (
                <p data-gemara-part="recommendation-id">{r.id}</p>
              ) : null}
              <Prose content={r.text} as="p" />
              {required ? <p data-gemara-part="required">Required</p> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function References({ children }: { children: ReactNode }) {
  return (
    <details data-gemara-part="references">
      <summary data-gemara-part="references-summary">
        References to Other Documents
      </summary>
      {children}
    </details>
  );
}

interface MappingsProps {
  label: string;
  mappings: MultiEntryMapping[];
}

function Mappings({ label, mappings }: MappingsProps) {
  return (
    <section data-gemara-part="mappings" data-gemara-mappings-label={label.toLowerCase()}>
      <Heading offset={3}>{label}</Heading>
      <ul>
        {mappings.map((m, i) => (
          <li key={`${m["reference-id"] ?? "ref"}-${i}`}>
            <strong>{m["reference-id"]}</strong>
            {m.remarks ? <> — {m.remarks}</> : null}
            {m.entries && m.entries.length > 0 ? (
              <ul>
                {m.entries.map((e, j) => {
                  // Inner MultiEntryMapping entries are #ArtifactMapping, which
                  // carries `reference-id`. The postamble keeps `entry-id` as a
                  // forward-looking field; prefer it, fall back to today's shape.
                  const entryId = e["entry-id"] ?? e["reference-id"];
                  return (
                    <li key={`${entryId ?? "entry"}-${j}`}>
                      <ArtifactRef
                        kind="entry"
                        id={entryId ?? ""}
                        referenceId={m["reference-id"]}
                        relation={label.toLowerCase()}
                      >
                        {entryId}
                      </ArtifactRef>
                      {e.remarks ? <> — {e.remarks}</> : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function MappingReferences({ data }: PartProps) {
  const { metadata } = data;
  const refs = metadata["mapping-references"] ?? [];
  if (refs.length === 0) return null;
  return (
    <section data-gemara-part="mapping-references">
      <Heading offset={1}>Referenced documents</Heading>
      <ul>
        {refs.map((r, i) => (
          <li
            key={`${r.id ?? "ref"}-${i}`}
            data-gemara-part="mapping-reference"
            data-gemara-reference-id={r.id ?? ""}
          >
            <ArtifactRef kind="mapping-reference" id={r.id ?? ""} url={r.url}>
              {r.title ?? r.id}
            </ArtifactRef>
            {r.version ? (
              <span data-gemara-part="reference-version"> ({r.version})</span>
            ) : null}
            {r.description ? <Prose content={r.description} as="p" /> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Compound API. Object.assign keeps the default top-level renderer callable
 * as `<AuditLog>` while still exposing parts at `<AuditLog.X>`.
 */
export const AuditLog = Object.assign(AuditLogRoot, {
  Header,
  Target,
  Owner,
  Summary,
  Criteria,
  Results,
  Result: ResultView,
  Evidence: EvidenceList,
  Recommendations,
  References,
  Mappings,
  MappingReferences,
  Contact: ContactView,
});
