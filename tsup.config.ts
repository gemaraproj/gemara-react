import { defineConfig } from "tsup";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const shared = {
  format: ["esm", "cjs"] as ("esm" | "cjs")[],
  dts: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  external: ["react", "react-dom", "@radix-ui/react-slot"],
};

/**
 * Re-inject the "use client" directive into interactive/* outputs.
 *
 * tsup/rollup strips module-level directives during bundling (with a warning).
 * RSC bundlers (Next, Astro, RSC-aware Webpack) require the directive at the
 * top of the *built* file to route the module into the client graph, so we
 * patch it back in as a post-process step.
 */
async function injectUseClient(distDir: string) {
  const dir = join(distDir, "interactive");
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const f of entries) {
    if (!/\.(c?js|mjs)$/.test(f)) continue;
    const p = join(dir, f);
    const src = await readFile(p, "utf8");
    if (src.startsWith('"use client"')) continue;
    // Preserve any leading "use strict" (CJS) — directive prologues stack.
    if (src.startsWith("'use strict';")) {
      await writeFile(
        p,
        `'use strict';\n"use client";\n${src.slice("'use strict';".length).replace(/^\n/, "")}`,
        "utf8",
      );
    } else {
      await writeFile(p, `"use client";\n${src}`, "utf8");
    }
  }
}

export default defineConfig({
  ...shared,
  clean: true,
  entry: {
    index: "src/index.ts",
    "control-catalog/index": "src/control-catalog/index.ts",
    "guidance-catalog/index": "src/guidance-catalog/index.ts",
    "primitives/index": "src/primitives/index.ts",
    "provider/index": "src/provider/index.ts",
    "interactive/index": "src/interactive/index.ts",
    "generated/types": "src/generated/types.ts",
  },
  async onSuccess() {
    await injectUseClient("dist");
  },
});
