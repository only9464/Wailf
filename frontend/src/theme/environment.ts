import { normalizeEnvironment, platforms } from './platform'
import type { PlatformDetectionResult } from './types'

interface ProbeOptions {
  hasDOM?: () => boolean
  isRuntime?: () => boolean
  readEnvironment?: () => Promise<unknown>
  timeoutMs?: number
}
function runtimeAvailable(): boolean {
  if (typeof window === 'undefined') return false
  const bridge = window as unknown as {
    _wails?: { environment?: unknown; invoke?: unknown }
    chrome?: { webview?: unknown }
    webkit?: { messageHandlers?: { external?: unknown } }
    wails?: { invoke?: unknown }
  }
  return !!(
    bridge._wails?.environment ||
    bridge._wails?.invoke ||
    bridge.chrome?.webview ||
    bridge.webkit?.messageHandlers?.external ||
    bridge.wails?.invoke
  )
}
export class PlatformProvider {
  private pending: Promise<PlatformDetectionResult> | null = null
  constructor(private options: ProbeOptions = {}) {}
  detect(): Promise<PlatformDetectionResult> {
    if (this.pending) return this.pending
    const hasDOM =
      this.options.hasDOM ?? (() => typeof window !== 'undefined' && typeof document !== 'undefined')
    if (!hasDOM())
      return Promise.resolve({
        platform: platforms.unknown,
        usedFallback: true,
        diagnostics: ['theme.environment.no_dom'],
      })
    const isRuntime = this.options.isRuntime ?? runtimeAvailable
    const read =
      this.options.readEnvironment ??
      (async () => {
        const { System } = await import('@wailsio/runtime')
        return System.Environment()
      })
    this.pending = new Promise((resolve) => {
      let started = false
      let finished = false
      const finish = (result: PlatformDetectionResult) => {
        if (finished) return
        finished = true
        clearTimeout(timer)
        window.removeEventListener('wails:runtime-config-ready', start)
        resolve(result)
      }
      const start = () => {
        if (started || finished || !isRuntime()) return
        started = true
        Promise.resolve()
          .then(read)
          .then((value) => {
            const platform = normalizeEnvironment(value)
            finish({
              platform,
              usedFallback: platform.id === 'unknown',
              diagnostics: platform.id === 'unknown' ? ['theme.environment.unknown'] : [],
            })
          })
          .catch(() =>
            finish({
              platform: platforms.unknown,
              usedFallback: true,
              diagnostics: ['theme.environment.failed'],
            }),
          )
      }
      const timer = setTimeout(
        () =>
          finish(
            started
              ? {
                  platform: platforms.unknown,
                  usedFallback: true,
                  diagnostics: ['theme.environment.timeout'],
                }
              : { platform: platforms.web, usedFallback: false, diagnostics: [] },
          ),
        this.options.timeoutMs ?? 500,
      )
      window.addEventListener('wails:runtime-config-ready', start)
      start()
    })
    return this.pending
  }
}
