// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { render } from "@testing-library/react";
import { ControlCatalog } from "../src/control-catalog/index.js";
import { EvaluationLog } from "../src/evaluation-log/index.js";
import { AuditLog } from "../src/audit-log/index.js";
import { EnforcementLog } from "../src/enforcement-log/index.js";
import { Lexicon } from "../src/lexicon/index.js";
import { MappingDocument } from "../src/mapping-document/index.js";
import { GuidanceCatalog } from "../src/guidance-catalog/index.js";
import { ThreatCatalog } from "../src/threat-catalog/index.js";
import { RiskCatalog } from "../src/risk-catalog/index.js";
import { Policy } from "../src/policy/index.js";
import { GemaraProvider, type ArtifactReference } from "../src/provider/index.js";
import {
  isAuditLog,
  isControlCatalog,
  isEnforcementLog,
  isEvaluationLog,
  isGuidanceCatalog,
  isLexicon,
  isMappingDocument,
  isPolicy,
  isRiskCatalog,
  isThreatCatalog,
} from "../src/generated/types.js";
import type {
  ControlCatalog as ControlCatalogData,
  EvaluationLog as EvaluationLogData,
  Metadata,
} from "../src/generated/types.js";

const DATA_DIR = resolve(__dirname, "..", "..", "gemara", "test", "test-data");

function load(name: string): unknown {
  return parseYaml(readFileSync(resolve(DATA_DIR, name), "utf8"));
}

const ccc = load("good-ccc.yaml");
if (!isControlCatalog(ccc)) throw new Error("Fixture is not a ControlCatalog");
const evalLog = load("pvtr-baseline-scan.yaml");
if (!isEvaluationLog(evalLog)) throw new Error("Fixture is not an EvaluationLog");
const auditLog = load("good-audit-log.yaml");
if (!isAuditLog(auditLog)) throw new Error("Fixture is not an AuditLog");
const enforcementLog = load("good-enforcement-log.yaml");
if (!isEnforcementLog(enforcementLog)) throw new Error("Fixture is not an EnforcementLog");
const lexicon = load("good-lexicon.yaml");
if (!isLexicon(lexicon)) throw new Error("Fixture is not a Lexicon");
const mappingDoc = load("good-mapping-document.yaml");
if (!isMappingDocument(mappingDoc)) throw new Error("Fixture is not a MappingDocument");
const guidance = load("good-aigf.yaml");
if (!isGuidanceCatalog(guidance)) throw new Error("Fixture is not a GuidanceCatalog");
const threats = load("good-threat-catalog.yaml");
if (!isThreatCatalog(threats)) throw new Error("Fixture is not a ThreatCatalog");
const risks = load("good-risk-catalog.yaml");
if (!isRiskCatalog(risks)) throw new Error("Fixture is not a RiskCatalog");
const policy = load("good-policy.yaml");
if (!isPolicy(policy)) throw new Error("Fixture is not a Policy");

const URL = "https://example.com/csf.yaml";
const LEX = { id: "LEX-1", title: "Lexicon", version: "1", url: URL };

/** Declare `metadata.lexicon` pointing at a mapping-reference that carries a url. */
function withLexicon<T extends { metadata: Metadata }>(d: T): T {
  return {
    ...d,
    metadata: {
      ...d.metadata,
      lexicon: { "reference-id": LEX.id },
      "mapping-references": [LEX, ...(d.metadata["mapping-references"] ?? [])],
    },
  };
}

const catalog: ControlCatalogData = {
  ...ccc,
  metadata: {
    ...ccc.metadata,
    lexicon: { "reference-id": "CSF", remarks: "shared vocabulary" },
    "mapping-references": (ccc.metadata["mapping-references"] ?? []).map((r) =>
      r.id === "CSF" ? { ...r, url: URL } : r,
    ),
  },
  extends: [{ "reference-id": "CSF", remarks: "builds on CSF" }],
  imports: [{ "reference-id": "CSF", entries: [{ "reference-id": "GV.OC" }] }],
};

