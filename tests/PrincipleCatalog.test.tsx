// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { render } from "@testing-library/react";
import { PrincipleCatalog } from "../src/principle-catalog/index.js";
import { isPrincipleCatalog } from "../src/generated/types.js";
import type { PrincipleCatalog as PrincipleCatalogData } from "../src/generated/types.js";

const FIXTURE = resolve(
  __dirname,
  "..",
  "..",
  "gemara",
  "test",
  "test-data",
  "good-aigf-principles.yaml",
);

function loadFixture(): PrincipleCatalogData {
  const raw = readFileSync(FIXTURE, "utf8");
  const parsed = parseYaml(raw);
  if (!isPrincipleCatalog(parsed)) {
    throw new Error("Fixture is not a PrincipleCatalog");
  }
  return parsed;
}

describe("PrincipleCatalog", () => {
  const data = loadFixture();

  it("narrows the discriminated union via isPrincipleCatalog", () => {
    expect(isPrincipleCatalog(data)).toBe(true);
    expect(data.metadata.type).toBe("PrincipleCatalog");
  });

  it("renders the catalog metadata in the header", () => {
    const { container, getByText } = render(<PrincipleCatalog data={data} />);
    expect(container.querySelector("[data-gemara-artifact='PrincipleCatalog']")).not.toBeNull();
    if (data.title) expect(getByText(data.title)).toBeTruthy();
    if (data.metadata.id) expect(getByText(data.metadata.id)).toBeTruthy();
  });

  it("renders one principle per id from the fixture", () => {
    const { container } = render(<PrincipleCatalog data={data} />);
    const principles = data.principles ?? [];
    expect(principles.length).toBeGreaterThan(0);
    const rendered = container.querySelectorAll("[data-gemara-part='principle']");
    expect(rendered.length).toBe(principles.length);
    for (const p of principles) {
      if (!p.id) continue;
      expect(
        container.querySelector(`[data-gemara-principle-id='${p.id}']`),
      ).not.toBeNull();
    }
  });

  it("renders principle rationale when present", () => {
    // The shared fixture has no rationale entries, so inject one onto a valid
    // catalog derived from the fixture to exercise the render path.
    const principles = data.principles ?? [];
    expect(principles.length).toBeGreaterThan(0);
    const augmented: PrincipleCatalogData = {
      ...data,
      principles: principles.map((p, i) =>
        i === 0 ? { ...p, rationale: "Because least privilege limits blast radius." } : p,
      ),
    };
    const { container } = render(<PrincipleCatalog data={augmented} />);
    const el = container.querySelector("[data-gemara-part='rationale']");
    expect(el).not.toBeNull();
    expect(el?.textContent).toContain("least privilege");
  });

  it("supports DIY composition via children", () => {
    const { container } = render(
      <PrincipleCatalog data={data}>
        <PrincipleCatalog.Header data={data} />
      </PrincipleCatalog>,
    );
    expect(container.querySelector("[data-gemara-part='header']")).not.toBeNull();
    expect(container.querySelector("[data-gemara-part='groups']")).toBeNull();
  });

  it("defaults the catalog title to <h1>", () => {
    const { container } = render(<PrincipleCatalog data={data} />);
    expect(container.querySelector("h1[data-gemara-part='title']")).not.toBeNull();
  });

  it("offsets all headings when headingLevel is set", () => {
    const { container } = render(<PrincipleCatalog data={data} headingLevel={3} />);
    expect(container.querySelector("h3[data-gemara-part='title']")).not.toBeNull();
    if ((data.groups ?? []).length > 0) {
      expect(container.querySelector("h4")).not.toBeNull();
    }
    if ((data.principles ?? []).length > 0) {
      expect(container.querySelector("h5")).not.toBeNull();
    }
  });
});
