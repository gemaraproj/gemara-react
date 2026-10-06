// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ComponentType } from "react";
import { parse as parseYaml } from "yaml";
import { render } from "@testing-library/react";
import axe from "axe-core";
import { AuditLog } from "../src/audit-log/index.js";
import { CapabilityCatalog } from "../src/capability-catalog/index.js";
import { ControlCatalog } from "../src/control-catalog/index.js";
import { EnforcementLog } from "../src/enforcement-log/index.js";
import { EvaluationLog } from "../src/evaluation-log/index.js";
import { GuidanceCatalog } from "../src/guidance-catalog/index.js";
import { CollapsibleGroup, FormatTabs } from "../src/interactive/index.js";
import { Lexicon } from "../src/lexicon/index.js";
import { MappingDocument } from "../src/mapping-document/index.js";
import { Policy } from "../src/policy/index.js";
import { PrincipleCatalog } from "../src/principle-catalog/index.js";
import { RiskCatalog } from "../src/risk-catalog/index.js";
import { ThreatCatalog } from "../src/threat-catalog/index.js";
import { VectorCatalog } from "../src/vector-catalog/index.js";
import { detectArtifactType, type ArtifactType } from "../src/generated/types.js";
import { IdPrefixScope } from "../src/primitives/index.js";

const FIXTURE_DIR = resolve(__dirname, "..", "..", "gemara", "test", "test-data");

const FIXTURES = [
  "good-ccc.yaml",
  "good-aigf.yaml",
  "good-aigf-principles.yaml",
  "good-aigf-vectors.yaml",
  "good-risk-catalog.yaml",
  "good-threat-catalog.yaml",
  "good-capability-catalog.yaml",
  "good-policy.yaml",
  "good-lexicon.yaml",
  "good-mapping-document.yaml",
  "good-audit-log.yaml",
  "good-enforcement-log.yaml",
  "pvtr-baseline-scan.yaml",
];

const RENDERERS: Record<ArtifactType, ComponentType<{ data: never }>> = {
  AuditLog,
  CapabilityCatalog,
  ControlCatalog,
  EnforcementLog,
  EvaluationLog,
  GuidanceCatalog,
  Lexicon,
  MappingDocument,
  Policy,
  PrincipleCatalog,
  RiskCatalog,
  ThreatCatalog,
  VectorCatalog,
};

// color-contrast needs layout and a canvas; neither exists in jsdom, and a
// headless library ships no colors to check anyway.
const AXE_OPTIONS: axe.RunOptions = {
  runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"] },
  rules: { "color-contrast": { enabled: false } },
};

async function expectNoViolations(container: Element) {
  const { violations } = await axe.run(container, AXE_OPTIONS);
  const report = violations.map(
    (v) => `${v.id}: ${v.help}\n  ${v.nodes.map((n) => n.target.join(" ")).join("\n  ")}`,
  );
  expect(report).toEqual([]);
}

describe("accessibility (axe-core)", () => {
  for (const name of FIXTURES) {
    it(`${name} renders without axe violations`, async () => {
      const data = parseYaml(readFileSync(resolve(FIXTURE_DIR, name), "utf8"));
      const type = detectArtifactType(data);
      if (!type) throw new Error(`Unrecognized artifact type in ${name}`);
      const Renderer = RENDERERS[type];
      const { container } = render(<Renderer data={data as never} />);
      await expectNoViolations(container);
    });
  }

  for (const name of FIXTURES) {
    it(`${name} rendered twice yields no duplicate ids when the second is prefixed`, () => {
      const data = parseYaml(readFileSync(resolve(FIXTURE_DIR, name), "utf8"));
      const type = detectArtifactType(data);
      if (!type) throw new Error(`Unrecognized artifact type in ${name}`);
      const Renderer = RENDERERS[type];
      const { container } = render(
        <>
          <Renderer data={data as never} />
          <IdPrefixScope prefix="again-">
            <Renderer data={data as never} />
          </IdPrefixScope>
        </>,
      );
      const ids = Array.from(container.querySelectorAll("[id]"), (el) => el.id);
      expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
    });
  }

  it("CollapsibleGroup renders without axe violations", async () => {
    const { container } = render(
      <CollapsibleGroup label="Toggle">
        <p>content</p>
      </CollapsibleGroup>,
    );
    const content = container.querySelector('[data-gemara-part="collapsible-content"]');
    expect(content?.hasAttribute("aria-labelledby")).toBe(false);
    await expectNoViolations(container);
  });

  it("FormatTabs renders without axe violations", async () => {
    const { container } = render(
      <FormatTabs
        aria-label="Formats"
        tabs={[
          { id: "a", label: "A", content: "a" },
          { id: "b", label: "B", content: "b" },
        ]}
      />,
    );
    await expectNoViolations(container);
  });
});
