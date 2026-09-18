// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { render } from "@testing-library/react";
import { ControlCatalog } from "../src/control-catalog/index.js";
import { EvaluationLog } from "../src/evaluation-log/index.js";
import { isControlCatalog, isEvaluationLog } from "../src/generated/types.js";
import type {
  ControlCatalog as ControlCatalogData,
  EvaluationLog as EvaluationLogData,
} from "../src/generated/types.js";

const DATA_DIR = resolve(__dirname, "..", "..", "gemara", "test", "test-data");

function load(name: string): unknown {
  return parseYaml(readFileSync(resolve(DATA_DIR, name), "utf8"));
}

const ccc = load("good-ccc.yaml");
if (!isControlCatalog(ccc)) throw new Error("Fixture is not a ControlCatalog");
const evalLog = load("pvtr-baseline-scan.yaml");
if (!isEvaluationLog(evalLog)) throw new Error("Fixture is not an EvaluationLog");

const URL = "https://example.com/csf.yaml";

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
  imports: [{ "reference-id": "CSF", entries: [{ "entry-id": "GV.OC" }] }],
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
    expect(
      imp?.querySelector(`[data-gemara-entry-id='GV.OC'] a[href='${URL}'][data-gemara-ref='entry']`),
    ).not.toBeNull();

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

  it("resolves the lexicon url in the log renderers", () => {
    const augmented: EvaluationLogData = {
      ...evalLog,
      metadata: {
        ...evalLog.metadata,
        lexicon: { "reference-id": "LEX-1" },
        "mapping-references": [
          { id: "LEX-1", title: "Lexicon", version: "1", url: URL },
        ],
      },
    };
    const { container } = render(<EvaluationLog data={augmented} />);
    expect(
      container.querySelector(`[data-gemara-part='lexicon'] a[href='${URL}']`),
    ).not.toBeNull();
  });
});
