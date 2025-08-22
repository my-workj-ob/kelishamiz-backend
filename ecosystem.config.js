module.exports = {
  apps: [
    {
      name: 'kelishamiz-backend',
      script: './dist/src/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: 3030,
        DATABASE_URL: 'postgres://....',
        BLOB_READ_WRITE_TOKEN:
          'vercel_blob_rw_Hl2g4VY0JzwRnHdy_88alBWTCk3BJPoDyuNMIP3E3FCm8CI',
      },
    },
  ],
};
