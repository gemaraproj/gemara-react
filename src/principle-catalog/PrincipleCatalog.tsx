// SPDX-License-Identifier: Apache-2.0
import type { ReactNode } from "react";
import { DateTime } from "../primitives/DateTime.js";
import { EntityRef } from "../primitives/EntityRef.js";
import { Prose } from "../primitives/Prose.js";
import { Heading, HeadingScope } from "../primitives/Heading.js";
import type { PrincipleCatalog as PrincipleCatalogData } from "../generated/types.js";

/**
 * Headless PrincipleCatalog renderer (Gemara Layer 1).
 *
 * Server-component-clean: no useState, no useEffect, no "use client". Compound
 * pattern via Object.assign so consumers can either:
 *   <PrincipleCatalog data={catalog} />            // default composition
 *   <PrincipleCatalog data={catalog}>              // DIY composition
 *     <PrincipleCatalog.Header data={catalog} />
 *     <PrincipleCatalog.Groups data={catalog} />
 *   </PrincipleCatalog>
 *
 * Children, if provided, take over rendering entirely.
 */

type Principle = NonNullable<PrincipleCatalogData["principles"]>[number];
type Group = NonNullable<PrincipleCatalogData["groups"]>[number];

export interface PrincipleCatalogProps {
  data: PrincipleCatalogData;
  /**
   * Heading level (1-6) used for the catalog title. Nested sections add fixed
   * offsets: group = +1, principle = +2, principle subsection labels = +3.
   * Defaults to 1. Set to 2 (or higher) when composing into a host page that
   * already owns the `<h1>`.
   */
  headingLevel?: number;
  children?: ReactNode;
}

function PrincipleCatalogRoot({ data, headingLevel = 1, children }: PrincipleCatalogProps) {
  return (
    <HeadingScope level={headingLevel}>
      <article data-gemara-artifact="PrincipleCatalog" data-gemara-id={data.metadata.id ?? ""}>
        {children ?? (
          <>
            <Header data={data} />
            <Groups data={data} />
          </>
        )}
      </article>
    </HeadingScope>
  );
}

interface HeaderProps {
  data: PrincipleCatalogData;
}

function Header({ data }: HeaderProps) {
  const { metadata, title } = data;
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
      </dl>
    </header>
  );
}

interface GroupsProps {
  data: PrincipleCatalogData;
}

function Groups({ data }: GroupsProps) {
  const groups = data.groups ?? [];
  const principles = data.principles ?? [];

  if (groups.length === 0) {
    return (
      <section data-gemara-part="groups">
        <PrincipleList principles={principles} />
      </section>
    );
  }

  // Pre-bucket principles by group id; principles with no group fall into "ungrouped".
  const buckets = new Map<string, Principle[]>();
  for (const g of groups) buckets.set(g.id ?? "", []);
  const ungrouped: Principle[] = [];
  for (const p of principles) {
    const gid = p.group ?? "";
    const bucket = buckets.get(gid);
    if (bucket) bucket.push(p);
    else ungrouped.push(p);
  }

  return (
    <section data-gemara-part="groups">
      {groups.map((g) => (
        <GroupView key={g.id} group={g} principles={buckets.get(g.id ?? "") ?? []} />
      ))}
      {ungrouped.length > 0 ? (
        <GroupView
          group={{
            id: "_ungrouped",
            title: "Ungrouped",
            description: "Principles not assigned to a declared group.",
          }}
          principles={ungrouped}
        />
      ) : null}
    </section>
  );
}

interface GroupViewProps {
  group: Group;
  principles: Principle[];
}

function GroupView({ group, principles }: GroupViewProps) {
  return (
    <section data-gemara-part="group" data-gemara-group-id={group.id ?? ""}>
      <Heading offset={1}>{group.title}</Heading>
      {group.description ? <Prose content={group.description} as="p" /> : null}
      <PrincipleList principles={principles} />
    </section>
  );
}

interface PrincipleListProps {
  principles: Principle[];
}

function PrincipleList({ principles }: PrincipleListProps) {
  if (principles.length === 0) {
    return <p data-gemara-empty="principles">No principles in this group.</p>;
  }
  return (
    <ol data-gemara-part="principle-list">
      {principles.map((p) => (
        <li key={p.id}>
          <PrincipleView principle={p} />
        </li>
      ))}
    </ol>
  );
}

interface PrincipleViewProps {
  principle: Principle;
}

function PrincipleView({ principle }: PrincipleViewProps) {
  return (
    <article
      data-gemara-part="principle"
      data-gemara-principle-id={principle.id ?? ""}
      id={principle.id ? `principle-${principle.id}` : undefined}
    >
      <header>
        <Heading offset={2}>
          <span data-gemara-part="principle-id">{principle.id}</span>
          {principle.title ? (
            <>
              {" "}
              <span data-gemara-part="principle-title">{principle.title}</span>
            </>
          ) : null}
        </Heading>
      </header>
      {principle.description ? (
        <section data-gemara-part="description">
          <Prose content={principle.description} as="p" />
        </section>
      ) : null}
      {principle.rationale ? (
        <section data-gemara-part="rationale">
          <Heading offset={3}>Rationale</Heading>
          <Prose content={principle.rationale} as="p" />
        </section>
      ) : null}
    </article>
  );
}

/**
 * Compound API. Object.assign keeps the default top-level renderer callable
 * as `<PrincipleCatalog>` while still exposing parts at `<PrincipleCatalog.X>`.
 */
export const PrincipleCatalog = Object.assign(PrincipleCatalogRoot, {
  Header,
  Groups,
  Group: GroupView,
  Principle: PrincipleView,
});
