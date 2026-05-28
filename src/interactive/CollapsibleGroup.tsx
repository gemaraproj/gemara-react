// SPDX-License-Identifier: Apache-2.0
"use client";

import { useId, useState, type ReactNode } from "react";

export interface CollapsibleGroupProps {
  /** Visible label for the toggle. */
  label: ReactNode;
  /** Initial open state. Defaults to false (collapsed). */
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Tiny client-only disclosure for wrapping any read-only renderer.
 *
 * Uses `<details>` semantics under the hood — keyboard- and screen-reader-
 * accessible by default. The internal `useState` only forces the island into
 * client mode; the inner DOM is plain HTML and remains styleable headlessly.
 *
 * Lives in the `interactive` subpath export so RSC consumers who never reach
 * for it never pay the client-bundle cost.
 */
export function CollapsibleGroup({
  label,
  defaultOpen = false,
  children,
}: CollapsibleGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      data-gemara-part="collapsible"
      data-gemara-open={open ? "" : undefined}
    >
      <summary id={id} data-gemara-part="collapsible-trigger">
        {label}
      </summary>
      <div data-gemara-part="collapsible-content" aria-labelledby={id}>
        {children}
      </div>
    </details>
  );
}
