import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import netlify from "@netlify/vite-plugin-tanstack-start";

export default defineConfig(() => {
  return {
    server: {
      port: 3000,
    },
    plugins: [
      tsConfigPaths({
        projects: ["./tsconfig.json"],
      }),
      tanstackStart(),
      viteReact(),
      netlify(),
    ],
  };
});
