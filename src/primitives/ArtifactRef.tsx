import { Slot } from "@radix-ui/react-slot";
import type { ReactNode } from "react";
import { useLinkResolver, type ArtifactReference } from "../provider/index.js";

export interface ArtifactRefProps extends ArtifactReference {
  children?: ReactNode;
  /** Use Radix Slot — render a single child element instead of injecting one. */
  asChild?: boolean;
}

/**
 * Renders a cross-reference using the LinkResolver from context.
 *
 * If `children` is omitted, falls back to the reference id so consumers can
 * always rely on the visible label being present.
 */
export function ArtifactRef({
  children,
  asChild,
  ...ref
}: ArtifactRefProps) {
  const resolver = useLinkResolver();
  const label = children ?? ref.id;
  const element = resolver(ref, label);

  if (!asChild) return element;
  return <Slot>{element}</Slot>;
}
