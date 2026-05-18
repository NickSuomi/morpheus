import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@morpheus/adapters": fileURLToPath(
        new URL("./packages/adapters/src/index.ts", import.meta.url),
      ),
      "@morpheus/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
      "@morpheus/runtime": fileURLToPath(
        new URL("./packages/runtime/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    globals: false,
  },
});
