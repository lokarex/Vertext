<script setup lang="ts">
import { NIcon } from 'naive-ui'
import { Document24Regular } from '@vicons/fluent'
import { useEditorStore } from '@/stores/editor'
import EditorTabBar from '@/components/editor/EditorTabBar.vue'
import MarkdownEditor from '@/components/editor/MarkdownEditor.vue'
import CodeViewer from '@/components/editor/CodeViewer.vue'

const editorStore = useEditorStore()
</script>

<template>
  <div class="editor-view">
    <EditorTabBar />
    <div class="editor-body" v-if="editorStore.activeTab && editorStore.activeTabId">
      <MarkdownEditor
        v-if="editorStore.activeTab.isMarkdown"
        :key="`md-${editorStore.activeTabId}`"
        :tabId="editorStore.activeTabId"
      />
      <CodeViewer
        v-else
        :key="`code-${editorStore.activeTabId}`"
        :tabId="editorStore.activeTabId"
      />
    </div>
    <div class="editor-empty" v-else>
      <div class="empty-icon">
        <NIcon :component="Document24Regular" :size="48" />
      </div>
      <p class="empty-text">{{ $t('editor.message.emptyHint') }}</p>
    </div>
  </div>
</template>

<style scoped>
.editor-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editor-body {
  flex: 1;
  overflow: hidden;
}

.editor-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-text {
  font-size: 1em;
}
</style>
