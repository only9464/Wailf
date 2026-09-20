import { serializeToken, tokenProperty, tokenRegistry } from './tokenRegistry'
import type { ResolvedTheme } from './types'

/** Only registry names and validated values can reach DOM style APIs. */
export function applyTheme(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  for (const key of Object.keys(tokenRegistry)) root.style.removeProperty(tokenProperty(key)!)
  for (const [key, value] of Object.entries(theme.userTokens)) {
    const property = tokenProperty(key)
    const serialized = serializeToken(key, value)
    if (property && serialized !== null) root.style.setProperty(property, serialized)
  }
  root.dataset.themeBase = theme.base
  root.dataset.platform = theme.platform.id
  root.dataset.material = theme.hooks.material
  root.dataset.rootBackground = theme.hooks.rootBackground
  root.style.setProperty('--wailf-titlebar-height', theme.hooks.titlebar === 'custom' ? '50px' : '0px')
  root.style.setProperty(
    '--wailf-safe-area-top',
    theme.hooks.safeArea === 'env' ? 'env(safe-area-inset-top)' : '0px',
  )
  root.style.setProperty(
    '--wailf-safe-area-bottom',
    theme.hooks.safeArea === 'env' ? 'env(safe-area-inset-bottom)' : '0px',
  )
  root.style.setProperty(
    '--wailf-safe-area-left',
    theme.hooks.safeArea === 'env' ? 'env(safe-area-inset-left)' : '0px',
  )
  root.style.setProperty(
    '--wailf-safe-area-right',
    theme.hooks.safeArea === 'env' ? 'env(safe-area-inset-right)' : '0px',
  )
}
