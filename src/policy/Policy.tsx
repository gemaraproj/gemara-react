// SPDX-License-Identifier: Apache-2.0
import { Fragment, type ReactNode } from "react";
import { ArtifactRef } from "../primitives/ArtifactRef.js";
import { DateTime } from "../primitives/DateTime.js";
import { EntityRef } from "../primitives/EntityRef.js";
import { Prose } from "../primitives/Prose.js";
import { Heading, HeadingScope } from "../primitives/Heading.js";
import type {
  Policy as PolicyData,
  SchemaMappingReference,
} from "../generated/types.js";

/**
 * Headless Policy renderer (Gemara Layer 3).
 *
 * Server-component-clean: no useState, no useEffect, no "use client". Compound
 * pattern via Object.assign so consumers can either:
 *   <Policy data={policy} />            // default composition
 *   <Policy data={policy}>              // DIY composition
 *     <Policy.Header data={policy} />
 *     <Policy.Adherence data={policy} />
 *   </Policy>
 *
 * Children, if provided, take over rendering entirely. Parts receive the
 * policy via props (not context) so they work standalone too.
 *
 * Policy is not a `#Catalog`: instead of groups/entries it carries RACI
 * contacts, an applicability scope, imports of external catalogs/guidance/
 * policies, an optional implementation plan, mitigated/accepted risks, and
 * adherence (evaluation/enforcement methods + assessment plans).
 */

// Pull discrete shapes off the narrowed Policy type to keep prop types tight.
type Raci = PolicyData["contacts"];
type Contact = Raci["responsible"][number];
type ScopeData = PolicyData["scope"];
type DimensionsData = ScopeData["in"];
type ImportsData = PolicyData["imports"];
type PolicyImport = NonNullable<ImportsData["policies"]>[number];
type CatalogImport = NonNullable<ImportsData["catalogs"]>[number];
type GuidanceImport = NonNullable<ImportsData["guidance"]>[number];
type Constraint = NonNullable<CatalogImport["constraints"]>[number];
type RequirementModification = NonNullable<
  CatalogImport["assessment-requirement-modifications"]
>[number];
type ImplementationDetails = NonNullable<
  PolicyData["implementation-plan"]
>["evaluation-timeline"];
type MitigatedRisk = NonNullable<NonNullable<PolicyData["risks"]>["mitigated"]>[number];
type AcceptedRisk = NonNullable<NonNullable<PolicyData["risks"]>["accepted"]>[number];
type RiskMapping = MitigatedRisk["risk"];
type AcceptedMethod = NonNullable<
  PolicyData["adherence"]["evaluation-methods"]
>[number];
type AssessmentPlan = NonNullable<
  PolicyData["adherence"]["assessment-plans"]
>[number];
type Parameter = NonNullable<AssessmentPlan["parameters"]>[number];

/**
 * `metadata["mapping-references"]` is optional on the CUE `#Metadata` schema
 * (and present in real Policy documents — imports resolve through it), but the
 * OpenAPI generator drops the conditional overlay so the narrowed `Policy`
 * alias doesn't carry it. Widen locally instead of hand-editing the generated
 * types; the intersection only *adds* an optional field, so the cast is safe.
 */
type MetadataWithMappingReferences = PolicyData["metadata"] & {
  "mapping-references"?: SchemaMappingReference[];
};

function mappingReferencesOf(data: PolicyData): SchemaMappingReference[] {
  return (
    (data.metadata as MetadataWithMappingReferences)["mapping-references"] ?? []
  );
}

/** Resolve a reference-id to the URL declared in metadata mapping-references. */
function refUrl(
  refs: SchemaMappingReference[],
  id: string | undefined,
): string | undefined {
  if (!id) return undefined;
  return refs.find((r) => r.id === id)?.url;
}

/**
 * `required` is `*false | bool` in CUE but collapses to `string` in the
 * generated OpenAPI types; YAML parsing yields a real boolean. Handle both.
 */
function isTrue(v: string | boolean | undefined): boolean {
  return v === true || v === "true";
}

export interface PolicyProps {
  data: PolicyData;
  /**
   * Heading level (1-6) used for the policy title. Nested sections add fixed
   * offsets: top-level section = +1, subsection = +2, item/detail = +3 (+4 for
   * plan-level method lists). Defaults to 1. Set to 2 (or higher) when
   * composing into a host page that already owns the `<h1>`.
   */
  headingLevel?: number;
  children?: ReactNode;
}

