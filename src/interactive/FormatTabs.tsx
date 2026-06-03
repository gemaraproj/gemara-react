// SPDX-License-Identifier: Apache-2.0
"use client";

import {
  useEffect,
  useId,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export interface FormatTab {
  /**
   * Stable identity for the tab. Emitted as `data-gemara-tab-id` (a styling /
   * selector hook) and used as the React key. Should be unique within `tabs`.
   */
  id: string;
  /** Visible label for the tab trigger. */
  label: ReactNode;
  /**
   * Rendered preview node. When present, the panel renders this instead of a
   * code block — use it for the styled "Preview" tab (e.g. `<ControlCatalog />`),
   * or for a loading/empty placeholder (e.g. `<Spinner />`) while a conversion
   * is still in flight.
   */
  preview?: ReactNode;
  /** Raw source text. Rendered in a `<pre><code>` block when no `preview`. */
  content?: string;
  /**
   * Language hint, surfaced as `data-gemara-language` on the code `<pre>`.
   * The library ships no highlighting; consumers style/highlight off this.
   */
  language?: string;
}

export interface FormatTabsProps {
  /** Ordered tabs. The first is active unless `defaultTabId` overrides it. */
  tabs: FormatTab[];
  /** Id of the tab to activate initially. Defaults to the first tab. */
  defaultTabId?: string;
  /** Accessible label for the tablist. Provide this or `aria-labelledby`. */
  "aria-label"?: string;
  /** Id of an external element labelling the tablist. */
  "aria-labelledby"?: string;
}

/**
 * Tabbed viewer for an artifact's available representations.
 *
 * The conversions themselves (OSCAL, Markdown, SARIF, …) are produced by
 * go-gemara server-side and passed in as strings — this component does no
 * fetching or conversion, keeping the library decoupled and headless. The
 * "Preview" tab is supplied by the consumer as a rendered node, so the viewer
 * imports no renderers and stays artifact-agnostic + tree-shakeable.
 *
 * Lives in the `interactive` subpath export: the `useState` for the active tab
 * forces a client island, so RSC consumers who never reach for it pay no
 * client-bundle cost. Implements the ARIA tabs pattern with **automatic
 * activation** — arrow keys move focus and switch the panel in one step
 * (Left/Right wrap; Home/End jump to the first/last tab).
 *
 * DOM ids and selection are keyed by tab *position*, not by `tab.id`, so the
 * ARIA wiring (`aria-controls` / `aria-labelledby`) stays valid even if a
 * consumer accidentally supplies duplicate ids.
 */
export function FormatTabs({
  tabs,
  defaultTabId,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: FormatTabsProps) {
  const baseId = useId();
  const [activeIndex, setActiveIndex] = useState(() => {
    if (defaultTabId === undefined) return 0;
    const i = tabs.findIndex((t) => t.id === defaultTabId);
    return i >= 0 ? i : 0;
  });

  const idSignature = tabs.map((t) => t.id).join(",");
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (tabs.length === 0) return;
    const ids = tabs.map((t) => t.id);
    if (new Set(ids).size !== ids.length) {
      console.warn(
        "[FormatTabs] duplicate tab ids — `data-gemara-tab-id` selectors and React keys require unique ids:",
        ids,
      );
    }
    if (defaultTabId !== undefined && !ids.includes(defaultTabId)) {
      console.warn(
        `[FormatTabs] defaultTabId "${defaultTabId}" matches no tab; falling back to the first tab.`,
      );
    }
    if (ariaLabel === undefined && ariaLabelledBy === undefined) {
      console.warn(
        "[FormatTabs] tablist has no accessible name — pass `aria-label` or `aria-labelledby`.",
      );
    }
    // idSignature stands in for the tab ids so the check re-runs when they change.
  }, [idSignature, defaultTabId, ariaLabel, ariaLabelledBy, tabs]);

  if (tabs.length === 0) return null;

  // Clamp in case the tab list shrank below the remembered index.
  const current = activeIndex < tabs.length ? activeIndex : 0;
  const tabDomId = (index: number) => `${baseId}-tab-${index}`;
  const panelDomId = (index: number) => `${baseId}-panel-${index}`;

  function activate(index: number) {
    setActiveIndex(index);
    document.getElementById(tabDomId(index))?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    let next = current;
    switch (e.key) {
      case "ArrowRight":
        next = (current + 1) % tabs.length;
        break;
      case "ArrowLeft":
        next = (current - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = tabs.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    activate(next);
  }

  return (
    <div data-gemara-part="format-tabs">
      <div
        role="tablist"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        data-gemara-part="format-tablist"
        onKeyDown={onKeyDown}
      >
        {tabs.map((tab, index) => {
          const selected = index === current;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={tabDomId(index)}
              aria-selected={selected}
              aria-controls={panelDomId(index)}
              tabIndex={selected ? 0 : -1}
              data-gemara-part="format-tab"
              data-gemara-tab-id={tab.id}
              data-gemara-selected={selected ? "" : undefined}
              onClick={() => setActiveIndex(index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab, index) => {
        const selected = index === current;
        return (
          <div
            key={tab.id}
            role="tabpanel"
            id={panelDomId(index)}
            aria-labelledby={tabDomId(index)}
            hidden={!selected}
            data-gemara-part="format-panel"
            data-gemara-tab-id={tab.id}
          >
            {tab.preview !== undefined ? (
              tab.preview
            ) : (
              <pre
                data-gemara-part="format-code"
                data-gemara-language={tab.language}
              >
                <code>{tab.content ?? ""}</code>
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}
