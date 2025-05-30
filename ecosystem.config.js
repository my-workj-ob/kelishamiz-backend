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
        PORT: 3000, // kerakli port
        // boshqa environment variables
      },
    },
  ],
};
