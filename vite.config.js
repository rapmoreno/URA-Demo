"use strict";

import { defineConfig } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: ".",
  publicDir: "public",
  resolve: {
    alias: {
      talkinghead: resolve(__dirname, "scripts/talkinghead-stub.js"),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      input: "./index.html",
    },
  },
  plugins: [
    {
      name: "block-chatbot",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith("/chatbot")) {
            res.statusCode = 404;
            res.end("Not found");
            return;
          }
          next();
        });
      },
    },
  ],
});
