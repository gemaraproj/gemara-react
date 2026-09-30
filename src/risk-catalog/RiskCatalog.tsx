// SPDX-License-Identifier: Apache-2.0
import type { ReactNode } from "react";
import { ArtifactRef } from "../primitives/ArtifactRef.js";
import { DateTime } from "../primitives/DateTime.js";
import { EntityRef } from "../primitives/EntityRef.js";
import { Prose } from "../primitives/Prose.js";
import { Heading, HeadingScope } from "../primitives/Heading.js";
import { DocumentReferences, mappingReferenceUrl } from "../primitives/DocumentReferences.js";
import type { RiskCatalog as RiskCatalogData } from "../generated/types.js";

type MappingReference = NonNullable<RiskCatalogData["metadata"]["mapping-references"]>[number];

/**
 * Headless RiskCatalog renderer (Gemara Layer 2).
 *
 * Server-component-clean: no useState, no useEffect, no "use client". Compound
 * pattern via Object.assign so consumers can either:
 *   <RiskCatalog data={catalog} />            // default composition
 *   <RiskCatalog data={catalog}>              // DIY composition
 *     <RiskCatalog.Header data={catalog} />
 *     <RiskCatalog.Groups data={catalog} />
 *   </RiskCatalog>
 *
 * Children, if provided, take over rendering entirely.
 *
 * RiskCatalog-specific taxonomy extensions (exhaustive list in README
 * "Styling: the `data-gemara-*` taxonomy"):
 * - groups are `#RiskCategory` (Group + appetite / max-severity), surfaced as
 *   `data-gemara-part="appetite" | "max-severity"` inside the group section and
 *   mirrored as `data-gemara-appetite` on the group for stable CSS selection.
 * - risks carry `data-gemara-part="risk" | "risk-id" | "risk-title" |
 *   "description" | "severity" | "impact" | "owner" | "owner-role" | "contact" |
 *   "contact-affiliation" | "contact-email" | "contact-social"` with
 *   `data-gemara-risk-id` / `data-gemara-severity` / `data-gemara-owner-role`
 *   selector attributes.
 */

type Risk = NonNullable<RiskCatalogData["risks"]>[number];
type Group = NonNullable<RiskCatalogData["groups"]>[number];
type Raci = NonNullable<Risk["owner"]>;
type Contact = NonNullable<Raci["responsible"]>[number];
type MultiEntryMapping = NonNullable<Risk["threats"]>[number];

export interface RiskCatalogProps {
  data: RiskCatalogData;
  /**
   * Heading level (1-6) used for the catalog title. Nested sections add fixed
   * offsets: group = +1, risk = +2, risk subsection labels = +3. Defaults
   * to 1. Set to 2 (or higher) when composing into a host page that already
   * owns the `<h1>`.
   */
  headingLevel?: number;
  children?: ReactNode;
}

function RiskCatalogRoot({ data, headingLevel = 1, children }: RiskCatalogProps) {
  return (
    <HeadingScope level={headingLevel}>
      <article data-gemara-artifact="RiskCatalog" data-gemara-id={data.metadata.id ?? ""}>
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
  data: RiskCatalogData;
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
        {metadata.draft !== undefined ? (
          <>
            <dt>Draft</dt>
            <dd data-gemara-part="draft">{metadata.draft ? "Yes" : "No"}</dd>
          </>
        ) : null}
      </dl>
      <DocumentReferences data={data} />
    </header>
  );
}

interface GroupsProps {
  data: RiskCatalogData;
}

function Groups({ data }: GroupsProps) {
  const groups = data.groups ?? [];
  const risks = data.risks ?? [];
  const refs = data.metadata["mapping-references"];

  if (groups.length === 0) {
    return (
      <section data-gemara-part="groups">
        <RiskList risks={risks} refs={refs} />
      </section>
    );
  }

  // Pre-bucket risks by group id; risks with no group fall into "ungrouped".
  const buckets = new Map<string, Risk[]>();
  for (const g of groups) buckets.set(g.id ?? "", []);
  const ungrouped: Risk[] = [];
  for (const r of risks) {
    const gid = r.group ?? "";
    const bucket = buckets.get(gid);
    if (bucket) bucket.push(r);
    else ungrouped.push(r);
  }

  return (
    <section data-gemara-part="groups">
      {groups.map((g) => (
        <GroupView key={g.id} group={g} risks={buckets.get(g.id ?? "") ?? []} refs={refs} />
      ))}
      {ungrouped.length > 0 ? (
        <GroupView
          group={{
            id: "_ungrouped",
            title: "Ungrouped",
            description: "Risks not assigned to a declared category.",
            appetite: "",
          }}
          risks={ungrouped}
          refs={refs}
        />
      ) : null}
    </section>
  );
}

