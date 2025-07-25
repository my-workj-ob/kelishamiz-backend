module.exports = {
  apps: [
    {
      name: 'kelishamiz-backend',
      script: './dist/src/main.js',
      instances: 1, // yoki CPU yadro soniga qarab "max"
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: 3030, // kerakli port
        DATABASE_URL:
          'postgres://neondb_owner:npg_cbWOXKt59Gmz@ep-cool-boat-a2p8ewnj-pooler.eu-central-1.aws.neon.tech:5432/neondb?sslmode=require',
        BLOB_READ_WRITE_TOKEN:
          'vercel_blob_rw_Hl2g4VY0JzwRnHdy_88alBWTCk3BJPoDyuNMIP3E3FCm8CI',
      },
    },
  ],
};
