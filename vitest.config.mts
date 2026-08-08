import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@sidera/curriculum-schema": fileURLToPath(
        new URL("./packages/curriculum-schema/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["tests/**/*.test.ts", "packages/**/src/**/*.test.ts"],
  },
});
