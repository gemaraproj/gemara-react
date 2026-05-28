// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { render } from "@testing-library/react";
import { CapabilityCatalog } from "../src/capability-catalog/index.js";
import { isCapabilityCatalog } from "../src/generated/types.js";
import type { CapabilityCatalog as CapabilityCatalogData } from "../src/generated/types.js";

const FIXTURE = resolve(
  __dirname,
  "..",
  "..",
  "gemara",
  "test",
  "test-data",
  "good-capability-catalog.yaml",
);

function loadFixture(): CapabilityCatalogData {
  const raw = readFileSync(FIXTURE, "utf8");
  const parsed = parseYaml(raw);
  if (!isCapabilityCatalog(parsed)) {
    throw new Error("Fixture is not a CapabilityCatalog");
  }
  return parsed;
}

describe("CapabilityCatalog", () => {
  const data = loadFixture();

  it("narrows the discriminated union via isCapabilityCatalog", () => {
    expect(isCapabilityCatalog(data)).toBe(true);
    expect(data.metadata.type).toBe("CapabilityCatalog");
  });

  it("renders the catalog metadata in the header", () => {
    const { container } = render(<CapabilityCatalog data={data} />);
    expect(container.querySelector("[data-gemara-artifact='CapabilityCatalog']")).not.toBeNull();
    // title may equal the description in some fixtures, so target the title slot.
    if (data.title) {
      expect(
        container.querySelector("[data-gemara-part='title']")?.textContent,
      ).toContain(data.title);
    }
    if (data.metadata.id) {
      expect(
        container.querySelector("[data-gemara-part='meta']")?.textContent,
      ).toContain(data.metadata.id);
    }
  });

  it("renders one capability per id from the fixture", () => {
    const { container } = render(<CapabilityCatalog data={data} />);
    const capabilities = data.capabilities ?? [];
    expect(capabilities.length).toBeGreaterThan(0);
    const rendered = container.querySelectorAll("[data-gemara-part='capability']");
    expect(rendered.length).toBe(capabilities.length);
    for (const c of capabilities) {
      if (!c.id) continue;
      expect(
        container.querySelector(`[data-gemara-capability-id='${c.id}']`),
      ).not.toBeNull();
    }
  });

  it("supports DIY composition via children", () => {
    const { container } = render(
      <CapabilityCatalog data={data}>
        <CapabilityCatalog.Header data={data} />
      </CapabilityCatalog>,
    );
    expect(container.querySelector("[data-gemara-part='header']")).not.toBeNull();
    expect(container.querySelector("[data-gemara-part='groups']")).toBeNull();
  });

  it("defaults the catalog title to <h1>", () => {
    const { container } = render(<CapabilityCatalog data={data} />);
    expect(container.querySelector("h1[data-gemara-part='title']")).not.toBeNull();
  });

  it("offsets all headings when headingLevel is set", () => {
    const { container } = render(<CapabilityCatalog data={data} headingLevel={3} />);
    expect(container.querySelector("h3[data-gemara-part='title']")).not.toBeNull();
    if ((data.groups ?? []).length > 0) {
      expect(container.querySelector("h4")).not.toBeNull();
    }
    if ((data.capabilities ?? []).length > 0) {
      expect(container.querySelector("h5")).not.toBeNull();
    }
  });
});
