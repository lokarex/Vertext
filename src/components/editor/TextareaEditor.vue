<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { NScrollbar } from 'naive-ui'
import { useEditorStore } from '@/stores/editor'
import { useEditorScroll } from '@/composables/useEditorScroll'

const props = defineProps<{
  tabId: string
  active: boolean
}>()

const editorStore = useEditorStore()
const textareaEl = ref<HTMLTextAreaElement>()
const value = ref('')
const { saveScroll, restoreScroll } = useEditorScroll(props.tabId)

function autoResize() {
  if (!textareaEl.value) return
  textareaEl.value.style.height = 'auto'
  textareaEl.value.style.height = textareaEl.value.scrollHeight + 'px'
}

function handleInput() {
  editorStore.updateContent(props.tabId, value.value)
  autoResize()
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
}

onMounted(() => {
  if (props.active) init()
})

watch(
  () => props.active,
  async (val, oldVal) => {
    if (val === oldVal) return
    if (val) {
      await init()
    } else {
      if (textareaEl.value) saveScroll(textareaEl.value)
    }
  },
)

onBeforeUnmount(() => {
  if (props.active && textareaEl.value) {
    saveScroll(textareaEl.value)
  }
})
</script>

<template>
  <n-scrollbar style="height: 100%">
    <textarea
      ref="textareaEl"
      v-model="value"
      @input="handleInput"
      class="markdown-textarea"
      spellcheck="false"
    />
  </n-scrollbar>
</template>

<style scoped>
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
</style>
