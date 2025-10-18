import { json } from '@tanstack/react-start'
import { logError } from './logger'

/**
 * API error response structure
 * Never includes stack traces (per NFR-6)
 */
export interface ApiError {
  code: string
  message: string
  field?: string
  details?: Record<string, unknown>
}

/**
 * API error response wrapper
 */
export interface ApiErrorResponse {
  error: ApiError
}

/**
 * Create sanitized error response for API endpoints
 * Logs full error details (including stack trace) to console only
 * Returns sanitized error response to client (no stack traces exposed)
 *
 * @param code - Error code identifier (e.g., 'VALIDATION_ERROR', 'NOT_FOUND')
 * @param message - User-friendly error message
 * @param statusCode - HTTP status code (default: 500)
 * @param options - Additional error details
 * @param options.field - Field name for validation errors
 * @param options.details - Additional structured error data
 * @param options.originalError - Original error object (logged to console only)
 *
 * @example
 * return createErrorResponse('NOT_FOUND', 'File not found', 404, { field: 'fileId', details: { fileId: '123' } })
 *
 * @example
 * return createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, { originalError: error })
 */
export function createErrorResponse(
  code: string,
  message: string,
  statusCode: number = 500,
  options?: {
    field?: string
    details?: Record<string, unknown>
    originalError?: Error | unknown
  }
) {
  // Log full error details to console (including stack trace if available)
  if (options?.originalError) {
    logError('api_error', options.originalError as Error, {
      code,
      statusCode,
      field: options.field,
      details: options.details,
    })
  } else {
    logError('api_error', message, {
      code,
      statusCode,
      field: options?.field,
      details: options?.details,
    })
  }

  // Return sanitized error response to client (no stack traces)
  const errorResponse: ApiErrorResponse = {
    error: {
      code,
      message,
      ...(options?.field && { field: options.field }),
      ...(options?.details && { details: options.details }),
    },
  }

  return json(errorResponse, { status: statusCode })
}
