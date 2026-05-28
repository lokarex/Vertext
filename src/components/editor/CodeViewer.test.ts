import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
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

import CodeViewer from '@/components/editor/CodeViewer.vue'
import { useEditorStore } from '@/stores/editor'

describe('CodeViewer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders file name in header', async () => {
    const store = useEditorStore()
    await new Promise(r => setTimeout(r, 50))

    const tab = {
      id: 'tab-1',
      repoName: 'test',
      filePath: 'app.ts',
      fileName: 'app.ts',
      isMarkdown: false,
      content: 'console.log("hi")',
      savedContent: 'console.log("hi")',
      markdownMode: 'wysiwyg' as const,
      scrollTop: 0,
    }
    store.tabs.push(tab as any)

    const wrapper = mount(CodeViewer, {
      props: { tabId: 'tab-1' },
      global: {
        stubs: { NCode: true, NScrollbar: true },
      },
    })

    expect(wrapper.text()).toContain('app.ts')
  })

  it('shows Loading when tab is null', () => {
    const wrapper = mount(CodeViewer, {
      props: { tabId: 'nonexistent' },
      global: {
        stubs: { NCode: true, NScrollbar: true },
      },
    })

    expect(wrapper.text()).toContain('Loading')
  })

  it('shows language tag for .py file', async () => {
    const store = useEditorStore()
    await new Promise(r => setTimeout(r, 50))

    const tab = {
      id: 'tab-2',
      repoName: 'test',
      filePath: 'script.py',
      fileName: 'script.py',
      isMarkdown: false,
      content: 'print("hello")',
      savedContent: 'print("hello")',
      markdownMode: 'wysiwyg' as const,
      scrollTop: 0,
    }
    store.tabs.push(tab as any)

    const wrapper = mount(CodeViewer, {
      props: { tabId: 'tab-2' },
      global: {
        stubs: { NCode: true, NScrollbar: true },
      },
    })

    expect(wrapper.text()).toContain('python')
  })
})
