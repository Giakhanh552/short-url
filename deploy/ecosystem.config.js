const path = require("path");

const appRoot = path.resolve(__dirname, "..");

module.exports = {
  apps: [
    {
      name: "url-shortener",
      script: "src/index.js",
      cwd: path.join(appRoot, "server"),
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "3000",
      },
      error_file: "/var/log/url-shortener/error.log",
      out_file: "/var/log/url-shortener/out.log",
      time: true,
    },
  ],
};
