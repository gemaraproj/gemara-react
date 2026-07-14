// SPDX-License-Identifier: Apache-2.0
import type { ReactNode } from "react";
import { ArtifactRef } from "../primitives/ArtifactRef.js";
import { DateTime } from "../primitives/DateTime.js";
import { EntityRef } from "../primitives/EntityRef.js";
import { Prose } from "../primitives/Prose.js";
import { Heading, HeadingScope } from "../primitives/Heading.js";
import type { EvaluationLog as EvaluationLogData } from "../generated/types.js";

/**
 * Headless EvaluationLog renderer (Gemara Layer 4 evaluation results).
 *
 * Server-component-clean: no useState, no useEffect, no "use client". Compound
 * pattern via Object.assign so consumers can either:
 *   <EvaluationLog data={log} />              // default composition
 *   <EvaluationLog data={log}>                // DIY composition
 *     <EvaluationLog.Header data={log} />
 *     <EvaluationLog.Evaluations data={log} />
 *   </EvaluationLog>
 *
 * Children, if provided, take over rendering entirely.
 *
 * Shape notes (see the alias doc comment in src/generated/types.ts):
 * - `target` comes from the dropped `#Log` embed and is restored as OPTIONAL —
 *   this renderer must handle its absence.
 * - `evaluations[]["assessment-logs"]` is restored to the full AssessmentLog
 *   shape by the postamble alias.
 */

type Evaluation = EvaluationLogData["evaluations"][number];
type AssessmentLog = Evaluation["assessment-logs"][number];

/**
 * The generated `Resource` schema keeps only `environment`/`owner` — the
 * OpenAPI generator drops the entity fields (`id`/`name`/`type`) the CUE
 * `#Resource` embeds, but real documents carry them (see the fixture's
 * `target`). Widen with the optional entity shape so `EntityRef` can surface
 * them when present.
 */
type TargetResource = NonNullable<EvaluationLogData["target"]> & {
  id?: string;
  name?: string;
  type?: string;
};

export interface EvaluationLogProps {
  data: EvaluationLogData;
  /**
   * Heading level (1-6) used for the log title. Nested sections add fixed
   * offsets: target/evaluations sections = +1, evaluation = +2, assessment
   * subsection labels = +3. Defaults to 1. Set to 2 (or higher) when composing
   * into a host page that already owns the `<h1>`.
   */
  headingLevel?: number;
  children?: ReactNode;
}

function EvaluationLogRoot({ data, headingLevel = 1, children }: EvaluationLogProps) {
  return (
    <HeadingScope level={headingLevel}>
      <article data-gemara-artifact="EvaluationLog" data-gemara-id={data.metadata.id ?? ""}>
        {children ?? (
          <>
            <Header data={data} />
            <Target data={data} />
            <Evaluations data={data} />
          </>
        )}
      </article>
    </HeadingScope>
  );
}

interface WithDataProps {
  data: EvaluationLogData;
}

