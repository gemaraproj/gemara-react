// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { render } from "@testing-library/react";
import { RiskCatalog } from "../src/risk-catalog/index.js";
import { GemaraProvider } from "../src/provider/index.js";
import { isRiskCatalog } from "../src/generated/types.js";
import type { RiskCatalog as RiskCatalogData } from "../src/generated/types.js";

const FIXTURE = resolve(
  __dirname,
  "..",
  "..",
  "gemara",
  "test",
  "test-data",
  "good-risk-catalog.yaml",
);

function loadFixture(): RiskCatalogData {
  const raw = readFileSync(FIXTURE, "utf8");
  const parsed = parseYaml(raw);
  if (!isRiskCatalog(parsed)) {
    throw new Error("Fixture is not a RiskCatalog");
  }
  return parsed;
}

describe("RiskCatalog", () => {
  const data = loadFixture();

  it("narrows the discriminated union via isRiskCatalog", () => {
    expect(isRiskCatalog(data)).toBe(true);
    expect(data.metadata.type).toBe("RiskCatalog");
  });

  it("renders the catalog metadata in the header", () => {
    const { container } = render(<RiskCatalog data={data} />);
    expect(container.querySelector("[data-gemara-artifact='RiskCatalog']")).not.toBeNull();
    if (data.title) {
      expect(
        container.querySelector("[data-gemara-part='title']")?.textContent,
      ).toContain(data.title);
    }
    const meta = container.querySelector("[data-gemara-part='meta']");
    if (data.metadata.id) {
      expect(meta?.textContent).toContain(data.metadata.id);
    }
    if (data.metadata.version) {
      expect(meta?.textContent).toContain(data.metadata.version);
    }
    // The generated Actor type collapses to `{ contact? }`, but real fixtures
    // carry the embedded #Entity name — assert on it via a widened view.
    const authorName = (data.metadata.author as { name?: string }).name;
    if (authorName) {
      expect(meta?.textContent).toContain(authorName);
    }
  });

  it("renders one group per risk category with appetite and max-severity", () => {
    const { container } = render(<RiskCatalog data={data} />);
    const groups = data.groups ?? [];
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) {
      if (!g.id) continue;
      const section = container.querySelector(`[data-gemara-group-id='${g.id}']`);
      expect(section, `expected a rendered group for ${g.id}`).not.toBeNull();
      if (g.appetite) {
        expect(section?.getAttribute("data-gemara-appetite")).toBe(g.appetite);
        expect(
          section?.querySelector("[data-gemara-part='appetite']")?.textContent,
        ).toBe(g.appetite);
      }
      if (g["max-severity"]) {
        expect(
          section?.querySelector("[data-gemara-part='max-severity']")?.textContent,
        ).toBe(g["max-severity"]);
      }
    }
  });

  it("renders one risk per id from the fixture, under its declared group", () => {
    const { container } = render(<RiskCatalog data={data} />);
    const risks = data.risks ?? [];
    expect(risks.length).toBeGreaterThan(0);
    const rendered = container.querySelectorAll("[data-gemara-part='risk']");
    expect(rendered.length).toBe(risks.length);
    for (const r of risks) {
      if (!r.id) continue;
      const el = container.querySelector(`[data-gemara-risk-id='${r.id}']`);
      expect(el, `expected a rendered risk for ${r.id}`).not.toBeNull();
      if (r.group) {
        expect(el?.closest("[data-gemara-part='group']")?.getAttribute("data-gemara-group-id")).toBe(
          r.group,
        );
      }
    }
  });

  it("renders severity and impact for each risk", () => {
    const { container } = render(<RiskCatalog data={data} />);
    for (const r of data.risks ?? []) {
      if (!r.id) continue;
      const el = container.querySelector(`[data-gemara-risk-id='${r.id}']`);
      if (r.severity) {
        expect(el?.getAttribute("data-gemara-severity")).toBe(r.severity);
        expect(
          el?.querySelector("[data-gemara-part='severity']")?.textContent,
        ).toContain(r.severity);
      }
      if (r.impact) {
        expect(
          el?.querySelector("[data-gemara-part='impact']")?.textContent,
        ).toContain(r.impact);
      }
    }
  });

  it("renders RACI owner roles with contact affiliation and email", () => {
    const { container } = render(<RiskCatalog data={data} />);
    const owned = (data.risks ?? []).filter((r) => r.owner);
    expect(owned.length).toBeGreaterThan(0);
    for (const r of owned) {
      const el = container.querySelector(`[data-gemara-risk-id='${r.id}']`);
      const ownerSection = el?.querySelector("[data-gemara-part='owner']");
      expect(ownerSection, `expected an owner section for ${r.id}`).not.toBeNull();
      for (const role of ["responsible", "accountable", "consulted", "informed"] as const) {
        const contacts = r.owner?.[role] ?? [];
        if (contacts.length === 0) continue;
        const roleEl = ownerSection?.querySelector(`[data-gemara-owner-role='${role}']`);
        expect(roleEl, `expected role ${role} on ${r.id}`).not.toBeNull();
        expect(roleEl?.querySelectorAll("[data-gemara-part='contact']").length).toBe(
          contacts.length,
        );
        for (const c of contacts) {
          expect(roleEl?.textContent).toContain(c.name);
          if (c.affiliation) {
            expect(
              roleEl?.querySelector("[data-gemara-part='contact-affiliation']")
                ?.textContent,
            ).toContain(c.affiliation);
          }
          if (c.email) {
            expect(
              roleEl?.querySelector("[data-gemara-part='contact-email']")
                ?.textContent,
            ).toContain(c.email);
          }
        }
      }
    }
  });

  it("renders threat mapping entries with their reference ids", () => {
    const { container } = render(<RiskCatalog data={data} />);
    const refIds = new Set<string>();
    for (const r of data.risks ?? []) {
      for (const m of r.threats ?? []) {
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

  it("groups threat mappings in a collapsed References section", () => {
    const { container } = render(<RiskCatalog data={data} />);
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
      details?.querySelector("[data-gemara-mappings-label='threats']"),
    ).not.toBeNull();
  });

  it("renders an empty state for categories with no risks", () => {
    const { container } = render(<RiskCatalog data={data} />);
    const groups = data.groups ?? [];
    const populated = new Set((data.risks ?? []).map((r) => r.group));
    const emptyGroups = groups.filter((g) => g.id && !populated.has(g.id));
    if (emptyGroups.length > 0) {
      expect(
        container.querySelectorAll("[data-gemara-empty='risks']").length,
      ).toBe(emptyGroups.length);
    }
  });

  it("uses linkResolver from context for threat mappings", () => {
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
        <RiskCatalog data={data} />
      </Resolver>,
    );

    const resolved = container.querySelectorAll("[data-test-resolver]");
    expect(resolved.length).toBeGreaterThan(0);
  });

  it("supports DIY composition via children", () => {
    const { container } = render(
      <RiskCatalog data={data}>
        <RiskCatalog.Header data={data} />
      </RiskCatalog>,
    );
    expect(container.querySelector("[data-gemara-part='header']")).not.toBeNull();
    expect(container.querySelector("[data-gemara-part='groups']")).toBeNull();
  });

  it("defaults the catalog title to <h1>", () => {
    const { container } = render(<RiskCatalog data={data} />);
    expect(container.querySelector("h1[data-gemara-part='title']")).not.toBeNull();
  });

  it("offsets all headings when headingLevel is set", () => {
    const { container } = render(<RiskCatalog data={data} headingLevel={3} />);
    expect(container.querySelector("h3[data-gemara-part='title']")).not.toBeNull();
    if ((data.groups ?? []).length > 0) {
      expect(container.querySelector("h4")).not.toBeNull();
    }
    if ((data.risks ?? []).length > 0) {
      expect(container.querySelector("h5")).not.toBeNull();
    }
  });
});
