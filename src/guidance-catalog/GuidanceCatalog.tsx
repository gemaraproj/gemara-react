// SPDX-License-Identifier: Apache-2.0
import type { ReactNode } from "react";
import { ArtifactRef } from "../primitives/ArtifactRef.js";
import { DateTime } from "../primitives/DateTime.js";
import { EntityRef } from "../primitives/EntityRef.js";
import { Prose } from "../primitives/Prose.js";
import { Heading, HeadingScope } from "../primitives/Heading.js";
import type { GuidanceCatalog as GuidanceCatalogData } from "../generated/types.js";

type Guideline = NonNullable<GuidanceCatalogData["guidelines"]>[number];
type Group = NonNullable<GuidanceCatalogData["groups"]>[number];
type MultiEntryMapping = NonNullable<Guideline["principles"]>[number];

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
    </header>
  );
}

interface GroupsProps {
  data: GuidanceCatalogData;
}

function Groups({ data }: GroupsProps) {
  const groups = data.groups ?? [];
  const guidelines = data.guidelines ?? [];

  if (groups.length === 0) {
    return (
      <section data-gemara-part="groups">
        <GuidelineList guidelines={guidelines} />
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
        />
      ) : null}
    </section>
  );
}

interface GroupViewProps {
  group: Group;
  guidelines: Guideline[];
}

function GroupView({ group, guidelines }: GroupViewProps) {
  return (
    <section data-gemara-part="group" data-gemara-group-id={group.id ?? ""}>
      <Heading offset={1}>{group.title}</Heading>
      {group.description ? <Prose content={group.description} as="p" /> : null}
      <GuidelineList guidelines={guidelines} />
    </section>
  );
}

interface GuidelineListProps {
  guidelines: Guideline[];
}

function GuidelineList({ guidelines }: GuidelineListProps) {
  if (guidelines.length === 0) {
    return <p data-gemara-empty="guidelines">No guidelines in this group.</p>;
  }
  return (
    <ol data-gemara-part="guideline-list">
      {guidelines.map((g) => (
        <li key={g.id}>
          <GuidelineView guideline={g} />
        </li>
      ))}
    </ol>
  );
}

interface GuidelineViewProps {
  guideline: Guideline;
}

function GuidelineView({ guideline }: GuidelineViewProps) {
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
      {guideline.rationale?.importance ? (
        <section data-gemara-part="rationale">
          <Heading offset={3}>Rationale</Heading>
          <Prose content={guideline.rationale.importance} as="p" />
        </section>
      ) : null}
      {guideline.principles && guideline.principles.length > 0 ? (
        <Mappings label="Principles" mappings={guideline.principles} />
      ) : null}
      {guideline.extends ? (
        <p data-gemara-part="extends">
          Extends:{" "}
          <ArtifactRef
            kind="entry"
            id={guideline.extends["entry-id"] ?? ""}
            referenceId={guideline.extends["reference-id"]}
            relation="extends"
          >
            {guideline.extends["entry-id"]}
          </ArtifactRef>
        </p>
      ) : null}
    </article>
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

export const GuidanceCatalog = Object.assign(GuidanceCatalogRoot, {
  Header,
  Groups,
  Group: GroupView,
  Guideline: GuidelineView,
  Mappings,
});
