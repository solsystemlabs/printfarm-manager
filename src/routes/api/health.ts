import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getPrismaClient } from '~/lib/db'

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => {
        // Environment variables work in both local dev (process.env) and Workers (injected by adapter)
        // In local dev: process.env from .dev.vars
        // In Workers: process.env is populated by the runtime from wrangler.jsonc vars
        const environment = process.env.ENVIRONMENT || 'development'
        const xataBranch = process.env.XATA_BRANCH || 'dev'

        try {
          // Get singleton Prisma client and pool
          const { prisma } = getPrismaClient()

          // Test database connection with a simple query
          await prisma.$connect()
          await prisma.$disconnect()

          return json({
            status: 'healthy',
            database: 'connected',
            environment,
            xataBranch,
            timestamp: new Date().toISOString(),
          })
        } catch (error) {
          return json(
            {
              status: 'unhealthy',
              database: 'disconnected',
              environment,
              xataBranch,
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString(),
            },
            { status: 503 },
          )
        }
      },
    },
  },
})
