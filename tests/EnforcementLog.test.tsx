// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { render } from "@testing-library/react";
import { EnforcementLog } from "../src/enforcement-log/index.js";
import { GemaraProvider } from "../src/provider/index.js";
import { isEnforcementLog } from "../src/generated/types.js";
import type { EnforcementLog as EnforcementLogData } from "../src/generated/types.js";

const FIXTURE = resolve(
  __dirname,
  "..",
  "..",
  "gemara",
  "test",
  "test-data",
  "good-enforcement-log.yaml",
);

function loadFixture(): EnforcementLogData {
  const raw = readFileSync(FIXTURE, "utf8");
  const parsed = parseYaml(raw);
  if (!isEnforcementLog(parsed)) {
    throw new Error("Fixture is not an EnforcementLog");
  }
  return parsed;
}

/** The generator drops metadata["mapping-references"]; read it defensively. */
function fixtureMappingReferences(
  data: EnforcementLogData,
): { id: string; title: string; url?: string }[] {
  const metadata = data.metadata as {
    "mapping-references"?: { id: string; title: string; url?: string }[];
  };
  return metadata["mapping-references"] ?? [];
}

describe("EnforcementLog", () => {
  const data = loadFixture();

  it("narrows the discriminated union via isEnforcementLog", () => {
    expect(isEnforcementLog(data)).toBe(true);
    expect(data.metadata.type).toBe("EnforcementLog");
  });

  it("renders the log metadata in the header", () => {
    const { container, getByText } = render(<EnforcementLog data={data} />);
    const root = container.querySelector(
      "[data-gemara-artifact='EnforcementLog']",
    );
    expect(root).not.toBeNull();
    expect(root?.getAttribute("data-gemara-id")).toBe(data.metadata.id);
    if (data.metadata.id) expect(getByText(data.metadata.id)).toBeTruthy();
    if (data.metadata.description) {
      expect(getByText(data.metadata.description)).toBeTruthy();
    }
    // Actor's #Entity embed (name/id/…) is dropped by the generator; widen.
    const author = data.metadata.author as { name?: string } | undefined;
    if (author?.name) {
      expect(getByText(author.name)).toBeTruthy();
    }
  });

  it("renders the aggregate disposition with a value attribute", () => {
    const { container } = render(<EnforcementLog data={data} />);
    const disposition = container.querySelector(
      "[data-gemara-part='disposition']",
    );
    expect(disposition).not.toBeNull();
    expect(disposition?.getAttribute("data-gemara-disposition")).toBe(
      data.disposition,
    );
    expect(disposition?.textContent).toContain(data.disposition);
    // Root also carries the aggregate disposition for whole-log styling.
    expect(
      container
        .querySelector("[data-gemara-artifact='EnforcementLog']")
        ?.getAttribute("data-gemara-disposition"),
    ).toBe(data.disposition);
  });

  it("renders the target resource with entity, environment, and owner", () => {
    const { container, getByText } = render(<EnforcementLog data={data} />);
    const target = container.querySelector("[data-gemara-part='target']");
    expect(target).not.toBeNull();
    // Entity embed fields are dropped from the generated Resource but present
    // in real documents — assert they reach the output.
    expect(getByText("gemaraproj/gemara")).toBeTruthy();
    expect(
      container.querySelector("[data-gemara-part='target-environment']")
        ?.textContent,
    ).toBe("production");
    const owner = container.querySelector("[data-gemara-part='target-owner']");
    expect(owner?.textContent).toContain("Gemara Maintainers");
    expect(owner?.textContent).toContain("OpenSSF");
    // target.uri renders through the resolver, never a hand-built anchor.
    expect(
      container.querySelector(
        "[data-gemara-part='target-meta'] a[href='https://github.com/gemaraproj/gemara']",
      ),
    ).not.toBeNull();
  });

  it("renders one action per fixture entry with its disposition", () => {
    const { container } = render(<EnforcementLog data={data} />);
    const actions = data.actions ?? [];
    expect(actions.length).toBeGreaterThan(0);
    const rendered = container.querySelectorAll("[data-gemara-part='action']");
    expect(rendered.length).toBe(actions.length);
    for (const [i, action] of actions.entries()) {
      expect(rendered[i]?.getAttribute("data-gemara-disposition")).toBe(
        action.disposition,
      );
    }
  });

  it("renders each action's message, method, timestamps, and steps", () => {
    const { container, getByText } = render(<EnforcementLog data={data} />);
    for (const action of data.actions ?? []) {
      if (action.message) expect(getByText(action.message)).toBeTruthy();
    }
    // Method entry refs resolve with their entry ids.
    const methodIds = new Set(
      (data.actions ?? []).map((a) => a.method?.["entry-id"]).filter(Boolean),
    );
    expect(methodIds.size).toBeGreaterThan(0);
    for (const id of methodIds) {
      expect(
        container.querySelector(
          `[data-gemara-part='action-method'] [data-gemara-ref-id='${id}']`,
        ),
        `expected a rendered method ref for ${id}`,
      ).not.toBeNull();
    }
    // Timestamps render as machine-readable <time> elements.
    const starts = (data.actions ?? []).map((a) => a.start).filter(Boolean);
    for (const start of starts) {
      expect(container.querySelector(`time[datetime='${start}']`)).not.toBeNull();
    }
    // Ended timestamps too (optional per schema).
    const ends = (data.actions ?? []).map((a) => a.end).filter(Boolean);
    expect(ends.length).toBeGreaterThan(0);
    for (const end of ends) {
      expect(container.querySelector(`time[datetime='${end}']`)).not.toBeNull();
    }
    // Steps render as code entries.
    const stepCount = (data.actions ?? []).reduce(
      (n, a) => n + (a.steps ?? []).length,
      0,
    );
    const renderedSteps = container.querySelectorAll(
      "[data-gemara-part='action-step'] code",
    );
    expect(renderedSteps.length).toBe(stepCount);
  });

  it("renders justification assessments with result, requirement, plan, and log refs", () => {
    const { container } = render(<EnforcementLog data={data} />);
    const findings = (data.actions ?? []).flatMap(
      (a) => a.justification?.assessments ?? [],
    );
    expect(findings.length).toBeGreaterThan(0);
    const rendered = container.querySelectorAll("[data-gemara-part='assessment']");
    expect(rendered.length).toBe(findings.length);
    for (const [i, finding] of findings.entries()) {
      expect(rendered[i]?.getAttribute("data-gemara-result")).toBe(finding.result);
    }
    // Every requirement / plan / log entry-id must reach resolver output.
    const refIds = new Set<string>();
    for (const f of findings) {
      for (const m of [f.requirement, f.plan, f.log]) {
        if (m?.["entry-id"]) refIds.add(m["entry-id"]);
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

  it("renders justification exceptions with remarks", () => {
    const { container, getByText } = render(<EnforcementLog data={data} />);
    const exceptions = (data.actions ?? []).flatMap(
      (a) => a.justification?.exceptions ?? [],
    );
    expect(exceptions.length).toBeGreaterThan(0);
    const rendered = container.querySelectorAll("[data-gemara-part='exception']");
    expect(rendered.length).toBe(exceptions.length);
    for (const e of exceptions) {
      if (e["reference-id"]) {
        expect(
          container.querySelector(
            `[data-gemara-part='exception'] [data-gemara-ref-id='${e["reference-id"]}']`,
          ),
        ).not.toBeNull();
      }
      if (e.remarks) expect(getByText(e.remarks)).toBeTruthy();
    }
  });

  it("renders metadata mapping-references in a collapsed References section", () => {
    const { container } = render(<EnforcementLog data={data} />);
    const refs = fixtureMappingReferences(data);
    expect(refs.length).toBeGreaterThan(0);
    const details = container.querySelector(
      "details[data-gemara-part='references']",
    ) as HTMLDetailsElement | null;
    expect(details).not.toBeNull();
    // Collapsed by default: no `open` attribute, stays server-component-clean.
    expect(details?.open).toBe(false);
    const summary = details?.querySelector(
      "summary[data-gemara-part='references-summary']",
    );
    expect(summary?.textContent).toBe("References to Other Documents");
    const items = details?.querySelectorAll(
      "[data-gemara-part='mapping-reference']",
    );
    expect(items?.length).toBe(refs.length);
    // A reference with a url resolves to a real anchor by default.
    const withUrl = refs.find((r) => r.url);
    expect(withUrl).toBeTruthy();
    expect(
      details?.querySelector(`a[href='${withUrl?.url}']`),
    ).not.toBeNull();
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
        <EnforcementLog data={data} />
      </Resolver>,
    );

    // The fixture has method + justification refs, so the resolver must fire.
    const resolved = container.querySelectorAll("[data-test-resolver]");
    expect(resolved.length).toBeGreaterThan(0);
  });

  it("supports DIY composition via children", () => {
    const { container } = render(
      <EnforcementLog data={data}>
        <EnforcementLog.Header data={data} />
      </EnforcementLog>,
    );
    expect(container.querySelector("[data-gemara-part='header']")).not.toBeNull();
    expect(container.querySelector("[data-gemara-part='actions']")).toBeNull();
    expect(container.querySelector("[data-gemara-part='target']")).toBeNull();
  });

  it("defaults section headings to <h2> and offsets when headingLevel is set", () => {
    const { container } = render(<EnforcementLog data={data} />);
    // Target/Actions sections are base+1 -> h2 by default.
    expect(
      container.querySelector("[data-gemara-part='actions'] h2"),
    ).not.toBeNull();

    const offset = render(<EnforcementLog data={data} headingLevel={3} />);
    // base 3: sections +1 -> h4, actions +2 -> h5, subsections +3 -> h6.
    expect(
      offset.container.querySelector("[data-gemara-part='actions'] h4"),
    ).not.toBeNull();
    expect(
      offset.container.querySelector("[data-gemara-part='action'] h5"),
    ).not.toBeNull();
    expect(
      offset.container.querySelector("[data-gemara-part='justification'] h6"),
    ).not.toBeNull();
    expect(offset.container.querySelector("h7")).toBeNull();
  });
});
