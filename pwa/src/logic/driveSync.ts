// ============================================================
// Client side of the Apps Script Drive bridge (see bridgeScript.ts)
// ============================================================
//
// Requests are POSTs with a text/plain body so the browser sends them as
// "simple" CORS requests (no preflight, which Apps Script can't answer);
// fetch follows the script's 302 to script.googleusercontent.com.

export type SyncErrorCode =
  | 'auth_failed'
  | 'rate_limited'
  | 'not_found'
  | 'bad_deployment'
  | 'network'
  | 'unknown'

export type SyncResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: SyncErrorCode; status?: number }

type BridgeReply = { ok?: unknown; error?: unknown }

async function call(url: string, body: Record<string, unknown>): Promise<SyncResult<BridgeReply>> {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
    })
  } catch {
    return { ok: false, error: 'network' }
  }
  if (res.status === 429) return { ok: false, error: 'rate_limited', status: 429 }
  if (!res.ok) return { ok: false, error: 'unknown', status: res.status }

  let data: BridgeReply
  try {
    data = (await res.json()) as BridgeReply
  } catch {
    // Apps Script serves an HTML page (with 200) when the deployment is
    // wrong — e.g. access not set to "Anyone", or the script threw.
    return { ok: false, error: 'bad_deployment' }
  }
  if (data?.ok !== true) {
    if (data?.error === 'auth') return { ok: false, error: 'auth_failed' }
    if (data?.error === 'missing') return { ok: false, error: 'not_found' }
    return { ok: false, error: 'unknown' }
  }
  return { ok: true, value: data }
}

export async function pushFiles(
  url: string,
  secret: string,
  files: Record<string, string>,
): Promise<SyncResult> {
  const res = await call(url, { secret, action: 'write', files })
  return res.ok ? { ok: true, value: undefined } : res
}

export function errorMessage(code: SyncErrorCode): string {
  switch (code) {
    case 'auth_failed':
      return 'Secret mismatch. Re-copy the setup script and redeploy.'
    case 'rate_limited':
      return 'Google is rate limiting. Will retry.'
    case 'not_found':
      return 'File not found in Drive.'
    case 'bad_deployment':
      return 'Unexpected response. Check the deployment: Execute as Me, access Anyone.'
    case 'network':
      return 'Network error. Check your connection.'
    case 'unknown':
      return 'Sync failed. Try again.'
  }
}
