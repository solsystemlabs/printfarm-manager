import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createErrorResponse } from '../errors'

describe('Error Response Utility', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  describe('createErrorResponse()', () => {
    it('should create basic error response with code and message', async () => {
      const response = createErrorResponse('TEST_ERROR', 'Test error message')
      const data = await response.json()

      expect(response.status).toBe(500) // Default status code
      expect(data).toEqual({
        error: {
          code: 'TEST_ERROR',
          message: 'Test error message',
        },
      })
    })

    it('should use custom status code', async () => {
      const response = createErrorResponse('NOT_FOUND', 'Resource not found', 404)

      expect(response.status).toBe(404)
    })

    it('should include field in error response when provided', async () => {
      const response = createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, {
        field: 'email',
      })
      const data = await response.json()

      expect(data.error).toHaveProperty('field', 'email')
    })

    it('should include details in error response when provided', async () => {
      const response = createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, {
        details: { expected: 'string', received: 'number' },
      })
      const data = await response.json()

      expect(data.error).toHaveProperty('details')
      expect(data.error.details).toEqual({ expected: 'string', received: 'number' })
    })

    it('should log original error to console but not expose in response', async () => {
      const originalError = new Error('Internal error with stack trace')
      const response = createErrorResponse(
        'INTERNAL_ERROR',
        'An unexpected error occurred',
        500,
        { originalError }
      )
      const data = await response.json()

      // Error should be logged to console with stack trace
      expect(consoleErrorSpy).toHaveBeenCalled()
      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string)
      expect(loggedData.error).toBe('Internal error with stack trace')
      expect(loggedData.stack).toBeDefined()

      // Response should NOT include stack trace
      expect(data.error).not.toHaveProperty('stack')
      expect(JSON.stringify(data)).not.toContain('stack')
    })

    it('should log error details to console', async () => {
      createErrorResponse('TEST_ERROR', 'Test message', 400, {
        field: 'testField',
        details: { foo: 'bar' },
      })

      expect(consoleErrorSpy).toHaveBeenCalled()
      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string)

      expect(loggedData.event).toBe('api_error')
      expect(loggedData.code).toBe('TEST_ERROR')
      expect(loggedData.statusCode).toBe(400)
      expect(loggedData.field).toBe('testField')
      expect(loggedData.details).toEqual({ foo: 'bar' })
    })

    it('should handle errors without original error object', async () => {
      const response = createErrorResponse('SIMPLE_ERROR', 'Simple error message', 400)
      const data = await response.json()

      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(data.error.code).toBe('SIMPLE_ERROR')
      expect(data.error.message).toBe('Simple error message')
    })
  })

  describe('Error response format compliance', () => {
    it('should never expose stack traces in response body', async () => {
      const error = new Error('Test error')
      const response = createErrorResponse('ERROR', 'Error occurred', 500, {
        originalError: error,
      })
      const responseText = JSON.stringify(await response.json())

      expect(responseText).not.toContain('stack')
      expect(responseText).not.toContain('Error: Test error')
    })

    it('should return properly formatted ApiErrorResponse', async () => {
      const response = createErrorResponse('FORMAT_TEST', 'Format test', 400, {
        field: 'testField',
        details: { key: 'value' },
      })
      const data = await response.json()

      // Should have error wrapper
      expect(data).toHaveProperty('error')

      // Error should have required fields
      expect(data.error).toHaveProperty('code', 'FORMAT_TEST')
      expect(data.error).toHaveProperty('message', 'Format test')

      // Optional fields should be present when provided
      expect(data.error).toHaveProperty('field', 'testField')
      expect(data.error).toHaveProperty('details', { key: 'value' })
    })
  })
})
