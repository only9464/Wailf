import { createI18n } from 'vue-i18n'
import zh from './zh-CN/zh-CN.json'
import en from './en-US/en-US.json'
import elementZh from 'element-plus/es/locale/lang/zh-cn'
import elementEn from 'element-plus/es/locale/lang/en'

export const messages = {
  'zh-CN': zh,
  'en-US': en,
}
export const elementLocales = { 'zh-CN': elementZh, 'en-US': elementEn }
export const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages,
  missingWarn: import.meta.env.DEV,
  fallbackWarn: import.meta.env.DEV,
  missing: (locale, key) =>
    import.meta.env.DEV ? key : locale === 'en-US' ? 'Information unavailable' : '信息暂不可用',
})
