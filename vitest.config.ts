import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "cloudflare:workers": fileURLToPath(
        new URL("./tests/cloudflare.ts", import.meta.url),
      ),
    },
  },
  test: { testTimeout: 20000, hookTimeout: 30000, fileParallelism: false },
});
