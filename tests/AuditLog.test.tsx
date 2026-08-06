// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { render } from "@testing-library/react";
import { AuditLog } from "../src/audit-log/index.js";
import { GemaraProvider } from "../src/provider/index.js";
import { isAuditLog } from "../src/generated/types.js";
import type { AuditLog as AuditLogData } from "../src/generated/types.js";

const FIXTURE = resolve(
  __dirname,
  "..",
  "..",
  "gemara",
  "test",
  "test-data",
  "good-audit-log.yaml",
);

function loadFixture(): AuditLogData {
  const raw = readFileSync(FIXTURE, "utf8");
  const parsed = parseYaml(raw);
  if (!isAuditLog(parsed)) {
    throw new Error("Fixture is not an AuditLog");
  }
  return parsed;
}

describe("AuditLog", () => {
  const data = loadFixture();

  it("narrows the discriminated union via isAuditLog", () => {
    expect(isAuditLog(data)).toBe(true);
    expect(data.metadata.type).toBe("AuditLog");
  });

  it("renders the log metadata in the header", () => {
    const { container, getByText } = render(<AuditLog data={data} />);
    expect(container.querySelector("[data-gemara-artifact='AuditLog']")).not.toBeNull();
    if (data.metadata.id) expect(getByText(data.metadata.id)).toBeTruthy();
    if (data.metadata.description) expect(getByText(data.metadata.description)).toBeTruthy();
    // Author renders through EntityRef.
    expect(container.querySelector("[data-gemara-entity]")).not.toBeNull();
  });

  it("renders the target resource with its entity fields and environment", () => {
    const { container } = render(<AuditLog data={data} />);
    const target = container.querySelector("[data-gemara-part='target']");
    expect(target).not.toBeNull();
    // The fixture target is `gemara-repo` (type Software); the OpenAPI
    // generator drops the #Entity embed but the renderer reads it defensively.
    expect(
      target?.querySelector("[data-gemara-entity='Software']"),
    ).not.toBeNull();
    expect(target?.textContent).toContain("gemaraproj/gemara");
    expect(
      target?.querySelector("[data-gemara-part='environment']")?.textContent,
    ).toBe("production");
    // target.uri renders as a resolvable link via the default resolver.
    expect(
      target?.querySelector("a[href='https://github.com/gemaraproj/gemara']"),
    ).not.toBeNull();
    // target.owner renders as a contact with affiliation.
    expect(target?.textContent).toContain("Gemara Maintainers");
    expect(target?.textContent).toContain("OpenSSF");
  });

  it("renders RACI owner roles with their contacts", () => {
    const { container } = render(<AuditLog data={data} />);
    const owner = container.querySelector("[data-gemara-part='owner']");
    expect(owner).not.toBeNull();
    const responsible = owner?.querySelector("[data-gemara-raci-role='responsible']");
    expect(responsible?.textContent).toContain("Jane Auditor");
    expect(responsible?.textContent).toContain("External Audit Firm");
    const accountable = owner?.querySelector("[data-gemara-raci-role='accountable']");
    expect(accountable?.textContent).toContain("Project Lead");
    // Roles absent from the fixture render nothing.
    expect(owner?.querySelector("[data-gemara-raci-role='consulted']")).toBeNull();
  });

  it("renders the summary", () => {
    const { container } = render(<AuditLog data={data} />);
    const summary = container.querySelector("[data-gemara-part='summary']");
    expect(summary?.textContent).toContain(data.summary);
  });

  it("renders one criterion per criteria entry", () => {
    const { container } = render(<AuditLog data={data} />);
    const criteria = data.criteria ?? [];
    expect(criteria.length).toBeGreaterThan(0);
    const rendered = container.querySelectorAll("[data-gemara-part='criterion']");
    expect(rendered.length).toBe(criteria.length);
    expect(
      container.querySelector(
        "[data-gemara-part='criteria'] [data-gemara-ref-id='security-policy']",
      ),
    ).not.toBeNull();
  });

  it("renders one result per id with type attributes", () => {
    const { container } = render(<AuditLog data={data} />);
    const results = data.results ?? [];
    expect(results.length).toBeGreaterThan(0);
    const rendered = container.querySelectorAll("[data-gemara-part='result']");
    expect(rendered.length).toBe(results.length);
    for (const r of results) {
      const el = container.querySelector(`[data-gemara-result-id='${r.id}']`);
      expect(el, `expected a rendered result for ${r.id}`).not.toBeNull();
      expect(el?.getAttribute("data-gemara-result-type")).toBe(r.type);
    }
    // The four fixture result types all surface for CSS targeting.
    for (const type of ["Strength", "Gap", "Finding", "Observation"]) {
      expect(
        container.querySelector(`[data-gemara-result-type='${type}']`),
      ).not.toBeNull();
    }
  });

  it("wraps each result's criteria-reference in a collapsed References section", () => {
    const { container } = render(<AuditLog data={data} />);
    const details = container.querySelector(
      "details[data-gemara-part='references']",
    ) as HTMLDetailsElement | null;
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
    const summary = details?.querySelector(
      "summary[data-gemara-part='references-summary']",
    );
    expect(summary?.textContent).toBe("References to Other Documents");
    expect(
      details?.querySelector("[data-gemara-mappings-label='criteria']"),
    ).not.toBeNull();
    // Inner entry ids reach the resolver output.
    const entryIds = new Set<string>();
    for (const r of data.results ?? []) {
      for (const e of r["criteria-reference"]?.entries ?? []) {
        const id = e["entry-id"] ?? e["reference-id"];
        if (id) entryIds.add(id);
      }
    }
    expect(entryIds.size).toBeGreaterThan(0);
    for (const id of entryIds) {
      expect(
        container.querySelector(`[data-gemara-ref-id='${id}']`),
        `expected a rendered ref for ${id}`,
      ).not.toBeNull();
    }
  });

  it("renders top-level criteria-reference remarks", () => {
    // The shared fixture never sets remarks on the outer MultiEntryMapping;
    // inject one to exercise the render path.
    const results = data.results ?? [];
    const augmented: AuditLogData = {
      ...data,
      results: results.map((r, i) =>
        i === 0 && r["criteria-reference"]
          ? {
              ...r,
              "criteria-reference": {
                ...r["criteria-reference"],
                remarks: "Scoped to release 2025.2",
              },
            }
          : r,
      ),
    };
    const { container } = render(<AuditLog data={augmented} />);
    expect(
      container.querySelector("[data-gemara-part='mappings']")?.textContent,
    ).toContain("Scoped to release 2025.2");
  });

  it("renders evidence items with type and collected timestamp", () => {
    const { container } = render(<AuditLog data={data} />);
    const evidence = (data.results ?? []).flatMap((r) => r.evidence ?? []);
    expect(evidence.length).toBeGreaterThan(0);
    const rendered = container.querySelectorAll("[data-gemara-part='evidence-item']");
    expect(rendered.length).toBe(evidence.length);
    for (const e of evidence) {
      if (!e.id) continue;
      const el = container.querySelector(`[data-gemara-evidence-id='${e.id}']`);
      expect(el, `expected rendered evidence ${e.id}`).not.toBeNull();
      expect(el?.getAttribute("data-gemara-evidence-type")).toBe(e.type);
      // collected-at renders as a machine-readable <time>.
      expect(
        el?.querySelector(`time[datetime='${e["collected-at"]}']`),
      ).not.toBeNull();
    }
  });

  it("renders an evidence payload as verbatim preformatted text", () => {
    const results = data.results ?? [];
    const target = results.findIndex((r) => (r.evidence ?? []).length > 0);
    if (target < 0) throw new Error("fixture has no evidence");
    const augmented = {
      ...data,
      results: results.map((r, i) =>
        i === target
          ? {
              ...r,
              evidence: (r.evidence ?? []).map((e, j) =>
                j === 0 ? { ...e, payload: '{"score":42}' } : e,
              ),
            }
          : r,
      ),
    };
    const { container } = render(<AuditLog data={augmented} />);
    const payload = container.querySelector(
      "[data-gemara-part='evidence-payload']",
    );
    expect(payload).not.toBeNull();
    expect(payload?.tagName).toBe("PRE");
    expect(payload?.textContent).toBe('{"score":42}');
  });

  it("renders recommendations and reflects the required flag", () => {
    const { container } = render(<AuditLog data={data} />);
    // REC-01 carries `required: true` in the fixture.
    const rec1 = container.querySelector("[data-gemara-recommendation-id='REC-01']");
    expect(rec1).not.toBeNull();
    expect(rec1?.getAttribute("data-gemara-required")).toBe("true");
    expect(rec1?.querySelector("[data-gemara-part='required']")).not.toBeNull();
    // REC-02 omits `required` (CUE default false).
    const rec2 = container.querySelector("[data-gemara-recommendation-id='REC-02']");
    expect(rec2).not.toBeNull();
    expect(rec2?.getAttribute("data-gemara-required")).toBe("false");
    expect(rec2?.querySelector("[data-gemara-part='required']")).toBeNull();
    expect(rec2?.textContent).toContain(
      "Formalize the private vulnerability reporting process",
    );
  });

  it("renders metadata mapping-references as a bibliography with links", () => {
    const { container } = render(<AuditLog data={data} />);
    const section = container.querySelector("[data-gemara-part='mapping-references']");
    expect(section).not.toBeNull();
    const items = section?.querySelectorAll("[data-gemara-part='mapping-reference']");
    // The generator drops mapping-references from Metadata; the renderer reads
    // it defensively — the fixture declares five.
    expect(items?.length).toBe(5);
    expect(
      section?.querySelector("a[href='https://baseline.openssf.org']"),
    ).not.toBeNull();
    expect(section?.textContent).toContain("Open Source Project Security Baseline");
    expect(section?.textContent).toContain("2025.1");
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
        <AuditLog data={data} />
      </Resolver>,
    );

    const resolved = container.querySelectorAll("[data-test-resolver]");
    expect(resolved.length).toBeGreaterThan(0);
  });

  it("supports DIY composition via children", () => {
    const { container } = render(
      <AuditLog data={data}>
        <AuditLog.Header data={data} />
      </AuditLog>,
    );
    expect(container.querySelector("[data-gemara-part='header']")).not.toBeNull();
    expect(container.querySelector("[data-gemara-part='results']")).toBeNull();
    expect(container.querySelector("[data-gemara-part='target']")).toBeNull();
  });

  it("defaults the log title to <h1>", () => {
    const { container } = render(<AuditLog data={data} />);
    expect(container.querySelector("h1[data-gemara-part='title']")).not.toBeNull();
  });

  it("offsets all headings when headingLevel is set", () => {
    const { container } = render(<AuditLog data={data} headingLevel={3} />);
    expect(container.querySelector("h3[data-gemara-part='title']")).not.toBeNull();
    // top-level section +1 -> h4, result +2 -> h5, subsections +3 -> h6
    expect(container.querySelector("h4")).not.toBeNull();
    if ((data.results ?? []).length > 0) {
      expect(container.querySelector("h5")).not.toBeNull();
    }
  });

  it("clamps heading level at h6", () => {
    const { container } = render(<AuditLog data={data} headingLevel={5} />);
    expect(container.querySelectorAll("h6").length).toBeGreaterThan(0);
    expect(container.querySelector("h7")).toBeNull();
  });
});
