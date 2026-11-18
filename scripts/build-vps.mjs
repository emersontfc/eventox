import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.BUILD_TARGET = "node";
process.env.NODE_ENV = "production";

console.log("🔨 [Eventox VPS] Compilando bundle Node standalone...");

// Vinext verifica se existe wrangler na raiz para forçar Cloudflare.
// No alvo Node VPS, ocultamos temporariamente os ficheiros wrangler da raiz durante o build.
const root = process.cwd();
const stashed = [];
for (const name of ["wrangler.json", "wrangler.jsonc", "wrangler.toml"]) {
  const p = path.join(root, name);
  if (fs.existsSync(p)) {
    const backup = path.join(root, `${name}.vps_bak`);
    fs.renameSync(p, backup);
    stashed.push({ orig: p, backup });
  }
}

try {
  const cli = fileURLToPath(new URL("../scripts/run-framework.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [cli, "build"], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
} finally {
  for (const item of stashed) {
    if (fs.existsSync(item.backup)) {
      fs.renameSync(item.backup, item.orig);
    }
  }
}

console.log("✅ [Eventox VPS] Build standalone para Node.js concluído com sucesso!");
