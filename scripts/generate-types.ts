// SPDX-License-Identifier: Apache-2.0
/**
 * Type generation pipeline.
 *
 * Pulls the Gemara OpenAPI schema, runs openapi-typescript over it, then
 * post-processes to:
 *   - emit a typed `ArtifactType` union literal mirroring metadata.cue,
 *   - emit narrowed aliases (metadata.type pinned to the literal, plus
 *     restoration of fields the OpenAPI generator drops or collapses) for all
 *     13 artifact types,
 *   - emit an `is<Type>` runtime guard per artifact type.
 *
 * This is the TS analogue of go-gemara/cmd/typestagger.
 *
 * Source resolution order:
 *   1. GEMARA_SPEC_DIR env (sibling local checkout) -> ${dir}/generated/openapi.yaml
 *   2. ../gemara/generated/openapi.yaml (default sibling layout)
 *   3. (future) GitHub release asset for the version pinned in .spec-version
 *
 * The release-asset path is intentionally not yet implemented because upstream
 * does not publish openapi.yaml as a release artifact at this writing. When it
 * does, swap in the fetch with an integrity-checked download.
 */

import { spawn } from "node:child_process";
import { readFile, writeFile, access } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// Mirrors gemara/metadata.cue #ArtifactType. Keep in sync when the spec grows.
// Drift from the spec is enforced by assertArtifactTypeDrift() before openapi-typescript runs.
const ARTIFACT_TYPES = [
  "CapabilityCatalog",
  "ControlCatalog",
  "GuidanceCatalog",
  "ThreatCatalog",
  "RiskCatalog",
  "Policy",
  "MappingDocument",
  "Lexicon",
  "EvaluationLog",
  "EnforcementLog",
  "VectorCatalog",
  "PrincipleCatalog",
  "AuditLog",
] as const;

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function resolveOpenApiSource(): Promise<string> {
  const candidates: string[] = [];

  if (process.env.GEMARA_SPEC_DIR) {
    candidates.push(join(process.env.GEMARA_SPEC_DIR, "generated", "openapi.yaml"));
  }
  candidates.push(resolve(repoRoot, "..", "gemara", "generated", "openapi.yaml"));

  for (const c of candidates) {
    if (await fileExists(c)) return c;
  }

  const specVersion = (await readFile(resolve(repoRoot, ".spec-version"), "utf8")).trim();

  throw new Error(
    [
      `Could not locate openapi.yaml for spec ${specVersion}.`,
      "",
      "Tried:",
      ...candidates.map((c) => `  - ${c}`),
      "",
      "Resolve this by either:",
      "  1. Setting GEMARA_SPEC_DIR=/absolute/path/to/gemara",
      "  2. Running `make gendocs` in ../gemara to materialize generated/openapi.yaml",
      "     (then `make cleanup` after this script finishes; gemara CI rejects committed generated files)",
      "  3. Once upstream publishes openapi.yaml as a release asset for the pinned",
      "     SPECVERSION, this script will fetch it from the GitHub release.",
    ].join("\n"),
  );
}

async function assertArtifactTypeDrift(source: string): Promise<void> {
  // The OpenAPI generator (gemara/cmd/gemara-docs cue2openapi) does not preserve
  // CUE disjunction enums — ArtifactType comes out as a bare `type: string`. The
  // CUE source is the actual source of truth, and metadata.cue sits next to the
  // generated/ output directory.
  const specDir = dirname(dirname(source));
  const metadataPath = join(specDir, "metadata.cue");

  let raw: string;
  try {
    raw = await readFile(metadataPath, "utf8");
  } catch {
    throw new Error(
      `Cannot verify ArtifactType drift: ${metadataPath} not found. ` +
        `The spec checkout looks incomplete.`,
    );
  }

  const enumValues = extractArtifactTypeLiterals(raw);
  if (!enumValues || enumValues.length === 0) {
    throw new Error(
      `Could not extract #ArtifactType literals from ${metadataPath}. ` +
        `The CUE format may have changed; update extractArtifactTypeLiterals().`,
    );
  }

  const fromSpec = new Set(enumValues);
  const fromScript = new Set<string>(ARTIFACT_TYPES);
  const missing = [...fromSpec].filter((v) => !fromScript.has(v)).sort();
  const extra = [...fromScript].filter((v) => !fromSpec.has(v)).sort();

  if (missing.length === 0 && extra.length === 0) return;

  const lines = [
    `ArtifactType drift detected between scripts/generate-types.ts and ${metadataPath}.`,
  ];
  if (missing.length > 0) {
    lines.push(`  Missing from ARTIFACT_TYPES (present in spec): ${missing.join(", ")}`);
  }
  if (extra.length > 0) {
    lines.push(`  Extra in ARTIFACT_TYPES (absent from spec): ${extra.join(", ")}`);
  }
  lines.push("Update ARTIFACT_TYPES in scripts/generate-types.ts to match the spec.");
  throw new Error(lines.join("\n"));
}

