<script setup lang="ts">
/**
 * Syntax-highlighted code viewer for an individual editor tab.
 * Resolves the language from the file extension, preserves/restores
 * scroll position across tab switches, and displays a header with
 * the file name and detected language.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { NCode, NScrollbar } from 'naive-ui'
import { useEditorStore } from '@/stores/editor'
import { getLanguageFromFileName } from '@/utils/languageMap'

/** @property tabId - Unique identifier of the editor tab whose content to display. */
const props = defineProps<{
  tabId: string
}>()

/** Pinia store managing open editor tabs, content, and scroll state. */
const editorStore = useEditorStore()

/** The editor tab object matching the given `tabId`, or `null` if not found. */
const tab = computed(() => editorStore.tabs.find((t) => t.id === props.tabId) ?? null)
/** The text content of the current tab, or an empty string. */
const code = computed(() => tab.value?.content ?? '')
/** The resolved language identifier for syntax highlighting, derived from the file name. */
const language = computed(() => {
  if (!tab.value) return 'text'
  return getLanguageFromFileName(tab.value.fileName)
})

/** Template ref bound to the scrollable code body container. */
const bodyRef = ref<HTMLElement>()

/**
 * Walks the DOM to locate the inner scrollable container inside the
 * `<n-scrollbar>` wrapper, or `null` if not yet rendered.
 * @returns The `.n-scrollbar-container` HTMLElement or `null`.
 */
function getScrollContainer(): HTMLElement | null {
  if (!bodyRef.value) return null
  const scrollbar = bodyRef.value.querySelector('.n-scrollbar')
  if (!scrollbar) return null
  return scrollbar.querySelector('.n-scrollbar-container') as HTMLElement | null
}

/**
 * Persists the current vertical scroll position to the editor store
 * so it can be restored when the tab is revisited.
 */
function saveScrollTop() {
  const container = getScrollContainer()
  if (container) {
    editorStore.setTabScrollTop(props.tabId, container.scrollTop)
  }
}

/**
 * Restores a previously saved vertical scroll position for this tab
 * after the next DOM update, if a stored position exists.
 */
function restoreScrollTop() {
  const t = tab.value
  if (!t || t.scrollTop <= 0) return
  nextTick(() => {
    const container = getScrollContainer()
    if (container) {
      container.scrollTop = t.scrollTop
    }
  })
}

/** Scroll event listener reference for cleanup on unmount. */
let scrollHandler: (() => void) | null = null

/**
 * Lifecycle: attaches a passive scroll listener to persist scroll position
 * and restores any previously saved scroll position for the active tab.
 */
onMounted(() => {
  nextTick(() => {
    const container = getScrollContainer()
    if (container) {
      scrollHandler = () => saveScrollTop()
      container.addEventListener('scroll', scrollHandler, { passive: true })
    }
    restoreScrollTop()
  })
})

/**
 * Lifecycle: saves the current scroll position and removes the scroll
 * listener before the component is destroyed.
 */
onBeforeUnmount(() => {
  saveScrollTop()
  if (scrollHandler) {
    const container = getScrollContainer()
    if (container) {
      container.removeEventListener('scroll', scrollHandler)
    }
    scrollHandler = null
  }
})
</script>

<template>
  <div class="code-viewer" v-if="tab">
    <div class="code-header">
      <span class="code-filename">{{ tab.fileName }}</span>
      <span class="code-lang">{{ language }}</span>
    </div>
    <div class="code-body" ref="bodyRef">
      <n-scrollbar style="height: 100%">
        <n-code :code="code" :language="language" word-wrap />
      </n-scrollbar>
    </div>
  </div>
  <div class="code-viewer code-viewer-empty" v-else>
    <span>Loading...</span>
  </div>
</template>

<style scoped>
.code-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.code-viewer-empty {
  justify-content: center;
  align-items: center;
}

.code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  flex-shrink: 0;
  font-size: 1em;
}

.code-filename {
  font-weight: 500;
}

.code-lang {
  text-transform: uppercase;
  opacity: 0.7;
}

.code-body {
  flex: 1;
  overflow: hidden;
  padding: 16px;
}
</style>
