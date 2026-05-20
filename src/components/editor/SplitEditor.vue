<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { NScrollbar } from 'naive-ui'
import { useEditorStore } from '@/stores/editor'
import { useMilkdownEditor } from '@/composables/useMilkdownEditor'
import { useEditorScroll } from '@/composables/useEditorScroll'

const props = defineProps<{
  tabId: string
  active: boolean
}>()

const editorStore = useEditorStore()
const textareaEl = ref<HTMLTextAreaElement>()
const previewEl = ref<HTMLDivElement>()
const value = ref('')

const { create, destroy } = useMilkdownEditor()
const { saveScroll, restoreScroll } = useEditorScroll(props.tabId)

function autoResize() {
  if (!textareaEl.value) return
  textareaEl.value.style.height = 'auto'
  textareaEl.value.style.height = textareaEl.value.scrollHeight + 'px'
}

function handleInput() {
  editorStore.updateContent(props.tabId, value.value)
  autoResize()
  updatePreview()
}

async function updatePreview() {
  if (!previewEl.value) return
  await destroy()
  previewEl.value.innerHTML = ''
  await create(previewEl.value, value.value, { editable: false })
}

function getTextarea(): HTMLTextAreaElement | null {
  return textareaEl.value ?? null
}

defineExpose({ getTextarea })

async function init() {
  const tab = editorStore.tabs.find((t) => t.id === props.tabId)
  if (!tab) return
  value.value = tab.content
  await nextTick()
  autoResize()
  if (textareaEl.value) restoreScroll(textareaEl.value)
  await updatePreview()
}

onMounted(async () => {
  if (props.active) await init()
})

watch(
  () => props.active,
  async (val, oldVal) => {
    if (val === oldVal) return
    if (val) {
      await init()
    } else {
      if (textareaEl.value) saveScroll(textareaEl.value)
      await destroy()
    }
  },
)

onBeforeUnmount(async () => {
  if (props.active && textareaEl.value) {
    saveScroll(textareaEl.value)
  }
  await destroy()
})
</script>

<template>
  <div class="split-layout">
    <div class="split-pane">
      <n-scrollbar style="height: 100%">
        <textarea
          ref="textareaEl"
          v-model="value"
          @input="handleInput"
          class="markdown-textarea"
          spellcheck="false"
        />
      </n-scrollbar>
    </div>
    <div class="split-divider" />
    <div class="split-pane">
      <n-scrollbar style="height: 100%">
        <div ref="previewEl" class="milkdown-wrapper" />
      </n-scrollbar>
    </div>
  </div>
</template>

<style scoped>
.split-layout {
  display: flex;
  flex-direction: row;
  overflow: hidden;
  height: 100%;
}
.split-pane {
  flex: 1;
  overflow: hidden;
  display: flex;
}
.split-divider {
  width: 1px;
  background: var(--n-border-color);
  flex-shrink: 0;
}
.markdown-textarea {
  display: block;
  width: 100%;
  min-height: 100%;
  border: none;
  outline: none;
  resize: none;
  overflow: hidden;
  padding: 16px;
  font-family: 'Consolas', 'Cascadia Code', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.7;
  color: var(--n-text-color);
  background: var(--n-color);
  tab-size: 4;
}
.milkdown-wrapper {
  min-height: 100%;
  padding: 16px 24px;
}
:deep(.milkdown) {
  max-width: min(100%, 1200px);
  margin: 0 auto;
}
:deep(.milkdown .ProseMirror) {
  outline: none;
  min-height: calc(100vh - 200px);
}
:deep(.milkdown .editor) {
  min-height: calc(100vh - 200px);
}
</style>
