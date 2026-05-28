// SPDX-License-Identifier: Apache-2.0
import { createContext, type ReactElement, type ReactNode } from "react";

/**
 * A reference to another artifact (or entry within one), as encoded in
 * `extends`, `imports`, `mapping-references`, and inline EntryMappings.
 *
 * `kind` lets resolvers route differently for cross-artifact links (mapping
 * references) vs. intra-artifact links (entry refs by id).
 */
export interface ArtifactReference {
  kind: "artifact" | "entry" | "mapping-reference";
  /** The identifier as it appears in the source document (id, reference-id, etc.). */
  id: string;
  /** For entry-mappings, the parent reference id this entry belongs to. */
  referenceId?: string;
  /** For artifact-level refs, the URL where the target may be retrieved. */
  url?: string;
  /** Free-form context for resolvers (e.g. "extends", "threats", "guidelines"). */
  relation?: string;
}

/**
 * linkResolver renders an in-document or cross-document link.
 *
 * Returns a React element so consumers can substitute their router's <Link>,
 * Astro's <a>, plain anchors, or anything else. Defaults to a plain anchor
 * when `url` is present, or an inert <span> otherwise.
 */
export type LinkResolver = (
  ref: ArtifactReference,
  children: ReactNode,
) => ReactElement;

export const defaultLinkResolver: LinkResolver = (ref, children) => {
  if (ref.url) {
    return (
      <a
        href={ref.url}
        data-gemara-ref={ref.kind}
        data-gemara-ref-id={ref.id}
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  }
  return (
    <span data-gemara-ref={ref.kind} data-gemara-ref-id={ref.id}>
      {children}
    </span>
  );
};

export interface GemaraContextValue {
  linkResolver: LinkResolver;
}

export const GemaraContext = createContext<GemaraContextValue>({
  linkResolver: defaultLinkResolver,
});

export interface GemaraProviderProps {
  linkResolver?: LinkResolver;
  children: ReactNode;
}

/**
 * Server-component-safe context provider. No state, no effects — the value
 * object is stable per render which is fine for read-only renderers.
 */
export function GemaraProvider({
  linkResolver = defaultLinkResolver,
  children,
}: GemaraProviderProps) {
  return (
    <GemaraContext.Provider value={{ linkResolver }}>
      {children}
    </GemaraContext.Provider>
  );
}
