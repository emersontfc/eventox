module.exports = {
  apps: [
    {
      name: "eventox",
      script: "./dist/standalone/server.js",
      cwd: "./",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "3050",
        DATABASE_PATH: "./data/eventox.db",
        SESSION_SECRET: process.env.SESSION_SECRET || "eventox_super_secure_production_secret_2026_kazix_key_live_55a9aa80",
      },
    },
  ],
};
