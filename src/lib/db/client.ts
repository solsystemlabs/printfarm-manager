// Standard Prisma Client with PostgreSQL adapter
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
  pool: Pool;
};

// Create PostgreSQL connection pool
const pool =
  globalForPrisma.pool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

// Create Prisma adapter for serverless environment compatibility
const adapter = new PrismaPg(pool);

// Initialize Prisma client with adapter
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
}
