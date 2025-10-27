import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { getContext } from "vinxi/http";
import { getStorageClient } from "~/lib/storage";

export const Route = createFileRoute("/api/test-r2")({
  server: {
    handlers: {
      GET: async () => {
        try {
          // Get Cloudflare context for R2 binding access (staging/production)
          // In development, getStorageClient() will use MinIO from process.env instead
          let cfEnv;
          try {
            const cf = getContext("cloudflare");
            cfEnv = cf?.env;
          } catch {
            // getContext not available in development - that's OK, will use MinIO
            cfEnv = undefined;
          }

          // Get environment-appropriate storage client
          const storage = await getStorageClient(cfEnv);

          const key = "test/test.txt";
          const testContent = `Hello from ${storage.getStorageType()}!`;

          // Test upload
          await storage.put(key, testContent, {
            contentType: "text/plain",
          });

          // Test download
          const content = await storage.get(key);

          // Test delete
          await storage.delete(key);

          // Return test results
          return json({
            success: content === testContent,
            content: content || "",
            message:
              content === testContent
                ? `${storage.getStorageType()} read/write/delete successful`
                : "Content mismatch",
            environment: storage.getEnvironment(),
            storage: storage.getStorageType(),
          });
        } catch (error) {
          console.error("Storage test error:", error);
          return json(
            {
              success: false,
              message: error instanceof Error ? error.message : "Unknown error",
              environment: "unknown",
              storage: "unknown",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
