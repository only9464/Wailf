import { describe, expect, it } from 'vitest'
import { messages, i18n, elementLocales } from './index'
import { parseJsonText, forEachChild, isObjectLiteralExpression, isPropertyAssignment, type Node } from 'typescript'
const localeFiles = import.meta.glob('./**/*.json', { query: '?raw', import: 'default', eager: true })
function flatten(value: Record<string, unknown>, prefix = ''): Record<string, string> {
  return Object.assign(
    {},
    ...Object.entries(value).map(([key, entry]) =>
      typeof entry === 'string'
        ? { [prefix + key]: entry }
        : flatten(entry as Record<string, unknown>, `${prefix}${key}.`),
    ),
  )
}
describe('interface translations', () => {
  it('keeps one application JSON per language without duplicate JSON properties', () => {
    expect(Object.keys(localeFiles).sort()).toEqual(['./en-US/en-US.json', './zh-CN/zh-CN.json'])
    for (const [file, raw] of Object.entries(localeFiles)) {
      const tree = parseJsonText(file, String(raw))
      function visit(node: Node) {
        if (isObjectLiteralExpression(node)) {
          const names = node.properties.filter(isPropertyAssignment).map(p => p.name.getText(tree))
          expect(new Set(names).size, file).toBe(names.length)
        }
        forEachChild(node, visit)
      }
      visit(tree)
    }
    expect(elementLocales['zh-CN'].name).toBe('zh-cn')
    expect(elementLocales['en-US'].name).toBe('en')
  })
  it('has matching keys and interpolation variables across both languages', () => {
    const zh = flatten(messages['zh-CN']),
      en = flatten(messages['en-US'])
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
    for (const key of Object.keys(zh)) {
      expect(en[key].trim(), key).not.toBe('')
      expect([...zh[key].matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort(), key).toEqual(
        [...en[key].matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort(),
      )
    }
  })
  it('interpolates counts and reports missing development keys without throwing', () => {
    expect(i18n.global.t('notifications.count', { count: 3 })).toContain('3')
    expect(i18n.global.t('nonexistent.test.key')).toBeTruthy()
  })
})
