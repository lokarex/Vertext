/**
 * @file Scroll position persistence composable.
 * Saves and restores the vertical scroll position of an editor tab
 * so that switching between tabs preserves the user's viewport.
 */
import { nextTick } from 'vue'
import { useEditorStore } from '@/stores/editor'

/**
 * Provides scroll save/restore helpers for a specific editor tab.
 *
 * @param tabId - The unique identifier of the editor tab.
 * @returns An object with {@link saveScroll} and {@link restoreScroll} functions.
 */
export function useEditorScroll(tabId: string) {
  const editorStore = useEditorStore()

  /**
   * Saves the current scroll position of the given element to the editor store.
   * @param el - The editor DOM element (e.g. textarea or preview container).
   */
  function saveScroll(el: HTMLElement) {
    const container = el.closest('.n-scrollbar')?.querySelector('.n-scrollbar-container') as HTMLElement | null
    if (container) {
      editorStore.setTabScrollTop(tabId, container.scrollTop)
    }
  }

  /**
   * Restores the previously saved scroll position for the tab.
   * Uses `nextTick` to ensure the DOM has updated before scrolling.
   * @param el - The editor DOM element.
   */
  function restoreScroll(el: HTMLElement) {
    const tab = editorStore.tabs.find((t) => t.id === tabId)
    if (!tab || tab.scrollTop <= 0) return
    nextTick(() => {
      const container = el.closest('.n-scrollbar')?.querySelector('.n-scrollbar-container') as HTMLElement | null
      if (container) {
        container.scrollTop = tab.scrollTop
      }
    })
  }

  return { saveScroll, restoreScroll }
}
