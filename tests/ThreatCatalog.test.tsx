// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { render } from "@testing-library/react";
import { ThreatCatalog } from "../src/threat-catalog/index.js";
import { GemaraProvider } from "../src/provider/index.js";
import { isThreatCatalog } from "../src/generated/types.js";
import type { ThreatCatalog as ThreatCatalogData } from "../src/generated/types.js";

const FIXTURE = resolve(
  __dirname,
  "..",
  "..",
  "gemara",
  "test",
  "test-data",
  "good-threat-catalog.yaml",
);

function loadFixture(): ThreatCatalogData {
  const raw = readFileSync(FIXTURE, "utf8");
  const parsed = parseYaml(raw);
  if (!isThreatCatalog(parsed)) {
    throw new Error("Fixture is not a ThreatCatalog");
  }
  return parsed;
}

describe("ThreatCatalog", () => {
  const data = loadFixture();

  it("narrows the discriminated union via isThreatCatalog", () => {
    expect(isThreatCatalog(data)).toBe(true);
    expect(data.metadata.type).toBe("ThreatCatalog");
  });

  it("renders the catalog metadata in the header", () => {
    const { container } = render(<ThreatCatalog data={data} />);
    expect(container.querySelector("[data-gemara-artifact='ThreatCatalog']")).not.toBeNull();
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

  it("renders one threat per id from the fixture", () => {
    const { container } = render(<ThreatCatalog data={data} />);
    const threats = data.threats ?? [];
    expect(threats.length).toBeGreaterThan(0);
    const rendered = container.querySelectorAll("[data-gemara-part='threat']");
    expect(rendered.length).toBe(threats.length);
    for (const t of threats) {
      if (!t.id) continue;
      expect(
        container.querySelector(`[data-gemara-threat-id='${t.id}']`),
      ).not.toBeNull();
    }
  });

  it("renders threat actors", () => {
    const { container } = render(<ThreatCatalog data={data} />);
    const actorCount = (data.threats ?? []).reduce(
      (n, t) => n + (t.actors?.length ?? 0),
      0,
    );
    if (actorCount > 0) {
      expect(container.querySelectorAll("[data-gemara-part='actor']").length).toBe(
        actorCount,
      );
      expect(container.querySelector("[data-gemara-entity]")).not.toBeNull();
    }
  });

  it("renders capability and vector mapping entries with their reference ids", () => {
    const { container } = render(<ThreatCatalog data={data} />);
    // Inner MultiEntryMapping entries carry reference-id; the renderer must
    // surface those (not blank) onto the resolver output.
    const refIds = new Set<string>();
    for (const t of data.threats ?? []) {
      for (const m of t.capabilities ?? []) {
        for (const e of m.entries ?? []) {
          const id = e["entry-id"] ?? e["reference-id"];
          if (id) refIds.add(id);
        }
      }
      for (const m of t.vectors ?? []) {
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

  it("groups capability and vector mappings in a collapsed References section", () => {
    const { container } = render(<ThreatCatalog data={data} />);
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
      details?.querySelector("[data-gemara-mappings-label='capabilities']"),
    ).not.toBeNull();
  });

  it("uses linkResolver from context for capability/vector mappings", () => {
    const Resolver = ({ children }: { children: React.ReactNode }) => (
      <GemaraProvider
        linkResolver={(ref, c) => (
          <a href={`#test-${ref.referenceId ?? "ref"}-${ref.id}`} data-test-resolver="">
            {c}
          </a>
        )}
      >
        {children}
      </GemaraProvider>
    );

    const { container } = render(
      <Resolver>
        <ThreatCatalog data={data} />
      </Resolver>,
    );

    const resolved = container.querySelectorAll("[data-test-resolver]");
    expect(resolved.length).toBeGreaterThan(0);
  });

  it("supports DIY composition via children", () => {
    const { container } = render(
      <ThreatCatalog data={data}>
        <ThreatCatalog.Header data={data} />
      </ThreatCatalog>,
    );
    expect(container.querySelector("[data-gemara-part='header']")).not.toBeNull();
    expect(container.querySelector("[data-gemara-part='groups']")).toBeNull();
  });

  it("defaults the catalog title to <h1>", () => {
    const { container } = render(<ThreatCatalog data={data} />);
    expect(container.querySelector("h1[data-gemara-part='title']")).not.toBeNull();
  });

  it("offsets all headings when headingLevel is set", () => {
    const { container } = render(<ThreatCatalog data={data} headingLevel={3} />);
    expect(container.querySelector("h3[data-gemara-part='title']")).not.toBeNull();
    if ((data.groups ?? []).length > 0) {
      expect(container.querySelector("h4")).not.toBeNull();
    }
    if ((data.threats ?? []).length > 0) {
      expect(container.querySelector("h5")).not.toBeNull();
    }
  });
});
