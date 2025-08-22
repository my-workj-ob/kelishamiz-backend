module.exports = {
  apps: [
    {
      name: 'kelishamiz-backend',
      script: './dist/src/main.js', // shu to‘g‘ri yo‘l
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3030,
        DATABASE_HOST: process.env.DATABASE_HOST,
        DATABASE_PORT: process.env.DATABASE_PORT,
        DATABASE_USER: process.env.DATABASE_USER,
        DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
        DATABASE_NAME: process.env.DATABASE_NAME,
        JWT_SECRET_KEY: process.env.JWT_SECRET_KEY,
        BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
        REDIS_URL: process.env.REDIS_URL,
        ESKIZ_EMAIL: process.env.ESKIZ_EMAIL,
        ESKIZ_PASSWORD: process.env.ESKIZ_PASSWORD,
        ESKIZ_API_TOKEN: process.env.ESKIZ_API_TOKEN,
        PAYME_MERCHANT_ID: process.env.PAYME_MERCHANT_ID,
        PAYME_API_KEY: process.env.PAYME_API_KEY,
        PAYME_API_URL: process.env.PAYME_API_URL,
      },
    },
  ],
};