interface GroupViewProps {
  group: Group;
  risks: Risk[];
  refs?: MappingReference[];
}

function GroupView({ group, risks, refs }: GroupViewProps) {
  return (
    <section
      data-gemara-part="group"
      data-gemara-group-id={group.id ?? ""}
      data-gemara-appetite={group.appetite ?? ""}
    >
      <Heading offset={1}>{group.title}</Heading>
      {group.description ? <Prose content={group.description} as="p" /> : null}
      {group.appetite || group["max-severity"] ? (
        <dl data-gemara-part="risk-boundaries">
          {group.appetite ? (
            <>
              <dt>Risk appetite</dt>
              <dd data-gemara-part="appetite">{group.appetite}</dd>
            </>
          ) : null}
          {group["max-severity"] ? (
            <>
              <dt>Maximum tolerated severity</dt>
              <dd data-gemara-part="max-severity">{group["max-severity"]}</dd>
            </>
          ) : null}
        </dl>
      ) : null}
      <RiskList risks={risks} refs={refs} />
    </section>
  );
}

interface RiskListProps {
  risks: Risk[];
  refs?: MappingReference[];
}

function RiskList({ risks, refs }: RiskListProps) {
  if (risks.length === 0) {
    return <p data-gemara-empty="risks">No risks in this category.</p>;
  }
  return (
    <ol data-gemara-part="risk-list">
      {risks.map((r) => (
        <li key={r.id}>
          <RiskView risk={r} refs={refs} />
        </li>
      ))}
    </ol>
  );
}

interface RiskViewProps {
  risk: Risk;
  refs?: MappingReference[];
}

function RiskView({ risk, refs }: RiskViewProps) {
  return (
    <article
      data-gemara-part="risk"
      data-gemara-risk-id={risk.id ?? ""}
      data-gemara-severity={risk.severity ?? ""}
      data-gemara-rank={risk.rank ?? undefined}
      id={risk.id ? `risk-${risk.id}` : undefined}
    >
      <header>
        <Heading offset={2}>
          <span data-gemara-part="risk-id">{risk.id}</span>
          {risk.title ? (
            <>
              {" "}
              <span data-gemara-part="risk-title">{risk.title}</span>
            </>
          ) : null}
        </Heading>
      </header>
      {risk.description ? (
        <section data-gemara-part="description">
          <Prose content={risk.description} as="p" />
        </section>
      ) : null}
      {risk.severity ? (
        <p data-gemara-part="severity">Severity: {risk.severity}</p>
      ) : null}
      {risk.rank !== undefined && risk.rank !== null ? (
        <p data-gemara-part="rank">Rank: {risk.rank}</p>
      ) : null}
      {risk.impact ? (
        <section data-gemara-part="impact">
          <Heading offset={3}>Impact</Heading>
          <Prose content={risk.impact} as="p" />
        </section>
      ) : null}
      {risk.owner ? <Owner owner={risk.owner} /> : null}
      {risk.threats && risk.threats.length > 0 ? (
        <References>
          <Mappings label="Threats" mappings={risk.threats} refs={refs} />
        </References>
      ) : null}
    </article>
  );
}

interface OwnerProps {
  owner: Raci;
}

const RACI_ROLES = [
  ["responsible", "Responsible"],
  ["accountable", "Accountable"],
  ["consulted", "Consulted"],
  ["informed", "Informed"],
] as const;

function Owner({ owner }: OwnerProps) {
  return (
    <section data-gemara-part="owner">
      <Heading offset={3}>Owner</Heading>
      <dl>
        {RACI_ROLES.map(([key, label]) => {
          const contacts = owner[key] ?? [];
          if (contacts.length === 0) return null;
          return (
            <div key={key} data-gemara-part="owner-role" data-gemara-owner-role={key}>
              <dt>{label}</dt>
              <dd>
                <ul>
                  {contacts.map((c, i) => (
                    <li key={c.name ?? `contact-${i}`} data-gemara-part="contact">
                      <ContactView contact={c} />
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
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
    <>
      <EntityRef entity={contact} />
      {contact.affiliation ? (
        <>
          {" "}
          <span data-gemara-part="contact-affiliation">({contact.affiliation})</span>
        </>
      ) : null}
      {contact.email ? (
        <>
          {" "}
          <span data-gemara-part="contact-email">&lt;{contact.email}&gt;</span>
        </>
      ) : null}
      {contact.social ? (
        <>
          {" "}
          <span data-gemara-part="contact-social">{contact.social}</span>
        </>
      ) : null}
    </>
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
 * as `<RiskCatalog>` while still exposing parts at `<RiskCatalog.X>`.
 */
export const RiskCatalog = Object.assign(RiskCatalogRoot, {
  Header,
  Groups,
  Group: GroupView,
  Risk: RiskView,
  Owner,
  References,
  Mappings,
});
