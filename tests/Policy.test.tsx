// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { render } from "@testing-library/react";
import { Policy } from "../src/policy/index.js";
import { GemaraProvider } from "../src/provider/index.js";
import { isPolicy } from "../src/generated/types.js";
import type { Policy as PolicyData } from "../src/generated/types.js";

const FIXTURE = resolve(
  __dirname,
  "..",
  "..",
  "gemara",
  "test",
  "test-data",
  "good-policy.yaml",
);

function loadFixture(): PolicyData {
  const raw = readFileSync(FIXTURE, "utf8");
  const parsed = parseYaml(raw);
  if (!isPolicy(parsed)) {
    throw new Error("Fixture is not a Policy");
  }
  return parsed;
}

describe("Policy", () => {
  const data = loadFixture();

  it("narrows the discriminated union via isPolicy", () => {
    expect(isPolicy(data)).toBe(true);
    expect(data.metadata.type).toBe("Policy");
  });

  it("renders the policy metadata in the header", () => {
    const { container, getByText } = render(<Policy data={data} />);
    expect(container.querySelector("[data-gemara-artifact='Policy']")).not.toBeNull();
    expect(getByText(data.title)).toBeTruthy();
    if (data.metadata.id) expect(getByText(data.metadata.id)).toBeTruthy();
    if (data.metadata.version) expect(getByText(data.metadata.version)).toBeTruthy();
    if (data.metadata["gemara-version"]) {
      expect(getByText(data.metadata["gemara-version"])).toBeTruthy();
    }
  });

  it("renders metadata mapping-references in a collapsed References section", () => {
    const { container } = render(<Policy data={data} />);
    const details = container.querySelector(
      "details[data-gemara-part='references']",
    ) as HTMLDetailsElement | null;
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
    const summary = details?.querySelector(
      "summary[data-gemara-part='references-summary']",
    );
    expect(summary?.textContent).toBe("References to Other Documents");
    // The fixture declares NIST-800-53 and ISO-27001 with URLs; the default
    // resolver renders anchors for URL-bearing references.
    const items = details?.querySelectorAll("[data-gemara-part='mapping-reference']");
    expect(items?.length).toBe(2);
    expect(
      details?.querySelector(
        "a[data-gemara-ref='mapping-reference'][data-gemara-ref-id='NIST-800-53']",
      ),
    ).not.toBeNull();
  });

  it("renders every RACI role present in the fixture", () => {
    const { container } = render(<Policy data={data} />);
    const contacts = container.querySelector("[data-gemara-part='contacts']");
    expect(contacts).not.toBeNull();
    for (const role of ["responsible", "accountable", "consulted", "informed"] as const) {
      const declared = data.contacts[role] ?? [];
      const section = container.querySelector(`[data-gemara-raci-role='${role}']`);
      if (declared.length === 0) {
        expect(section).toBeNull();
        continue;
      }
      expect(section).not.toBeNull();
      const rendered = section?.querySelectorAll("[data-gemara-part='contact']");
      expect(rendered?.length).toBe(declared.length);
    }
    expect(container.textContent).toContain("Chief Information Security Officer");
    expect(container.textContent).toContain("it-director@company.com");
  });

  it("renders scope dimensions", () => {
    const { container } = render(<Policy data={data} />);
    const inScope = container.querySelector(
      "[data-gemara-part='scope-dimensions'][data-gemara-scope='in']",
    );
    expect(inScope).not.toBeNull();
    const geo = inScope?.querySelector("[data-gemara-dimension='geopolitical']");
    expect(geo?.textContent).toBe("United States, European Union, Canada");
    const tech = inScope?.querySelector("[data-gemara-dimension='technologies']");
    expect(tech?.textContent).toContain("Cloud Computing");
    // The fixture has no `out` scope.
    expect(container.querySelector("[data-gemara-scope='out']")).toBeNull();
  });

  it("renders catalog imports with constraints and requirement modifications", () => {
    const { container } = render(<Policy data={data} />);
    const catalogs = container.querySelector("[data-gemara-part='import-catalogs']");
    expect(catalogs).not.toBeNull();
    const imp = catalogs?.querySelector(
      "[data-gemara-part='import'][data-gemara-import-id='NIST-800-53']",
    );
    expect(imp).not.toBeNull();
    // The reference-id resolves to the URL declared in metadata mapping-references.
    expect(
      imp?.querySelector(
        "a[data-gemara-ref='artifact'][data-gemara-ref-id='NIST-800-53']",
      ),
    ).not.toBeNull();
    const constraint = imp?.querySelector(
      "[data-gemara-part='constraint'][data-gemara-constraint-id='nist-cloud-constraint']",
    );
    expect(constraint).not.toBeNull();
    expect(constraint?.textContent).toContain(
      "Enhanced access control requirements for cloud environments",
    );
    expect(
      constraint?.querySelector("[data-gemara-ref='entry'][data-gemara-ref-id='AC-1']"),
    ).not.toBeNull();
    const mod = imp?.querySelector(
      "[data-gemara-part='requirement-modification'][data-gemara-modification-id='nist-ac1-mod']",
    );
    expect(mod).not.toBeNull();
    expect(mod?.getAttribute("data-gemara-modification-type")).toBe("Modify");
    expect(
      mod?.querySelector("[data-gemara-ref='entry'][data-gemara-ref-id='AC-1.1']"),
    ).not.toBeNull();
    expect(mod?.textContent).toContain(
      "Clarified assessment procedures for multi-cloud environments",
    );
    expect(
      mod?.querySelector("[data-gemara-part='applicability']")?.textContent,
    ).toBe("cloud, multi-cloud");
    expect(mod?.textContent).toContain("Conduct quarterly assessments");
  });

  it("renders guidance imports", () => {
    const { container } = render(<Policy data={data} />);
    const guidance = container.querySelector("[data-gemara-part='import-guidance']");
    expect(guidance).not.toBeNull();
    expect(
      guidance?.querySelector(
        "[data-gemara-part='import'][data-gemara-import-id='ISO-27001']",
      ),
    ).not.toBeNull();
  });

  it("renders adherence methods and non-compliance", () => {
    const { container } = render(<Policy data={data} />);
    const evaluation = container.querySelector(
      "[data-gemara-part='methods'][data-gemara-methods-label='evaluation']",
    );
    expect(evaluation).not.toBeNull();
    expect(
      evaluation?.querySelectorAll("[data-gemara-part='method']").length,
    ).toBe(2);
    const auto = evaluation?.querySelector("[data-gemara-method-id='EV-AUTO-01']");
    expect(auto?.getAttribute("data-gemara-method-mode")).toBe("Automated");
    // required: true in the fixture — marked; EV-MANUAL-01 defaults to false.
    expect(auto?.querySelector("[data-gemara-part='method-required']")).not.toBeNull();
    const manual = evaluation?.querySelector("[data-gemara-method-id='EV-MANUAL-01']");
    expect(manual?.querySelector("[data-gemara-part='method-required']")).toBeNull();
    const enforcement = container.querySelector(
      "[data-gemara-part='methods'][data-gemara-methods-label='enforcement']",
    );
    expect(
      enforcement?.querySelector("[data-gemara-method-id='EM-GATE-01']"),
    ).not.toBeNull();
    const nonCompliance = container.querySelector("[data-gemara-part='non-compliance']");
    expect(nonCompliance?.textContent).toContain(
      "Non-compliant systems will be quarantined pending remediation",
    );
  });

  it("omits optional sections absent from the fixture", () => {
    const { container } = render(<Policy data={data} />);
    expect(container.querySelector("[data-gemara-part='implementation-plan']")).toBeNull();
    expect(container.querySelector("[data-gemara-part='risks']")).toBeNull();
    expect(container.querySelector("[data-gemara-part='assessment-plans']")).toBeNull();
    expect(container.querySelector("[data-gemara-part='import-policies']")).toBeNull();
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
        <Policy data={data} />
      </Resolver>,
    );

    const resolved = container.querySelectorAll("[data-test-resolver]");
    expect(resolved.length).toBeGreaterThan(0);
  });

  it("supports DIY composition via children", () => {
    const { container } = render(
      <Policy data={data}>
        <Policy.Header data={data} />
      </Policy>,
    );
    expect(container.querySelector("[data-gemara-part='header']")).not.toBeNull();
    expect(container.querySelector("[data-gemara-part='contacts']")).toBeNull();
    expect(container.querySelector("[data-gemara-part='adherence']")).toBeNull();
  });

  it("defaults the policy title to <h1>", () => {
    const { container } = render(<Policy data={data} />);
    expect(container.querySelector("h1[data-gemara-part='title']")).not.toBeNull();
  });

  it("offsets all headings when headingLevel is set", () => {
    const { container } = render(<Policy data={data} headingLevel={3} />);
    expect(container.querySelector("h3[data-gemara-part='title']")).not.toBeNull();
    // top-level sections +1 -> h4, subsections +2 -> h5
    expect(container.querySelector("h4")).not.toBeNull();
    expect(container.querySelector("h5")).not.toBeNull();
  });

  it("clamps heading level at h6", () => {
    const { container } = render(<Policy data={data} headingLevel={5} />);
    expect(container.querySelectorAll("h6").length).toBeGreaterThan(0);
    expect(container.querySelector("h7")).toBeNull();
  });
});

