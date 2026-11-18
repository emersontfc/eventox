import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

process.env.HOST = process.env.HOST || "127.0.0.1";
process.env.PORT = process.env.PORT || "3050";
process.env.NODE_ENV = "production";

const standaloneServer = path.resolve(process.cwd(), "dist/standalone/server.js");
if (!fs.existsSync(standaloneServer)) {
  console.error("❌ Servidor standalone não encontrado em dist/standalone/server.js");
  console.error("Execute primeiro: npm run build:vps");
  process.exit(1);
}

console.log(`🚀 [Eventox VPS] Iniciando servidor Node standalone em http://${process.env.HOST}:${process.env.PORT}`);

const child = spawn(process.execPath, [standaloneServer], {
  stdio: "inherit",
  env: process.env,
});

child.on("error", (err) => {
  console.error("❌ Erro ao iniciar servidor Node:", err);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
