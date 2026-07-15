/* クライアントから Route Handlers を呼び出すための薄いラッパー */

export interface ApiError {
  error: string;
}

export async function api<T>(path: string, opts: Omit<RequestInit, 'body'> & { body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as ApiError).error || `通信エラー (${res.status})`);
  return data as T;
}
