import { describe, it, expect } from 'vitest'
import { bridgeScript, generateSecret, isBridgeUrl } from './bridgeScript'
import { DRIVE_FILES } from './driveFiles'
import { normalizePersistedData } from './persistedData'

describe('bridgeScript', () => {
  it('embeds the secret and the file allowlist as JS literals', () => {
    const src = bridgeScript('ab"c')
    expect(src).toContain('var SECRET = "ab\\"c";')
    expect(src).toContain(`var FILES = ${JSON.stringify(DRIVE_FILES)};`)
    expect(src).toContain('function doPost(e)')
    expect(src).toContain('safeEqual(req.secret, SECRET)')
  })

  it('generates 256-bit hex secrets', () => {
    const s = generateSecret()
    expect(s).toMatch(/^[0-9a-f]{64}$/)
    expect(generateSecret()).not.toBe(s)
  })
})

describe('isBridgeUrl', () => {
  it('accepts consumer and Workspace /exec URLs only', () => {
    expect(isBridgeUrl('https://script.google.com/macros/s/AKfy-abc_123/exec')).toBe(true)
    expect(isBridgeUrl('https://script.google.com/a/macros/example.com/s/AKfy123/exec')).toBe(true)
    expect(isBridgeUrl('https://script.google.com/macros/s/AKfy123/dev')).toBe(false)
    expect(isBridgeUrl('https://evil.example/macros/s/AKfy123/exec')).toBe(false)
  })
})

describe('gist-era cloudSync migration', () => {
  it('drops a {token, gistId} config so Settings offers Drive setup', () => {
    const out = normalizePersistedData({
      cloudSync: { enabled: true, token: 'ghp_x', gistId: 'g', lastSyncAt: null, lastError: null },
    })
    expect(out.cloudSync).toBeNull()
  })

  it('keeps a Drive bridge config', () => {
    const cfg = { enabled: true, bridgeUrl: 'https://script.google.com/macros/s/X/exec', secret: 's', lastSyncAt: null, lastError: null }
    expect(normalizePersistedData({ cloudSync: cfg }).cloudSync).toEqual(cfg)
  })
})
