// SPDX-License-Identifier: Apache-2.0
// Post-build smoke test: render through the built package, ESM and CJS, with
// GemaraProvider / IdPrefixScope / HeadingScope imported from different
// subpaths than the renderer. Catches context duplication across bundles,
// which the vitest suite (importing from src/) cannot see.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { parse } from "yaml";

const require = createRequire(import.meta.url);
const data = parse(readFileSync(new URL("../../gemara/test/test-data/good-ccc.yaml", import.meta.url), "utf8"));

async function load(ext) {
  const get = (p) => (ext === "cjs" ? require(`../dist/${p}/index.cjs`) : import(`../dist/${p}/index.js`));
  const [{ GemaraProvider }, { IdPrefixScope, HeadingScope }, { ControlCatalog }] = await Promise.all([
    get("provider"),
    get("primitives"),
    get("control-catalog"),
  ]);
  return { GemaraProvider, IdPrefixScope, HeadingScope, ControlCatalog };
}

for (const ext of ["js", "cjs"]) {
  const { GemaraProvider, IdPrefixScope, HeadingScope, ControlCatalog } = await load(ext);
  let calls = 0;
  const html = renderToString(
    h(
      GemaraProvider,
      { linkResolver: (r) => { calls++; return h("a", { href: "#" }, r.id); } },
      h(IdPrefixScope, { prefix: "smoke-" }, h(HeadingScope, { level: 3 }, h(ControlCatalog, { data }))),
    ),
  );
  assert.ok(calls > 0, `${ext}: linkResolver from /provider never reached /control-catalog`);
  assert.ok(html.includes('id="smoke-control-'), `${ext}: IdPrefixScope from /primitives did not apply`);
  assert.ok(html.includes("<h3"), `${ext}: HeadingScope from /primitives did not apply`);
  console.log(`${ext}: ok (${calls} resolver calls)`);
}
