import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { render } from "@testing-library/react";
import { ControlCatalog } from "../src/control-catalog/index.js";
import { GemaraProvider } from "../src/provider/index.js";
import { isControlCatalog } from "../src/generated/types.js";
import type { ControlCatalog as ControlCatalogData } from "../src/generated/types.js";

const FIXTURE = resolve(
  __dirname,
  "..",
  "..",
  "gemara",
  "test",
  "test-data",
  "good-ccc.yaml",
);

function loadFixture(): ControlCatalogData {
  const raw = readFileSync(FIXTURE, "utf8");
  const parsed = parseYaml(raw);
  if (!isControlCatalog(parsed)) {
    throw new Error("Fixture is not a ControlCatalog");
  }
  return parsed;
}

describe("ControlCatalog", () => {
  const data = loadFixture();

  it("narrows the discriminated union via isControlCatalog", () => {
    expect(isControlCatalog(data)).toBe(true);
    expect(data.metadata.type).toBe("ControlCatalog");
  });

  it("renders the catalog metadata in the header", () => {
    const { container, getByText } = render(<ControlCatalog data={data} />);
    expect(container.querySelector("[data-gemara-artifact='ControlCatalog']")).not.toBeNull();
    if (data.title) expect(getByText(data.title)).toBeTruthy();
    if (data.metadata.id) expect(getByText(data.metadata.id)).toBeTruthy();
  });

  it("renders one control per id from the fixture", () => {
    const { container } = render(<ControlCatalog data={data} />);
    const controls = data.controls ?? [];
    expect(controls.length).toBeGreaterThan(0);
    const rendered = container.querySelectorAll("[data-gemara-part='control']");
    expect(rendered.length).toBe(controls.length);
    for (const c of controls) {
      if (!c.id) continue;
      expect(
        container.querySelector(`[data-gemara-control-id='${c.id}']`),
      ).not.toBeNull();
    }
  });

  it("renders inner mapping entries with their reference ids", () => {
    // Regression guard: inner MultiEntryMapping entries carry reference-id (not
    // entry-id). Assert the real ids reach the resolver output, not blank labels.
    const { container } = render(<ControlCatalog data={data} />);
    const refIds = new Set<string>();
    for (const c of data.controls ?? []) {
      for (const m of [...(c.guidelines ?? []), ...(c.threats ?? [])]) {
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
        <ControlCatalog data={data} />
      </Resolver>,
    );

    // The fixture has at least one mapping entry, so the custom resolver must fire.
    const resolved = container.querySelectorAll("[data-test-resolver]");
    expect(resolved.length).toBeGreaterThan(0);
  });

  it("supports DIY composition via children", () => {
    const { container } = render(
      <ControlCatalog data={data}>
        <ControlCatalog.Header data={data} />
      </ControlCatalog>,
    );
    expect(container.querySelector("[data-gemara-part='header']")).not.toBeNull();
    expect(container.querySelector("[data-gemara-part='groups']")).toBeNull();
  });

  it("defaults the catalog title to <h1>", () => {
    const { container } = render(<ControlCatalog data={data} />);
    expect(container.querySelector("h1[data-gemara-part='title']")).not.toBeNull();
  });

  it("offsets all headings when headingLevel is set", () => {
    const { container } = render(<ControlCatalog data={data} headingLevel={3} />);
    expect(container.querySelector("h3[data-gemara-part='title']")).not.toBeNull();
    // group +1 -> h4, control +2 -> h5, subsections +3 -> h6
    if ((data.groups ?? []).length > 0) {
      expect(container.querySelector("h4")).not.toBeNull();
    }
    if ((data.controls ?? []).length > 0) {
      expect(container.querySelector("h5")).not.toBeNull();
    }
  });

  it("clamps heading level at h6", () => {
    const { container } = render(<ControlCatalog data={data} headingLevel={5} />);
    // Title at h5, group +1 = h6, control +2 would be h7 -> clamped to h6.
    expect(container.querySelectorAll("h6").length).toBeGreaterThan(0);
    expect(container.querySelector("h7")).toBeNull();
  });
});
