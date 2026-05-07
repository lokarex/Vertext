import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { Store } from '@tauri-apps/plugin-store'
import { error, trace } from '@tauri-apps/plugin-log'
import { useSettingsStore } from '@/stores/settings'
import { useRepositoriesStore } from './repositories'

export type MarkdownMode = 'wysiwyg' | 'split' | 'edit' | 'preview'

export interface Tab {
  id: string
  repoName: string
  filePath: string
  fileName: string
  isMarkdown: boolean
  content: string
  savedContent: string
  markdownMode: MarkdownMode
}

interface PersistedTab {
  id: string
  repoName: string
  filePath: string
  fileName: string
  isMarkdown: boolean
  markdownMode: MarkdownMode
}

let tabCounter = 0

function generateTabId(): string {
  tabCounter++
  return `tab-${Date.now()}-${tabCounter}`
}

function isMarkdownFile(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return lower.endsWith('.md') || lower.endsWith('.mdx') || lower.endsWith('.markdown')
}

export const useEditorStore = defineStore('editor', () => {
  const tabs = ref<Tab[]>([])
  const activeTabId = ref<string | null>(null)
  let autoSaveTimer: ReturnType<typeof setInterval> | null = null
  let store: Store | null = null
  let repositoriesStore = useRepositoriesStore();

  const activeTab = ref<Tab | null>(null)

  watch(activeTabId, (id) => {
    activeTab.value = tabs.value.find((t) => t.id === id) ?? null
  })

  watch(() => repositoriesStore.selectedRepository, (oldRepo, newRepo) => {
    if (oldRepo?.name != newRepo?.name) {
      clearAllTabs();
    }
  })

  function isTabDirty(tab: Tab): boolean {
    return tab.content !== tab.savedContent
  }

  async function openFile(
    repoName: string,
    filePath: string,
    fileName: string,
  ): Promise<string> {
    const existing = tabs.value.find(
      (t) => t.repoName === repoName && t.filePath === filePath,
    )
    if (existing) {
      activeTabId.value = existing.id
      return existing.id
    }

    const content = await invoke<string>('read_file_content', {
      repoName,
      relativePath: filePath,
    })

    const tab: Tab = {
      id: generateTabId(),
      repoName,
      filePath,
      fileName,
      isMarkdown: isMarkdownFile(fileName),
      content,
      savedContent: content,
      markdownMode: 'wysiwyg',
    }

    tabs.value.push(tab)
    activeTabId.value = tab.id
    return tab.id
  }

  function closeTab(tabId: string): void {
    const idx = tabs.value.findIndex((t) => t.id === tabId)
    if (idx === -1) return

    tabs.value.splice(idx, 1)

    if (activeTabId.value === tabId) {
      if (tabs.value.length === 0) {
        activeTabId.value = null
      } else {
        const newIdx = Math.min(idx, tabs.value.length - 1)
        activeTabId.value = tabs.value[newIdx].id
      }
    }
  }

  function setActiveTab(tabId: string): void {
    if (tabs.value.some((t) => t.id === tabId)) {
      activeTabId.value = tabId
    }
  }

  function updateContent(tabId: string, content: string): void {
    const tab = tabs.value.find((t) => t.id === tabId)
    if (tab) {
      tab.content = content
    }
  }

  async function saveFile(tabId: string): Promise<void> {
    const tab = tabs.value.find((t) => t.id === tabId)
    if (!tab) return

    await invoke('write_file_content', {
      repoName: tab.repoName,
      relativePath: tab.filePath,
      content: tab.content,
    })

    tab.savedContent = tab.content
  }

  function setMarkdownMode(tabId: string, mode: MarkdownMode): void {
    const tab = tabs.value.find((t) => t.id === tabId)
    if (tab && tab.isMarkdown) {
      tab.markdownMode = mode
    }
  }

  function clearAllTabs(): void {
    tabs.value = []
    activeTabId.value = null
  }

  function startAutoSave(): void {
    stopAutoSave()
    const settingsStore = useSettingsStore()
    const intervalMs = settingsStore.autoSaveInterval * 1000

    autoSaveTimer = setInterval(async () => {
      for (const tab of tabs.value) {
        if (isTabDirty(tab)) {
          try {
            await saveFile(tab.id)
          } catch {
            error('Failed to auto-save file')
          }
        }
      }
    }, intervalMs)
  }

  function stopAutoSave(): void {
    if (autoSaveTimer !== null) {
      clearInterval(autoSaveTimer)
      autoSaveTimer = null
    }
  }

  watch(
    activeTabId,
    () => {
      startAutoSave()
    },
  )

  function toPersistedTab(tab: Tab): PersistedTab {
    return {
      id: tab.id,
      repoName: tab.repoName,
      filePath: tab.filePath,
      fileName: tab.fileName,
      isMarkdown: tab.isMarkdown,
      markdownMode: tab.markdownMode,
    }
  }

  async function persistEditorState() {
    if (!store) return
    const persistedTabs: PersistedTab[] = tabs.value.map(toPersistedTab)
    await store.set('tabs', persistedTabs)
    await store.set('activeTabId', activeTabId.value)
    await store.set('tabCounter', tabCounter)
    await store.save()
  }

  let persistTimer: ReturnType<typeof setTimeout> | null = null

  watch([tabs, activeTabId], () => {
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      persistEditorState()
    }, 300)
  }, { deep: true })

  async function initialize() {
    try {
      store = await Store.load('editor.json')
      const persistedTabs = await store.get('tabs') as PersistedTab[] | null
      const savedCounter = await store.get('tabCounter') as number | null
      const savedActiveTabId = await store.get('activeTabId') as string | null

      if (savedCounter) {
        tabCounter = Math.max(tabCounter, savedCounter)
      }

      if (persistedTabs && persistedTabs.length > 0) {
        for (const pt of persistedTabs) {
          try {
            const content = await invoke<string>('read_file_content', {
              repoName: pt.repoName,
              relativePath: pt.filePath,
            })
            const tab: Tab = {
              id: pt.id,
              repoName: pt.repoName,
              filePath: pt.filePath,
              fileName: pt.fileName,
              isMarkdown: pt.isMarkdown,
              markdownMode: pt.markdownMode,
              content,
              savedContent: content,
            }
            tabs.value.push(tab)
          } catch {
            // file may have been deleted, skip
          }
        }
      }

      if (savedActiveTabId && tabs.value.some(t => t.id === savedActiveTabId)) {
        activeTabId.value = savedActiveTabId
      } else if (tabs.value.length > 0) {
        activeTabId.value = tabs.value[0].id
      }
    } catch (err) {
      trace(`Failed to initialize editor store: ${err}`)
    }
  }

  initialize()

  return {
    tabs,
    activeTabId,
    activeTab,
    openFile,
    closeTab,
    setActiveTab,
    updateContent,
    saveFile,
    setMarkdownMode,
    clearAllTabs,
    isTabDirty,
    startAutoSave,
    stopAutoSave,
  }
})
