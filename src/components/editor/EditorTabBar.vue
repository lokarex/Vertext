<script setup lang="ts">
/**
 * Horizontal tab bar for the editor pane.
 * Displays open file tabs with file-type icons, dirty-state indicators,
 * and close buttons. Tabs scroll horizontally when they overflow.
 */
import { h } from 'vue'
import { NIcon, NScrollbar } from 'naive-ui'
import { Dismiss12Regular } from '@vicons/fluent'
import { useEditorStore } from '@/stores/editor'
import { getFileEntryIcon } from '@/composables/useFileTreeIcons'

/** Pinia store managing open editor tabs and active-tab state. */
const editorStore = useEditorStore()

/**
 * Activates the editor tab with the given ID.
 * @param tabId - Unique identifier of the tab to activate.
 */
function handleTabClick(tabId: string) {
  editorStore.setActiveTab(tabId)
}

/**
 * Closes the editor tab with the given ID, preventing the click from
 * bubbling up to the parent tab element.
 * @param tabId - Unique identifier of the tab to close.
 * @param event - The originating mouse event.
 */
function handleTabClose(tabId: string, event: MouseEvent) {
  event.stopPropagation()
  editorStore.closeTab(tabId)
}

/**
 * Returns a pre-configured NIcon VNode for the file-type icon matching
 * the given file name, or `null` if no icon could be resolved.
 * @param fileName - The file name (including extension) to resolve an icon for.
 * @returns An NIcon VNode or `null`.
 */
function getTabIcon(fileName: string) {
  const entry = { key: fileName, label: fileName, isLeaf: true, children: [] }
  const iconComp = getFileEntryIcon(entry)
  if (iconComp) {
    return h(NIcon, { component: iconComp, size: 16 })
  }
  return null
}

/**
 * Returns a pre-configured NIcon VNode for the close (dismiss) button.
 * @returns An NIcon VNode rendering the Dismiss12Regular icon at 14px.
 */
function getCloseIcon() {
  return h(NIcon, { component: Dismiss12Regular, size: 14 })
}
</script>

<template>
  <div class="editor-tab-bar" v-if="editorStore.tabs.length > 0">
    <n-scrollbar x-scrollable>
      <div class="tab-bar-inner">
        <div
          v-for="tab in editorStore.tabs"
          :key="tab.id"
          class="editor-tab-item"
          :class="{ active: tab.id === editorStore.activeTabId, dirty: editorStore.isTabDirty(tab) }"
          @click="handleTabClick(tab.id)"
        >
          <span class="editor-tab-icon">
            <component :is="getTabIcon(tab.fileName)" />
          </span>
          <span class="editor-tab-name">{{ tab.fileName }}</span>
          <span class="editor-tab-close" @click="(e: MouseEvent) => handleTabClose(tab.id, e)">
            <component :is="getCloseIcon()" />
          </span>
        </div>
      </div>
    </n-scrollbar>
  </div>
</template>

<style scoped>
.editor-tab-bar {
  background: var(--n-color-embedded);
  border-bottom: 1px solid var(--n-border-color);
  min-height: 36px;
  flex-shrink: 0;
}

.tab-bar-inner {
  display: flex;
  align-items: stretch;
  min-height: 36px;
}

.editor-tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 0.9em;
  flex-shrink: 0;
}

.editor-tab-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.editor-tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

.editor-tab-close {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  margin-left: 2px;
  opacity: 0.6;
}

.editor-tab-close:hover {
  opacity: 1;
  background: var(--n-color-hover);
}
</style>
