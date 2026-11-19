import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

process.env.BUILD_TARGET = "node";
process.env.NODE_ENV = "production";

const root = process.cwd();
const require = createRequire(path.join(root, "package.json"));

console.log("🔍 [Eventox VPS] A verificar dependências de runtime...");

// Verificar se better-sqlite3 e dependências essenciais estão instaladas em node_modules
let missingDependency = false;
for (const dep of ["better-sqlite3", "@aws-sdk/client-s3", "qrcode"]) {
  try {
    require.resolve(`${dep}/package.json`);
  } catch {
    console.log(`📦 [Eventox VPS] Dependência em falta no node_modules: "${dep}"`);
    missingDependency = true;
    break;
  }
}

if (missingDependency) {
  console.log("📦 [Eventox VPS] A instalar dependências em falta através de npm install...");
  const installResult = spawnSync("npm", ["install", "--prefer-offline", "--no-audit"], {
    stdio: "inherit",
    cwd: root,
    shell: true,
  });
  if (installResult.status !== 0) {
    console.error("❌ [Eventox VPS] Erro ao executar npm install. Por favor executa manualmente: npm install");
    process.exit(installResult.status ?? 1);
  }
  console.log("✅ [Eventox VPS] Dependências instaladas com sucesso!");
}

console.log("🔨 [Eventox VPS] Compilando bundle Node standalone...");

// Vinext verifica se existe wrangler na raiz para forçar Cloudflare.
// No alvo Node VPS, ocultamos temporariamente os ficheiros wrangler da raiz durante o build.
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
