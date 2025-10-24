module.exports = {
  apps: [
    {
      name: "kelishamiz-backend",
      script: "dist/main.js",
    }
  ],
  deploy: {
    production: {
      user: "root",
      host: "api.kelishamiz.uz",
      ref: "origin/main",
      repo: "git@github.com:my-workj-ob/kelishamiz-backend.git",
      path: "/var/www/api.kelishamiz.uz",
      "post-deploy": "npm install && npm run build && pm2 reload ecosystem.config.js --env production"
    }
  }
}
