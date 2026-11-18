module.exports = {
  apps: [
    {
      name: 'eventox',
      script: 'node',
      args: '--import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js dev --config dist/server/wrangler.json --local --persist-to .wrangler/state --ip 127.0.0.1 --port 3050 --inspector-port 0',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3050,
      },
    },
  ],
};
