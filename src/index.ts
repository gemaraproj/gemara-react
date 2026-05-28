// SPDX-License-Identifier: Apache-2.0
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
  CapabilityCatalog as CapabilityCatalogData,
  PrincipleCatalog as PrincipleCatalogData,
  ThreatCatalog as ThreatCatalogData,
  VectorCatalog as VectorCatalogData,
} from "./generated/types.js";
export {
  ARTIFACT_TYPES,
  isControlCatalog,
  isGuidanceCatalog,
  isCapabilityCatalog,
  isPrincipleCatalog,
  isThreatCatalog,
  isVectorCatalog,
  detectArtifactType,
} from "./generated/types.js";
