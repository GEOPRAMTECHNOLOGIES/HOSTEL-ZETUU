module.exports = {
  apps: [
    {
      name: 'hosteli-zetu',
      script: 'server.js',
      instances: process.env.PM2_INSTANCES || 2, // cluster mode across CPU cores
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '400M',
      autorestart: true,
      watch: false,
      kill_timeout: 12000, // give the graceful-shutdown handler in server.js time to finish
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
