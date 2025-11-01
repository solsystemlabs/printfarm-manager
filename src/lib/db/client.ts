// Prisma Client singleton with Accelerate support
// Note: Using standard @prisma/client (not /edge) for Netlify Functions Node.js runtime
import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const globalForPrisma = global as unknown as {
  prisma: ReturnType<typeof createPrismaClient>;
};

function createPrismaClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  }).$extends(withAccelerate());
}

// Initialize Prisma client with Accelerate extension
// Works with both:
// - Direct PostgreSQL URLs (local dev): postgresql://localhost:5432/db
// - Prisma Accelerate URLs (production): prisma://accelerate.prisma-data.net/?api_key=...
export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
