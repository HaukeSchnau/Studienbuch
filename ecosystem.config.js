module.exports = {
  apps: [
    {
      name: "ClassMate",
      script: "pnpm",
      args: "start",
    },
  ],
  deploy: {
    production: {
      "user": "hauke",
      "host": "haukeschnau.de",
      "ref": "origin/main",
      "repo": "git@github.com:HaukeSchnau/ClassMate.git",
      "path": "/home/hauke/apps/ClassMate",
      "post-setup": "scripts/setup && ni && nr db:generate && nr db:push",
      "post-deploy": "ni && nr build && pm2 startOrRestart ecosystem.config.js"
    },
  },
};
