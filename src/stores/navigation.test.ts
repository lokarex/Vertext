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

describe('navigation store', () => {
  it('has default values', async () => {
    setActivePinia(createPinia())
    await new Promise(r => setTimeout(r, 50))
    const { useNavigationStore } = await import('@/stores/navigation')
    const store = useNavigationStore()
    expect(store.selectedView).toBe('repositoryList')
    expect(store.previousViews).toEqual([])
  })
})
