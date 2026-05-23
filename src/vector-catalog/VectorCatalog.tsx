import type { ReactNode } from "react";
import { DateTime } from "../primitives/DateTime.js";
import { EntityRef } from "../primitives/EntityRef.js";
import { Prose } from "../primitives/Prose.js";
import { Heading, HeadingScope } from "../primitives/Heading.js";
import type { VectorCatalog as VectorCatalogData } from "../generated/types.js";

/**
 * Headless VectorCatalog renderer (Gemara Layer 1).
 *
 * Server-component-clean: no useState, no useEffect, no "use client". Compound
 * pattern via Object.assign so consumers can either:
 *   <VectorCatalog data={catalog} />            // default composition
 *   <VectorCatalog data={catalog}>              // DIY composition
 *     <VectorCatalog.Header data={catalog} />
 *     <VectorCatalog.Groups data={catalog} />
 *   </VectorCatalog>
 *
 * Children, if provided, take over rendering entirely.
 */

type Vector = NonNullable<VectorCatalogData["vectors"]>[number];
type Group = NonNullable<VectorCatalogData["groups"]>[number];

export interface VectorCatalogProps {
  data: VectorCatalogData;
  /**
   * Heading level (1-6) used for the catalog title. Nested sections add fixed
   * offsets: group = +1, vector = +2. Defaults to 1. Set to 2 (or higher) when
   * composing into a host page that already owns the `<h1>`.
   */
  headingLevel?: number;
  children?: ReactNode;
}

function VectorCatalogRoot({ data, headingLevel = 1, children }: VectorCatalogProps) {
  return (
    <HeadingScope level={headingLevel}>
      <article data-gemara-artifact="VectorCatalog" data-gemara-id={data.metadata.id ?? ""}>
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
  data: VectorCatalogData;
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
  data: VectorCatalogData;
}

function Groups({ data }: GroupsProps) {
  const groups = data.groups ?? [];
  const vectors = data.vectors ?? [];

  if (groups.length === 0) {
    return (
      <section data-gemara-part="groups">
        <VectorList vectors={vectors} />
      </section>
    );
  }

  // Pre-bucket vectors by group id; vectors with no group fall into "ungrouped".
  const buckets = new Map<string, Vector[]>();
  for (const g of groups) buckets.set(g.id ?? "", []);
  const ungrouped: Vector[] = [];
  for (const v of vectors) {
    const gid = v.group ?? "";
    const bucket = buckets.get(gid);
    if (bucket) bucket.push(v);
    else ungrouped.push(v);
  }

  return (
    <section data-gemara-part="groups">
      {groups.map((g) => (
        <GroupView key={g.id} group={g} vectors={buckets.get(g.id ?? "") ?? []} />
      ))}
      {ungrouped.length > 0 ? (
        <GroupView
          group={{
            id: "_ungrouped",
            title: "Ungrouped",
            description: "Vectors not assigned to a declared group.",
          }}
          vectors={ungrouped}
        />
      ) : null}
    </section>
  );
}

interface GroupViewProps {
  group: Group;
  vectors: Vector[];
}

function GroupView({ group, vectors }: GroupViewProps) {
  return (
    <section data-gemara-part="group" data-gemara-group-id={group.id ?? ""}>
      <Heading offset={1}>{group.title}</Heading>
      {group.description ? <Prose content={group.description} as="p" /> : null}
      <VectorList vectors={vectors} />
    </section>
  );
}

interface VectorListProps {
  vectors: Vector[];
}

function VectorList({ vectors }: VectorListProps) {
  if (vectors.length === 0) {
    return <p data-gemara-empty="vectors">No vectors in this group.</p>;
  }
  return (
    <ol data-gemara-part="vector-list">
      {vectors.map((v) => (
        <li key={v.id}>
          <VectorView vector={v} />
        </li>
      ))}
    </ol>
  );
}

interface VectorViewProps {
  vector: Vector;
}

function VectorView({ vector }: VectorViewProps) {
  return (
    <article
      data-gemara-part="vector"
      data-gemara-vector-id={vector.id ?? ""}
      id={vector.id ? `vector-${vector.id}` : undefined}
    >
      <header>
        <Heading offset={2}>
          <span data-gemara-part="vector-id">{vector.id}</span>
          {vector.title ? (
            <>
              {" "}
              <span data-gemara-part="vector-title">{vector.title}</span>
            </>
          ) : null}
        </Heading>
      </header>
      {vector.description ? (
        <section data-gemara-part="description">
          <Prose content={vector.description} as="p" />
        </section>
      ) : null}
      {vector.applicability && vector.applicability.length > 0 ? (
        <p data-gemara-part="applicability">
          Applicability: {vector.applicability.join(", ")}
        </p>
      ) : null}
    </article>
  );
}

/**
 * Compound API. Object.assign keeps the default top-level renderer callable
 * as `<VectorCatalog>` while still exposing parts at `<VectorCatalog.X>`.
 */
export const VectorCatalog = Object.assign(VectorCatalogRoot, {
  Header,
  Groups,
  Group: GroupView,
  Vector: VectorView,
});
