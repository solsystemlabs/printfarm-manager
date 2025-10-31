// Database client factory for serverless environments
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// Note: In serverless environments, we create instances per-request and clean them up
// to avoid connection pool exhaustion

export function getPrismaClient(databaseUrl: string): {
  prisma: PrismaClient;
  pool: pg.Pool;
} {
  // Create PostgreSQL connection pool
  const pool = new pg.Pool({
    connectionString: databaseUrl,
  });

  // Create Prisma adapter for edge runtime
  const adapter = new PrismaPg(pool);

  // Initialize Prisma client with adapter
  const prisma = new PrismaClient({ adapter });

  return {
    prisma,
    pool,
  };
}
