export function jsonResponse<T = unknown>(body: T, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

export function errorResponse(message: string, status = 400, details?: unknown): Response {
  return jsonResponse({ ok: false, error: message, details }, status);
}

export function okResponse<T = unknown>(data: T, status = 200): Response {
  return jsonResponse({ ok: true, data }, status);
}
