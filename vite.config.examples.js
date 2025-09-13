import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "examples",
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      "@lib": resolve(__dirname, "src") 
    },
  },
});