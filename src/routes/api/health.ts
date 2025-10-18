import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { log } from "~/lib/utils/logger";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const startTime = Date.now();

        // Environment variables work in both local dev (process.env) and Workers (injected by adapter)
        // In local dev: process.env from .dev.vars
        // In Workers: process.env is populated by the runtime from wrangler.jsonc vars
        const environment = process.env.ENVIRONMENT || "development";
        const xataBranch = process.env.XATA_BRANCH || "dev";
        const databaseUrl = process.env.DATABASE_URL;

        // NOTE: Database connection testing with Prisma deferred until Epic 2
        // For now, just verify environment configuration is working
        const databaseConfigured = !!databaseUrl;

        const durationMs = Date.now() - startTime;

        // Log health check event with structured JSON format
        log("health_check", {
          method: request.method,
          path: new URL(request.url).pathname,
          status: 200,
          durationMs,
          databaseConfigured,
        });

        return json({
          status: "healthy",
          database: databaseConfigured ? "configured" : "not configured",
          environment,
          xataBranch,
          timestamp: new Date().toISOString(),
          note: "Database connection testing will be implemented in Epic 2 with actual schema",
        });
      },
    },
  },
});
