import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue('mock content'),
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
vi.mock('@/stores/repositories', () => ({
  useRepositoriesStore: vi.fn().mockReturnValue({
    selectedRepository: { name: 'test-repo', status: 'synced' },
    setStatus: vi.fn(),
  }),
}))

describe('editor store helpers', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await new Promise(r => setTimeout(r, 50))
  })

  it('isMarkdownFile returns true for .md', async () => {
    const { isMarkdownFile } = await import('@/stores/editor')
    expect(isMarkdownFile('readme.md')).toBe(true)
  })
  it('isMarkdownFile returns true for .mdx', async () => {
    const { isMarkdownFile } = await import('@/stores/editor')
    expect(isMarkdownFile('docs.mdx')).toBe(true)
  })
  it('isMarkdownFile returns true for .markdown', async () => {
    const { isMarkdownFile } = await import('@/stores/editor')
    expect(isMarkdownFile('notes.markdown')).toBe(true)
  })
  it('isMarkdownFile returns true for uppercase .MD', async () => {
    const { isMarkdownFile } = await import('@/stores/editor')
    expect(isMarkdownFile('README.MD')).toBe(true)
  })
  it('isMarkdownFile returns false for .txt', async () => {
    const { isMarkdownFile } = await import('@/stores/editor')
    expect(isMarkdownFile('notes.txt')).toBe(false)
  })
  it('isMarkdownFile returns false for no extension', async () => {
    const { isMarkdownFile } = await import('@/stores/editor')
    expect(isMarkdownFile('justtext')).toBe(false)
  })

  it('getFileNameFromPath extracts filename', async () => {
    const { getFileNameFromPath } = await import('@/stores/editor')
    expect(getFileNameFromPath('a/b/c.md')).toBe('c.md')
  })
  it('getFileNameFromPath returns same for flat path', async () => {
    const { getFileNameFromPath } = await import('@/stores/editor')
    expect(getFileNameFromPath('c.md')).toBe('c.md')
  })
  it('getFileNameFromPath handles empty', async () => {
    const { getFileNameFromPath } = await import('@/stores/editor')
    expect(getFileNameFromPath('')).toBe('')
  })
})

describe('editor store operations', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with empty tabs', async () => {
    const { useEditorStore } = await import('@/stores/editor')
    const store = useEditorStore()
    expect(store.tabs).toBeDefined()
  })

  it('isTabDirty detects unsaved changes', async () => {
    const { useEditorStore } = await import('@/stores/editor')
    const store = useEditorStore()
    const tab = {
      id: '1', repoName: 'r', filePath: 'f', fileName: 'f.md',
      isMarkdown: true, content: 'new', savedContent: 'old',
      markdownMode: 'wysiwyg' as const, scrollTop: 0,
    }
    expect(store.isTabDirty(tab as any)).toBe(true)
  })

  it('isTabDirty returns false when content matches', async () => {
    const { useEditorStore } = await import('@/stores/editor')
    const store = useEditorStore()
    const tab = {
      id: '1', repoName: 'r', filePath: 'f', fileName: 'f.md',
      isMarkdown: true, content: 'same', savedContent: 'same',
      markdownMode: 'wysiwyg' as const, scrollTop: 0,
    }
    expect(store.isTabDirty(tab as any)).toBe(false)
  })

  it('isTabDirty returns false for both empty', async () => {
    const { useEditorStore } = await import('@/stores/editor')
    const store = useEditorStore()
    const tab = {
      id: '1', repoName: 'r', filePath: 'f', fileName: 'f.md',
      isMarkdown: true, content: '', savedContent: '',
      markdownMode: 'wysiwyg' as const, scrollTop: 0,
    }
    expect(store.isTabDirty(tab as any)).toBe(false)
  })

  it('closeTab non-existent does nothing', async () => {
    const { useEditorStore } = await import('@/stores/editor')
    const store = useEditorStore()
    store.closeTab('nonexistent')
    expect(store.tabs.length).toBe(0)
  })

  it('setActiveTab ignores invalid id', async () => {
    const { useEditorStore } = await import('@/stores/editor')
    const store = useEditorStore()
    store.setActiveTab('nonexistent')
    expect(store.activeTabId).toBeNull()
  })

  it('clearAllTabs empties tabs', async () => {
    const { useEditorStore } = await import('@/stores/editor')
    const store = useEditorStore()
    store.clearAllTabs()
    expect(store.tabs).toHaveLength(0)
    expect(store.activeTabId).toBeNull()
  })

  it('setMarkdownMode on non-markdown tab', async () => {
    const { useEditorStore } = await import('@/stores/editor')
    const store = useEditorStore()
    expect(() => store.setMarkdownMode('nonexistent', 'preview')).not.toThrow()
  })

  it('updateContent on non-existent tab', async () => {
    const { useEditorStore } = await import('@/stores/editor')
    const store = useEditorStore()
    expect(() => store.updateContent('nonexistent', 'new')).not.toThrow()
  })

  it('setTabScrollTop on non-existent tab', async () => {
    const { useEditorStore } = await import('@/stores/editor')
    const store = useEditorStore()
    expect(() => store.setTabScrollTop('nonexistent', 100)).not.toThrow()
  })
})
