// SPDX-License-Identifier: Apache-2.0
import type { ReactNode } from "react";
import { ArtifactRef } from "../primitives/ArtifactRef.js";
import { DateTime } from "../primitives/DateTime.js";
import { EntityRef } from "../primitives/EntityRef.js";
import { Prose } from "../primitives/Prose.js";
import { Heading, HeadingScope } from "../primitives/Heading.js";
import { IdPrefixScope, useIdPrefix } from "../primitives/IdPrefix.js";
import { DocumentReferences, mappingReferenceUrl } from "../primitives/DocumentReferences.js";
import type { ThreatCatalog as ThreatCatalogData } from "../generated/types.js";

type MappingReference = NonNullable<ThreatCatalogData["metadata"]["mapping-references"]>[number];

/**
 * Headless ThreatCatalog renderer (Gemara Layer 2).
 *
 * Server-component-clean: no useState, no useEffect, no "use client". Compound
 * pattern via Object.assign so consumers can either:
 *   <ThreatCatalog data={catalog} />            // default composition
 *   <ThreatCatalog data={catalog}>              // DIY composition
 *     <ThreatCatalog.Header data={catalog} />
 *     <ThreatCatalog.Groups data={catalog} />
 *   </ThreatCatalog>
 *
 * Children, if provided, take over rendering entirely.
 */

type Threat = NonNullable<ThreatCatalogData["threats"]>[number];
type Group = NonNullable<ThreatCatalogData["groups"]>[number];
type Actor = NonNullable<Threat["actors"]>[number];
type MultiEntryMapping = NonNullable<Threat["capabilities"]>[number];

export interface ThreatCatalogProps {
  data: ThreatCatalogData;
  /**
   * Heading level (1-6) used for the catalog title. Nested sections add fixed
   * offsets: group = +1, threat = +2, threat subsection labels = +3. Defaults
   * to 1. Set to 2 (or higher) when composing into a host page that already
   * owns the `<h1>`.
   */
  headingLevel?: number;
  /**
   * Prefix for the entry anchor ids (`control-<id>`, `term-<id>`, …). Set it
   * when the same artifact renders more than once on a page so the anchors
   * stay unique.
   */
  idPrefix?: string;
  children?: ReactNode;
}

function ThreatCatalogRoot({ data, headingLevel = 1, idPrefix, children }: ThreatCatalogProps) {
  return (
    <IdPrefixScope prefix={idPrefix}>
      <HeadingScope level={headingLevel}>
        <article data-gemara-artifact="ThreatCatalog" data-gemara-id={data.metadata.id ?? ""}>
          {children ?? (
            <>
              <Header data={data} />
              <Groups data={data} />
            </>
          )}
        </article>
      </HeadingScope>
    </IdPrefixScope>
  );
}

interface HeaderProps {
  data: ThreatCatalogData;
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
      <DocumentReferences data={data} />
    </header>
  );
}

interface GroupsProps {
  data: ThreatCatalogData;
}

function Groups({ data }: GroupsProps) {
  const groups = data.groups ?? [];
  const threats = data.threats ?? [];
  const refs = data.metadata["mapping-references"];

  if (groups.length === 0) {
    return (
      <section data-gemara-part="groups">
        <ThreatList threats={threats} refs={refs} />
      </section>
    );
  }

  // Pre-bucket threats by group id; threats with no group fall into "ungrouped".
  const buckets = new Map<string, Threat[]>();
  for (const g of groups) buckets.set(g.id ?? "", []);
  const ungrouped: Threat[] = [];
  for (const t of threats) {
    const gid = t.group ?? "";
    const bucket = buckets.get(gid);
    if (bucket) bucket.push(t);
    else ungrouped.push(t);
  }

  return (
    <section data-gemara-part="groups">
      {groups.map((g) => (
        <GroupView key={g.id} group={g} threats={buckets.get(g.id ?? "") ?? []} refs={refs} />
      ))}
      {ungrouped.length > 0 ? (
        <GroupView
          group={{
            id: "_ungrouped",
            title: "Ungrouped",
            description: "Threats not assigned to a declared group.",
          }}
          threats={ungrouped}
          refs={refs}
        />
      ) : null}
    </section>
  );
}

interface GroupViewProps {
  group: Group;
  threats: Threat[];
  refs?: MappingReference[];
}

function GroupView({ group, threats, refs }: GroupViewProps) {
  return (
    <section data-gemara-part="group" data-gemara-group-id={group.id ?? ""}>
      <Heading offset={1}>{group.title}</Heading>
      {group.description ? <Prose content={group.description} as="p" /> : null}
      <ThreatList threats={threats} refs={refs} />
    </section>
  );
}

interface ThreatListProps {
  threats: Threat[];
  refs?: MappingReference[];
}

function ThreatList({ threats, refs }: ThreatListProps) {
  if (threats.length === 0) {
    return <p data-gemara-empty="threats">No threats in this group.</p>;
  }
  return (
    <ol data-gemara-part="threat-list">
      {threats.map((t) => (
        <li key={t.id}>
          <ThreatView threat={t} refs={refs} />
        </li>
      ))}
    </ol>
  );
}

interface ThreatViewProps {
  threat: Threat;
  refs?: MappingReference[];
}

function ThreatView({ threat, refs }: ThreatViewProps) {
  const idPrefix = useIdPrefix();
  return (
    <article
      data-gemara-part="threat"
      data-gemara-threat-id={threat.id ?? ""}
      id={threat.id ? `${idPrefix}threat-${threat.id}` : undefined}
    >
      <header>
        <Heading offset={2}>
          <span data-gemara-part="threat-id">{threat.id}</span>
          {threat.title ? (
            <>
              {" "}
              <span data-gemara-part="threat-title">{threat.title}</span>
            </>
          ) : null}
        </Heading>
      </header>
      {threat.description ? (
        <section data-gemara-part="description">
          <Prose content={threat.description} as="p" />
        </section>
      ) : null}
      {threat.actors && threat.actors.length > 0 ? (
        <Actors actors={threat.actors} />
      ) : null}
      {(threat.capabilities && threat.capabilities.length > 0) ||
      (threat.vectors && threat.vectors.length > 0) ? (
        <References>
          {threat.capabilities && threat.capabilities.length > 0 ? (
            <Mappings label="Capabilities" mappings={threat.capabilities} refs={refs} />
          ) : null}
          {threat.vectors && threat.vectors.length > 0 ? (
            <Mappings label="Vectors" mappings={threat.vectors} refs={refs} />
          ) : null}
        </References>
      ) : null}
    </article>
  );
}

interface ActorsProps {
  actors: Actor[];
}

function Actors({ actors }: ActorsProps) {
  return (
    <section data-gemara-part="actors">
      <Heading offset={3}>Actors</Heading>
      <ul>
        {actors.map((a, i) => (
          <li key={a.id ?? `actor-${i}`} data-gemara-part="actor">
            <EntityRef entity={a} />
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

/**
 * Compound API. Object.assign keeps the default top-level renderer callable
 * as `<ThreatCatalog>` while still exposing parts at `<ThreatCatalog.X>`.
 */
export const ThreatCatalog = Object.assign(ThreatCatalogRoot, {
  Header,
  Groups,
  Group: GroupView,
  Threat: ThreatView,
  Actors,
  References,
  Mappings,
});
