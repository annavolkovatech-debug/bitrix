export const INTEGRATION_DISABLED = true;

export const DISABLED_REASON =
  "Работа интеграции временно приостановлена. Для возобновления свяжитесь с разработчиком.";

export function disabledResponse(status = 503): Response {
  return errorResponse(DISABLED_REASON, status, {
    disabled: true,
    code: "INTEGRATION_DISABLED",
  });
}

export function isIntegrationEnabled(): boolean {
  if (typeof process !== "undefined" && process.env.INTEGRATION_ENABLED === "1") return true;
  return !INTEGRATION_DISABLED;
}

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

