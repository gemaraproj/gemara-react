// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { render, fireEvent } from "@testing-library/react";
import { FormatTabs } from "../src/interactive/index.js";
import { ControlCatalog } from "../src/control-catalog/index.js";
import { isControlCatalog } from "../src/generated/types.js";
import type { ControlCatalog as ControlCatalogData } from "../src/generated/types.js";

const OSCAL = '{"catalog":{"uuid":"abc"}}';
const MARKDOWN = "# Catalog\n\nline one\nline two";

function renderTabs(defaultTabId?: string) {
  return render(
    <FormatTabs
      aria-label="formats"
      defaultTabId={defaultTabId}
      tabs={[
        { id: "preview", label: "Preview", preview: <p>rendered preview</p> },
        { id: "markdown", label: "Markdown", language: "markdown", content: MARKDOWN },
        { id: "oscal", label: "OSCAL", language: "json", content: OSCAL },
      ]}
    />,
  );
}

function selected(getByRole: ReturnType<typeof render>["getByRole"], name: string) {
  return getByRole("tab", { name }).getAttribute("aria-selected");
}

describe("FormatTabs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("activates the first tab by default", () => {
    const { getByRole } = renderTabs();
    expect(selected(getByRole, "Preview")).toBe("true");
    expect(selected(getByRole, "OSCAL")).toBe("false");
  });

  it("honors defaultTabId", () => {
    const { getByRole } = renderTabs("oscal");
    expect(selected(getByRole, "OSCAL")).toBe("true");
  });

  it("renders a code block with exact content + language hint", () => {
    const { getByRole } = renderTabs("oscal");
    const pre = getByRole("tabpanel").querySelector(
      '[data-gemara-part="format-code"]',
    );
    expect(pre).not.toBeNull();
    expect(pre?.getAttribute("data-gemara-language")).toBe("json");
    expect(pre?.textContent).toBe(OSCAL);
  });

  it("renders the supplied preview node verbatim on the preview tab", () => {
    const { getByText, getByRole } = renderTabs("preview");
    expect(getByText("rendered preview")).not.toBeNull();
    // getByRole excludes hidden panels — only the active one is exposed.
    expect(getByRole("tabpanel").getAttribute("data-gemara-tab-id")).toBe(
      "preview",
    );
  });

  it("switches panels on click and toggles hidden + aria-selected", () => {
    const { getByRole, container } = renderTabs();
    fireEvent.click(getByRole("tab", { name: "Markdown" }));
    expect(selected(getByRole, "Markdown")).toBe("true");
    const panels = container.querySelectorAll('[data-gemara-part="format-panel"]');
    const md = container.querySelector(
      '[data-gemara-part="format-panel"][data-gemara-tab-id="markdown"]',
    );
    const preview = container.querySelector(
      '[data-gemara-part="format-panel"][data-gemara-tab-id="preview"]',
    );
    expect(panels.length).toBe(3);
    expect(md?.hasAttribute("hidden")).toBe(false);
    expect(preview?.hasAttribute("hidden")).toBe(true);
  });

  it("moves selection with ArrowRight, ArrowLeft, Home, and End", () => {
    const { getByRole } = renderTabs();
    const tablist = getByRole("tablist");
    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(selected(getByRole, "Markdown")).toBe("true");
    fireEvent.keyDown(tablist, { key: "End" });
    expect(selected(getByRole, "OSCAL")).toBe("true");
    fireEvent.keyDown(tablist, { key: "Home" });
    expect(selected(getByRole, "Preview")).toBe("true");
    // ArrowLeft wraps from the first tab to the last.
    fireEvent.keyDown(tablist, { key: "ArrowLeft" });
    expect(selected(getByRole, "OSCAL")).toBe("true");
  });

  it("moves focus to the newly activated tab (automatic activation)", () => {
    const { getByRole } = renderTabs();
    const tablist = getByRole("tablist");
    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(document.activeElement).toBe(getByRole("tab", { name: "Markdown" }));
    fireEvent.keyDown(tablist, { key: "End" });
    expect(document.activeElement).toBe(getByRole("tab", { name: "OSCAL" }));
  });

  it("applies a roving tabindex (only the active tab is in the tab order)", () => {
    const { getByRole } = renderTabs("markdown");
    expect(getByRole("tab", { name: "Preview" }).getAttribute("tabindex")).toBe("-1");
    expect(getByRole("tab", { name: "Markdown" }).getAttribute("tabindex")).toBe("0");
  });

  it("keeps DOM ids unique even when tab ids collide", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(
      <FormatTabs
        aria-label="dupes"
        tabs={[
          { id: "dup", label: "One", content: "a" },
          { id: "dup", label: "Two", content: "b" },
        ]}
      />,
    );
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    const panels = [...container.querySelectorAll('[role="tabpanel"]')];
    const tabIds = tabs.map((t) => t.id);
    const panelIds = panels.map((p) => p.id);
    expect(new Set(tabIds).size).toBe(2); // distinct DOM ids despite duplicate tab.id
    expect(new Set(panelIds).size).toBe(2);
    // Each tab points at a distinct, existing panel.
    tabs.forEach((t) => {
      const target = t.getAttribute("aria-controls");
      expect(panelIds).toContain(target);
    });
  });

  it("falls back to the first tab and warns when defaultTabId matches nothing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getByRole } = renderTabs("does-not-exist");
    expect(selected(getByRole, "Preview")).toBe("true");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("does-not-exist"),
    );
  });

  it("warns in dev when the tablist has no accessible name", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<FormatTabs tabs={[{ id: "a", label: "A", content: "x" }]} />);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("accessible name"),
    );
  });

  it("accepts aria-labelledby as the tablist name", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getByRole } = render(
      <FormatTabs
        aria-labelledby="ext-heading"
        tabs={[{ id: "a", label: "A", content: "x" }]}
      />,
    );
    expect(getByRole("tablist").getAttribute("aria-labelledby")).toBe("ext-heading");
    expect(warn).not.toHaveBeenCalled();
  });

  it("wires aria-controls / aria-labelledby between tab and panel", () => {
    const { getByRole } = renderTabs("markdown");
    const tab = getByRole("tab", { name: "Markdown" });
    const panel = getByRole("tabpanel");
    expect(tab.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.getAttribute("aria-labelledby")).toBe(tab.id);
  });

  it("returns null for an empty tab set", () => {
    const { container } = render(<FormatTabs tabs={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("uses a real renderer as the preview tab", () => {
    const raw = readFileSync(
      resolve(__dirname, "..", "..", "gemara", "test", "test-data", "good-ccc.yaml"),
      "utf8",
    );
    const parsed = parseYaml(raw);
    if (!isControlCatalog(parsed)) throw new Error("fixture is not a ControlCatalog");
    const data = parsed as ControlCatalogData;
    const { container } = render(
      <FormatTabs
        aria-label="Catalog formats"
        tabs={[
          { id: "preview", label: "Preview", preview: <ControlCatalog data={data} /> },
          { id: "oscal", label: "OSCAL", language: "json", content: OSCAL },
        ]}
      />,
    );
    expect(
      container.querySelector('[data-gemara-artifact="ControlCatalog"]'),
    ).not.toBeNull();
  });
});
