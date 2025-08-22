module.exports = {
  apps: [
    {
      name: 'kelishamiz-backend',
      script: './dist/src/main.js',
      instances: 1, // faqat bitta process
      exec_mode: 'fork', // cluster o‘rniga fork
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
    },
  ],
};
