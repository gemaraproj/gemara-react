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
});
