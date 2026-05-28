import { describe, it, expect, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}))
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

describe('repositories store', () => {
  it('has default values', async () => {
    setActivePinia(createPinia())
    await new Promise(r => setTimeout(r, 50))
    const { useRepositoriesStore } = await import('@/stores/repositories')
    const store = useRepositoriesStore()
    expect(store.repositories).toEqual([])
    expect(store.selectedRepository).toBeNull()
    expect(store.fileTreeOpen).toBe(false)
  })

  it('toggles fileTreeOpen', async () => {
    setActivePinia(createPinia())
    await new Promise(r => setTimeout(r, 50))
    const { useRepositoriesStore } = await import('@/stores/repositories')
    const store = useRepositoriesStore()
    store.toggleFileTree()
    expect(store.fileTreeOpen).toBe(true)
    store.toggleFileTree()
    expect(store.fileTreeOpen).toBe(false)
  })

  it('selectRepository null deselects', async () => {
    setActivePinia(createPinia())
    await new Promise(r => setTimeout(r, 50))
    const { useRepositoriesStore } = await import('@/stores/repositories')
    const store = useRepositoriesStore()
    store.selectRepository(null)
    expect(store.selectedRepository).toBeNull()
  })

  it('selectRepository nonexistent returns null', async () => {
    setActivePinia(createPinia())
    await new Promise(r => setTimeout(r, 50))
    const { useRepositoriesStore } = await import('@/stores/repositories')
    const store = useRepositoriesStore()
    store.selectRepository('nonexistent')
    expect(store.selectedRepository).toBeNull()
  })
})
