import { describe, it, expect, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@tauri-apps/plugin-log', () => ({
  error: vi.fn(),
  trace: vi.fn(),
  debug: vi.fn(),
}))
vi.mock('@tauri-apps/plugin-store', () => ({
  Store: {
    load: vi.fn().mockResolvedValue({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn(),
      save: vi.fn(),
    }),
  },
}))
vi.mock('@/i18n', () => ({
  i18n: vi.fn().mockReturnValue({
    global: { locale: { value: 'en' } },
  }),
}))

describe('settings store', () => {
  it('has default values', async () => {
    setActivePinia(createPinia())
    await new Promise(r => setTimeout(r, 50))
    const { useSettingsStore } = await import('@/stores/settings')
    const store = useSettingsStore()
    expect(store.theme).toBe('darkTheme')
    expect(store.fontSize).toBe(14)
    expect(store.language).toBe('en')
    expect(store.autoSaveInterval).toBe(10)
  })
})
