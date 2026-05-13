import { describe, expect, it } from 'vitest'
import {
  apiAccepted,
  apiBadRequest,
  apiCreated,
  apiError,
  apiInternalError,
  apiNoContent,
  apiNotFound,
  apiSuccess,
  apiUnauthorized,
} from '../api-response'

describe('api-response', () => {
  describe('apiSuccess', () => {
    it('should return 200 status by default', async () => {
      const response = apiSuccess({ message: 'OK' })

      expect(response.status).toBe(200)

      const json = await response.json()
      expect(json.success).toBe(true)
      expect(json.data).toEqual({ message: 'OK' })
      expect(json.timestamp).toBeDefined()
    })

    it('should allow custom status code', async () => {
      const response = apiSuccess({ id: 1 }, 201)

      expect(response.status).toBe(201)
    })

    it('should set no-cache headers', () => {
      const response = apiSuccess({})

      expect(response.headers.get('Cache-Control')).toContain('no-store')
      expect(response.headers.get('pragma')).toBe('no-cache')
    })
  })

  describe('apiError', () => {
    it('should return error response with correct structure', async () => {
      const error = {
        code: 'TEST_ERROR',
        message: 'Test error message',
        statusCode: 400,
        details: { field: 'name' },
      }

      const response = apiError(error)

      expect(response.status).toBe(400)

      const json = await response.json()
      expect(json.success).toBe(false)
      expect(json.error.code).toBe('TEST_ERROR')
      expect(json.error.message).toBe('Test error message')
      expect(json.error.details).toEqual({ field: 'name' })
    })
  })

  describe('apiCreated', () => {
    it('should return 201 status', async () => {
      const response = apiCreated({ id: 123 })

      expect(response.status).toBe(201)

      const json = await response.json()
      expect(json.data.id).toBe(123)
    })
  })

  describe('apiAccepted', () => {
    it('should return 202 status', async () => {
      const response = apiAccepted({ jobId: 'abc' })

      expect(response.status).toBe(202)
    })
  })

  describe('apiNoContent', () => {
    it('should return 204 status with no body', async () => {
      const response = apiNoContent()

      expect(response.status).toBe(204)
      expect(response.body).toBeNull()
    })
  })

  describe('apiBadRequest', () => {
    it('should return 400 status', async () => {
      const response = apiBadRequest('Invalid input', { field: 'email' })

      expect(response.status).toBe(400)

      const json = await response.json()
      expect(json.error.message).toBe('Invalid input')
    })
  })

  describe('apiNotFound', () => {
    it('should return 404 status', async () => {
      const response = apiNotFound('Resource not found')

      expect(response.status).toBe(404)

      const json = await response.json()
      expect(json.error.message).toBe('Resource not found')
    })
  })

  describe('apiInternalError', () => {
    it('should return 500 status', async () => {
      const response = apiInternalError('Server error')

      expect(response.status).toBe(500)

      const json = await response.json()
      expect(json.error.message).toBe('Server error')
    })
  })

  describe('apiUnauthorized', () => {
    it('should return 401 status', async () => {
      const response = apiUnauthorized('Invalid token')

      expect(response.status).toBe(401)

      const json = await response.json()
      expect(json.error.message).toBe('Invalid token')
    })

    it('should use default message', async () => {
      const response = apiUnauthorized()

      const json = await response.json()
      expect(json.error.message).toBe('Unauthorized')
    })
  })
})
