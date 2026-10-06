// SPDX-License-Identifier: Apache-2.0
import type { ReactNode } from "react";
import { ArtifactRef } from "../primitives/ArtifactRef.js";
import { DateTime } from "../primitives/DateTime.js";
import { EntityRef } from "../primitives/EntityRef.js";
import { Prose } from "../primitives/Prose.js";
import { Heading, HeadingScope } from "../primitives/Heading.js";
import { IdPrefixScope, useIdPrefix } from "../primitives/IdPrefix.js";
import { mappingReferenceUrl } from "../primitives/DocumentReferences.js";
import type { Lexicon as LexiconData } from "../generated/types.js";

/**
 * Headless Lexicon renderer.
 *
 * Server-component-clean: no useState, no useEffect, no "use client". Compound
 * pattern via Object.assign so consumers can either:
 *   <Lexicon data={lexicon} />            // default composition
 *   <Lexicon data={lexicon}>              // DIY composition
 *     <Lexicon.Header data={lexicon} />
 *     <Lexicon.Terms data={lexicon} />
 *   </Lexicon>
 *
 * Children, if provided, take over rendering entirely.
 */

type LexiconTerm = NonNullable<LexiconData["terms"]>[number];
type LexiconReference = NonNullable<LexiconTerm["references"]>[number];

export interface LexiconProps {
  data: LexiconData;
  /**
   * Heading level (1-6) used for the lexicon title. Nested sections add fixed
   * offsets: term = +1, term subsection labels = +2. Defaults to 1. Set to 2
   * (or higher) when composing into a host page that already owns the `<h1>`.
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

function LexiconRoot({ data, headingLevel = 1, idPrefix, children }: LexiconProps) {
  return (
    <IdPrefixScope prefix={idPrefix}>
      <HeadingScope level={headingLevel}>
        <article data-gemara-artifact="Lexicon" data-gemara-id={data.metadata.id ?? ""}>
          {children ?? (
            <>
              <Header data={data} />
              <Terms data={data} />
            </>
          )}
        </article>
      </HeadingScope>
    </IdPrefixScope>
  );
}

interface HeaderProps {
  data: LexiconData;
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
        {metadata.draft !== undefined ? (
          <>
            <dt>Draft</dt>
            <dd data-gemara-part="draft">{metadata.draft ? "Yes" : "No"}</dd>
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
        {metadata.lexicon ? (
          <>
            <dt>Lexicon</dt>
            <dd data-gemara-part="lexicon-ref">
              <ArtifactRef
                kind="artifact"
                id={metadata.lexicon["reference-id"] ?? ""}
                url={mappingReferenceUrl(
                  metadata["mapping-references"],
                  metadata.lexicon["reference-id"],
                )}
                relation="lexicon"
              >
                {metadata.lexicon["reference-id"]}
              </ArtifactRef>
              {metadata.lexicon.remarks ? <> — {metadata.lexicon.remarks}</> : null}
            </dd>
          </>
        ) : null}
      </dl>
    </header>
  );
}

interface TermsProps {
  data: LexiconData;
}

function Terms({ data }: TermsProps) {
  const terms = data.terms ?? [];
  if (terms.length === 0) {
    return (
      <section data-gemara-part="terms">
        <p data-gemara-empty="terms">No terms in this lexicon.</p>
      </section>
    );
  }
  return (
    <section data-gemara-part="terms">
      <ol data-gemara-part="term-list">
        {terms.map((t) => (
          <li key={t.id}>
            <TermView term={t} />
          </li>
        ))}
      </ol>
    </section>
  );
}

interface TermViewProps {
  term: LexiconTerm;
}

function TermView({ term }: TermViewProps) {
  const idPrefix = useIdPrefix();
  const references = term.references ?? [];
  const synonyms = term.synonyms ?? [];
  return (
    <article
      data-gemara-part="term"
      data-gemara-term-id={term.id ?? ""}
      id={term.id ? `${idPrefix}term-${term.id}` : undefined}
    >
      <header>
        <Heading offset={1}>
          <span data-gemara-part="term-id">{term.id}</span>
          {term.title ? (
            <>
              {" "}
              <span data-gemara-part="term-title">{term.title}</span>
            </>
          ) : null}
        </Heading>
      </header>
      {term.definition ? (
        <section data-gemara-part="definition">
          <Prose content={term.definition} as="p" />
        </section>
      ) : null}
      {synonyms.length > 0 ? (
        <p data-gemara-part="synonyms">
          Synonyms:{" "}
          {synonyms.map((s, i) => (
            <span key={`${s}-${i}`}>
              {i > 0 ? ", " : null}
              <span data-gemara-synonym={s}>{s}</span>
            </span>
          ))}
        </p>
      ) : null}
      {references.length > 0 ? (
        <References>
          <Citations references={references} />
        </References>
      ) : null}
    </article>
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

interface CitationsProps {
  references: LexiconReference[];
}

function Citations({ references }: CitationsProps) {
  return (
    <ul data-gemara-part="citation-list">
      {references.map((r, i) => (
        <li key={`${r.citation ?? "citation"}-${i}`} data-gemara-part="citation">
          <ArtifactRef
            kind="artifact"
            id={r.citation ?? ""}
            url={r.url}
            relation="citation"
          >
            {r.citation}
          </ArtifactRef>
        </li>
      ))}
    </ul>
  );
}

/**
 * Compound API. Object.assign keeps the default top-level renderer callable
 * as `<Lexicon>` while still exposing parts at `<Lexicon.X>`.
 */
export const Lexicon = Object.assign(LexiconRoot, {
  Header,
  Terms,
  Term: TermView,
  References,
  Citations,
});
