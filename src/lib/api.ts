export type ApiError = Error & { status?: number };

/** Small fetch wrapper that surfaces API error messages. */
export async function apiFetch<T>(
  url: string,
  options: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, ...init } = options;

  const response = await fetch(url, {
    ...init,
    headers:
      json === undefined
        ? init.headers
        : { "Content-Type": "application/json", ...(init.headers as Record<string, string> | undefined) },
    body: json === undefined ? init.body : JSON.stringify(json),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const error = new Error(
      typeof payload.error === "string" ? payload.error : "Something went wrong.",
    ) as ApiError;
    error.status = response.status;
    throw error;
  }

  return payload as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
