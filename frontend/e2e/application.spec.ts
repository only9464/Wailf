import { test, expect, type Page } from '@playwright/test'

async function openPlatformActions(page: Page) {
  const card = page.locator('.platform-card')
  await expect(card).toBeVisible()
  await expect(card).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('.platform-drawer-content')).toBeHidden()
  await card.click()
  await expect(page.locator('.platform-drawer-content')).toBeVisible()
  return card
}

async function chooseLanguage(page: Page, label: string) {
  await page.locator('.settings-select').click()
  await page.getByRole('option', { name: label, exact: true }).click()
}

test('platform card opens an upward action drawer and restores focus on Escape', async ({ page }) => {
  await page.goto('/#/settings')
  const card = await openPlatformActions(page)
  await expect(card).toHaveAccessibleName('运行平台 · 浏览器')
  await expect(page.locator('.sidebar-top-controls')).not.toContainText('Wailf')
  await expect(page.getByRole('button', { name: '任务中心', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '通知记录', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '设置', exact: true })).toBeVisible()
  const drawerBounds = await page.locator('.platform-drawer-content').boundingBox()
  const cardBounds = await card.boundingBox()
  expect(drawerBounds!.y + drawerBounds!.height).toBeLessThanOrEqual(cardBounds!.y + 1)
  await card.click()
  await expect(card).toHaveAttribute('aria-expanded', 'false')
  await card.click()
  await page.getByRole('button', { name: '任务中心', exact: true }).focus()
  await page.keyboard.press('Escape')
  await expect(page.locator('.platform-drawer-content')).toBeHidden()
  await expect(card).toBeFocused()

  await card.click()
  await page.getByRole('button', { name: '任务中心', exact: true }).click()
  await expect(page.locator('.business-sheet')).toBeVisible()
  await expect(card).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('.business-sheet')).toContainText('服务尚未接入')
  await page.keyboard.press('Escape')
  await expect(page.locator('.business-sheet')).toHaveCount(0)
  await expect(card).toBeFocused()
})

test('scan target drafts survive route navigation without local persistence', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/#/recon/portscan')
  const targets = page.locator('.scan-targets textarea')
  await targets.fill('192.0.2.10\nexample.test')

  await openPlatformActions(page)
  await page.getByRole('link', { name: '设置', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('设置')
  await page.locator('.nav-item', { hasText: '端口扫描' }).click()
  await expect(page.locator('.scan-targets textarea')).toHaveValue('192.0.2.10\nexample.test')
  await expect(page.locator('.scan-form button[type="submit"]')).toBeDisabled()
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }))
  expect(stored).not.toContain('192.0.2.10')
  expect(errors).toEqual([])
})

test('language changes update Element Plus controls', async ({ page }) => {
  await page.goto('/#/settings')
  await chooseLanguage(page, 'English')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings')
  await page.locator('.nav-item', { hasText: 'Port scan' }).click()
  await expect(page.getByRole('alert').getByText('Service not connected', { exact: true })).toBeVisible()
})

test('layout controls retain unknown features and expose accessible group selectors', async ({ page }) => {
  await page.goto('/#/settings?tab=layout')
  await expect(page.locator('#active-layout')).toBeVisible()
  await expect(page.getByRole('combobox', { name: '端口扫描 · 移至分组', exact: true })).toBeVisible()
  const portscanVisibility = page.locator('.layout-item-name', { hasText: '端口扫描' }).locator('input[type="checkbox"]')
  await expect(portscanVisibility).toBeChecked()
  await portscanVisibility.uncheck()
  await expect(page.locator('.nav-item', { hasText: '端口扫描' })).toHaveCount(0)
  await portscanVisibility.check()

  const payload = {
    version: 1,
    layoutId: 'imported',
    groups: [{ id: 'focus', name: 'Focus', icon: 'folder', items: ['portscan', 'future-feature'] }],
  }
  await page.locator('input[type=file]').setInputFiles({
    name: 'layout.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload)),
  })
  await expect(page.locator('.settings-feedback')).toContainText('导航布局已导入')
  await expect(page.getByText('未知功能：future-feature', { exact: true })).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出 JSON', exact: true }).click()
  const download = await downloadPromise
  const stream = await download.createReadStream()
  let contents = ''
  for await (const chunk of stream!) contents += chunk.toString()
  expect(JSON.parse(contents).groups.flatMap((group: { items: string[] }) => group.items)).toContain('future-feature')
  await page.locator('input[type=file]').setInputFiles({
    name: 'unsupported.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...payload, version: 99 })),
  })
  await expect(page.locator('.settings-feedback')).toContainText('布局导入失败')
  await expect(page.locator('.layout-select')).toContainText('imported')
})

test('mobile navigation traps focus, supports the platform drawer and restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/settings')
  const menu = page.getByRole('button', { name: '打开导航', exact: true })
  await menu.click()
  await expect(page.locator('[data-mobile="true"]')).toBeVisible()
  const card = await openPlatformActions(page)
  await page.getByRole('button', { name: '任务中心', exact: true }).focus()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-mobile="true"]')).toBeVisible()
  await expect(card).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-mobile="true"]')).toHaveCount(0)
  await expect(menu).toBeFocused()
})

for (const viewport of [
  { width: 1000, height: 618 },
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`renders ${viewport.width}px without overflow in light and dark themes`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/#/settings')
    await expect(page.locator('h1')).toHaveText('设置')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `artifacts/settings-${viewport.width}.png`, fullPage: true })
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--wailf-color-canvas').trim(),
        ),
      )
      .toBe('#17191d')
    await page.screenshot({ path: `artifacts/settings-${viewport.width}-dark.png`, fullPage: true })
  })
}