function Header({ data }: WithDataProps) {
  const { metadata } = data;
  return (
    <header data-gemara-part="header">
      {/* Logs carry no native title; the artifact id is the closest thing. */}
      <Heading offset={0} data-gemara-part="title">
        {metadata.id}
      </Heading>
      <ResultBadge result={data.result} />
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
        {metadata.draft !== undefined ? (
          <>
            <dt>Draft</dt>
            <dd data-gemara-part="draft">{metadata.draft ? "Yes" : "No"}</dd>
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
    </header>
  );
}

/**
 * The evaluated resource, from the (restored, optional) `#Log` embed.
 * Renders nothing when the document omits it.
 */
function Target({ data }: WithDataProps) {
  const target: TargetResource | undefined = data.target;
  if (!target) return null;
  return (
    <section data-gemara-part="target">
      <Heading offset={1}>Target</Heading>
      <dl>
        <dt>Resource</dt>
        <dd>
          <EntityRef entity={target} />
        </dd>
        {target.environment ? (
          <>
            <dt>Environment</dt>
            <dd data-gemara-part="environment">{target.environment}</dd>
          </>
        ) : null}
        {target.owner ? (
          <>
            <dt>Owner</dt>
            <dd data-gemara-part="owner">
              {target.owner.name}
              {target.owner.affiliation ? <> ({target.owner.affiliation})</> : null}
              {target.owner.email ? <> — {target.owner.email}</> : null}
              {target.owner.social ? <> — {target.owner.social}</> : null}
            </dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}

function Evaluations({ data }: WithDataProps) {
  const evaluations = data.evaluations ?? [];
  if (evaluations.length === 0) {
    return (
      <section data-gemara-part="evaluations">
        <Heading offset={1}>Control evaluations</Heading>
        <p data-gemara-empty="evaluations">No control evaluations recorded.</p>
      </section>
    );
  }
  return (
    <section data-gemara-part="evaluations">
      <Heading offset={1}>Control evaluations</Heading>
      <ol data-gemara-part="evaluation-list">
        {evaluations.map((e, i) => (
          <li key={`${e.control?.["entry-id"] ?? "evaluation"}-${i}`}>
            <EvaluationView evaluation={e} />
          </li>
        ))}
      </ol>
    </section>
  );
}

interface EvaluationViewProps {
  evaluation: Evaluation;
}

function EvaluationView({ evaluation }: EvaluationViewProps) {
  const control = evaluation.control;
  const controlId = control?.["entry-id"] ?? "";
  return (
    <article data-gemara-part="evaluation" data-gemara-control-id={controlId}>
      <header>
        <Heading offset={2}>
          {evaluation.name ? (
            <span data-gemara-part="evaluation-name">{evaluation.name}</span>
          ) : null}
          {evaluation.name && control ? " " : null}
          {control ? (
            <span data-gemara-part="control">
              <ArtifactRef
                kind="entry"
                id={controlId}
                referenceId={control["reference-id"]}
                relation="control"
              >
                {controlId}
              </ArtifactRef>
              {control.remarks ? <> — {control.remarks}</> : null}
            </span>
          ) : null}
        </Heading>
        <ResultBadge result={evaluation.result} />
      </header>
      {evaluation.message ? (
        <div data-gemara-part="message">
          <Prose content={evaluation.message} as="p" />
        </div>
      ) : null}
      <AssessmentLogs logs={evaluation["assessment-logs"] ?? []} />
    </article>
  );
}

interface AssessmentLogsProps {
  logs: AssessmentLog[];
}

function AssessmentLogs({ logs }: AssessmentLogsProps) {
  if (logs.length === 0) {
    return <p data-gemara-empty="assessment-logs">No assessment logs recorded.</p>;
  }
  return (
    <section data-gemara-part="assessment-logs">
      <Heading offset={3}>Assessments</Heading>
      <ol data-gemara-part="assessment-log-list">
        {logs.map((log, i) => (
          <li key={`${log.requirement?.["entry-id"] ?? "assessment"}-${i}`}>
            <AssessmentLogView log={log} />
          </li>
        ))}
      </ol>
    </section>
  );
}

interface AssessmentLogViewProps {
  log: AssessmentLog;
}

function AssessmentLogView({ log }: AssessmentLogViewProps) {
  const requirement = log.requirement;
  const requirementId = requirement?.["entry-id"] ?? "";
  const executed = log["steps-executed"];
  const steps = log.steps ?? [];
  return (
    <article data-gemara-part="assessment-log" data-gemara-requirement-id={requirementId}>
      <header>
        {requirement ? (
          <p data-gemara-part="requirement">
            <ArtifactRef
              kind="entry"
              id={requirementId}
              referenceId={requirement["reference-id"]}
              relation="requirement"
            >
              {requirementId}
            </ArtifactRef>
            {requirement.remarks ? <> — {requirement.remarks}</> : null}
          </p>
        ) : null}
        <ResultBadge result={log.result} />
      </header>
      {log.description ? (
        <div data-gemara-part="description">
          <Prose content={log.description} as="p" />
        </div>
      ) : null}
      {log.message ? (
        <div data-gemara-part="message">
          <Prose content={log.message} as="p" />
        </div>
      ) : null}
      {log.recommendation ? (
        <div data-gemara-part="recommendation">
          <Prose content={log.recommendation} as="p" />
        </div>
      ) : null}
      {log.applicability && log.applicability.length > 0 ? (
        <p data-gemara-part="applicability">
          Applicability: {log.applicability.join(", ")}
        </p>
      ) : null}
      {log["confidence-level"] ? (
        <p data-gemara-part="confidence-level">
          Confidence: {log["confidence-level"]}
        </p>
      ) : null}
      {log.plan ? (
        <p data-gemara-part="plan">
          Plan:{" "}
          <ArtifactRef
            kind="entry"
            id={log.plan["entry-id"] ?? ""}
            referenceId={log.plan["reference-id"]}
            relation="plan"
          >
            {log.plan["entry-id"]}
          </ArtifactRef>
          {log.plan.remarks ? <> — {log.plan.remarks}</> : null}
        </p>
      ) : null}
      {steps.length > 0 ? (
        // Same uncontrolled native-<details> pattern as the catalog
        // `references` part: collapsed by default, no client JS.
        <details data-gemara-part="steps">
          <summary data-gemara-part="steps-summary">
            Steps
            {executed !== undefined ? (
              <>
                {" — "}
                <span data-gemara-part="steps-executed">{executed}</span> of{" "}
                {steps.length} executed
              </>
            ) : null}
          </summary>
          <ol data-gemara-part="step-list">
            {steps.map((s, i) => (
              <li key={`${s}-${i}`} data-gemara-part="step">
                <code>{s}</code>
              </li>
            ))}
          </ol>
        </details>
      ) : executed !== undefined ? (
        <p data-gemara-part="steps-executed">Steps executed: {executed}</p>
      ) : null}
      {log.start || log.end ? (
        <p data-gemara-part="timespan">
          {log.start ? (
            <span data-gemara-part="start">
              Started <DateTime value={log.start} />
            </span>
          ) : null}
          {log.start && log.end ? " · " : null}
          {log.end ? (
            <span data-gemara-part="end">
              Ended <DateTime value={log.end} />
            </span>
          ) : null}
        </p>
      ) : null}
    </article>
  );
}

interface ResultBadgeProps {
  result: string | undefined;
}

/**
 * Result outcome (aggregate, per-evaluation, or per-assessment). The raw value
 * ("Passed", "Failed", "Needs Review", "Not Run", …) is mirrored onto
 * `data-gemara-result` so consumers can style outcomes without text matching;
 * disambiguate scope via the ancestor part (header / evaluation / assessment-log).
 */
function ResultBadge({ result }: ResultBadgeProps) {
  if (!result) return null;
  return (
    <p data-gemara-part="result" data-gemara-result={result}>
      {result}
    </p>
  );
}

/**
 * Compound API. Object.assign keeps the default top-level renderer callable
 * as `<EvaluationLog>` while still exposing parts at `<EvaluationLog.X>`.
 */
export const EvaluationLog = Object.assign(EvaluationLogRoot, {
  Header,
  Target,
  Evaluations,
  Evaluation: EvaluationView,
  AssessmentLogs,
  AssessmentLog: AssessmentLogView,
  Result: ResultBadge,
});
