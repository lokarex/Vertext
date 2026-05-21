<script setup lang="ts">
/**
 * Plain textarea markdown editor component.
 * Provides a raw text editing experience with auto-resize behavior
 * and scroll position preservation across tab switches.
 */
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { NScrollbar } from 'naive-ui'
import { useEditorStore } from '@/stores/editor'
import { useEditorScroll } from '@/composables/useEditorScroll'

/**
 * @property {string} tabId - Unique identifier of the editor tab.
 * @property {boolean} active - Whether this editor is the currently active tab.
 */
const props = defineProps<{
  tabId: string
  active: boolean
}>()

const editorStore = useEditorStore()
/** Reference to the native textarea element. */
const textareaEl = ref<HTMLTextAreaElement>()
/** Current markdown content bound to the textarea. */
const value = ref('')
const { saveScroll, restoreScroll } = useEditorScroll(props.tabId)

/**
 * Resizes the textarea height to fit its content.
 */
function autoResize() {
  if (!textareaEl.value) return
  textareaEl.value.style.height = 'auto'
  textareaEl.value.style.height = textareaEl.value.scrollHeight + 'px'
}

/**
 * Handles textarea input: persists content to the store and triggers resize.
 */
function handleInput() {
  editorStore.updateContent(props.tabId, value.value)
  autoResize()
}

/**
 * Returns the native textarea element reference.
 * @returns {HTMLTextAreaElement | null} The textarea DOM element, or null if not mounted.
 */
function getTextarea(): HTMLTextAreaElement | null {
  return textareaEl.value ?? null
}

/**
 * Exposed methods available to the parent component.
 * @method getTextarea - Returns the native textarea element.
 */
defineExpose({ getTextarea })

/**
 * Initializes the editor: loads tab content, auto-resizes, and restores scroll position.
 */
async function init() {
  const tab = editorStore.tabs.find((t) => t.id === props.tabId)
  if (!tab) return
  value.value = tab.content
  await nextTick()
  autoResize()
  if (textareaEl.value) restoreScroll(textareaEl.value)
}

/**
 * Initializes the editor on mount if this tab is already active.
 */
onMounted(() => {
  if (props.active) init()
})

/**
 * Watches the active state to initialize on activation and save scroll on deactivation.
 */
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

/**
 * Saves the current scroll position before the component is unmounted.
 */
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
