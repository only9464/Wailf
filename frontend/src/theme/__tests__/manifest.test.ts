import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { platformTokens } from '../platform'
import { resourceManifest } from '../resources'
import { serializeToken, tokenProperty } from '../tokenRegistry'
import type { PlatformId } from '../types'

describe('packaged platform stylesheet manifest', () => {
  it('ships every allowed file with matching platform tokens and no external dependencies', () => {
    for (const [id, entry] of Object.entries(resourceManifest)) {
      // Quote choice is formatting, not a difference in the CSS token contract.
      const css = readFileSync(resolve('public/themes/platform', entry.path), 'utf8').replaceAll("'", '"')
      expect(Buffer.byteLength(css)).toBeLessThanOrEqual(entry.maxBytes)
      expect(css).not.toMatch(/@import|url\s*\(/i)
      expect(css).toContain('html[data-theme-base="platform"]')
      const platform = id.slice('platform.'.length) as PlatformId
      for (const [key, value] of Object.entries(platformTokens[platform] ?? {})) {
        expect(css).toContain(`${tokenProperty(key)}: ${serializeToken(key, value)};`)
      }
      // Platform IDs may select hooks, never the visual token layer.
      const hookRules = [...css.matchAll(/html\[data-platform="[a-z]+"\][^{]*\{([^}]+)\}/g)]
      for (const match of hookRules) expect(match[1]).not.toMatch(/--wailf-/)
    }
  })
})
