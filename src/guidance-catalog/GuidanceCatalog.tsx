// SPDX-License-Identifier: Apache-2.0
import type { ReactNode } from "react";
import { ArtifactRef } from "../primitives/ArtifactRef.js";
import { DateTime } from "../primitives/DateTime.js";
import { EntityRef } from "../primitives/EntityRef.js";
import { Prose } from "../primitives/Prose.js";
import { Heading, HeadingScope } from "../primitives/Heading.js";
import { DocumentReferences, mappingReferenceUrl } from "../primitives/DocumentReferences.js";
import type { GuidanceCatalog as GuidanceCatalogData } from "../generated/types.js";

type MappingReference = NonNullable<GuidanceCatalogData["metadata"]["mapping-references"]>[number];

type Guideline = NonNullable<GuidanceCatalogData["guidelines"]>[number];
type Group = NonNullable<GuidanceCatalogData["groups"]>[number];
type MultiEntryMapping = NonNullable<Guideline["principles"]>[number];
type Statement = NonNullable<Guideline["statements"]>[number];
type Exemption = NonNullable<GuidanceCatalogData["exemptions"]>[number];

export interface GuidanceCatalogProps {
  data: GuidanceCatalogData;
  /**
   * Heading level (1-6) used for the catalog title. Nested sections add fixed
   * offsets: group = +1, guideline = +2, guideline subsection labels = +3.
   * Defaults to 1. Set to 2 (or higher) when composing into a host page that
   * already owns the `<h1>`.
   */
  headingLevel?: number;
  children?: ReactNode;
}

function GuidanceCatalogRoot({ data, headingLevel = 1, children }: GuidanceCatalogProps) {
  return (
    <HeadingScope level={headingLevel}>
      <article data-gemara-artifact="GuidanceCatalog" data-gemara-id={data.metadata.id ?? ""}>
        {children ?? (
          <>
            <Header data={data} />
            {data["front-matter"] ? (
              <section data-gemara-part="front-matter">
                <Prose content={data["front-matter"]} as="div" />
              </section>
            ) : null}
            <Groups data={data} />
            {data.exemptions && data.exemptions.length > 0 ? (
              <Exemptions exemptions={data.exemptions} refs={data.metadata["mapping-references"]} />
            ) : null}
          </>
        )}
      </article>
    </HeadingScope>
  );
}

interface HeaderProps {
  data: GuidanceCatalogData;
}

