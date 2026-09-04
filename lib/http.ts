export async function httpFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(input, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json, */*",
        ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...(init.headers || {}),
      },
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

export async function httpJson<T = unknown>(input: string, init: RequestInit = {}): Promise<T> {
  const res = await httpFetch(input, init);
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(
      `HTTP ${res.status} ${res.statusText} for ${input}: ${typeof data === "string" ? data : JSON.stringify(data)}`
    );
    (err as unknown as { status: number; body: unknown }).status = res.status;
    (err as unknown as { status: number; body: unknown }).body = data;
    throw err;
  }
  return data as T;
}
