// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { render } from "@testing-library/react";
import { GuidanceCatalog } from "../src/guidance-catalog/index.js";
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

  it("renders inner principle mapping entries with their reference ids", () => {
    // Regression guard: inner MultiEntryMapping entries carry reference-id (not
    // entry-id). Assert the real ids reach the resolver output, not blank labels.
    const { container } = render(<GuidanceCatalog data={data} />);
    const refIds = new Set<string>();
    for (const g of data.guidelines ?? []) {
      for (const m of g.principles ?? []) {
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

  it("defaults the catalog title to <h1>", () => {
    const { container } = render(<GuidanceCatalog data={data} />);
    expect(container.querySelector("h1[data-gemara-part='title']")).not.toBeNull();
  });

  it("offsets all headings when headingLevel is set", () => {
    const { container } = render(<GuidanceCatalog data={data} headingLevel={2} />);
    expect(container.querySelector("h2[data-gemara-part='title']")).not.toBeNull();
  });
});
