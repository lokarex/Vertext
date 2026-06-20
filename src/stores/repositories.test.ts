import { beforeEach, describe, it, expect, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const { invokeMock, settingsState } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  settingsState: {
    isAiConfigured: true,
    aiProvider: 'openai',
    aiModel: 'gpt-4.1-mini',
    aiOllamaEndpoint: 'http://localhost:11434',
    language: 'en' as string | null,
  },
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
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
vi.mock('@/stores/settings', () => ({
  useSettingsStore: () => settingsState,
}))

describe('repositories store', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    invokeMock.mockImplementation((command: string) => {
      if (command === 'get_password') return Promise.resolve('secret')
      if (command === 'prepare_commit_message') {
        return Promise.resolve({ message: 'Version information', filesChanged: [] })
      }
      return Promise.resolve(undefined)
    })
    settingsState.language = 'en'
  })

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

  it('passes the current Chinese application language to commit generation', async () => {
    settingsState.language = 'zh-CN'
    setActivePinia(createPinia())
    const { useRepositoriesStore } = await import('@/stores/repositories')
    const store = useRepositoriesStore()
    store.repositories.push({
      name: 'notes',
      status: 'unsynced',
      remoteUrl: 'https://example.com/notes.git',
      userName: 'writer',
    })

    await store.prepareCommitMessage('notes')

    expect(invokeMock).toHaveBeenCalledWith('prepare_commit_message', expect.objectContaining({
      language: 'zh-CN',
    }))
  })

  it('falls back to English when the application language is empty', async () => {
    settingsState.language = null
    setActivePinia(createPinia())
    const { useRepositoriesStore } = await import('@/stores/repositories')
    const store = useRepositoriesStore()
    store.repositories.push({
      name: 'notes',
      status: 'unsynced',
      remoteUrl: 'https://example.com/notes.git',
      userName: 'writer',
    })

    await store.prepareCommitMessage('notes')

    expect(invokeMock).toHaveBeenCalledWith('prepare_commit_message', expect.objectContaining({
      language: 'en',
    }))
  })
})
