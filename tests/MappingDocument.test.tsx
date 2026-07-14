// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { render } from "@testing-library/react";
import { MappingDocument } from "../src/mapping-document/index.js";
import { isMappingDocument } from "../src/generated/types.js";
import type { MappingDocument as MappingDocumentData } from "../src/generated/types.js";

const FIXTURE = resolve(
  __dirname,
  "..",
  "..",
  "gemara",
  "test",
  "test-data",
  "good-mapping-document.yaml",
);

function loadFixture(): MappingDocumentData {
  const raw = readFileSync(FIXTURE, "utf8");
  const parsed = parseYaml(raw);
  if (!isMappingDocument(parsed)) {
    throw new Error("Fixture is not a MappingDocument");
  }
  return parsed;
}

/** The OpenAPI generator drops `reference-id` from TypedMapping; read it the
 * same defensive way the renderer does. */
function refIdOf(ref: MappingDocumentData["source-reference"]): string | undefined {
  return (ref as { "reference-id"?: string })["reference-id"];
}

describe("MappingDocument", () => {
  const data = loadFixture();

  it("narrows the discriminated union via isMappingDocument", () => {
    expect(isMappingDocument(data)).toBe(true);
    expect(data.metadata.type).toBe("MappingDocument");
  });

  it("renders the document metadata in the header", () => {
    const { container, getByText } = render(<MappingDocument data={data} />);
    expect(
      container.querySelector("[data-gemara-artifact='MappingDocument']"),
    ).not.toBeNull();
    expect(getByText(data.title)).toBeTruthy();
    if (data.metadata.id) expect(getByText(data.metadata.id)).toBeTruthy();
    if (data.metadata.version) {
      expect(getByText(data.metadata.version)).toBeTruthy();
    }
    // Author renders through EntityRef. The generated Actor type drops the
    // embedded Entity fields (name/id/type), so read name defensively.
    const authorName = (data.metadata.author as { name?: string }).name;
    expect(authorName).toBeTruthy();
    const author = container.querySelector("[data-gemara-entity]");
    expect(author).not.toBeNull();
    expect(author?.textContent).toBe(authorName);
  });

  it("renders one mapping-reference per entry, linked when a url is present", () => {
    const { container } = render(<MappingDocument data={data} />);
    const refs = data.metadata["mapping-references"] ?? [];
    expect(refs.length).toBeGreaterThan(0);
    const rendered = container.querySelectorAll(
      "[data-gemara-part='mapping-reference']",
    );
    expect(rendered.length).toBe(refs.length);
    for (const r of refs) {
      const item = container.querySelector(
        `[data-gemara-part='mapping-reference'][data-gemara-reference-id='${r.id}']`,
      );
      expect(item).not.toBeNull();
      expect(item?.textContent).toContain(r.title);
      expect(item?.textContent).toContain(r.version);
      if (r.url) {
        // Default link resolver emits an anchor when a url exists.
        expect(item?.querySelector(`a[href='${r.url}']`)).not.toBeNull();
      }
    }
  });

  it("renders scope with source/target entry types and document remarks", () => {
    const { container } = render(<MappingDocument data={data} />);
    const scope = container.querySelector("[data-gemara-part='scope']");
    expect(scope).not.toBeNull();

    const source = scope?.querySelector("[data-gemara-part='source-reference']");
    expect(source).not.toBeNull();
    const sourceId = refIdOf(data["source-reference"]);
    if (sourceId) expect(source?.textContent).toContain(sourceId);
    expect(source?.textContent).toContain(
      `(${data["source-reference"]["entry-type"]} entries)`,
    );

    const target = scope?.querySelector("[data-gemara-part='target-reference']");
    expect(target).not.toBeNull();
    expect(target?.textContent).toContain(
      `(${data["target-reference"]["entry-type"]} entries)`,
    );

    if (data.remarks) {
      const remarks = scope?.querySelector("[data-gemara-part='remarks']");
      expect(remarks).not.toBeNull();
      expect(remarks?.textContent).toContain("CRA Annex I Part I");
    }
  });

  it("resolves scope references against mapping-reference urls", () => {
    const { container } = render(<MappingDocument data={data} />);
    const sourceId = refIdOf(data["source-reference"]);
    expect(sourceId).toBeTruthy();
    const url = (data.metadata["mapping-references"] ?? []).find(
      (r) => r.id === sourceId,
    )?.url;
    expect(url).toBeTruthy();
    const source = container.querySelector(
      "[data-gemara-part='source-reference']",
    );
    expect(source?.querySelector(`a[href='${url}']`)).not.toBeNull();
  });

  it("renders applicability groups from metadata", () => {
    // `applicability-groups` is dropped from the generated Metadata type but
    // present in real documents; the renderer reads it defensively.
    const groups =
      (data.metadata as {
        "applicability-groups"?: { id: string; title: string }[];
      })["applicability-groups"] ?? [];
    expect(groups.length).toBeGreaterThan(0);
    const { container } = render(<MappingDocument data={data} />);
    const rendered = container.querySelectorAll(
      "[data-gemara-part='applicability-group']",
    );
    expect(rendered.length).toBe(groups.length);
    for (const g of groups) {
      const el = container.querySelector(
        `[data-gemara-part='applicability-group'][data-gemara-group-id='${g.id}']`,
      );
      expect(el).not.toBeNull();
      expect(el?.textContent).toContain(g.title);
    }
  });

  it("renders one mapping per fixture entry with id and relationship", () => {
    const { container } = render(<MappingDocument data={data} />);
    const mappings = data.mappings ?? [];
    expect(mappings.length).toBeGreaterThan(0);
    const rendered = container.querySelectorAll("[data-gemara-part='mapping']");
    expect(rendered.length).toBe(mappings.length);
    for (const m of mappings) {
      const el = container.querySelector(
        `[data-gemara-part='mapping'][data-gemara-mapping-id='${m.id}']`,
      );
      expect(el).not.toBeNull();
      expect(el?.getAttribute("data-gemara-relationship")).toBe(m.relationship);
      expect(
        el?.querySelector("[data-gemara-part='mapping-source']")?.textContent,
      ).toContain(m.source);
      expect(
        el?.querySelector("[data-gemara-part='relationship']")?.textContent,
      ).toBe(m.relationship);
    }
  });

  it("renders every mapping target with entry id, confidence, applicability, rationale", () => {
    const { container } = render(<MappingDocument data={data} />);
    for (const m of data.mappings ?? []) {
      const el = container.querySelector(
        `[data-gemara-part='mapping'][data-gemara-mapping-id='${m.id}']`,
      );
      const targets = m.targets ?? [];
      const renderedTargets =
        el?.querySelectorAll("[data-gemara-part='mapping-target']") ?? [];
      expect(renderedTargets.length).toBe(targets.length);
      targets.forEach((t, i) => {
        const tEl = renderedTargets[i];
        expect(tEl?.getAttribute("data-gemara-entry-id")).toBe(t["entry-id"]);
        if (t["confidence-level"]) {
          const conf = tEl?.querySelector(
            "[data-gemara-part='confidence-level']",
          );
          expect(conf?.textContent).toContain(String(t["confidence-level"]));
          expect(conf?.getAttribute("data-gemara-confidence")).toBe(
            String(t["confidence-level"]),
          );
        }
        if (t.applicability && t.applicability.length > 0) {
          expect(
            tEl?.querySelector("[data-gemara-part='applicability']")
              ?.textContent,
          ).toContain(t.applicability.join(", "));
        }
        if (t.rationale) {
          expect(
            tEl?.querySelector("[data-gemara-part='rationale']")?.textContent,
          ).toBeTruthy();
        }
        if (t.strength) {
          expect(
            tEl?.querySelector("[data-gemara-part='strength']")?.textContent,
          ).toContain(`${t.strength}/10`);
        }
      });
    }
  });

  it("renders remarks for a no-match mapping with no targets", () => {
    const noMatch = (data.mappings ?? []).find(
      (m) => m.relationship === "no-match",
    );
    expect(noMatch).toBeTruthy();
    const { container } = render(<MappingDocument data={data} />);
    const el = container.querySelector(
      `[data-gemara-part='mapping'][data-gemara-mapping-id='${noMatch?.id}']`,
    );
    expect(el).not.toBeNull();
    expect(
      el?.querySelector("[data-gemara-part='remarks']")?.textContent,
    ).toContain("OSPS-GV-01");
    expect(el?.querySelector("[data-gemara-part='mapping-targets']")).toBeNull();
  });

  it("renders draft, date, and lexicon metadata when present", () => {
    // The shared fixture carries none of these; augment a valid document to
    // exercise the render paths (same approach as the VectorCatalog tests).
    const augmented: MappingDocumentData = {
      ...data,
      metadata: {
        ...data.metadata,
        draft: true,
        date: "2025-03-03T00:00:00Z",
        lexicon: { "reference-id": "LEX-1", remarks: "Shared vocabulary" },
      },
    };
    const { container } = render(<MappingDocument data={augmented} />);
    expect(
      container.querySelector("[data-gemara-part='draft']")?.textContent,
    ).toBe("Yes");
    expect(
      container.querySelector("time[datetime='2025-03-03T00:00:00Z']"),
    ).not.toBeNull();
    const lexicon = container.querySelector("[data-gemara-part='lexicon']");
    expect(lexicon?.textContent).toContain("LEX-1");
    expect(lexicon?.textContent).toContain("Shared vocabulary");
  });

  it("supports DIY composition via children", () => {
    const { container } = render(
      <MappingDocument data={data}>
        <MappingDocument.Header data={data} />
      </MappingDocument>,
    );
    expect(container.querySelector("[data-gemara-part='header']")).not.toBeNull();
    expect(container.querySelector("[data-gemara-part='mappings']")).toBeNull();
  });

  it("defaults the document title to <h1>", () => {
    const { container } = render(<MappingDocument data={data} />);
    expect(container.querySelector("h1[data-gemara-part='title']")).not.toBeNull();
  });

  it("offsets all headings when headingLevel is set", () => {
    const { container } = render(<MappingDocument data={data} headingLevel={3} />);
    expect(container.querySelector("h3[data-gemara-part='title']")).not.toBeNull();
    // Section headings sit at +1.
    expect(container.querySelector("h4")).not.toBeNull();
    if ((data.mappings ?? []).length > 0) {
      // Individual mappings sit at +2.
      expect(container.querySelector("h5")).not.toBeNull();
    }
  });
});

/**
 * A document can carry the right `metadata.type` (so the runtime guard passes)
 * while omitting schema-required fields like `source-reference` /
 * `target-reference` — the guards only check the discriminator. The renderer
 * must degrade (render nothing per missing field) rather than throw, or SSR
 * consumers crash on invalid documents.
 */
describe("MappingDocument defensive rendering", () => {
  it("renders a type-tagged document missing schema-required fields without throwing", () => {
    const minimal = {
      title: "Skeleton Mapping Document",
      metadata: { type: "MappingDocument" },
    } as unknown as MappingDocumentData;
    expect(isMappingDocument(minimal)).toBe(true);
    const { container } = render(<MappingDocument data={minimal} />);
    expect(
      container.querySelector("[data-gemara-artifact='MappingDocument']"),
    ).not.toBeNull();
    expect(container.textContent).toContain("Skeleton Mapping Document");
  });
});