interface PartProps {
  data: PolicyData;
}

function PolicyRoot({ data, headingLevel = 1, children }: PolicyProps) {
  return (
    <HeadingScope level={headingLevel}>
      <article data-gemara-artifact="Policy" data-gemara-id={data.metadata.id ?? ""}>
        {children ?? (
          <>
            <Header data={data} />
            <Contacts data={data} />
            <ScopeSection data={data} />
            <ImportsSection data={data} />
            <ImplementationPlanSection data={data} />
            <RisksSection data={data} />
            <AdherenceSection data={data} />
          </>
        )}
      </article>
    </HeadingScope>
  );
}

function Header({ data }: PartProps) {
  const { metadata, title } = data;
  const refs = mappingReferencesOf(data);
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
                url={refUrl(refs, metadata.lexicon["reference-id"])}
                relation="lexicon"
              >
                {metadata.lexicon["reference-id"]}
              </ArtifactRef>
              {metadata.lexicon.remarks ? <> — {metadata.lexicon.remarks}</> : null}
            </dd>
          </>
        ) : null}
      </dl>
      <MappingReferences references={refs} />
    </header>
  );
}

interface MappingReferencesProps {
  references: SchemaMappingReference[];
}

function MappingReferences({ references }: MappingReferencesProps) {
  if (references.length === 0) return null;
  return (
    <details data-gemara-part="references">
      <summary data-gemara-part="references-summary">
        References to Other Documents
      </summary>
      <ul>
        {references.map((r) => (
          <li
            key={r.id}
            data-gemara-part="mapping-reference"
            data-gemara-reference-id={r.id}
          >
            <ArtifactRef
              kind="mapping-reference"
              id={r.id}
              url={r.url}
              relation="mapping-references"
            >
              {r.title}
            </ArtifactRef>{" "}
            <span data-gemara-part="reference-version">{r.version}</span>
            {r.description ? <> — {r.description}</> : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

const RACI_ROLES = [
  ["responsible", "Responsible"],
  ["accountable", "Accountable"],
  ["consulted", "Consulted"],
  ["informed", "Informed"],
] as const;

function Contacts({ data }: PartProps) {
  // `contacts` is schema-required, but render degraded (not throw) on
  // documents that omit it — same defensive posture as the log renderers.
  const contacts: Raci | undefined = data.contacts;
  if (!contacts) return null;
  return (
    <section data-gemara-part="contacts">
      <Heading offset={1}>Contacts</Heading>
      {RACI_ROLES.map(([role, label]) => {
        const entries: Contact[] = contacts[role] ?? [];
        if (entries.length === 0) return null;
        return (
          <section
            key={role}
            data-gemara-part="contact-role"
            data-gemara-raci-role={role}
          >
            <Heading offset={2}>{label}</Heading>
            <ul>
              {entries.map((c, i) => (
                <li key={`${c.name}-${i}`} data-gemara-part="contact">
                  <EntityRef entity={c} />
                  {c.affiliation ? (
                    <>
                      {" "}
                      <span data-gemara-part="contact-affiliation">
                        ({c.affiliation})
                      </span>
                    </>
                  ) : null}
                  {c.email ? (
                    <>
                      {" "}
                      <span data-gemara-part="contact-email">{c.email}</span>
                    </>
                  ) : null}
                  {c.social ? (
                    <>
                      {" "}
                      <span data-gemara-part="contact-social">{c.social}</span>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </section>
  );
}

const DIMENSIONS = [
  ["technologies", "Technologies"],
  ["geopolitical", "Geopolitical"],
  ["sensitivity", "Sensitivity"],
  ["users", "Users"],
  ["groups", "Groups"],
] as const;

interface DimensionsViewProps {
  label: string;
  variant: "in" | "out";
  dimensions: DimensionsData;
  offset: number;
}

function DimensionsView({ label, variant, dimensions, offset }: DimensionsViewProps) {
  return (
    <section data-gemara-part="scope-dimensions" data-gemara-scope={variant}>
      <Heading offset={offset}>{label}</Heading>
      <dl>
        {DIMENSIONS.map(([key, keyLabel]) => {
          const values = dimensions[key] ?? [];
          if (values.length === 0) return null;
          return (
            <Fragment key={key}>
              <dt>{keyLabel}</dt>
              <dd data-gemara-part="dimension" data-gemara-dimension={key}>
                {values.join(", ")}
              </dd>
            </Fragment>
          );
        })}
      </dl>
    </section>
  );
}

interface ScopeViewProps {
  scope: ScopeData;
  /** Heading offset for the "Scope" heading; in/out labels render one deeper. */
  offset?: number;
  heading?: string;
}

/**
 * Reused for both the policy-level scope and per-accepted-risk scopes, so the
 * heading text/offset are configurable.
 */
function ScopeView({ scope, offset = 1, heading = "Scope" }: ScopeViewProps) {
  return (
    <section data-gemara-part="scope">
      <Heading offset={offset}>{heading}</Heading>
      {scope.in ? (
        <DimensionsView
          label="In scope"
          variant="in"
          dimensions={scope.in}
          offset={offset + 1}
        />
      ) : null}
      {scope.out ? (
        <DimensionsView
          label="Out of scope"
          variant="out"
          dimensions={scope.out}
          offset={offset + 1}
        />
      ) : null}
    </section>
  );
}

function ScopeSection({ data }: PartProps) {
  // `scope` is schema-required, but render nothing (not throw) when absent.
  const scope: ScopeData | undefined = data.scope;
  if (!scope) return null;
  return <ScopeView scope={scope} />;
}

function ImportsSection({ data }: PartProps) {
  // `imports` is schema-required, but treat its absence like an empty imports
  // block (renders the existing "No imports declared." empty treatment).
  const imports: ImportsData | undefined = data.imports;
  const refs = mappingReferencesOf(data);
  const policies = imports?.policies ?? [];
  const catalogs = imports?.catalogs ?? [];
  const guidance = imports?.guidance ?? [];
  return (
    <section data-gemara-part="imports">
      <Heading offset={1}>Imports</Heading>
      {policies.length + catalogs.length + guidance.length === 0 ? (
        <p data-gemara-empty="imports">No imports declared.</p>
      ) : null}
      {policies.length > 0 ? (
        <section data-gemara-part="import-policies">
          <Heading offset={2}>Policies</Heading>
          <ul>
            {policies.map((p, i) => (
              <PolicyImportView key={`${p["reference-id"]}-${i}`} imp={p} refs={refs} />
            ))}
          </ul>
        </section>
      ) : null}
      {catalogs.length > 0 ? (
        <section data-gemara-part="import-catalogs">
          <Heading offset={2}>Catalogs</Heading>
          {catalogs.map((c, i) => (
            <CatalogImportView key={`${c["reference-id"]}-${i}`} imp={c} refs={refs} />
          ))}
        </section>
      ) : null}
      {guidance.length > 0 ? (
        <section data-gemara-part="import-guidance">
          <Heading offset={2}>Guidance</Heading>
          {guidance.map((g, i) => (
            <GuidanceImportView key={`${g["reference-id"]}-${i}`} imp={g} refs={refs} />
          ))}
        </section>
      ) : null}
    </section>
  );
}

interface PolicyImportViewProps {
  imp: PolicyImport;
  refs: SchemaMappingReference[];
}

function PolicyImportView({ imp, refs }: PolicyImportViewProps) {
  return (
    <li data-gemara-part="import" data-gemara-import-id={imp["reference-id"] ?? ""}>
      <ArtifactRef
        kind="artifact"
        id={imp["reference-id"] ?? ""}
        url={refUrl(refs, imp["reference-id"])}
        relation="imports"
      />
      {imp.remarks ? <> — {imp.remarks}</> : null}
    </li>
  );
}

interface CatalogImportViewProps {
  imp: CatalogImport;
  refs: SchemaMappingReference[];
}

function CatalogImportView({ imp, refs }: CatalogImportViewProps) {
  const referenceId = imp["reference-id"];
  return (
    <article data-gemara-part="import" data-gemara-import-id={referenceId ?? ""}>
      <Heading offset={3}>
        <ArtifactRef
          kind="artifact"
          id={referenceId ?? ""}
          url={refUrl(refs, referenceId)}
          relation="imports"
        />
      </Heading>
      <Exclusions exclusions={imp.exclusions ?? []} />
      <ConstraintList constraints={imp.constraints ?? []} referenceId={referenceId} />
      <RequirementModifications
        modifications={imp["assessment-requirement-modifications"] ?? []}
        referenceId={referenceId}
      />
    </article>
  );
}

interface GuidanceImportViewProps {
  imp: GuidanceImport;
  refs: SchemaMappingReference[];
}

function GuidanceImportView({ imp, refs }: GuidanceImportViewProps) {
  const referenceId = imp["reference-id"];
  return (
    <article data-gemara-part="import" data-gemara-import-id={referenceId ?? ""}>
      <Heading offset={3}>
        <ArtifactRef
          kind="artifact"
          id={referenceId ?? ""}
          url={refUrl(refs, referenceId)}
          relation="imports"
        />
      </Heading>
      <Exclusions exclusions={imp.exclusions ?? []} />
      <ConstraintList constraints={imp.constraints ?? []} referenceId={referenceId} />
    </article>
  );
}

function Exclusions({ exclusions }: { exclusions: string[] }) {
  if (exclusions.length === 0) return null;
  return (
    <p data-gemara-part="exclusions">Exclusions: {exclusions.join(", ")}</p>
  );
}

interface ConstraintListProps {
  constraints: Constraint[];
  referenceId: string | undefined;
}

function ConstraintList({ constraints, referenceId }: ConstraintListProps) {
  if (constraints.length === 0) return null;
  return (
    <section data-gemara-part="constraints">
      <Heading offset={4}>Constraints</Heading>
      <ul>
        {constraints.map((c) => (
          <li
            key={c.id}
            data-gemara-part="constraint"
            data-gemara-constraint-id={c.id ?? ""}
          >
            <strong data-gemara-part="constraint-id">{c.id}</strong>{" — "}
            <ArtifactRef
              kind="entry"
              id={c["target-id"] ?? ""}
              referenceId={referenceId}
              relation="constraint"
            />
            <Prose content={c.text} as="p" />
          </li>
        ))}
      </ul>
    </section>
  );
}

interface RequirementModificationsProps {
  modifications: RequirementModification[];
  referenceId: string | undefined;
}

function RequirementModifications({
  modifications,
  referenceId,
}: RequirementModificationsProps) {
  if (modifications.length === 0) return null;
  return (
    <section data-gemara-part="requirement-modifications">
      <Heading offset={4}>Assessment requirement modifications</Heading>
      <ul>
        {modifications.map((m) => (
          <li
            key={m.id}
            data-gemara-part="requirement-modification"
            data-gemara-modification-id={m.id ?? ""}
            data-gemara-modification-type={m["modification-type"] ?? ""}
          >
            <strong data-gemara-part="modification-id">{m.id}</strong>{" "}
            <span data-gemara-part="modification-type">
              {m["modification-type"]}
            </span>{" — "}
            <ArtifactRef
              kind="entry"
              id={m["target-id"] ?? ""}
              referenceId={referenceId}
              relation="requirement-modification"
            />
            <dl>
              <dt>Rationale</dt>
              <dd>
                <Prose content={m["modification-rationale"]} />
              </dd>
              {m.text ? (
                <>
                  <dt>Text</dt>
                  <dd>
                    <Prose content={m.text} />
                  </dd>
                </>
              ) : null}
              {m.applicability && m.applicability.length > 0 ? (
                <>
                  <dt>Applicability</dt>
                  <dd data-gemara-part="applicability">
                    {m.applicability.join(", ")}
                  </dd>
                </>
              ) : null}
              {m.recommendation ? (
                <>
                  <dt>Recommendation</dt>
                  <dd>
                    <Prose content={m.recommendation} />
                  </dd>
                </>
              ) : null}
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ImplementationPlanSection({ data }: PartProps) {
  const plan = data["implementation-plan"];
  if (!plan) return null;
  return (
    <section data-gemara-part="implementation-plan">
      <Heading offset={1}>Implementation plan</Heading>
      {plan["notification-process"] ? (
        <section data-gemara-part="notification-process">
          <Heading offset={2}>Notification process</Heading>
          <Prose content={plan["notification-process"]} as="p" />
        </section>
      ) : null}
      {plan["evaluation-timeline"] ? (
        <TimelineView
          label="Evaluation timeline"
          variant="evaluation"
          details={plan["evaluation-timeline"]}
        />
      ) : null}
      {plan["enforcement-timeline"] ? (
        <TimelineView
          label="Enforcement timeline"
          variant="enforcement"
          details={plan["enforcement-timeline"]}
        />
      ) : null}
    </section>
  );
}

interface TimelineViewProps {
  label: string;
  variant: "evaluation" | "enforcement";
  details: ImplementationDetails;
}

function TimelineView({ label, variant, details }: TimelineViewProps) {
  return (
    <section data-gemara-part="timeline" data-gemara-timeline={variant}>
      <Heading offset={2}>{label}</Heading>
      <dl>
        <dt>Start</dt>
        <dd>
          <DateTime value={details.start} />
        </dd>
        {details.end ? (
          <>
            <dt>End</dt>
            <dd>
              <DateTime value={details.end} />
            </dd>
          </>
        ) : null}
        <dt>Notes</dt>
        <dd>
          <Prose content={details.notes} />
        </dd>
      </dl>
    </section>
  );
}

interface RiskRefProps {
  mapping: RiskMapping;
  relation: string;
}

function RiskRef({ mapping, relation }: RiskRefProps) {
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
      {mapping["reference-id"] ? (
        <>
          {" "}
          <span data-gemara-part="risk-reference">
            ({mapping["reference-id"]})
          </span>
        </>
      ) : null}
      {mapping.remarks ? <> — {mapping.remarks}</> : null}
    </>
  );
}

function RisksSection({ data }: PartProps) {
  const risks = data.risks;
  if (!risks) return null;
  const mitigated = risks.mitigated ?? [];
  const accepted = risks.accepted ?? [];
  return (
    <section data-gemara-part="risks">
      <Heading offset={1}>Risks</Heading>
      {mitigated.length > 0 ? (
        <section data-gemara-part="mitigated-risks">
          <Heading offset={2}>Mitigated</Heading>
          <ul>
            {mitigated.map((r) => (
              <MitigatedRiskView key={r.id} risk={r} />
            ))}
          </ul>
        </section>
      ) : null}
      {accepted.length > 0 ? (
        <section data-gemara-part="accepted-risks">
          <Heading offset={2}>Accepted</Heading>
          <ul>
            {accepted.map((r) => (
              <AcceptedRiskView key={r.id} risk={r} />
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

function MitigatedRiskView({ risk }: { risk: MitigatedRisk }) {
  return (
    <li data-gemara-part="risk" data-gemara-risk-id={risk.id ?? ""}>
      <strong data-gemara-part="risk-id">{risk.id}</strong>{" "}
      {risk.risk ? <RiskRef mapping={risk.risk} relation="mitigated-risk" /> : null}
    </li>
  );
}

function AcceptedRiskView({ risk }: { risk: AcceptedRisk }) {
  return (
    <li data-gemara-part="risk" data-gemara-risk-id={risk.id ?? ""}>
      <strong data-gemara-part="risk-id">{risk.id}</strong>{" "}
      {risk.risk ? <RiskRef mapping={risk.risk} relation="accepted-risk" /> : null}
      {risk["target-id"] ? (
        <p data-gemara-part="risk-target">
          Covers mitigated risk{" "}
          <ArtifactRef
            kind="entry"
            id={risk["target-id"] ?? ""}
            relation="accepted-risk-target"
          />
        </p>
      ) : null}
      {risk.justification ? (
        <section data-gemara-part="justification">
          <Heading offset={3}>Justification</Heading>
          <Prose content={risk.justification} as="p" />
        </section>
      ) : null}
      {risk.scope ? (
        <ScopeView scope={risk.scope} offset={3} heading="Acceptance scope" />
      ) : null}
    </li>
  );
}

function AdherenceSection({ data }: PartProps) {
  // `adherence` is schema-required, but render nothing (not throw) when absent.
  const adherence: PolicyData["adherence"] | undefined = data.adherence;
  if (!adherence) return null;
  const evaluation = adherence["evaluation-methods"] ?? [];
  const enforcement = adherence["enforcement-methods"] ?? [];
  const plans = adherence["assessment-plans"] ?? [];
  return (
    <section data-gemara-part="adherence">
      <Heading offset={1}>Adherence</Heading>
      {evaluation.length > 0 ? (
        <MethodList
          label="Evaluation methods"
          variant="evaluation"
          methods={evaluation}
          offset={2}
        />
      ) : null}
      {plans.length > 0 ? (
        <section data-gemara-part="assessment-plans">
          <Heading offset={2}>Assessment plans</Heading>
          {plans.map((p) => (
            <AssessmentPlanView key={p.id} plan={p} />
          ))}
        </section>
      ) : null}
      {enforcement.length > 0 ? (
        <MethodList
          label="Enforcement methods"
          variant="enforcement"
          methods={enforcement}
          offset={2}
        />
      ) : null}
      {adherence["non-compliance"] ? (
        <section data-gemara-part="non-compliance">
          <Heading offset={2}>Non-compliance</Heading>
          <Prose content={adherence["non-compliance"]} as="p" />
        </section>
      ) : null}
    </section>
  );
}

interface MethodListProps {
  label: string;
  variant: "evaluation" | "enforcement";
  methods: AcceptedMethod[];
  offset?: number;
}

function MethodList({ label, variant, methods, offset = 2 }: MethodListProps) {
  return (
    <section data-gemara-part="methods" data-gemara-methods-label={variant}>
      <Heading offset={offset}>{label}</Heading>
      <ul>
        {methods.map((m) => (
          <MethodView key={m.id} method={m} />
        ))}
      </ul>
    </section>
  );
}

function MethodView({ method }: { method: AcceptedMethod }) {
  return (
    <li
      data-gemara-part="method"
      data-gemara-method-id={method.id ?? ""}
      data-gemara-method-mode={method.mode ?? ""}
    >
      <strong data-gemara-part="method-id">{method.id}</strong>{" "}
      <span data-gemara-part="method-type">{method.type}</span>{" · "}
      <span data-gemara-part="method-mode">{method.mode}</span>
      {isTrue(method.required) ? (
        <>
          {" "}
          <span data-gemara-part="method-required">Required</span>
        </>
      ) : null}
      {method.executor ? (
        <p data-gemara-part="method-executor">
          Executor: <EntityRef entity={method.executor} />
        </p>
      ) : null}
      {method.description ? <Prose content={method.description} as="p" /> : null}
    </li>
  );
}

function AssessmentPlanView({ plan }: { plan: AssessmentPlan }) {
  const parameters = plan.parameters ?? [];
  return (
    <article data-gemara-part="assessment-plan" data-gemara-plan-id={plan.id ?? ""}>
      <Heading offset={3}>
        <span data-gemara-part="plan-id">{plan.id}</span>
      </Heading>
      <dl>
        <dt>Requirement</dt>
        <dd>
          <ArtifactRef
            kind="entry"
            id={plan["requirement-id"] ?? ""}
            relation="assessment-plan"
          />
        </dd>
        <dt>Frequency</dt>
        <dd data-gemara-part="plan-frequency">{plan.frequency}</dd>
        {plan["evidence-requirements"] ? (
          <>
            <dt>Evidence requirements</dt>
            <dd>
              <Prose content={plan["evidence-requirements"]} />
            </dd>
          </>
        ) : null}
      </dl>
      <MethodList
        label="Evaluation methods"
        variant="evaluation"
        methods={plan["evaluation-methods"] ?? []}
        offset={4}
      />
      {parameters.length > 0 ? <ParameterList parameters={parameters} /> : null}
    </article>
  );
}

function ParameterList({ parameters }: { parameters: Parameter[] }) {
  return (
    <section data-gemara-part="parameters">
      <Heading offset={4}>Parameters</Heading>
      <ul>
        {parameters.map((p) => {
          const accepted = p["accepted-values"] ?? [];
          return (
            <li
              key={p.id}
              data-gemara-part="parameter"
              data-gemara-parameter-id={p.id ?? ""}
            >
              <strong data-gemara-part="parameter-label">{p.label}</strong>
              <Prose content={p.description} as="p" />
              {accepted.length > 0 ? (
                <p data-gemara-part="accepted-values">
                  Accepted values: {accepted.join(", ")}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Compound API. Object.assign keeps the default top-level renderer callable
 * as `<Policy>` while still exposing parts at `<Policy.X>`.
 */
export const Policy = Object.assign(PolicyRoot, {
  Header,
  Contacts,
  Scope: ScopeSection,
  Imports: ImportsSection,
  ImplementationPlan: ImplementationPlanSection,
  Risks: RisksSection,
  Adherence: AdherenceSection,
});
