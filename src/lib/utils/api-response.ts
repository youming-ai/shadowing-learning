import {
  createError,
  handleError,
  internalError,
  notFoundError,
  validationError,
} from '~/lib/utils/error-handler'
import type { AppError } from '~/types/api/errors'

// Successresponse函数
export function apiSuccess(data: unknown, status: number = 200) {
  return Response.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    },
    {
      status,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        pragma: 'no-cache',
        expires: '0',
      },
    },
  )
}

// Errorresponse函数
export function apiError(error: AppError & { headers?: Record<string, string> }) {
  const { headers: customHeaders, ...errorData } = error
  return Response.json(
    {
      success: false,
      error: {
        code: errorData.code,
        message: errorData.message,
        details: errorData.details,
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: errorData.statusCode,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        pragma: 'no-cache',
        expires: '0',
        ...customHeaders,
      },
    },
  )
}

// 从未知Error创建response
export function apiFromError(error: unknown, context?: string) {
  const appError = handleError(error, context)
  return apiError(appError)
}

// 常用Successresponse
export function apiCreated(data: unknown) {
  return apiSuccess(data, 201)
}

export function apiNoContent() {
  return new Response(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      pragma: 'no-cache',
      expires: '0',
    },
  })
}

export function apiAccepted(data: unknown) {
  return apiSuccess(data, 202)
}

// 常用Errorresponse
export function apiBadRequest(message: string, details?: Record<string, unknown>) {
  const error = validationError(message, details)
  return apiError(error)
}

export function apiNotFound(message: string, details?: Record<string, unknown>) {
  const error = notFoundError(message, details)
  return apiError(error)
}

export function apiInternalError(message: string, details?: Record<string, unknown>) {
  const error = internalError(message, details)
  return apiError(error)
}

export function apiUnauthorized(
  message: string = 'Unauthorized',
  details?: Record<string, unknown>,
) {
  const error = createError('apiAuthError', message, details, 401)
  return apiError(error)
}

export function apiForbidden(message: string = 'Forbidden', details?: Record<string, unknown>) {
  const error = createError('apiAuthError', message, details, 403)
  return apiError(error)
}

export function apiTooManyRequests(
  message: string = 'Too many requests',
  details?: Record<string, unknown>,
) {
  const error = createError('apiRateLimit', message, details, 429)
  return apiError(error)
}

export function apiServiceUnavailable(
  message: string = 'Service unavailable',
  details?: Record<string, unknown>,
) {
  const error = createError('serviceUnavailable', message, details, 503)
  return apiError(error)
}

// a了向后兼容，keep函数别名
export const ApiResponse = {
  success: apiSuccess,
  error: apiError,
  fromError: apiFromError,
  created: apiCreated,
  noContent: apiNoContent,
  accepted: apiAccepted,
  badRequest: apiBadRequest,
  notFound: apiNotFound,
  internalError: apiInternalError,
  unauthorized: apiUnauthorized,
  forbidden: apiForbidden,
  tooManyRequests: apiTooManyRequests,
  serviceUnavailable: apiServiceUnavailable,
}
