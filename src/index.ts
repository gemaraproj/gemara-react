// Top-level barrel — provider + primitives only.
// Renderers live behind subpath imports so consumers tree-shake per artifact.
export * from "./provider/index.js";
export * from "./primitives/index.js";

// Re-export only the discriminated unions and guards from generated types,
// so consumers can `import type { ControlCatalog } from "@gemara/react"`.
export type {
  ArtifactType,
  ControlCatalog as ControlCatalogData,
  GuidanceCatalog as GuidanceCatalogData,
} from "./generated/types.js";
export {
  ARTIFACT_TYPES,
  isControlCatalog,
  isGuidanceCatalog,
  detectArtifactType,
} from "./generated/types.js";
