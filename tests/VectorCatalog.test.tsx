// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { render } from "@testing-library/react";
import { VectorCatalog } from "../src/vector-catalog/index.js";
import { isVectorCatalog } from "../src/generated/types.js";
import type { VectorCatalog as VectorCatalogData } from "../src/generated/types.js";

const FIXTURE = resolve(
  __dirname,
  "..",
  "..",
  "gemara",
  "test",
  "test-data",
  "good-aigf-vectors.yaml",
);

function loadFixture(): VectorCatalogData {
  const raw = readFileSync(FIXTURE, "utf8");
  const parsed = parseYaml(raw);
  if (!isVectorCatalog(parsed)) {
    throw new Error("Fixture is not a VectorCatalog");
  }
  return parsed;
}

describe("VectorCatalog", () => {
  const data = loadFixture();

  it("narrows the discriminated union via isVectorCatalog", () => {
    expect(isVectorCatalog(data)).toBe(true);
    expect(data.metadata.type).toBe("VectorCatalog");
  });

  it("renders the catalog metadata in the header", () => {
    const { container, getByText } = render(<VectorCatalog data={data} />);
    expect(container.querySelector("[data-gemara-artifact='VectorCatalog']")).not.toBeNull();
    if (data.title) expect(getByText(data.title)).toBeTruthy();
    if (data.metadata.id) expect(getByText(data.metadata.id)).toBeTruthy();
  });

  it("renders one vector per id from the fixture", () => {
    const { container } = render(<VectorCatalog data={data} />);
    const vectors = data.vectors ?? [];
    expect(vectors.length).toBeGreaterThan(0);
    const rendered = container.querySelectorAll("[data-gemara-part='vector']");
    expect(rendered.length).toBe(vectors.length);
    for (const v of vectors) {
      if (!v.id) continue;
      expect(
        container.querySelector(`[data-gemara-vector-id='${v.id}']`),
      ).not.toBeNull();
    }
  });

  it("renders vector applicability when present", () => {
    // The shared fixture has no applicability entries, so inject one onto a
    // valid catalog derived from the fixture to exercise the render path.
    const vectors = data.vectors ?? [];
    expect(vectors.length).toBeGreaterThan(0);
    const augmented: VectorCatalogData = {
      ...data,
      vectors: vectors.map((v, i) =>
        i === 0 ? { ...v, applicability: ["cloud-native", "on-prem"] } : v,
      ),
    };
    const { container } = render(<VectorCatalog data={augmented} />);
    const el = container.querySelector("[data-gemara-part='applicability']");
    expect(el).not.toBeNull();
    expect(el?.textContent).toContain("cloud-native");
    expect(el?.textContent).toContain("on-prem");
  });

  it("supports DIY composition via children", () => {
    const { container } = render(
      <VectorCatalog data={data}>
        <VectorCatalog.Header data={data} />
      </VectorCatalog>,
    );
    expect(container.querySelector("[data-gemara-part='header']")).not.toBeNull();
    expect(container.querySelector("[data-gemara-part='groups']")).toBeNull();
  });

  it("defaults the catalog title to <h1>", () => {
    const { container } = render(<VectorCatalog data={data} />);
    expect(container.querySelector("h1[data-gemara-part='title']")).not.toBeNull();
  });

  it("offsets all headings when headingLevel is set", () => {
    const { container } = render(<VectorCatalog data={data} headingLevel={3} />);
    expect(container.querySelector("h3[data-gemara-part='title']")).not.toBeNull();
    if ((data.groups ?? []).length > 0) {
      expect(container.querySelector("h4")).not.toBeNull();
    }
    if ((data.vectors ?? []).length > 0) {
      expect(container.querySelector("h5")).not.toBeNull();
    }
  });
});
