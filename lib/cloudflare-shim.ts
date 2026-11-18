// Safe shim for cloudflare:workers when running in Node.js runtime
export const env = {};

export class WorkerEntrypoint {
  ctx: unknown;
  env: unknown;
  constructor(ctx?: unknown, env?: unknown) {
    this.ctx = ctx;
    this.env = env;
  }
}

export default {
  env,
  WorkerEntrypoint,
};
