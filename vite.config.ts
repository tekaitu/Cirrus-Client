import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: { target: "es2020", outDir: "dist" },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
