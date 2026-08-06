// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { render } from "@testing-library/react";
import { EvaluationLog } from "../src/evaluation-log/index.js";
import { isEvaluationLog } from "../src/generated/types.js";
import type { EvaluationLog as EvaluationLogData } from "../src/generated/types.js";

const FIXTURE = resolve(
  __dirname,
  "..",
  "..",
  "gemara",
  "test",
  "test-data",
  "pvtr-baseline-scan.yaml",
);

function loadFixture(): EvaluationLogData {
  const raw = readFileSync(FIXTURE, "utf8");
  const parsed = parseYaml(raw);
  if (!isEvaluationLog(parsed)) {
    throw new Error("Fixture is not an EvaluationLog");
  }
  return parsed;
}

describe("EvaluationLog", () => {
  const data = loadFixture();

  it("narrows the discriminated union via isEvaluationLog", () => {
    expect(isEvaluationLog(data)).toBe(true);
    expect(data.metadata.type).toBe("EvaluationLog");
  });

  it("renders the log metadata in the header", () => {
    const { container } = render(<EvaluationLog data={data} />);
    expect(
      container.querySelector("[data-gemara-artifact='EvaluationLog']"),
    ).not.toBeNull();
    expect(
      container
        .querySelector("[data-gemara-artifact='EvaluationLog']")
        ?.getAttribute("data-gemara-id"),
    ).toBe(data.metadata.id);
    const title = container.querySelector("[data-gemara-part='title']");
    expect(title?.textContent).toBe(data.metadata.id);
    const header = container.querySelector("[data-gemara-part='header']");
    expect(header?.textContent).toContain(data.metadata.description ?? "");
    expect(header?.textContent).toContain(data.metadata["gemara-version"] ?? "");
  });

  it("renders the aggregate result with a data-gemara-result attribute", () => {
    const { container } = render(<EvaluationLog data={data} />);
    const badge = container.querySelector(
      "[data-gemara-part='header'] [data-gemara-part='result']",
    );
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute("data-gemara-result")).toBe(data.result);
    expect(badge?.textContent).toBe(data.result);
  });

  it("renders the target resource when present", () => {
    const { container } = render(<EvaluationLog data={data} />);
    expect(data.target).toBeDefined();
    const target = container.querySelector("[data-gemara-part='target']");
    expect(target).not.toBeNull();
    // The fixture target carries runtime name/type from the CUE #Resource
    // shape; EntityRef surfaces them.
    expect(target?.textContent).toContain("GitHub Repository");
  });

  it("omits the target section when the document has none", () => {
    const { target: _dropped, ...rest } = data;
    const withoutTarget: EvaluationLogData = { ...rest };
    const { container } = render(<EvaluationLog data={withoutTarget} />);
    expect(container.querySelector("[data-gemara-part='target']")).toBeNull();
  });

  it("renders one evaluation per fixture entry, keyed by control id", () => {
    const { container } = render(<EvaluationLog data={data} />);
    const evaluations = data.evaluations ?? [];
    expect(evaluations.length).toBeGreaterThan(0);
    const rendered = container.querySelectorAll("[data-gemara-part='evaluation']");
    expect(rendered.length).toBe(evaluations.length);
    for (const e of evaluations) {
      const controlId = e.control?.["entry-id"];
      if (!controlId) continue;
      expect(
        container.querySelector(
          `[data-gemara-part='evaluation'][data-gemara-control-id='${controlId}']`,
        ),
      ).not.toBeNull();
    }
  });

  it("renders control references through the link resolver", () => {
    const { container } = render(<EvaluationLog data={data} />);
    const ref = container.querySelector(
      "[data-gemara-part='control'] [data-gemara-ref='entry'][data-gemara-ref-id='OSPS-AC-01']",
    );
    expect(ref).not.toBeNull();
    expect(ref?.textContent).toBe("OSPS-AC-01");
  });

  it("renders every assessment log with requirement, result, and message", () => {
    const { container } = render(<EvaluationLog data={data} />);
    const evaluations = data.evaluations ?? [];
    const allLogs = evaluations.flatMap((e) => e["assessment-logs"] ?? []);
    const rendered = container.querySelectorAll("[data-gemara-part='assessment-log']");
    expect(rendered.length).toBe(allLogs.length);

    const first = container.querySelector(
      "[data-gemara-requirement-id='OSPS-AC-01.01']",
    );
    expect(first).not.toBeNull();
    expect(
      first?.querySelector("[data-gemara-part='result']")?.getAttribute(
        "data-gemara-result",
      ),
    ).toBe("Passed");
    expect(
      first?.querySelector("[data-gemara-part='message']")?.textContent,
    ).toContain("Two-factor authentication is configured");
    expect(
      first?.querySelector("[data-gemara-part='description']")?.textContent,
    ).toContain("multi-factor");
  });

  it("renders assessment applicability, steps, and timestamps", () => {
    const { container } = render(<EvaluationLog data={data} />);
    const first = container.querySelector(
      "[data-gemara-requirement-id='OSPS-AC-01.01']",
    );
    expect(first).not.toBeNull();

    const applicability = first?.querySelector("[data-gemara-part='applicability']");
    expect(applicability?.textContent).toContain("Maturity Level 1");
    expect(applicability?.textContent).toContain("Maturity Level 3");

    // Steps live inside an uncontrolled native <details>, collapsed by default.
    const steps = first?.querySelector("details[data-gemara-part='steps']");
    expect(steps).not.toBeNull();
    expect(steps?.hasAttribute("open")).toBe(false);
    expect(
      steps?.querySelector("[data-gemara-part='steps-summary']"),
    ).not.toBeNull();
    const stepItems = steps?.querySelectorAll("[data-gemara-part='step']") ?? [];
    expect(stepItems.length).toBe(1);
    expect(stepItems[0]?.textContent).toContain("access_control.orgRequiresMFA");
    expect(
      steps?.querySelector("[data-gemara-part='steps-executed']")?.textContent,
    ).toBe("1");

    const timespan = first?.querySelector("[data-gemara-part='timespan']");
    expect(timespan).not.toBeNull();
    const start = timespan?.querySelector("[data-gemara-part='start'] time");
    expect(start?.getAttribute("datetime")).toBe("2025-08-22T16:02:00.000000000Z");
    const end = timespan?.querySelector("[data-gemara-part='end'] time");
    expect(end?.getAttribute("datetime")).toBe("2025-08-22T16:02:00.000003708Z");
  });

  it("distinguishes result outcomes across evaluations", () => {
    const { container } = render(<EvaluationLog data={data} />);
    for (const outcome of ["Passed", "Failed", "Needs Review", "Not Run"]) {
      expect(
        container.querySelector(
          `[data-gemara-part='evaluation'] [data-gemara-result='${outcome}']`,
        ),
      ).not.toBeNull();
    }
  });

  it("renders optional fields absent from the fixture when supplied", () => {
    // The shared fixture omits several optional fields; inject them onto a
    // valid log derived from the fixture to exercise those render paths.
    const evaluations = data.evaluations ?? [];
    const augmented: EvaluationLogData = {
      ...data,
      metadata: {
        ...data.metadata,
        draft: true,
        lexicon: { "reference-id": "LEX-1", remarks: "shared glossary" },
      },
      target: {
        ...(data.target ?? {}),
        environment: "production",
        owner: {
          name: "Security Team",
          affiliation: "Example Org",
          email: "sec@example.com",
          social: "@example-sec",
        },
      },
      evaluations: evaluations.map((e, i) =>
        i === 0
          ? {
              ...e,
              name: "Access control evaluation",
              "assessment-logs": (e["assessment-logs"] ?? []).map((log, j) =>
                j === 0
                  ? {
                      ...log,
                      recommendation: "Enable MFA for all members",
                      "confidence-level": "High",
                      plan: { "reference-id": "POL-1", "entry-id": "PLAN-1" },
                    }
                  : log,
              ),
            }
          : e,
      ),
    };
    const { container } = render(<EvaluationLog data={augmented} />);
    expect(
      container.querySelector("[data-gemara-part='draft']")?.textContent,
    ).toBe("Yes");
    const lexicon = container.querySelector("[data-gemara-part='lexicon']");
    expect(
      lexicon?.querySelector("[data-gemara-ref-id='LEX-1']"),
    ).not.toBeNull();
    expect(
      container.querySelector("[data-gemara-part='environment']")?.textContent,
    ).toBe("production");
    const owner = container.querySelector("[data-gemara-part='owner']");
    expect(owner?.textContent).toContain("Security Team");
    expect(owner?.textContent).toContain("Example Org");
    expect(owner?.textContent).toContain("sec@example.com");
    expect(
      container.querySelector("[data-gemara-part='evaluation-name']")?.textContent,
    ).toBe("Access control evaluation");
    expect(
      container.querySelector("[data-gemara-part='recommendation']")?.textContent,
    ).toContain("Enable MFA");
    expect(
      container.querySelector("[data-gemara-part='confidence-level']")?.textContent,
    ).toContain("High");
    const plan = container.querySelector("[data-gemara-part='plan']");
    expect(plan?.querySelector("[data-gemara-ref-id='PLAN-1']")).not.toBeNull();
  });

  it("supports DIY composition via children", () => {
    const { container } = render(
      <EvaluationLog data={data}>
        <EvaluationLog.Header data={data} />
      </EvaluationLog>,
    );
    expect(container.querySelector("[data-gemara-part='header']")).not.toBeNull();
    expect(container.querySelector("[data-gemara-part='evaluations']")).toBeNull();
    expect(container.querySelector("[data-gemara-part='target']")).toBeNull();
  });

  it("defaults the log title to <h1>", () => {
    const { container } = render(<EvaluationLog data={data} />);
    expect(container.querySelector("h1[data-gemara-part='title']")).not.toBeNull();
  });

  it("renders assessment evidence with a structured payload as JSON", () => {
    const { container } = render(<EvaluationLog data={data} />);
    const evidence = (data.evaluations ?? []).flatMap((ev) =>
      (ev["assessment-logs"] ?? []).flatMap((l) => l.evidence ?? []),
    );
    expect(evidence.length).toBeGreaterThan(0);
    expect(
      container.querySelectorAll("[data-gemara-part='evidence-item']").length,
    ).toBe(evidence.length);
    for (const e of evidence) {
      const el = container.querySelector(
        `[data-gemara-evidence-id='${e.id}']`,
      );
      expect(el, `expected rendered evidence ${e.id}`).not.toBeNull();
      expect(el?.getAttribute("data-gemara-evidence-type")).toBe(e.type);
      expect(
        el?.querySelector(`time[datetime='${e["collected-at"]}']`),
      ).not.toBeNull();
      if (e.payload === undefined || e.payload === null) continue;
      const payload = el?.querySelector(
        "[data-gemara-part='evidence-payload']",
      );
      expect(payload?.tagName).toBe("PRE");
      // The fixture's payload is a YAML map, so it serializes to JSON.
      expect(payload?.textContent).toBe(JSON.stringify(e.payload, null, 2));
    }
  });

  it("offsets all headings when headingLevel is set", () => {
    const { container } = render(<EvaluationLog data={data} headingLevel={3} />);
    expect(container.querySelector("h3[data-gemara-part='title']")).not.toBeNull();
    // target/evaluations sections sit at +1, evaluations at +2.
    expect(container.querySelector("h4")).not.toBeNull();
    expect(
      container.querySelector("[data-gemara-part='evaluation'] h5"),
    ).not.toBeNull();
  });
});
