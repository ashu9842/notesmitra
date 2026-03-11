module.exports = {
  apps: [
    {
      name: 'notesmitra-api',
      script: './server.js',
      instances: 1, // or 'max' for cluster mode (use all CPU cores)
      exec_mode: 'fork', // or 'cluster' for load balancing
      
      // Environment variables
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      
      // Logging
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Advanced features
      wait_ready: true,              // Wait for process.send('ready')
      listen_timeout: 10000,         // Timeout for wait_ready (10 seconds)
      kill_timeout: 30000,           // Time to wait for graceful shutdown (30 seconds)
      shutdown_with_message: true,   // Send 'shutdown' message before SIGINT
      
      // Auto-restart settings
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',             // Min uptime before considered stable
      max_memory_restart: '500M',    // Restart if memory exceeds 500MB
      
      // Graceful reload/restart
      restart_delay: 4000,           // Delay between restarts (4 seconds)
      
      // Watch for changes (disable in production)
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'uploads'],
      
      // Cron restart (optional - restart daily at 3 AM)
      // cron_restart: '0 3 * * *',
      
      // Source map support
      source_map_support: true,
      
      // Process management
      instance_var: 'INSTANCE_ID',
      
      // Post-deploy hooks (if using PM2 deploy)
      post_update: ['npm install', 'echo Deploy finished'],
      
      // Time zone
      time: true
    }
  ],
  
  // PM2 deploy configuration (optional)
  deploy: {
    production: {
      user: 'deploy',
      host: ['your-server.com'],
      ref: 'origin/main',
      repo: 'git@github.com:your-username/notesmitra.git',
      path: '/var/www/notesmitra',
      'post-deploy': 'cd server && npm install && pm2 reload ecosystem.config.cjs --env production',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};