/**
 * A document can carry the right `metadata.type` (so the runtime guard passes)
 * while omitting schema-required sections — the guards only check the
 * discriminator. The renderer must degrade (render nothing per missing
 * section) rather than throw, or SSR consumers crash on invalid documents.
 */
describe("Policy defensive rendering", () => {
  it("renders a type-tagged document missing schema-required sections without throwing", () => {
    const minimal = {
      title: "Skeleton Policy",
      metadata: { type: "Policy" },
    } as unknown as PolicyData;
    expect(isPolicy(minimal)).toBe(true);
    const { container } = render(<Policy data={minimal} />);
    expect(
      container.querySelector("[data-gemara-artifact='Policy']"),
    ).not.toBeNull();
    expect(container.textContent).toContain("Skeleton Policy");
  });
});

/**
 * The fixture omits several optional Policy fields (implementation-plan,
 * risks, scope.out, assessment plans, policy imports, draft/lexicon/date
 * metadata). Exercise those branches with a minimal schema-valid document.
 */
describe("Policy optional sections", () => {
  const full: PolicyData = {
    title: "Synthetic Full Policy",
    metadata: {
      id: "synthetic-policy-001",
      type: "Policy",
      "gemara-version": "0.20.0",
      description: "Synthetic policy exercising all optional fields",
      version: "0.1.0",
      date: "2026-01-15",
      draft: true,
      author: { contact: { name: "Synthetic Author" } },
      lexicon: { "reference-id": "LEX-1", remarks: "shared vocabulary" },
    },
    contacts: {
      responsible: [{ name: "Resp One" }],
      accountable: [{ name: "Acct One" }],
    },
    scope: {
      in: { technologies: ["SaaS"], users: ["admins"], groups: ["platform"] },
      out: { geopolitical: ["Antarctica"], sensitivity: ["public"] },
    },
    imports: {
      policies: [{ "reference-id": "PARENT-POL", remarks: "parent policy" }],
    },
    "implementation-plan": {
      "notification-process": "Email all staff two weeks before enforcement",
      "evaluation-timeline": {
        start: "2026-02-01",
        end: "2026-03-01",
        notes: "Evaluation-only period",
      },
      "enforcement-timeline": {
        start: "2026-03-01",
        notes: "Full enforcement",
      },
    },
    risks: {
      mitigated: [
        {
          id: "mit-1",
          risk: {
            "reference-id": "RISK-CAT",
            "entry-id": "R-001",
            remarks: "covered by MFA rollout",
          },
        },
      ],
      accepted: [
        {
          id: "acc-1",
          "target-id": "mit-1",
          risk: { "reference-id": "RISK-CAT", "entry-id": "R-002" },
          justification: "Residual risk accepted for legacy systems",
          scope: { in: { technologies: ["legacy-mainframe"] } },
        },
      ],
    },
    adherence: {
      "assessment-plans": [
        {
          id: "AP-1",
          "requirement-id": "AC-1.1",
          frequency: "quarterly",
          "evidence-requirements": "Scan reports retained for one year",
          "evaluation-methods": [
            {
              id: "EV-PLAN-01",
              type: "Intent",
              mode: "Manual",
              required: "false",
              description: "Manual review of configuration intent",
              executor: { contact: { name: "Assessor Bot" } },
            },
          ],
          parameters: [
            {
              id: "param-1",
              label: "Scan depth",
              description: "How deep the scanner traverses",
              "accepted-values": ["shallow", "deep"],
            },
          ],
        },
      ],
    },
  };

  it("renders draft, date, and lexicon metadata", () => {
    const { container } = render(<Policy data={full} />);
    expect(
      container.querySelector("[data-gemara-part='draft']")?.textContent,
    ).toBe("Yes");
    expect(container.querySelector("time[datetime='2026-01-15']")).not.toBeNull();
    const lexicon = container.querySelector("[data-gemara-part='lexicon']");
    expect(
      lexicon?.querySelector("[data-gemara-ref='artifact'][data-gemara-ref-id='LEX-1']"),
    ).not.toBeNull();
    expect(lexicon?.textContent).toContain("shared vocabulary");
  });

  it("renders out-of-scope dimensions", () => {
    const { container } = render(<Policy data={full} />);
    const out = container.querySelector(
      "[data-gemara-part='scope-dimensions'][data-gemara-scope='out']",
    );
    expect(out).not.toBeNull();
    expect(
      out?.querySelector("[data-gemara-dimension='geopolitical']")?.textContent,
    ).toBe("Antarctica");
    expect(
      out?.querySelector("[data-gemara-dimension='sensitivity']")?.textContent,
    ).toBe("public");
    const inScope = container.querySelector(
      "[data-gemara-part='scope'] [data-gemara-scope='in']",
    );
    expect(
      inScope?.querySelector("[data-gemara-dimension='groups']")?.textContent,
    ).toBe("platform");
  });

  it("renders policy imports", () => {
    const { container } = render(<Policy data={full} />);
    const policies = container.querySelector("[data-gemara-part='import-policies']");
    expect(policies).not.toBeNull();
    const imp = policies?.querySelector(
      "[data-gemara-part='import'][data-gemara-import-id='PARENT-POL']",
    );
    expect(imp).not.toBeNull();
    expect(imp?.textContent).toContain("parent policy");
  });

  it("renders the implementation plan timelines", () => {
    const { container } = render(<Policy data={full} />);
    const plan = container.querySelector("[data-gemara-part='implementation-plan']");
    expect(plan).not.toBeNull();
    expect(
      plan?.querySelector("[data-gemara-part='notification-process']")?.textContent,
    ).toContain("Email all staff");
    const evaluation = plan?.querySelector("[data-gemara-timeline='evaluation']");
    expect(evaluation?.querySelector("time[datetime='2026-02-01']")).not.toBeNull();
    expect(evaluation?.querySelector("time[datetime='2026-03-01']")).not.toBeNull();
    expect(evaluation?.textContent).toContain("Evaluation-only period");
    const enforcement = plan?.querySelector("[data-gemara-timeline='enforcement']");
    expect(enforcement?.querySelector("time[datetime='2026-03-01']")).not.toBeNull();
    expect(enforcement?.textContent).toContain("Full enforcement");
  });

  it("renders mitigated and accepted risks", () => {
    const { container } = render(<Policy data={full} />);
    const mitigated = container.querySelector("[data-gemara-part='mitigated-risks']");
    const mit = mitigated?.querySelector(
      "[data-gemara-part='risk'][data-gemara-risk-id='mit-1']",
    );
    expect(mit).not.toBeNull();
    expect(
      mit?.querySelector("[data-gemara-ref='entry'][data-gemara-ref-id='R-001']"),
    ).not.toBeNull();
    expect(mit?.textContent).toContain("covered by MFA rollout");

    const accepted = container.querySelector("[data-gemara-part='accepted-risks']");
    const acc = accepted?.querySelector(
      "[data-gemara-part='risk'][data-gemara-risk-id='acc-1']",
    );
    expect(acc).not.toBeNull();
    expect(
      acc?.querySelector("[data-gemara-ref='entry'][data-gemara-ref-id='R-002']"),
    ).not.toBeNull();
    // target-id links back to the mitigated entry.
    expect(
      acc?.querySelector("[data-gemara-part='risk-target'] [data-gemara-ref-id='mit-1']"),
    ).not.toBeNull();
    expect(
      acc?.querySelector("[data-gemara-part='justification']")?.textContent,
    ).toContain("Residual risk accepted");
    // Per-acceptance scope reuses the scope taxonomy, nested inside the risk.
    const riskScope = acc?.querySelector("[data-gemara-part='scope']");
    expect(
      riskScope?.querySelector("[data-gemara-dimension='technologies']")?.textContent,
    ).toBe("legacy-mainframe");
  });

  it("renders assessment plans with methods and parameters", () => {
    const { container } = render(<Policy data={full} />);
    const plans = container.querySelector("[data-gemara-part='assessment-plans']");
    const plan = plans?.querySelector(
      "[data-gemara-part='assessment-plan'][data-gemara-plan-id='AP-1']",
    );
    expect(plan).not.toBeNull();
    expect(
      plan?.querySelector("[data-gemara-ref='entry'][data-gemara-ref-id='AC-1.1']"),
    ).not.toBeNull();
    expect(
      plan?.querySelector("[data-gemara-part='plan-frequency']")?.textContent,
    ).toBe("quarterly");
    expect(plan?.textContent).toContain("Scan reports retained for one year");
    const method = plan?.querySelector("[data-gemara-method-id='EV-PLAN-01']");
    expect(method).not.toBeNull();
    // required: "false" (string form) must not be marked as required.
    expect(method?.querySelector("[data-gemara-part='method-required']")).toBeNull();
    expect(
      method?.querySelector("[data-gemara-part='method-executor']"),
    ).not.toBeNull();
    const param = plan?.querySelector(
      "[data-gemara-part='parameter'][data-gemara-parameter-id='param-1']",
    );
    expect(param?.textContent).toContain("Scan depth");
    expect(
      param?.querySelector("[data-gemara-part='accepted-values']")?.textContent,
    ).toBe("Accepted values: shallow, deep");
  });
});
