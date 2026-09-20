import { darkTokens, lightTokens, validateTheme } from './tokenRegistry'
import { platformTokens } from './platform'
import type { PlatformDescriptor, ResolvedTheme, ThemeDefinition, ThemeSelection } from './types'

export function resolveTheme(
  platform: PlatformDescriptor,
  selection: ThemeSelection,
  custom: ThemeDefinition | null,
  platformAvailable = true,
  dark = false,
): ResolvedTheme {
  const valid = selection.mode === 'custom' && custom ? validateTheme(custom) : null
  const base =
    (valid?.base ?? 'platform') === 'platform' && platformAvailable && platform.tokenSetId !== 'default'
      ? 'platform'
      : 'default'
  return {
    base,
    platform,
    hooks: { ...platform.hooks },
    userTokens: valid?.tokens ?? {},
    tokens: {
      ...(dark ? darkTokens : lightTokens),
      ...(base === 'platform' ? platformTokens[platform.id] : {}),
      ...valid?.tokens,
    },
  }
}
