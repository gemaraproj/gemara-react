import type { ReactNode } from "react";

/** Minimal shape we accept for any "entity-like" actor / contact / author. */
export interface EntityLike {
  id?: string;
  name?: string;
  type?: string;
  contact?: { email?: string; url?: string } | undefined;
}

export interface EntityRefProps {
  entity: EntityLike;
  children?: ReactNode;
}

/**
 * Renders an entity (typically `metadata.author`) as a structured span.
 * Headless: consumers can target `[data-gemara-entity]` and friends.
 */
export function EntityRef({ entity, children }: EntityRefProps) {
  const label = children ?? entity.name ?? entity.id ?? "(unnamed)";

  return (
    <span
      data-gemara-entity={entity.type ?? "unknown"}
      data-gemara-entity-id={entity.id ?? ""}
    >
      {label}
    </span>
  );
}