describe("DocumentReferences", () => {
  it("mounts in the catalog header and resolves every reference-id to its url", () => {
    const { container } = render(<ControlCatalog data={catalog} />);
    const block = container.querySelector(
      "[data-gemara-part='header'] details[data-gemara-part='document-references']",
    );
    expect(block).not.toBeNull();

    const lexicon = block?.querySelector("[data-gemara-part='lexicon']");
    expect(lexicon?.querySelector(`a[href='${URL}'][data-gemara-ref-id='CSF']`)).not.toBeNull();
    expect(lexicon?.textContent).toContain("shared vocabulary");

    const ext = block?.querySelector(
      "[data-gemara-part='document-extends'] [data-gemara-part='extends-ref'][data-gemara-reference-id='CSF']",
    );
    expect(ext?.querySelector(`a[href='${URL}']`)).not.toBeNull();
    expect(ext?.textContent).toContain("builds on CSF");

    const imp = block?.querySelector(
      "[data-gemara-part='document-imports'] [data-gemara-part='import'][data-gemara-import-id='CSF']",
    );
    expect(imp?.querySelector(`a[href='${URL}'][data-gemara-ref='artifact']`)).not.toBeNull();
    const entry = imp?.querySelector(
      "[data-gemara-part='import-entries'] [data-gemara-part='import-entry'][data-gemara-entry-id='GV.OC']",
    );
    expect(entry).not.toBeNull();
    const entryLink = entry?.querySelector(`a[href='${URL}'][data-gemara-ref='entry']`);
    expect(entryLink?.getAttribute("data-gemara-ref-id")).toBe("GV.OC");
    expect(entryLink?.textContent).toBe("GV.OC");

    const refs = block?.querySelectorAll("[data-gemara-part='mapping-reference']") ?? [];
    expect(refs.length).toBe(catalog.metadata["mapping-references"]?.length);
    expect(
      block?.querySelector(`[data-gemara-reference-id='CSF'] a[href='${URL}']`),
    ).not.toBeNull();
  });

  it("labels artifact-level refs with their mapping-reference title", () => {
    const { container } = render(<ControlCatalog data={catalog} />);
    const title = "NIST Cybersecurity Framework";
    expect(container.querySelector("[data-gemara-part='lexicon'] a")?.textContent).toBe(title);
    expect(container.querySelector("[data-gemara-part='extends-ref'] a")?.textContent).toBe(title);
    expect(container.querySelector("[data-gemara-part='import'] > a")?.textContent).toBe(title);
  });

  it.each([
    ["Lexicon", () => <Lexicon data={withLexicon(lexicon)} />],
    ["MappingDocument", () => <MappingDocument data={withLexicon(mappingDoc)} />],
    ["Policy", () => <Policy data={withLexicon(policy)} />],
    ["AuditLog", () => <AuditLog data={withLexicon(auditLog)} />],
    ["EvaluationLog", () => <EvaluationLog data={withLexicon(evalLog)} />],
    ["EnforcementLog", () => <EnforcementLog data={withLexicon(enforcementLog)} />],
  ])("labels the %s metadata lexicon ref with its title", (_name, renderIt) => {
    const { container } = render(renderIt());
    expect(container.querySelector(`[data-gemara-ref-id='${LEX.id}']`)?.textContent).toBe(LEX.title);
  });

  it.each([
    ["ControlCatalog", ccc.metadata, () => <ControlCatalog data={ccc} />],
    ["GuidanceCatalog", guidance.metadata, () => <GuidanceCatalog data={guidance} />],
    ["ThreatCatalog", threats.metadata, () => <ThreatCatalog data={threats} />],
    ["RiskCatalog", risks.metadata, () => <RiskCatalog data={risks} />],
  ])("labels %s mapping groups with their title and keeps the reference-id", (_name, metadata, renderIt) => {
    const { container } = render(renderIt());
    const groups = [
      ...container.querySelectorAll("[data-gemara-part='mappings'] > ul > li[data-gemara-reference-id]"),
    ];
    expect(groups.length).toBeGreaterThan(0);
    for (const li of groups) {
      const id = li.getAttribute("data-gemara-reference-id");
      const title = metadata["mapping-references"]?.find((r) => r.id === id)?.title || id;
      expect(li.querySelector(":scope > strong")?.textContent).toBe(title);
    }
  });

  it("labels Policy imports with their mapping-reference title", () => {
    const { container } = render(<Policy data={policy} />);
    const labels = [...container.querySelectorAll("[data-gemara-part='import'] [data-gemara-ref='artifact']")].map(
      (el) => el.textContent,
    );
    expect(labels).toContain("NIST Special Publication 800-53");
    expect(labels).not.toContain("NIST-800-53");
  });

  it("labels the AuditLog Criteria list with mapping-reference titles", () => {
    const { container } = render(<AuditLog data={auditLog} />);
    const labels = [...container.querySelectorAll("[data-gemara-part='criterion'] [data-gemara-ref='artifact']")].map(
      (el) => el.textContent,
    );
    expect(labels).toEqual(["Information Security Policy", "Open Source Project Security Baseline"]);
  });

  it("renders nothing when the document declares no references", () => {
    const bare: ControlCatalogData = {
      ...ccc,
      metadata: { ...ccc.metadata, "mapping-references": undefined },
    };
    const { container } = render(<ControlCatalog data={bare} />);
    expect(container.querySelector("[data-gemara-part='document-references']")).toBeNull();
  });

  it("passes the resolved url to a custom linkResolver on artifact and entry refs", () => {
    const seen: ArtifactReference[] = [];
    render(
      <GemaraProvider
        linkResolver={(ref, children) => {
          seen.push(ref);
          return <span>{children}</span>;
        }}
      >
        <ControlCatalog data={catalog} />
      </GemaraProvider>,
    );
    const toCsf = seen.filter(
      (r) => r.id === "CSF" || (r.kind === "entry" && r.referenceId === "CSF"),
    );
    expect(toCsf.length).toBeGreaterThan(0);
    expect(toCsf.some((r) => r.kind === "artifact")).toBe(true);
    expect(toCsf.some((r) => r.kind === "entry")).toBe(true);
    expect(toCsf.every((r) => r.url === URL)).toBe(true);
  });

  it("resolves the url on entry-level mapping refs in the catalog body", () => {
    const { container } = render(<ControlCatalog data={catalog} />);
    expect(
      container.querySelector(
        `[data-gemara-part='mappings'][data-gemara-mappings-label='guidelines'] a[href='${URL}'][data-gemara-ref='entry']`,
      ),
    ).not.toBeNull();
  });

  it("resolves the url on EvaluationLog control, requirement and plan refs", () => {
    const augmented: EvaluationLogData = {
      ...evalLog,
      metadata: {
        ...evalLog.metadata,
        "mapping-references": [{ id: "OSPS-B", title: "Baseline", version: "1", url: URL }],
      },
    };
    const { container } = render(<EvaluationLog data={augmented} />);
    expect(
      container.querySelector(`[data-gemara-part='control'] a[href='${URL}'][data-gemara-ref='entry']`),
    ).not.toBeNull();
  });

  it("labels AuditLog result criteria mappings with their mapping-reference title", () => {
    const { container } = render(<AuditLog data={auditLog} />);
    expect(
      container.querySelector("[data-gemara-mappings-label='criteria'] > ul > li > strong")?.textContent,
    ).toBe("Open Source Project Security Baseline");
  });

  it("resolves the AuditLog criteria url", () => {
    const criterion = auditLog.criteria?.[0]?.["reference-id"];
    if (!criterion) throw new Error("Fixture declares no criteria");
    const augmented = {
      ...auditLog,
      metadata: {
        ...auditLog.metadata,
        "mapping-references": [
          { id: criterion, title: "Criteria", version: "1", url: URL },
          ...(auditLog.metadata["mapping-references"] ?? []),
        ],
      },
    };
    const { container } = render(<AuditLog data={augmented} />);
    expect(
      container.querySelector(`[data-gemara-part='criterion'] a[href='${URL}'][data-gemara-ref-id='${criterion}']`),
    ).not.toBeNull();
  });

  it.each([
    ["EvaluationLog", () => <EvaluationLog data={withLexicon(evalLog)} />, "lexicon"],
    ["AuditLog", () => <AuditLog data={withLexicon(auditLog)} />, "lexicon"],
    ["EnforcementLog", () => <EnforcementLog data={withLexicon(enforcementLog)} />, "lexicon"],
    ["MappingDocument", () => <MappingDocument data={withLexicon(mappingDoc)} />, "lexicon"],
    ["Lexicon", () => <Lexicon data={withLexicon(lexicon)} />, "lexicon-ref"],
  ])("resolves the metadata.lexicon url in %s", (_name, element, part) => {
    const { container } = render(element());
    expect(
      container.querySelector(`[data-gemara-part='${part}'] a[href='${URL}'][data-gemara-ref-id='${LEX.id}']`),
    ).not.toBeNull();
  });
});
