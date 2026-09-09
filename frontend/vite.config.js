import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/upload":      "http://localhost:8000",
      "/recalculate": "http://localhost:8000",
      "/history":     "http://localhost:8000",
      "/records":     "http://localhost:8000",
      "/search":      "http://localhost:8000",
      "/export":      "http://localhost:8000",
      "/debug":       "http://localhost:8000",
      "/clients":     "http://localhost:8000",
      "/uploads":     "http://localhost:8000",
    },
  },
  build: {
    outDir: "../static/react",
    emptyOutDir: true,
  },
});
