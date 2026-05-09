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
});
