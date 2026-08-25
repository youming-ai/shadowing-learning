export function apiSuccess<T>(data: T, status = 200) {
  return Response.json({ success: true, data }, { status })
}

export function apiError(
  opts: {
    code: string
    message: string
    statusCode?: number
    details?: unknown
    headers?: Record<string, string>
  },
) {
  const { code, message, statusCode = 500, details, headers } = opts
  return Response.json({ success: false, error: { code, message, details } }, { status: statusCode, headers })
}
