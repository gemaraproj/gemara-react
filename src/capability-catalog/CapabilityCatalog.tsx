import type { ReactNode } from "react";
import { DateTime } from "../primitives/DateTime.js";
import { EntityRef } from "../primitives/EntityRef.js";
import { Prose } from "../primitives/Prose.js";
import { Heading, HeadingScope } from "../primitives/Heading.js";
import type { CapabilityCatalog as CapabilityCatalogData } from "../generated/types.js";

/**
 * Headless CapabilityCatalog renderer (Gemara Layer 2).
 *
 * Server-component-clean: no useState, no useEffect, no "use client". Compound
 * pattern via Object.assign so consumers can either:
 *   <CapabilityCatalog data={catalog} />            // default composition
 *   <CapabilityCatalog data={catalog}>              // DIY composition
 *     <CapabilityCatalog.Header data={catalog} />
 *     <CapabilityCatalog.Groups data={catalog} />
 *   </CapabilityCatalog>
 *
 * Children, if provided, take over rendering entirely.
 */

type Capability = NonNullable<CapabilityCatalogData["capabilities"]>[number];
type Group = NonNullable<CapabilityCatalogData["groups"]>[number];

export interface CapabilityCatalogProps {
  data: CapabilityCatalogData;
  /**
   * Heading level (1-6) used for the catalog title. Nested sections add fixed
   * offsets: group = +1, capability = +2. Defaults to 1. Set to 2 (or higher)
   * when composing into a host page that already owns the `<h1>`.
   */
  headingLevel?: number;
  children?: ReactNode;
}

function CapabilityCatalogRoot({ data, headingLevel = 1, children }: CapabilityCatalogProps) {
  return (
    <HeadingScope level={headingLevel}>
      <article data-gemara-artifact="CapabilityCatalog" data-gemara-id={data.metadata.id ?? ""}>
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
  data: CapabilityCatalogData;
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
  data: CapabilityCatalogData;
}

function Groups({ data }: GroupsProps) {
  const groups = data.groups ?? [];
  const capabilities = data.capabilities ?? [];

  if (groups.length === 0) {
    return (
      <section data-gemara-part="groups">
        <CapabilityList capabilities={capabilities} />
      </section>
    );
  }

  // Pre-bucket capabilities by group id; capabilities with no group fall into "ungrouped".
  const buckets = new Map<string, Capability[]>();
  for (const g of groups) buckets.set(g.id ?? "", []);
  const ungrouped: Capability[] = [];
  for (const c of capabilities) {
    const gid = c.group ?? "";
    const bucket = buckets.get(gid);
    if (bucket) bucket.push(c);
    else ungrouped.push(c);
  }

  return (
    <section data-gemara-part="groups">
      {groups.map((g) => (
        <GroupView key={g.id} group={g} capabilities={buckets.get(g.id ?? "") ?? []} />
      ))}
      {ungrouped.length > 0 ? (
        <GroupView
          group={{
            id: "_ungrouped",
            title: "Ungrouped",
            description: "Capabilities not assigned to a declared group.",
          }}
          capabilities={ungrouped}
        />
      ) : null}
    </section>
  );
}

interface GroupViewProps {
  group: Group;
  capabilities: Capability[];
}

function GroupView({ group, capabilities }: GroupViewProps) {
  return (
    <section data-gemara-part="group" data-gemara-group-id={group.id ?? ""}>
      <Heading offset={1}>{group.title}</Heading>
      {group.description ? <Prose content={group.description} as="p" /> : null}
      <CapabilityList capabilities={capabilities} />
    </section>
  );
}

interface CapabilityListProps {
  capabilities: Capability[];
}

function CapabilityList({ capabilities }: CapabilityListProps) {
  if (capabilities.length === 0) {
    return <p data-gemara-empty="capabilities">No capabilities in this group.</p>;
  }
  return (
    <ol data-gemara-part="capability-list">
      {capabilities.map((c) => (
        <li key={c.id}>
          <CapabilityView capability={c} />
        </li>
      ))}
    </ol>
  );
}

interface CapabilityViewProps {
  capability: Capability;
}

function CapabilityView({ capability }: CapabilityViewProps) {
  return (
    <article
      data-gemara-part="capability"
      data-gemara-capability-id={capability.id ?? ""}
      id={capability.id ? `capability-${capability.id}` : undefined}
    >
      <header>
        <Heading offset={2}>
          <span data-gemara-part="capability-id">{capability.id}</span>
          {capability.title ? (
            <>
              {" "}
              <span data-gemara-part="capability-title">{capability.title}</span>
            </>
          ) : null}
        </Heading>
      </header>
      {capability.description ? (
        <section data-gemara-part="description">
          <Prose content={capability.description} as="p" />
        </section>
      ) : null}
    </article>
  );
}

/**
 * Compound API. Object.assign keeps the default top-level renderer callable
 * as `<CapabilityCatalog>` while still exposing parts at `<CapabilityCatalog.X>`.
 */
export const CapabilityCatalog = Object.assign(CapabilityCatalogRoot, {
  Header,
  Groups,
  Group: GroupView,
  Capability: CapabilityView,
});
