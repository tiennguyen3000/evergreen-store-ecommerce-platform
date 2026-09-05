import { defineConfig } from "vitest/config";
import path from "path";
export default defineConfig({ test: { include: ["tests/**/*.test.ts"], setupFiles: ["dotenv/config"], testTimeout: 30000, fileParallelism: false }, resolve: { alias: { "@": path.resolve(__dirname, "src") } } });
