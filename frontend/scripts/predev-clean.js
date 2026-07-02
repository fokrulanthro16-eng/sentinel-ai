/**
 * Predev: if .next was produced by a production build (output:"standalone"),
 * the .next/standalone directory will exist. Stale production artifacts cause
 * the dev server to serve hashed CSS filenames (layout-[hash].css) that don't
 * match the unhashed dev URLs (layout.css), resulting in 404s for CSS on first
 * page load. Clean .next so the dev server always starts from a blank slate
 * when switching from a production build to dev mode.
 */
const fs   = require("fs");
const path = require("path");

const nextDir      = path.join(__dirname, "../.next");
const standaloneDir = path.join(nextDir, "standalone");

if (fs.existsSync(standaloneDir)) {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log("[predev] Cleaned production .next (standalone artifacts detected)");
}
