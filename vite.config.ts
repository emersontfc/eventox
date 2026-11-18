import vinext from "vinext";
import { defineConfig, type PluginOption } from "vite";
import path from "node:path";
import hostingConfig from "./.openai/hosting.json";
import { readExecutionProfile } from "./scripts/execution-profile.mjs";
import { configureToolEnvironment } from "./scripts/tool-environment.mjs";

const CLOUDFLARE_D1_DATABASE_ID =
  process.env.CLOUDFLARE_D1_DATABASE_ID ||
  "b2450c68-fc38-4031-97e3-95bc4aa4ae6d";
const CLOUDFLARE_D1_DATABASE_NAME =
  process.env.CLOUDFLARE_D1_DATABASE_NAME || "eventox";

const { d1, r2 } = hostingConfig;
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const managedLinux = readExecutionProfile() === "managed-linux";

const isNodeTarget =
  process.env.BUILD_TARGET === "node" ||
  process.env.TARGET === "node" ||
  process.env.NEXT_RUNTIME === "nodejs";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: CLOUDFLARE_D1_DATABASE_NAME,
          database_id: CLOUDFLARE_D1_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async ({ command }) => {
  configureToolEnvironment(process.cwd());

  const plugins: PluginOption[] = [
    vinext(),
  ];

  if (isNodeTarget) {
    // Node.js target: DO NOT include Cloudflare Worker plugins
    return {
      resolve: {
        alias: {
          "cloudflare:workers": path.resolve(process.cwd(), "lib/cloudflare-shim.ts"),
        },
      },
      server: {
        ...(managedLinux
          ? { host: "0.0.0.0", allowedHosts: ["terminal.local"] }
          : {}),
        ...(isCodexSeatbeltSandbox
          ? { watch: { useFsEvents: false, usePolling: true } }
          : {}),
      },
      plugins,
    };
  }

  // Cloudflare Worker target
  const { sites } = await import("./scripts/vite/sites-vite-plugin");
  const { connectorPreview } = await import("./scripts/vite/connector-preview-plugin.mjs");
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  plugins.push(
    sites({ mockAuth: !managedLinux }),
    connectorPreview(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
      inspectorPort: false,
      config: {
        ...localBindingConfig,
        ...(command === "serve"
          ? {
              services: [
                {
                  binding: "CONNECTORS",
                  service: "sites-connector-preview",
                  entrypoint: "ConnectorPreview",
                },
              ],
            }
          : {}),
      },
      ...(command === "serve"
        ? {
            auxiliaryWorkers: [
              {
                config: {
                  name: "sites-connector-preview",
                  main: "./scripts/connector-preview/worker.mjs",
                  compatibility_date: "2026-05-15",
                },
              },
            ],
          }
        : {}),
    })
  );

  return {
    server: {
      ...(managedLinux
        ? { host: "0.0.0.0", allowedHosts: ["terminal.local"] }
        : {}),
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins,
  };
});
