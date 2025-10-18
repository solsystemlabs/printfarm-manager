import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// Database client factory for Cloudflare Workers edge runtime
// Note: In Workers, we need to be careful about connection pooling
// For now, we create instances per-request and clean them up
// Future optimization: Use Cloudflare Hyperdrive for connection pooling

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
