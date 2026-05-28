// SPDX-License-Identifier: Apache-2.0
import type { ReactNode } from "react";
import { ArtifactRef } from "../primitives/ArtifactRef.js";
import { DateTime } from "../primitives/DateTime.js";
import { EntityRef } from "../primitives/EntityRef.js";
import { Prose } from "../primitives/Prose.js";
import { Heading, HeadingScope } from "../primitives/Heading.js";
import type { ControlCatalog as ControlCatalogData } from "../generated/types.js";

/**
 * Headless ControlCatalog renderer.
 *
 * Server-component-clean: no useState, no useEffect, no "use client". Compound
 * pattern via Object.assign so consumers can either:
 *   <ControlCatalog data={catalog} />            // default composition
 *   <ControlCatalog data={catalog}>              // DIY composition
 *     <ControlCatalog.Header />
 *     <ControlCatalog.Groups />
 *   </ControlCatalog>
 *
 * Children, if provided, take over rendering entirely — they receive context
 * via `useControlCatalog()`.
 */

// Pull discrete shapes off the discriminated catalog type to keep prop types tight.
type Control = NonNullable<ControlCatalogData["controls"]>[number];
type Group = NonNullable<ControlCatalogData["groups"]>[number];
type AssessmentRequirement = NonNullable<Control["assessment-requirements"]>[number];
type MultiEntryMapping = NonNullable<Control["guidelines"]>[number];

export interface ControlCatalogProps {
  data: ControlCatalogData;
  /**
   * Heading level (1-6) used for the catalog title. Nested sections add fixed
   * offsets: group = +1, control = +2, control subsection labels = +3. Defaults
   * to 1. Set to 2 (or higher) when composing into a host page that already
   * owns the `<h1>`.
   */
  headingLevel?: number;
  children?: ReactNode;
}

function ControlCatalogRoot({ data, headingLevel = 1, children }: ControlCatalogProps) {
  return (
    <HeadingScope level={headingLevel}>
      <article data-gemara-artifact="ControlCatalog" data-gemara-id={data.metadata.id ?? ""}>
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
  data: ControlCatalogData;
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
  data: ControlCatalogData;
}

function Groups({ data }: GroupsProps) {
  const groups = data.groups ?? [];
  const controls = data.controls ?? [];

  if (groups.length === 0) {
    return (
      <section data-gemara-part="groups">
        <ControlList controls={controls} />
      </section>
    );
  }

  // Pre-bucket controls by group id; controls with no group fall into "ungrouped".
  const buckets = new Map<string, Control[]>();
  for (const g of groups) buckets.set(g.id ?? "", []);
  const ungrouped: Control[] = [];
  for (const c of controls) {
    const gid = c.group ?? "";
    const bucket = buckets.get(gid);
    if (bucket) bucket.push(c);
    else ungrouped.push(c);
  }

  return (
    <section data-gemara-part="groups">
      {groups.map((g) => (
        <GroupView
          key={g.id}
          group={g}
          controls={buckets.get(g.id ?? "") ?? []}
        />
      ))}
      {ungrouped.length > 0 ? (
        <GroupView
          group={{
            id: "_ungrouped",
            title: "Ungrouped",
            description: "Controls not assigned to a declared group.",
          }}
          controls={ungrouped}
        />
      ) : null}
    </section>
  );
}

interface GroupViewProps {
  group: Group;
  controls: Control[];
}

function GroupView({ group, controls }: GroupViewProps) {
  return (
    <section data-gemara-part="group" data-gemara-group-id={group.id ?? ""}>
      <Heading offset={1}>{group.title}</Heading>
      {group.description ? <Prose content={group.description} as="p" /> : null}
      <ControlList controls={controls} />
    </section>
  );
}

interface ControlListProps {
  controls: Control[];
}

function ControlList({ controls }: ControlListProps) {
  if (controls.length === 0) {
    return <p data-gemara-empty="controls">No controls in this group.</p>;
  }
  return (
    <ol data-gemara-part="control-list">
      {controls.map((c) => (
        <li key={c.id}>
          <ControlView control={c} />
        </li>
      ))}
    </ol>
  );
}

interface ControlViewProps {
  control: Control;
}

function ControlView({ control }: ControlViewProps) {
  return (
    <article
      data-gemara-part="control"
      data-gemara-control-id={control.id ?? ""}
      id={control.id ? `control-${control.id}` : undefined}
    >
      <header>
        <Heading offset={2}>
          <span data-gemara-part="control-id">{control.id}</span>
          {control.title ? (
            <>
              {" "}
              <span data-gemara-part="control-title">{control.title}</span>
            </>
          ) : null}
        </Heading>
      </header>
      {control.objective ? (
        <section data-gemara-part="objective">
          <Heading offset={3}>Objective</Heading>
          <Prose content={control.objective} as="p" />
        </section>
      ) : null}
      {control["assessment-requirements"] && control["assessment-requirements"].length > 0 ? (
        <RequirementList requirements={control["assessment-requirements"]} />
      ) : null}
      {control.guidelines && control.guidelines.length > 0 ? (
        <Mappings label="Guidelines" mappings={control.guidelines} />
      ) : null}
      {control.threats && control.threats.length > 0 ? (
        <Mappings label="Threats" mappings={control.threats} />
      ) : null}
    </article>
  );
}

interface RequirementListProps {
  requirements: AssessmentRequirement[];
}

function RequirementList({ requirements }: RequirementListProps) {
  return (
    <section data-gemara-part="requirements">
      <Heading offset={3}>Assessment requirements</Heading>
      <ol>
        {requirements.map((r) => (
          <li
            key={r.id}
            data-gemara-part="requirement"
            data-gemara-requirement-id={r.id ?? ""}
          >
            <Prose content={r.text} as="p" />
            {r.applicability && r.applicability.length > 0 ? (
              <p data-gemara-part="applicability">
                Applicability: {r.applicability.join(", ")}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
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

/**
 * Compound API. Object.assign keeps the default top-level renderer callable
 * as `<ControlCatalog>` while still exposing parts at `<ControlCatalog.X>`.
 */
export const ControlCatalog = Object.assign(ControlCatalogRoot, {
  Header,
  Groups,
  Group: GroupView,
  Control: ControlView,
  Requirements: RequirementList,
  Mappings,
});
