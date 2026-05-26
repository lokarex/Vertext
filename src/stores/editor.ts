/**
 * @file Editor state Pinia store.
 * Manages open editor tabs, file content, markdown mode switching,
 * auto-save, scroll position persistence, and session restore via
 * the Tauri Store plugin.
 */
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { Store } from '@tauri-apps/plugin-store'
import { error, trace } from '@tauri-apps/plugin-log'
import { useSettingsStore } from '@/stores/settings'
import { useRepositoriesStore } from './repositories'

/** Available editing modes for markdown files. */
export type MarkdownMode = 'wysiwyg' | 'split' | 'edit' | 'preview'

/**
 * Represents an open editor tab.
 */
export interface Tab {
  /** Unique tab identifier. */
  id: string
  /** Repository name this file belongs to. */
  repoName: string
  /** File path relative to the repository root. */
  filePath: string
  /** Display name (filename only). */
  fileName: string
  /** Whether the file is a markdown file. */
  isMarkdown: boolean
  /** Current editable content in the editor. */
  content: string
  /** Last saved version of the content (used for dirty detection). */
  savedContent: string
  /** Active editing mode for markdown tabs. */
  markdownMode: MarkdownMode
  /** Scroll position preserved across tab switches. */
  scrollTop: number
}

/**
 * Subset of {@link Tab} fields persisted to disk for session restore.
 */
interface PersistedTab {
  id: string
  repoName: string
  filePath: string
  fileName: string
  isMarkdown: boolean
  markdownMode: MarkdownMode
  scrollTop: number
}

/** Monotonically increasing counter for generating unique tab IDs. */
let tabCounter = 0

/**
 * Generates a unique tab identifier.
 * @returns A string in the format `tab-{timestamp}-{counter}`.
 */
function generateTabId(): string {
  tabCounter++
  return `tab-${Date.now()}-${tabCounter}`
}

/**
 * Determines whether a file is a markdown file by its extension.
 * @param fileName - The file name to check.
 * @returns `true` if the file has a markdown extension.
 */
function isMarkdownFile(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return lower.endsWith('.md') || lower.endsWith('.mdx') || lower.endsWith('.markdown')
}

/**
 * Extracts the display file name from a repository-relative path.
 * @param filePath - The repository-relative file path.
 * @returns The last path segment, or the original path if no segment exists.
 */
function getFileNameFromPath(filePath: string): string {
  return filePath.split('/').pop() ?? filePath
}

/**
 * Pinia store for editor state.
 * Handles tab management, file I/O, auto-save, and session persistence.
 */
