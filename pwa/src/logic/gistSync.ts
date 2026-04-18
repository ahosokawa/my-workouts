export type SyncErrorCode =
  | 'auth_failed'
  | 'rate_limited'
  | 'not_found'
  | 'network'
  | 'unknown'

export type SyncResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: SyncErrorCode; status?: number }

export const GIST_FILENAME = 'my-workouts-backup.json'
export const GIST_DESCRIPTION = 'my-workouts backup'
const API_BASE = 'https://api.github.com'

function buildHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  }
}

function errorFromStatus(status: number): SyncErrorCode {
  if (status === 401) return 'auth_failed'
  if (status === 403) return 'rate_limited'
  if (status === 404) return 'not_found'
  return 'unknown'
}

export async function verifyToken(
  token: string,
): Promise<SyncResult<{ login: string }>> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}/user`, { headers: buildHeaders(token) })
  } catch {
    return { ok: false, error: 'network' }
  }
  if (!res.ok) {
    return { ok: false, error: errorFromStatus(res.status), status: res.status }
  }
  try {
    const body = (await res.json()) as { login?: unknown }
    const login = typeof body.login === 'string' ? body.login : ''
    return { ok: true, value: { login } }
  } catch {
    return { ok: false, error: 'unknown' }
  }
}

export async function createGist(
  token: string,
  json: string,
): Promise<SyncResult<{ gistId: string }>> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}/gists`, {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify({
        description: GIST_DESCRIPTION,
        public: false,
        files: { [GIST_FILENAME]: { content: json } },
      }),
    })
  } catch {
    return { ok: false, error: 'network' }
  }
  if (!res.ok) {
    return { ok: false, error: errorFromStatus(res.status), status: res.status }
  }
  try {
    const body = (await res.json()) as { id?: unknown }
    if (typeof body.id !== 'string') return { ok: false, error: 'unknown' }
    return { ok: true, value: { gistId: body.id } }
  } catch {
    return { ok: false, error: 'unknown' }
  }
}

export async function updateGist(
  token: string,
  gistId: string,
  json: string,
): Promise<SyncResult> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}/gists/${encodeURIComponent(gistId)}`, {
      method: 'PATCH',
      headers: buildHeaders(token),
      body: JSON.stringify({
        files: { [GIST_FILENAME]: { content: json } },
      }),
    })
  } catch {
    return { ok: false, error: 'network' }
  }
  if (!res.ok) {
    return { ok: false, error: errorFromStatus(res.status), status: res.status }
  }
  return { ok: true, value: undefined }
}

export function errorMessage(code: SyncErrorCode): string {
  switch (code) {
    case 'auth_failed':
      return 'Invalid or expired token'
    case 'rate_limited':
      return 'GitHub rate limit reached. Try again later.'
    case 'not_found':
      return 'Gist not found. Disable and re-enable sync to recreate.'
    case 'network':
      return 'Network error. Check your connection.'
    case 'unknown':
      return 'Sync failed. Try again.'
  }
}
