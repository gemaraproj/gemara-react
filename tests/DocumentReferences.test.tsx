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
import { GemaraProvider, type ArtifactReference } from "../src/provider/index.js";
import {
  isAuditLog,
  isControlCatalog,
  isEnforcementLog,
  isEvaluationLog,
  isLexicon,
  isMappingDocument,
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