function Header({ data }: HeaderProps) {
  const { metadata, title, type } = data;
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
        {type ? (
          <>
            <dt>Type</dt>
            <dd>{type}</dd>
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
      </dl>
      <DocumentReferences data={data} />
    </header>
  );
}

interface GroupsProps {
  data: GuidanceCatalogData;
}

function Groups({ data }: GroupsProps) {
  const groups = data.groups ?? [];
  const guidelines = data.guidelines ?? [];
  const refs = data.metadata["mapping-references"];

  if (groups.length === 0) {
    return (
      <section data-gemara-part="groups">
        <GuidelineList guidelines={guidelines} refs={refs} />
      </section>
    );
  }

  const buckets = new Map<string, Guideline[]>();
  for (const g of groups) buckets.set(g.id ?? "", []);
  const ungrouped: Guideline[] = [];
  for (const g of guidelines) {
    const gid = g.group ?? "";
    const bucket = buckets.get(gid);
    if (bucket) bucket.push(g);
    else ungrouped.push(g);
  }

  return (
    <section data-gemara-part="groups">
      {groups.map((g) => (
        <GroupView
          key={g.id}
          group={g}
          guidelines={buckets.get(g.id ?? "") ?? []}
          refs={refs}
        />
      ))}
      {ungrouped.length > 0 ? (
        <GroupView
          group={{
            id: "_ungrouped",
            title: "Ungrouped",
            description: "Guidelines not assigned to a declared group.",
          }}
          guidelines={ungrouped}
          refs={refs}
        />
      ) : null}
    </section>
  );
}

interface GroupViewProps {
  group: Group;
  guidelines: Guideline[];
  refs?: MappingReference[];
}

function GroupView({ group, guidelines, refs }: GroupViewProps) {
  return (
    <section data-gemara-part="group" data-gemara-group-id={group.id ?? ""}>
      <Heading offset={1}>{group.title}</Heading>
      {group.description ? <Prose content={group.description} as="p" /> : null}
      <GuidelineList guidelines={guidelines} refs={refs} />
    </section>
  );
}

interface GuidelineListProps {
  guidelines: Guideline[];
  refs?: MappingReference[];
}

function GuidelineList({ guidelines, refs }: GuidelineListProps) {
  if (guidelines.length === 0) {
    return <p data-gemara-empty="guidelines">No guidelines in this group.</p>;
  }
  return (
    <ol data-gemara-part="guideline-list">
      {guidelines.map((g) => (
        <li key={g.id}>
          <GuidelineView guideline={g} refs={refs} />
        </li>
      ))}
    </ol>
  );
}

interface GuidelineViewProps {
  guideline: Guideline;
  refs?: MappingReference[];
}

function GuidelineView({ guideline, refs }: GuidelineViewProps) {
  return (
    <article
      data-gemara-part="guideline"
      data-gemara-guideline-id={guideline.id ?? ""}
      id={guideline.id ? `guideline-${guideline.id}` : undefined}
    >
      <header>
        <Heading offset={2}>
          <span data-gemara-part="guideline-id">{guideline.id}</span>
          {guideline.title ? (
            <>
              {" "}
              <span data-gemara-part="guideline-title">{guideline.title}</span>
            </>
          ) : null}
        </Heading>
      </header>
      {guideline.objective ? (
        <section data-gemara-part="objective">
          <Heading offset={3}>Objective</Heading>
          <Prose content={guideline.objective} as="p" />
        </section>
      ) : null}
      {guideline.rationale ? (
        <section data-gemara-part="rationale">
          <Heading offset={3}>Rationale</Heading>
          {guideline.rationale.importance ? (
            <Prose content={guideline.rationale.importance} as="p" />
          ) : null}
          {guideline.rationale.goals && guideline.rationale.goals.length > 0 ? (
            <ul data-gemara-part="goals">
              {guideline.rationale.goals.map((goal, i) => (
                <li key={i} data-gemara-part="goal">
                  {goal}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      {guideline.applicability && guideline.applicability.length > 0 ? (
        <p data-gemara-part="applicability">
          Applicability: {guideline.applicability.join(", ")}
        </p>
      ) : null}
      {guideline.recommendations && guideline.recommendations.length > 0 ? (
        <Recommendations recommendations={guideline.recommendations} offset={3} />
      ) : null}
      {guideline.statements && guideline.statements.length > 0 ? (
        <StatementList statements={guideline.statements} />
      ) : null}
      {(guideline.principles && guideline.principles.length > 0) ||
      (guideline.vectors && guideline.vectors.length > 0) ? (
        <References>
          {guideline.principles && guideline.principles.length > 0 ? (
            <Mappings label="Principles" mappings={guideline.principles} refs={refs} />
          ) : null}
          {guideline.vectors && guideline.vectors.length > 0 ? (
            <Mappings label="Vectors" mappings={guideline.vectors} refs={refs} />
          ) : null}
        </References>
      ) : null}
      {guideline["see-also"] && guideline["see-also"].length > 0 ? (
        <p data-gemara-part="see-also">
          See also:{" "}
          {guideline["see-also"].map((id, i) => (
            <span key={`${id}-${i}`}>
              {i > 0 ? ", " : null}
              <ArtifactRef kind="entry" id={id} relation="see-also">
                {id}
              </ArtifactRef>
            </span>
          ))}
        </p>
      ) : null}
      {guideline.extends ? (
        <p data-gemara-part="extends">
          Extends:{" "}
          <ArtifactRef
            kind="entry"
            id={guideline.extends["entry-id"] ?? ""}
            referenceId={guideline.extends["reference-id"]}
            url={mappingReferenceUrl(refs, guideline.extends["reference-id"])}
            relation="extends"
          >
            {guideline.extends["entry-id"]}
          </ArtifactRef>
        </p>
      ) : null}
    </article>
  );
}

interface RecommendationsProps {
  recommendations: string[];
  /** Heading offset: 3 under a guideline, 4 under a statement. */
  offset: number;
}

function Recommendations({ recommendations, offset }: RecommendationsProps) {
  return (
    <section data-gemara-part="recommendations">
      <Heading offset={offset}>Recommendations</Heading>
      <ul>
        {recommendations.map((r, i) => (
          <li key={i} data-gemara-part="recommendation">
            <Prose content={r} as="p" />
          </li>
        ))}
      </ul>
    </section>
  );
}

interface StatementListProps {
  statements: Statement[];
}

function StatementList({ statements }: StatementListProps) {
  return (
    <section data-gemara-part="statements">
      <Heading offset={3}>Statements</Heading>
      <ol>
        {statements.map((st) => (
          <li
            key={st.id}
            data-gemara-part="statement"
            data-gemara-statement-id={st.id ?? ""}
          >
            <Heading offset={4}>
              <span data-gemara-part="statement-id">{st.id}</span>
              {st.title ? (
                <>
                  {" "}
                  <span data-gemara-part="statement-title">{st.title}</span>
                </>
              ) : null}
            </Heading>
            {st.text ? <Prose content={st.text} as="p" /> : null}
            {st.recommendations && st.recommendations.length > 0 ? (
              <Recommendations recommendations={st.recommendations} offset={4} />
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

interface ExemptionsProps {
  exemptions: Exemption[];
  refs?: MappingReference[];
}

function Exemptions({ exemptions, refs }: ExemptionsProps) {
  return (
    <section data-gemara-part="exemptions">
      <Heading offset={1}>Exemptions</Heading>
      <ul>
        {exemptions.map((x, i) => (
          <li key={i} data-gemara-part="exemption">
            <Prose content={x.description} as="p" />
            {x.reason ? (
              <p data-gemara-part="exemption-reason">Reason: {x.reason}</p>
            ) : null}
            {x.redirect ? <Mappings label="Redirect" mappings={[x.redirect]} refs={refs} /> : null}
          </li>
        ))}
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
  refs?: MappingReference[];
}

function Mappings({ label, mappings, refs }: MappingsProps) {
  return (
    <section data-gemara-part="mappings" data-gemara-mappings-label={label.toLowerCase()}>
      <Heading offset={3}>{label}</Heading>
      <ul>
        {mappings.map((m, i) => (
          <li key={`${m["reference-id"] ?? "ref"}-${i}`}>
            <strong>{m["reference-id"]}</strong>
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
                        url={mappingReferenceUrl(refs, m["reference-id"])}
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

export const GuidanceCatalog = Object.assign(GuidanceCatalogRoot, {
  Header,
  Groups,
  Group: GroupView,
  Guideline: GuidelineView,
  Statements: StatementList,
  Recommendations,
  Exemptions,
  References,
  Mappings,
});
