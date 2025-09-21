import { defineConfig } from "vitest/config";
import { resolve, join } from "path";
import { existsSync, readFileSync, statSync } from "fs";

export default defineConfig({
  test: {
    include: ["test/**/*.test.js"],
    browser: {
      headless: true,
      provider: "playwright",
      instances: [
        { browser: "chromium" },
      ],
    }
  },
  plugins: [
    {
      name: "serve-additional-files",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (
            req.url?.startsWith("/dist/") || 
            req.url?.startsWith("/assets/") || 
            req.url?.startsWith("/test/")
          ) {
            const filePath = join(
              __dirname, 
              req.url.split("?")[0].replace('/assets/', '/dist/assets/')
            );

            if (existsSync(filePath) && statSync(filePath).isFile()) {
              if (filePath.endsWith(".js")) {
                res.setHeader("Content-Type", "application/javascript");
              }
              res.end(readFileSync(filePath));

              return;
            }
          }
          return next();
        });
      }
    },
  ],
});
