// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { render } from "@testing-library/react";
import { GuidanceCatalog } from "../src/guidance-catalog/index.js";
import { GemaraProvider } from "../src/provider/index.js";
import { isGuidanceCatalog } from "../src/generated/types.js";
import type { GuidanceCatalog as GuidanceCatalogData } from "../src/generated/types.js";

const FIXTURE = resolve(
  __dirname,
  "..",
  "..",
  "gemara",
  "test",
  "test-data",
  "good-aigf.yaml",
);

function loadFixture(): GuidanceCatalogData {
  const raw = readFileSync(FIXTURE, "utf8");
  const parsed = parseYaml(raw);
  if (!isGuidanceCatalog(parsed)) {
    throw new Error("Fixture is not a GuidanceCatalog");
  }
  return parsed;
}

describe("GuidanceCatalog", () => {
  const data = loadFixture();

  it("narrows the discriminated union via isGuidanceCatalog", () => {
    expect(isGuidanceCatalog(data)).toBe(true);
    expect(data.metadata.type).toBe("GuidanceCatalog");
  });

  it("renders the catalog header and front-matter", () => {
    const { container, getByText } = render(<GuidanceCatalog data={data} />);
    expect(container.querySelector("[data-gemara-artifact='GuidanceCatalog']")).not.toBeNull();
    if (data.title) expect(getByText(data.title)).toBeTruthy();
    if (data["front-matter"]) {
      expect(container.querySelector("[data-gemara-part='front-matter']")).not.toBeNull();
    }
  });

  it("renders one guideline per id from the fixture", () => {
    const { container } = render(<GuidanceCatalog data={data} />);
    const guidelines = data.guidelines ?? [];
    expect(guidelines.length).toBeGreaterThan(0);
    const rendered = container.querySelectorAll("[data-gemara-part='guideline']");
    expect(rendered.length).toBe(guidelines.length);
    for (const g of guidelines) {
      if (!g.id) continue;
      expect(
        container.querySelector(`[data-gemara-guideline-id='${g.id}']`),
      ).not.toBeNull();
    }
  });

  it("renders inner principle and vector mapping entries with their reference ids", () => {
    // Regression guard: inner MultiEntryMapping entries carry reference-id (not
    // entry-id). Assert the real ids reach the resolver output, not blank labels.
    const { container } = render(<GuidanceCatalog data={data} />);
    const refIds = new Set<string>();
    for (const g of data.guidelines ?? []) {
      for (const m of [...(g.principles ?? []), ...(g.vectors ?? [])]) {
        for (const e of m.entries ?? []) {
          const id = e["entry-id"] ?? e["reference-id"];
          if (id) refIds.add(id);
        }
      }
    }
    expect(refIds.size).toBeGreaterThan(0);
    for (const id of refIds) {
      expect(
        container.querySelector(`[data-gemara-ref-id='${id}']`),
        `expected a rendered ref for ${id}`,
      ).not.toBeNull();
    }
  });

  it("renders statements with their ids and nested recommendations", () => {
    const { container } = render(<GuidanceCatalog data={data} />);
    const statements = (data.guidelines ?? []).flatMap((g) => g.statements ?? []);
    expect(statements.length).toBeGreaterThan(0);
    expect(container.querySelectorAll("[data-gemara-part='statement']").length).toBe(
      statements.length,
    );
    for (const st of statements) {
      const el = container.querySelector(`[data-gemara-statement-id='${st.id}']`);
      expect(el, `expected statement ${st.id}`).not.toBeNull();
      if (st.recommendations?.length) {
        expect(
          el?.querySelectorAll("[data-gemara-part='recommendation']").length,
        ).toBe(st.recommendations.length);
      }
    }
  });

  it("renders rationale goals and see-also cross-references", () => {
    const { container } = render(<GuidanceCatalog data={data} />);
    const goals = (data.guidelines ?? []).flatMap((g) => g.rationale?.goals ?? []);
    expect(goals.length).toBeGreaterThan(0);
    expect(container.querySelectorAll("[data-gemara-part='goal']").length).toBe(goals.length);
    const seeAlso = (data.guidelines ?? []).flatMap((g) => g["see-also"] ?? []);
    expect(seeAlso.length).toBeGreaterThan(0);
    for (const id of seeAlso) {
      expect(
        container.querySelector(`[data-gemara-part='see-also'] [data-gemara-ref-id='${id}']`),
        `expected a see-also ref for ${id}`,
      ).not.toBeNull();
    }
  });

  it("renders catalog-level exemptions with redirect mappings", () => {
    const withExemptions: GuidanceCatalogData = {
      ...data,
      exemptions: [
        {
          description: "Legacy batch pipelines",
          reason: "Scheduled for decommission",
          redirect: { "reference-id": "AIR", entries: [{ "reference-id": "AIR-PREV-001" }] },
        },
      ],
    };
    const { container } = render(<GuidanceCatalog data={withExemptions} />);
    const section = container.querySelector("[data-gemara-part='exemptions']");
    expect(section).not.toBeNull();
    expect(section?.querySelectorAll("[data-gemara-part='exemption']").length).toBe(1);
    expect(section?.textContent).toContain("Scheduled for decommission");
    expect(
      section?.querySelector("[data-gemara-mappings-label='redirect'] [data-gemara-ref-id='AIR-PREV-001']"),
    ).not.toBeNull();
    // Fixture has none, so the default composition emits no section.
    expect(
      render(<GuidanceCatalog data={data} />).container.querySelector("[data-gemara-part='exemptions']"),
    ).toBeNull();
  });

  it("groups principle and vector mappings in a collapsed References section", () => {
    const { container } = render(<GuidanceCatalog data={data} />);
    const details = container.querySelector(
      "details[data-gemara-part='references']",
    ) as HTMLDetailsElement | null;
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
    expect(
      details?.querySelector("summary[data-gemara-part='references-summary']")
        ?.textContent,
    ).toBe("References to Other Documents");
    expect(
      details?.querySelector("[data-gemara-mappings-label='principles']"),
    ).not.toBeNull();
    expect(
      container.querySelector(
        "details[data-gemara-part='references'] [data-gemara-mappings-label='vectors']",
      ),
    ).not.toBeNull();
  });

  it("uses linkResolver from context for cross-references", () => {
    const Resolver = ({ children }: { children: React.ReactNode }) => (
      <GemaraProvider
        linkResolver={(ref, c) => (
          <a
            href={`#test-${ref.referenceId ?? "ref"}-${ref.id}`}
            data-test-resolver=""
          >
            {c}
          </a>
        )}
      >
        {children}
      </GemaraProvider>
    );

    const { container } = render(
      <Resolver>
        <GuidanceCatalog data={data} />
      </Resolver>,
    );

    const resolved = container.querySelectorAll("[data-test-resolver]");
    expect(resolved.length).toBeGreaterThan(0);
  });

  it("supports DIY composition via children", () => {
    const { container } = render(
      <GuidanceCatalog data={data}>
        <GuidanceCatalog.Header data={data} />
      </GuidanceCatalog>,
    );
    expect(container.querySelector("[data-gemara-part='header']")).not.toBeNull();
    expect(container.querySelector("[data-gemara-part='groups']")).toBeNull();
  });

  it("defaults the catalog title to <h1>", () => {
    const { container } = render(<GuidanceCatalog data={data} />);
    expect(container.querySelector("h1[data-gemara-part='title']")).not.toBeNull();
  });

  it("offsets all headings when headingLevel is set", () => {
    const { container } = render(<GuidanceCatalog data={data} headingLevel={3} />);
    expect(container.querySelector("h3[data-gemara-part='title']")).not.toBeNull();
    // group +1 -> h4, guideline +2 -> h5, subsections +3 -> h6
    if ((data.groups ?? []).length > 0) {
      expect(container.querySelector("h4")).not.toBeNull();
    }
    if ((data.guidelines ?? []).length > 0) {
      expect(container.querySelector("h5")).not.toBeNull();
    }
  });

  it("clamps heading level at h6", () => {
    const { container } = render(<GuidanceCatalog data={data} headingLevel={5} />);
    expect(container.querySelectorAll("h6").length).toBeGreaterThan(0);
    expect(container.querySelector("h7")).toBeNull();
  });
});
