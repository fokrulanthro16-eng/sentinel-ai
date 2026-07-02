/**
 * Postbuild: stamp CACHE_VERSION in public/sw.js with the Next.js BUILD_ID.
 * Every `next build` generates a unique BUILD_ID, so each deployment gets a
 * distinct cache bucket. The SW activate handler then deletes all old
 * sentinel-* caches automatically on first load after deployment.
 */
const fs   = require("fs");
const path = require("path");

const buildIdFile = path.join(__dirname, "../.next/BUILD_ID");
const swFile      = path.join(__dirname, "../public/sw.js");

if (!fs.existsSync(buildIdFile)) {
  console.warn("[inject-sw-version] .next/BUILD_ID not found — skipping");
  process.exit(0);
}

const buildId = fs.readFileSync(buildIdFile, "utf8").trim();
let sw = fs.readFileSync(swFile, "utf8");

sw = sw.replace(
  /^const CACHE_VERSION = '.*?';/m,
  `const CACHE_VERSION = '${buildId}';`
);

fs.writeFileSync(swFile, sw);
console.log(`[inject-sw-version] CACHE_VERSION → ${buildId}`);