export const useEditorStore = defineStore('editor', () => {
  /** All currently open editor tabs. */
  const tabs = ref<Tab[]>([])
  /** ID of the currently active tab, or null if no tabs are open. */
  const activeTabId = ref<string | null>(null)
  /** Timer for the auto-save interval. */
  let autoSaveTimer: ReturnType<typeof setInterval> | null = null
  /** Reference to the Tauri persistent store for session restore. */
  let store: Store | null = null
  /** Reference to the repositories store for status updates. */
  let repositoriesStore = useRepositoriesStore();

  /** The currently active tab object (derived from activeTabId). */
  const activeTab = ref<Tab | null>(null)

  watch(activeTabId, (id) => {
    activeTab.value = tabs.value.find((t) => t.id === id) ?? null
  })

  /** Clears all tabs when switching to a different repository. */
  watch(() => repositoriesStore.selectedRepository, (oldRepo, newRepo) => {
    if (oldRepo?.name != newRepo?.name) {
      clearAllTabs();
    }
  })

  /**
   * Checks whether a tab has unsaved changes.
   * @param tab - The tab to check.
   * @returns `true` if the content differs from the last saved version.
   */
  function isTabDirty(tab: Tab): boolean {
    return tab.content !== tab.savedContent
  }

  /**
   * Opens a file from a repository into a new or existing editor tab.
   * Reads file content from disk via the Tauri backend.
   *
   * @param repoName - The repository name.
   * @param filePath - The relative file path within the repository.
   * @param fileName - The display name for the tab.
   * @returns The tab ID of the opened file.
   */
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
      scrollTop: 0,
    }

    tabs.value.push(tab)
    activeTabId.value = tab.id
    return tab.id
  }

  /**
   * Closes a tab by its ID. If the closed tab was active, activates
   * the nearest remaining tab.
   * @param tabId - The ID of the tab to close.
   */
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

  /**
   * Sets the active tab by ID.
   * @param tabId - The ID of the tab to activate.
   */
  function setActiveTab(tabId: string): void {
    if (tabs.value.some((t) => t.id === tabId)) {
      activeTabId.value = tabId
    }
  }

  /**
   * Updates the content of a tab in memory (does not save to disk).
   * @param tabId - The tab to update.
   * @param content - The new content string.
   */
  function updateContent(tabId: string, content: string): void {
    const tab = tabs.value.find((t) => t.id === tabId)
    if (tab) {
      tab.content = content
    }
  }

  /**
   * Updates open tab metadata after a file or directory is renamed.
   * @param oldPath - The previous repository-relative file or directory path.
   * @param newPath - The new repository-relative file or directory path.
   */
  function updateTabsAfterRename(oldPath: string, newPath: string): void {
    const oldPrefix = `${oldPath}/`
    const newPrefix = `${newPath}/`

    for (const tab of tabs.value) {
      let updatedPath: string | null = null

      if (tab.filePath === oldPath) {
        updatedPath = newPath
      } else if (tab.filePath.startsWith(oldPrefix)) {
        updatedPath = `${newPrefix}${tab.filePath.slice(oldPrefix.length)}`
      }

      if (!updatedPath) continue

      const fileName = getFileNameFromPath(updatedPath)
      tab.filePath = updatedPath
      tab.fileName = fileName
      tab.isMarkdown = isMarkdownFile(fileName)
    }
  }

  /**
   * Closes open tabs whose files were deleted directly or inside a deleted directory.
   * @param deletedPath - The repository-relative file or directory path that was deleted.
   */
  function closeTabsAfterDelete(deletedPath: string): void {
    const deletedPrefix = `${deletedPath}/`
    const shouldClose = (tab: Tab) => (
      tab.filePath === deletedPath || tab.filePath.startsWith(deletedPrefix)
    )
    const firstClosedIndex = tabs.value.findIndex(shouldClose)

    if (firstClosedIndex === -1) return

    const previousActiveTabId = activeTabId.value
    tabs.value = tabs.value.filter((tab) => !shouldClose(tab))

    if (!previousActiveTabId || tabs.value.some((tab) => tab.id === previousActiveTabId)) {
      return
    }

    if (tabs.value.length === 0) {
      activeTabId.value = null
      return
    }

    const nextActiveIndex = Math.min(firstClosedIndex, tabs.value.length - 1)
    activeTabId.value = tabs.value[nextActiveIndex].id
  }

  /**
   * Saves a tab's content to disk via the Tauri backend.
   * Marks the tab as clean and updates the repository's sync status.
   *
   * @param tabId - The tab to save.
   */
  async function saveFile(tabId: string): Promise<void> {
    const tab = tabs.value.find((t) => t.id === tabId)
    if (!tab) return

    await invoke('write_file_content', {
      repoName: tab.repoName,
      relativePath: tab.filePath,
      content: tab.content,
    })

    tab.savedContent = tab.content

    if (repositoriesStore.selectedRepository && repositoriesStore.selectedRepository.status === 'synced') {
      await repositoriesStore.setStatus(tab.repoName, 'unsynced')
    }
  }

  /**
   * Sets the markdown editing mode for a tab (wysiwyg, split, edit, preview).
   * Only applies to markdown files.
   *
   * @param tabId - The tab to update.
   * @param mode - The new editing mode.
   */
  function setMarkdownMode(tabId: string, mode: MarkdownMode): void {
    const tab = tabs.value.find((t) => t.id === tabId)
    if (tab && tab.isMarkdown) {
      tab.markdownMode = mode
    }
  }

  /** Closes all open tabs. */
  function clearAllTabs(): void {
    tabs.value = []
    activeTabId.value = null
  }

  /**
   * Starts the auto-save timer.
   * Periodically saves any dirty tabs at the interval defined in settings.
   */
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

  /** Stops the auto-save timer. */
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

  /**
   * Converts a Tab to its persistable form (without content).
   * @param tab - The full tab object.
   * @returns A {@link PersistedTab} with content stripped.
   */
  function toPersistedTab(tab: Tab): PersistedTab {
    return {
      id: tab.id,
      repoName: tab.repoName,
      filePath: tab.filePath,
      fileName: tab.fileName,
      isMarkdown: tab.isMarkdown,
      markdownMode: tab.markdownMode,
      scrollTop: tab.scrollTop,
    }
  }

  /**
   * Persists the current editor state (open tabs and active tab) to disk.
   * Content is NOT persisted; only tab metadata and scroll positions are saved.
   */
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

  /**
   * Restores the editor session from disk on application launch.
   * Re-reads file content from disk for each persisted tab.
   */
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
              scrollTop: pt.scrollTop ?? 0,
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

  /**
   * Sets the scroll position for a tab.
   * @param tabId - The tab to update.
   * @param scrollTop - The vertical scroll offset in pixels.
   */
  function setTabScrollTop(tabId: string, scrollTop: number): void {
    const tab = tabs.value.find((t) => t.id === tabId)
    if (tab) {
      tab.scrollTop = scrollTop
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
    updateTabsAfterRename,
    closeTabsAfterDelete,
    saveFile,
    setMarkdownMode,
    clearAllTabs,
    isTabDirty,
    startAutoSave,
    stopAutoSave,
    setTabScrollTop,
  }
})
