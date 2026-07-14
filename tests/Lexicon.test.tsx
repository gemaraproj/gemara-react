// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { render } from "@testing-library/react";
import { Lexicon } from "../src/lexicon/index.js";
import { GemaraProvider } from "../src/provider/index.js";
import { isLexicon } from "../src/generated/types.js";
import type { Lexicon as LexiconData } from "../src/generated/types.js";

const FIXTURE = resolve(
  __dirname,
  "..",
  "..",
  "gemara",
  "test",
  "test-data",
  "good-lexicon.yaml",
);

function loadFixture(): LexiconData {
  const raw = readFileSync(FIXTURE, "utf8");
  const parsed = parseYaml(raw);
  if (!isLexicon(parsed)) {
    throw new Error("Fixture is not a Lexicon");
  }
  return parsed;
}

describe("Lexicon", () => {
  const data = loadFixture();

  it("narrows the discriminated union via isLexicon", () => {
    expect(isLexicon(data)).toBe(true);
    expect(data.metadata.type).toBe("Lexicon");
  });

  it("renders the lexicon metadata in the header", () => {
    const { container, getByText } = render(<Lexicon data={data} />);
    expect(container.querySelector("[data-gemara-artifact='Lexicon']")).not.toBeNull();
    if (data.title) expect(getByText(data.title)).toBeTruthy();
    if (data.metadata.id) expect(getByText(data.metadata.id)).toBeTruthy();
    // Author renders through EntityRef. The generated Actor type only keeps
    // `contact?`, so assert on the headless attribute rather than typed fields.
    expect(container.querySelector("[data-gemara-entity]")).not.toBeNull();
  });

  it("renders one term per id from the fixture with an anchor id", () => {
    const { container } = render(<Lexicon data={data} />);
    const terms = data.terms ?? [];
    expect(terms.length).toBeGreaterThan(0);
    const rendered = container.querySelectorAll("[data-gemara-part='term']");
    expect(rendered.length).toBe(terms.length);
    for (const t of terms) {
      if (!t.id) continue;
      const el = container.querySelector(`[data-gemara-term-id='${t.id}']`);
      expect(el).not.toBeNull();
      expect(el?.getAttribute("id")).toBe(`term-${t.id}`);
    }
  });

  it("renders each term's definition as prose", () => {
    const { container } = render(<Lexicon data={data} />);
    const definitions = container.querySelectorAll(
      "[data-gemara-part='definition'] [data-gemara-prose]",
    );
    expect(definitions.length).toBe((data.terms ?? []).length);
    const first = (data.terms ?? [])[0];
    expect(first).toBeDefined();
    expect(container.textContent).toContain(
      (first?.definition ?? "").trim().slice(0, 20),
    );
  });

  it("renders synonyms individually, only for terms that declare them", () => {
    const { container } = render(<Lexicon data={data} />);
    const withSynonyms = (data.terms ?? []).filter(
      (t) => (t.synonyms ?? []).length > 0,
    );
    const blocks = container.querySelectorAll("[data-gemara-part='synonyms']");
    expect(blocks.length).toBe(withSynonyms.length);
    for (const t of withSynonyms) {
      for (const s of t.synonyms ?? []) {
        expect(
          container.querySelector(`[data-gemara-synonym='${s}']`),
        ).not.toBeNull();
      }
    }
  });

  it("renders references inside an uncontrolled <details> with linked citations", () => {
    const { container } = render(<Lexicon data={data} />);
    const withRefs = (data.terms ?? []).filter(
      (t) => (t.references ?? []).length > 0,
    );
    expect(withRefs.length).toBeGreaterThan(0);
    const details = container.querySelectorAll("details[data-gemara-part='references']");
    expect(details.length).toBe(withRefs.length);
    // Collapsed by default: no `open` attribute.
    expect(container.querySelector("details[open]")).toBeNull();
    const firstRef = (withRefs[0]?.references ?? [])[0];
    expect(firstRef).toBeDefined();
    const citation = container.querySelector("[data-gemara-part='citation']");
    expect(citation?.textContent).toContain(firstRef?.citation ?? "");
    if (firstRef?.url) {
      // Default resolver renders an <a> when the reference carries a url.
      const anchor = citation?.querySelector("a[data-gemara-ref='artifact']");
      expect(anchor?.getAttribute("href")).toBe(firstRef.url);
    }
  });

  it("uses linkResolver from context for citation links", () => {
    const { container } = render(
      <GemaraProvider
        linkResolver={(ref, c) => (
          <a href={`#test-${ref.id}`} data-test-resolver="">
            {c}
          </a>
        )}
      >
        <Lexicon data={data} />
      </GemaraProvider>,
    );
    const resolved = container.querySelectorAll("[data-test-resolver]");
    expect(resolved.length).toBeGreaterThan(0);
  });

  it("renders draft status and metadata.lexicon when present", () => {
    // The shared fixture carries neither, so inject them onto a valid lexicon
    // derived from the fixture to exercise the render paths.
    const augmented: LexiconData = {
      ...data,
      metadata: {
        ...data.metadata,
        draft: true,
        lexicon: { "reference-id": "upstream-lexicon", remarks: "supersedes" },
      },
    };
    const { container } = render(<Lexicon data={augmented} />);
    const draft = container.querySelector("[data-gemara-part='draft']");
    expect(draft?.textContent).toBe("Yes");
    const lexRef = container.querySelector("[data-gemara-part='lexicon-ref']");
    expect(lexRef).not.toBeNull();
    expect(
      lexRef?.querySelector(
        "[data-gemara-ref='artifact'][data-gemara-ref-id='upstream-lexicon']",
      ),
    ).not.toBeNull();
    expect(lexRef?.textContent).toContain("supersedes");
  });

  it("renders an empty state when there are no terms", () => {
    const empty: LexiconData = { ...data, terms: [] };
    const { container } = render(<Lexicon data={empty} />);
    expect(container.querySelector("[data-gemara-empty='terms']")).not.toBeNull();
    expect(container.querySelector("[data-gemara-part='term']")).toBeNull();
  });

  it("supports DIY composition via children", () => {
    const { container } = render(
      <Lexicon data={data}>
        <Lexicon.Header data={data} />
      </Lexicon>,
    );
    expect(container.querySelector("[data-gemara-part='header']")).not.toBeNull();
    expect(container.querySelector("[data-gemara-part='terms']")).toBeNull();
  });

  it("defaults the lexicon title to <h1>", () => {
    const { container } = render(<Lexicon data={data} />);
    expect(container.querySelector("h1[data-gemara-part='title']")).not.toBeNull();
  });

  it("offsets all headings when headingLevel is set", () => {
    const { container } = render(<Lexicon data={data} headingLevel={3} />);
    expect(container.querySelector("h3[data-gemara-part='title']")).not.toBeNull();
    if ((data.terms ?? []).length > 0) {
      expect(container.querySelector("h4")).not.toBeNull();
    }
  });
});
