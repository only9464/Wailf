import type { PlatformResourceId } from './types'

export const THEME_BASE_URL = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}themes/platform/`
export const resourceManifest: Readonly<
  Record<PlatformResourceId, { path: string; mime: string; maxBytes: number }>
> = {
  'platform.windows': { path: 'windows.css', mime: 'text/css', maxBytes: 8192 },
  'platform.darwin': { path: 'darwin.css', mime: 'text/css', maxBytes: 8192 },
  'platform.linux': { path: 'linux.css', mime: 'text/css', maxBytes: 8192 },
  'platform.android': { path: 'android.css', mime: 'text/css', maxBytes: 8192 },
  'platform.ios': { path: 'ios.css', mime: 'text/css', maxBytes: 8192 },
}
export function resourceURL(id: PlatformResourceId, origin: string): URL | null {
  if (!Object.hasOwn(resourceManifest, id)) return null
  const path = resourceManifest[id].path
  if (!/^[a-z]+\.css$/.test(path)) return null
  try {
    const base = new URL(THEME_BASE_URL, origin)
    const url = new URL(path, base)
    return url.origin === new URL(origin).origin &&
      url.pathname.startsWith(base.pathname) &&
      !url.search &&
      !url.hash
      ? url
      : null
  } catch {
    return null
  }
}
export interface ResourceResult {
  ok: boolean
  diagnostics: string[]
  url?: string
  css?: string
}
export async function validateResource(
  id: PlatformResourceId,
  fetcher: typeof fetch = fetch,
  origin: string = window.location.href,
  timeoutMs = 500,
): Promise<ResourceResult> {
  const url = resourceURL(id, origin)
  if (!url) return { ok: false, diagnostics: ['theme.resource.invalid_path'] }
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const load = async (): Promise<ResourceResult> => {
    const response = await fetcher(url.href, {
      signal: controller.signal,
      redirect: 'error',
      credentials: 'same-origin',
    })
    if (!response.ok || response.redirected || (response.url && new URL(response.url).href !== url.href))
      return { ok: false, diagnostics: ['theme.resource.response'] }
    const entry = resourceManifest[id]
    if (response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== entry.mime)
      return { ok: false, diagnostics: ['theme.resource.mime'] }
    const declaredSize = Number(response.headers.get('content-length') ?? 0)
    if (declaredSize > entry.maxBytes) return { ok: false, diagnostics: ['theme.resource.size'] }
    const bytes = await response.arrayBuffer()
    if (bytes.byteLength > entry.maxBytes) return { ok: false, diagnostics: ['theme.resource.size'] }
    const css = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (/@import|url\s*\(|expression\s*\(|javascript:|<\/style|\\/i.test(css))
      return { ok: false, diagnostics: ['theme.resource.unsafe'] }
    return { ok: true, diagnostics: [], url: url.href, css }
  }
  try {
    return await Promise.race([
      load(),
      new Promise<ResourceResult>((resolve) => {
        timer = setTimeout(() => {
          controller.abort()
          resolve({ ok: false, diagnostics: ['theme.resource.timeout'] })
        }, timeoutMs)
      }),
    ])
  } catch {
    return { ok: false, diagnostics: ['theme.resource.failed'] }
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

let currentResource: PlatformResourceId | null = null
let currentLink: HTMLLinkElement | null = null
let revision = 0
/** Validation precedes the only platform link. A failed resource leaves the neutral stylesheet intact. */
export async function loadPlatformResource(
  id: PlatformResourceId,
  isCurrent: () => boolean = () => true,
): Promise<ResourceResult> {
  if (typeof document === 'undefined') return { ok: false, diagnostics: ['theme.resource.no_dom'] }
  if (currentResource === id && currentLink?.isConnected) return { ok: true, diagnostics: [] }
  const request = ++revision
  const result = await validateResource(id)
  if (!result.ok || !result.url || request !== revision || !isCurrent()) return { ...result, ok: false }
  const next = document.createElement('link')
  next.rel = 'stylesheet'
  next.href = result.url
  next.dataset.wailfPlatformTheme = id
  const loaded = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => finish(false), 500)
    const finish = (success: boolean) => {
      clearTimeout(timer)
      next.onload = null
      next.onerror = null
      resolve(success)
    }
    next.onload = () => finish(true)
    next.onerror = () => finish(false)
    // Disable the old token layer until the complete validated stylesheet is ready.
    document.documentElement.dataset.themeBase = 'default'
    currentLink?.remove()
    document.querySelectorAll('link[data-wailf-platform-theme]').forEach((link) => link.remove())
    document.head.append(next)
  })
  if (!loaded || request !== revision || !isCurrent()) {
    next.remove()
    return { ok: false, diagnostics: ['theme.resource.link_failed'] }
  }
  currentResource = id
  currentLink = next
  return { ok: true, diagnostics: [] }
}
