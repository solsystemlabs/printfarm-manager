import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";

export default defineConfig(() => {
  // Determine if we're building for Cloudflare (production/staging) or local dev
  const isCloudflare = process.env.CLOUDFLARE_ENV === "staging" || process.env.CLOUDFLARE_ENV === "production";

  return {
    server: {
      port: 3000,
    },
    plugins: [
      cloudflare({ viteEnvironment: { name: "ssr" } }),
      tsConfigPaths({
        projects: ["./tsconfig.json"],
      }),
      tanstackStart(),
      viteReact(),
    ],
    define: {
      // Replace __IS_CLOUDFLARE__ with true/false at build time for tree-shaking
      '__IS_CLOUDFLARE__': isCloudflare,
    },
  };
});
