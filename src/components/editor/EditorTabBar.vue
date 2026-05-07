<script setup lang="ts">
import { h } from 'vue'
import { NIcon } from 'naive-ui'
import { Dismiss12Regular } from '@vicons/fluent'
import { useEditorStore } from '@/stores/editor'
import { getFileEntryIcon } from '@/composables/useFileTreeIcons'

const editorStore = useEditorStore()

function handleTabClick(tabId: string) {
  editorStore.setActiveTab(tabId)
}

function handleTabClose(tabId: string, event: MouseEvent) {
  event.stopPropagation()
  editorStore.closeTab(tabId)
}

function getTabIcon(fileName: string) {
  const entry = { key: fileName, label: fileName, isLeaf: true, children: [] }
  const iconComp = getFileEntryIcon(entry)
  if (iconComp) {
    return h(NIcon, { component: iconComp, size: 16 })
  }
  return null
}

function getCloseIcon() {
  return h(NIcon, { component: Dismiss12Regular, size: 14 })
}
</script>

<template>
  <div class="editor-tab-bar" v-if="editorStore.tabs.length > 0">
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
</template>

<style scoped>
.editor-tab-bar {
  display: flex;
  align-items: stretch;
  background: var(--n-color-embedded);
  border-bottom: 1px solid var(--n-border-color);
  overflow-x: auto;
  overflow-y: hidden;
  min-height: 36px;
  flex-shrink: 0;
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
