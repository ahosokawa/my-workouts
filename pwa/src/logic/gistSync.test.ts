import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  verifyToken,
  createGist,
  updateGist,
  errorMessage,
  GIST_FILENAME,
} from './gistSync'

type MockFetch = ReturnType<typeof vi.fn>

function mockResponse(init: {
  ok?: boolean
  status?: number
  body?: unknown
  throwOnJson?: boolean
}): Response {
  const status = init.status ?? 200
  return {
    ok: init.ok ?? (status >= 200 && status < 300),
    status,
    json: async () => {
      if (init.throwOnJson) throw new Error('bad json')
      return init.body
    },
  } as Response
}

beforeEach(() => {
  globalThis.fetch = vi.fn() as unknown as typeof fetch
})

function getMock(): MockFetch {
  return globalThis.fetch as unknown as MockFetch
}

describe('verifyToken', () => {
  it('returns login on 200', async () => {
    getMock().mockResolvedValueOnce(mockResponse({ body: { login: 'octocat' } }))
    const res = await verifyToken('tok')
    expect(res).toEqual({ ok: true, value: { login: 'octocat' } })
  })

  it('maps 401 to auth_failed', async () => {
    getMock().mockResolvedValueOnce(mockResponse({ status: 401 }))
    const res = await verifyToken('tok')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('auth_failed')
  })

  it('maps 403 to rate_limited', async () => {
    getMock().mockResolvedValueOnce(mockResponse({ status: 403 }))
    const res = await verifyToken('tok')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('rate_limited')
  })

  it('maps thrown fetch to network', async () => {
    getMock().mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const res = await verifyToken('tok')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('network')
  })

  it('sends Authorization Bearer header', async () => {
    getMock().mockResolvedValueOnce(mockResponse({ body: { login: 'x' } }))
    await verifyToken('secret-token')
    const call = getMock().mock.calls[0]
    const headers = call[1].headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer secret-token')
  })
})

describe('createGist', () => {
  it('returns gist id on success', async () => {
    getMock().mockResolvedValueOnce(mockResponse({ body: { id: 'abc123' } }))
    const res = await createGist('tok', '{"foo":1}')
    expect(res).toEqual({ ok: true, value: { gistId: 'abc123' } })
  })

  it('posts private gist with correct filename', async () => {
    getMock().mockResolvedValueOnce(mockResponse({ body: { id: 'abc' } }))
    await createGist('tok', '{"foo":1}')
    const [url, init] = getMock().mock.calls[0]
    expect(url).toBe('https://api.github.com/gists')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body)
    expect(body.public).toBe(false)
    expect(body.files[GIST_FILENAME].content).toBe('{"foo":1}')
  })

  it('returns unknown when id is missing', async () => {
    getMock().mockResolvedValueOnce(mockResponse({ body: {} }))
    const res = await createGist('tok', '{}')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('unknown')
  })

  it('maps 401 to auth_failed', async () => {
    getMock().mockResolvedValueOnce(mockResponse({ status: 401 }))
    const res = await createGist('tok', '{}')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('auth_failed')
  })
})

describe('updateGist', () => {
  it('patches gist by id', async () => {
    getMock().mockResolvedValueOnce(mockResponse({ status: 200, body: {} }))
    const res = await updateGist('tok', 'abc', '{"x":1}')
    expect(res.ok).toBe(true)
    const [url, init] = getMock().mock.calls[0]
    expect(url).toBe('https://api.github.com/gists/abc')
    expect(init.method).toBe('PATCH')
  })

  it('maps 404 to not_found', async () => {
    getMock().mockResolvedValueOnce(mockResponse({ status: 404 }))
    const res = await updateGist('tok', 'abc', '{}')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('not_found')
  })

  it('encodes gist id in URL', async () => {
    getMock().mockResolvedValueOnce(mockResponse({ status: 200, body: {} }))
    await updateGist('tok', 'weird/id', '{}')
    const [url] = getMock().mock.calls[0]
    expect(url).toBe('https://api.github.com/gists/weird%2Fid')
  })
})

describe('errorMessage', () => {
  it('returns a user-friendly string for each code', () => {
    expect(errorMessage('auth_failed')).toMatch(/token/i)
    expect(errorMessage('rate_limited')).toMatch(/rate limit/i)
    expect(errorMessage('not_found')).toMatch(/not found/i)
    expect(errorMessage('network')).toMatch(/network/i)
    expect(errorMessage('unknown')).toMatch(/failed/i)
  })
})
