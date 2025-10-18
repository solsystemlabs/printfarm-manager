/**
 * Structured log event types
 */
export type LogEventType =
  | 'request_start'
  | 'request_complete'
  | 'request_error'
  | 'health_check'
  | 'api_error'
  | string // Allow custom event types for performance metrics

/**
 * Structured log data interface
 */
export interface LogEvent {
  timestamp: string
  event: LogEventType
  environment: string
  [key: string]: unknown
}

/**
 * Performance metric data
 */
export interface PerformanceMetric {
  durationMs: number
  [key: string]: unknown
}

/**
 * Get current environment from Cloudflare context
 * Falls back to 'development' if context unavailable
 */
function getEnvironment(): string {
  // In test environment or when vinxi/http is not available, use process.env or default
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return 'development'
  }

  // Try to use environment from process.env first (works in all environments)
  if (typeof process !== 'undefined' && process.env?.ENVIRONMENT) {
    return process.env.ENVIRONMENT
  }

  // Fall back to development (this is safe for all environments)
  return 'development'
}

/**
 * General-purpose structured logging
 *
 * @param event - Event type identifier (e.g., 'request_complete', 'health_check')
 * @param data - Additional structured data to log
 *
 * @example
 * log('request_complete', { method: 'GET', path: '/api/health', status: 200, durationMs: 12 })
 */
export function log(event: LogEventType, data?: Record<string, unknown>): void {
  const logEvent: LogEvent = {
    timestamp: new Date().toISOString(),
    event,
    environment: getEnvironment(),
    ...data,
  }

  console.log(JSON.stringify(logEvent))
}

/**
 * Error logging with full details
 * Stack traces are logged to console only (never exposed to users per NFR-6)
 *
 * @param event - Error event type (e.g., 'api_error', 'request_error')
 * @param error - Error object or message
 * @param data - Additional context data
 *
 * @example
 * logError('api_error', new Error('Database connection failed'), { operation: 'query', table: 'files' })
 */
export function logError(
  event: LogEventType,
  error: Error | string,
  data?: Record<string, unknown>
): void {
  const errorMessage = error instanceof Error ? error.message : error
  const stack = error instanceof Error ? error.stack : undefined

  const logEvent: LogEvent = {
    timestamp: new Date().toISOString(),
    event,
    environment: getEnvironment(),
    error: errorMessage,
    stack, // Stack trace logged to console only, never exposed to client
    ...data,
  }

  console.error(JSON.stringify(logEvent))
}

/**
 * Performance metric logging
 * Used to track operation durations for identifying slow operations (per NFR-9)
 *
 * @param event - Performance event type (e.g., 'file_upload_performance', 'search_query_performance')
 * @param durationMs - Operation duration in milliseconds
 * @param data - Additional metric data
 *
 * @example
 * const startTime = Date.now()
 * // ... perform operation ...
 * logPerformance('file_upload_performance', Date.now() - startTime, { fileSize: 1024000, fileName: 'test.pdf' })
 */
export function logPerformance(
  event: string,
  durationMs: number,
  data?: Record<string, unknown>
): void {
  const logEvent: LogEvent & PerformanceMetric = {
    timestamp: new Date().toISOString(),
    event,
    environment: getEnvironment(),
    durationMs,
    ...data,
  }

  console.log(JSON.stringify(logEvent))
}
