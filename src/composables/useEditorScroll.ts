import { nextTick } from 'vue'
import { useEditorStore } from '@/stores/editor'

export function useEditorScroll(tabId: string) {
  const editorStore = useEditorStore()

  function saveScroll(el: HTMLElement) {
    const container = el.closest('.n-scrollbar')?.querySelector('.n-scrollbar-container') as HTMLElement | null
    if (container) {
      editorStore.setTabScrollTop(tabId, container.scrollTop)
    }
  }

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