function extractArtifactTypeLiterals(src: string): string[] | undefined {
  // Match the #ArtifactType definition line. The spec currently writes the
  // disjunction on a single line; broaden the capture if that ever changes.
  const lineRe = /^#ArtifactType\s*:\s*(.+)$/m;
  const m = src.match(lineRe);
  const rhs = m?.[1];
  if (!rhs) return undefined;
  const stringRe = /"([^"]+)"/g;
  const values: string[] = [];
  for (const sm of rhs.matchAll(stringRe)) {
    const v = sm[1];
    if (v) values.push(v);
  }
  return values;
}

function runOpenApiTypescript(source: string): Promise<string> {
  return new Promise((resolveP, rejectP) => {
    const child = spawn(
      "npx",
      ["--no-install", "openapi-typescript", source, "--root-types"],
      { cwd: repoRoot, env: process.env },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", rejectP);
    child.on("close", (code) => {
      if (code !== 0) {
        rejectP(new Error(`openapi-typescript exited ${code}\n${stderr}`));
        return;
      }
      resolveP(stdout);
    });
  });
}

function buildPostamble(): string {
  const unionLiteral = ARTIFACT_TYPES.map((t) => JSON.stringify(t)).join(" | ");

  return `

// =============================================================================
// Post-processed additions (see scripts/generate-types.ts)
// These layer discriminated-union narrowing on top of the raw openapi-typescript
// output, which loses the metadata.type discriminator at the schema level.
// =============================================================================

/** ArtifactType mirrors gemara/metadata.cue #ArtifactType. */
export type ArtifactType = ${unionLiteral};

export const ARTIFACT_TYPES = [
${ARTIFACT_TYPES.map((t) => `  ${JSON.stringify(t)},`).join("\n")}
] as const satisfies readonly ArtifactType[];

/** Convenience alias for the components.schemas namespace. */
export type Schemas = components["schemas"];

/**
 * \`#Metadata\` declares \`mapping-references\` under a CUE field alias
 * (\`MR="mapping-references"\`) that the OpenAPI generator drops. Restore it
 * once here so every narrowed alias below carries it.
 */
export type Metadata = Schemas["Metadata"] & {
  "mapping-references"?: Schemas["MappingReference"][];
};

/**
 * EntryMapping override.
 *
 * The upstream openapi.yaml currently inlines a partial \`ArtifactMapping\` for
 * the \`entries\` field of MultiEntryMapping that omits the \`entry-id\` field
 * present in the CUE source and required by every fixture. We restore it here.
 */
export interface EntryMapping {
  "reference-id"?: string;
  "entry-id"?: string;
  remarks?: string;
}

/**
 * MultiEntryMapping override.
 *
 * Same root cause as EntryMapping: the upstream OpenAPI drops \`reference-id\`
 * on the parent and the nested \`entry-id\`. Restore both so renderers can index
 * into the fixture shape without \`any\`.
 */
export interface MultiEntryMapping {
  "reference-id"?: string;
  remarks?: string;
  entries?: EntryMapping[];
}

/** A loaded ControlCatalog with the discriminator narrowed to the literal. */
export type ControlCatalog = Omit<Schemas["ControlCatalog"], "metadata" | "controls"> & {
  metadata: Metadata & { type: "ControlCatalog" };
  groups?: Schemas["Group"][];
  title?: string;
  extends?: Schemas["ArtifactMapping"][];
  imports?: MultiEntryMapping[];
  controls?: Array<
    Omit<NonNullable<Schemas["ControlCatalog"]["controls"]>[number], "guidelines" | "threats"> & {
      guidelines?: MultiEntryMapping[];
      threats?: MultiEntryMapping[];
    }
  >;
};

/** A loaded GuidanceCatalog with the discriminator narrowed to the literal. */
export type GuidanceCatalog = Omit<Schemas["GuidanceCatalog"], "metadata" | "guidelines"> & {
  metadata: Metadata & { type: "GuidanceCatalog" };
  groups?: Schemas["Group"][];
  title?: string;
  extends?: Schemas["ArtifactMapping"][];
  imports?: MultiEntryMapping[];
  guidelines?: Array<
    Omit<NonNullable<Schemas["GuidanceCatalog"]["guidelines"]>[number], "principles"> & {
      principles?: MultiEntryMapping[];
    }
  >;
};

/**
 * A loaded PrincipleCatalog with the discriminator narrowed to the literal.
 *
 * As with the other catalog types, the OpenAPI generator drops the embedded
 * \`#Catalog\` mixin fields (groups, title), so we restore them here. Principles
 * carry no mappings, so the entry shape needs no further narrowing.
 */
export type PrincipleCatalog = Omit<Schemas["PrincipleCatalog"], "metadata"> & {
  metadata: Metadata & { type: "PrincipleCatalog" };
  groups?: Schemas["Group"][];
  title?: string;
  extends?: Schemas["ArtifactMapping"][];
  imports?: MultiEntryMapping[];
};

/** A loaded VectorCatalog with the discriminator narrowed to the literal. */
export type VectorCatalog = Omit<Schemas["VectorCatalog"], "metadata"> & {
  metadata: Metadata & { type: "VectorCatalog" };
  groups?: Schemas["Group"][];
  title?: string;
  extends?: Schemas["ArtifactMapping"][];
  imports?: MultiEntryMapping[];
};

/** A loaded CapabilityCatalog with the discriminator narrowed to the literal. */
export type CapabilityCatalog = Omit<Schemas["CapabilityCatalog"], "metadata"> & {
  metadata: Metadata & { type: "CapabilityCatalog" };
  groups?: Schemas["Group"][];
  title?: string;
  extends?: Schemas["ArtifactMapping"][];
  imports?: MultiEntryMapping[];
};

/**
 * A loaded ThreatCatalog with the discriminator narrowed to the literal.
 *
 * Threats carry \`capabilities\` and \`vectors\` mappings (same MultiEntryMapping
 * restoration as Control/Guidance) and \`actors\`, whose embedded \`#Entity\` shape
 * (id/name/type) the OpenAPI generator collapses to just \`contact\` — restore the
 * Entity fields so EntityRef can render them.
 */
export type ThreatCatalog = Omit<Schemas["ThreatCatalog"], "metadata" | "threats"> & {
  metadata: Metadata & { type: "ThreatCatalog" };
  groups?: Schemas["Group"][];
  title?: string;
  extends?: Schemas["ArtifactMapping"][];
  imports?: MultiEntryMapping[];
  threats?: Array<
    Omit<
      NonNullable<Schemas["ThreatCatalog"]["threats"]>[number],
      "capabilities" | "vectors" | "actors"
    > & {
      // capabilities is required in the spec (#Threat); vectors/actors are optional.
      capabilities: MultiEntryMapping[];
      vectors?: MultiEntryMapping[];
      actors?: Array<Schemas["Entity"] & { contact?: Schemas["Contact"] }>;
    }
  >;
};

/**
 * A loaded RiskCatalog with the discriminator narrowed to the literal.
 *
 * The OpenAPI generator drops the embedded \`#Catalog\` mixin field \`title\` and
 * the \`#Group\` fields embedded in \`#RiskCategory\` (id/title/description) —
 * restore both. Risk \`threats\` mappings get the same MultiEntryMapping
 * restoration as Control/Guidance/Threat.
 */
export type RiskCatalog = Omit<Schemas["RiskCatalog"], "metadata" | "groups" | "risks"> & {
  metadata: Metadata & { type: "RiskCatalog" };
  groups?: Array<Schemas["Group"] & Schemas["RiskCategory"]>;
  title?: string;
  extends?: Schemas["ArtifactMapping"][];
  imports?: MultiEntryMapping[];
  risks?: Array<
    Omit<NonNullable<Schemas["RiskCatalog"]["risks"]>[number], "threats"> & {
      threats?: MultiEntryMapping[];
    }
  >;
};

/**
 * A loaded Policy with the discriminator narrowed to the literal.
 *
 * Policy is not a \`#Catalog\`, so there are no groups/title mixin fields to
 * restore, but the CUE conjunctions \`#AcceptedMethod & {type: ...}\` inside
 * \`#Adherence\` / \`#AssessmentPlan\` collapse to bare strings in the OpenAPI —
 * restore the \`AcceptedMethod\` shape.
 */
export type Policy = Omit<Schemas["Policy"], "metadata" | "adherence"> & {
  metadata: Metadata & { type: "Policy" };
  adherence: Omit<
    Schemas["Adherence"],
    "evaluation-methods" | "enforcement-methods" | "assessment-plans"
  > & {
    "evaluation-methods"?: Schemas["AcceptedMethod"][];
    "enforcement-methods"?: Schemas["AcceptedMethod"][];
    "assessment-plans"?: Array<
      Omit<Schemas["AssessmentPlan"], "evaluation-methods"> & {
        "evaluation-methods": Schemas["AcceptedMethod"][];
      }
    >;
  };
};

/**
 * A loaded Lexicon with the discriminator narrowed to the literal.
 *
 * \`_uniqueTermIds\` is a hidden CUE validation map that leaks into the OpenAPI
 * as a required field; real documents never carry it, so it is omitted.
 */
export type Lexicon = Omit<Schemas["Lexicon"], "metadata" | "_uniqueTermIds"> & {
  metadata: Metadata & { type: "Lexicon" };
};

/**
 * A loaded MappingDocument with the discriminator narrowed to the literal.
 *
 * The generated \`metadata\` keeps only the conditional \`mapping-references\`
 * overlay and loses the base \`#Metadata\` fields (including \`type\`) — restore
 * both. \`#_MappingStrict\` collapses to \`string\` in the OpenAPI, so \`mappings\`
 * is restored to the underlying \`Mapping\` shape. \`_uniqueMappingIds\` is a
 * leaked hidden CUE field (same story as Lexicon) and is omitted.
 */
export type MappingDocument = Omit<
  Schemas["MappingDocument"],
  "metadata" | "mappings" | "_uniqueMappingIds"
> & {
  metadata: Metadata & {
    type: "MappingDocument";
    "mapping-references": Schemas["MappingReference"][];
  };
  mappings: Schemas["Mapping"][];
};

/**
 * A loaded AuditLog with the discriminator narrowed to the literal.
 *
 * AuditLog embeds \`#Log\`, whose \`target\` field the OpenAPI generator drops —
 * restored here (optional, matching the defensive treatment of restored
 * catalog mixin fields). Each result's \`criteria-reference\` gets the
 * MultiEntryMapping restoration.
 */
export type AuditLog = Omit<Schemas["AuditLog"], "metadata" | "results"> & {
  metadata: Metadata & { type: "AuditLog" };
  target?: Schemas["Resource"];
  results: Array<
    Omit<Schemas["AuditResult"], "criteria-reference"> & {
      "criteria-reference": MultiEntryMapping;
    }
  >;
};

/**
 * A loaded EnforcementLog with the discriminator narrowed to the literal.
 *
 * The CUE conditional constraint on \`actions\` ("Clear dispositions only
 * contain Passed results") collapses the OpenAPI \`actions\` items to empty
 * objects — restore the \`ActionResult\` shape. \`target\` comes from the dropped
 * \`#Log\` embed (same as AuditLog).
 */
export type EnforcementLog = Omit<Schemas["EnforcementLog"], "metadata" | "actions"> & {
  metadata: Metadata & { type: "EnforcementLog" };
  target?: Schemas["Resource"];
  actions: Schemas["ActionResult"][];
};

/**
 * A loaded EvaluationLog with the discriminator narrowed to the literal.
 *
 * \`target\` comes from the dropped \`#Log\` embed. The CUE constraint tying
 * assessment-log reference-ids to the control collapses each evaluation's
 * \`assessment-logs\` items to \`{ requirement: { "reference-id" } }\` — restore
 * the full \`AssessmentLog\` shape.
 */
export type EvaluationLog = Omit<Schemas["EvaluationLog"], "metadata" | "evaluations"> & {
  metadata: Metadata & { type: "EvaluationLog" };
  target?: Schemas["Resource"];
  evaluations: Array<
    Omit<Schemas["ControlEvaluation"], "assessment-logs"> & {
      "assessment-logs": Schemas["AssessmentLog"][];
    }
  >;
};

/** Minimal shape we rely on for type discrimination at runtime. */
type WithDiscriminator = { metadata?: { type?: string } };

function discriminator(x: unknown): string | undefined {
  if (typeof x !== "object" || x === null) return undefined;
  const m = (x as WithDiscriminator).metadata;
  if (!m || typeof m !== "object") return undefined;
  return typeof m.type === "string" ? m.type : undefined;
}

export function isControlCatalog(x: unknown): x is ControlCatalog {
  return discriminator(x) === "ControlCatalog";
}

export function isGuidanceCatalog(x: unknown): x is GuidanceCatalog {
  return discriminator(x) === "GuidanceCatalog";
}

export function isPrincipleCatalog(x: unknown): x is PrincipleCatalog {
  return discriminator(x) === "PrincipleCatalog";
}

export function isVectorCatalog(x: unknown): x is VectorCatalog {
  return discriminator(x) === "VectorCatalog";
}

export function isCapabilityCatalog(x: unknown): x is CapabilityCatalog {
  return discriminator(x) === "CapabilityCatalog";
}

export function isThreatCatalog(x: unknown): x is ThreatCatalog {
  return discriminator(x) === "ThreatCatalog";
}

export function isRiskCatalog(x: unknown): x is RiskCatalog {
  return discriminator(x) === "RiskCatalog";
}

export function isPolicy(x: unknown): x is Policy {
  return discriminator(x) === "Policy";
}

export function isLexicon(x: unknown): x is Lexicon {
  return discriminator(x) === "Lexicon";
}

export function isMappingDocument(x: unknown): x is MappingDocument {
  return discriminator(x) === "MappingDocument";
}

export function isAuditLog(x: unknown): x is AuditLog {
  return discriminator(x) === "AuditLog";
}

export function isEnforcementLog(x: unknown): x is EnforcementLog {
  return discriminator(x) === "EnforcementLog";
}

export function isEvaluationLog(x: unknown): x is EvaluationLog {
  return discriminator(x) === "EvaluationLog";
}

export function detectArtifactType(x: unknown): ArtifactType | undefined {
  const d = discriminator(x);
  return d && (ARTIFACT_TYPES as readonly string[]).includes(d)
    ? (d as ArtifactType)
    : undefined;
}
`;
}

async function main() {
  const source = await resolveOpenApiSource();
  console.error(`[generate-types] source: ${source}`);

  await assertArtifactTypeDrift(source);

  const raw = await runOpenApiTypescript(source);

  // openapi-typescript emits a deprecation banner with eslint-disable; keep it.
  // Strip the trailing newline so we always end with one after our postamble.
  const trimmed = raw.replace(/\s+$/u, "");
  const out = `${trimmed}\n${buildPostamble()}`;

  const dest = resolve(repoRoot, "src", "generated", "types.ts");
  await writeFile(dest, out, "utf8");
  console.error(`[generate-types] wrote ${dest} (${out.length} bytes)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
