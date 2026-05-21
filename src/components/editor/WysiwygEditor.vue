<script setup lang="ts">
/**
 * WYSIWYG Milkdown editor component.
 * Provides rich text editing with live markdown synchronization,
 * managing the Milkdown editor lifecycle and scroll position.
 */
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { NScrollbar } from 'naive-ui'
import { useEditorStore } from '@/stores/editor'
import { useMilkdownEditor } from '@/composables/useMilkdownEditor'
import { useEditorScroll } from '@/composables/useEditorScroll'
import type { EditorView } from 'prosemirror-view'

/**
 * @property {string} tabId - Unique identifier of the editor tab.
 * @property {boolean} active - Whether this editor is the currently active tab.
 */
const props = defineProps<{
  tabId: string
  active: boolean
}>()

const editorStore = useEditorStore()
/** Root element where the Milkdown editor is mounted. */
const rootEl = ref<HTMLDivElement>()
const { create, destroy, editorView } = useMilkdownEditor()
const { saveScroll, restoreScroll } = useEditorScroll(props.tabId)

/**
 * Initializes the WYSIWYG editor: clears the root element, creates a Milkdown
 * editor in editable mode with content syncing, and restores scroll position.
 */
async function init() {
  const tab = editorStore.tabs.find((t) => t.id === props.tabId)
  if (!tab || !rootEl.value) return
  rootEl.value.innerHTML = ''
  await create(rootEl.value, tab.content, {
    editable: true,
    onUpdate: (md) => editorStore.updateContent(props.tabId, md),
  })
  restoreScroll(rootEl.value)
}

/**
 * Returns the current ProseMirror EditorView instance.
 * @returns {EditorView | null} The EditorView, or null if not yet created.
 */
function getEditorView(): EditorView | null {
  return editorView.value
}

/**
 * Exposed methods available to the parent component.
 * @method getEditorView - Returns the ProseMirror EditorView instance.
 */
defineExpose({ getEditorView })

/**
 * Initializes the editor on mount if this tab is already active.
 */
onMounted(async () => {
  if (props.active) {
    await init()
  }
})

/**
 * Watches the active state to reinitialize the editor on activation
 * and tear down the Milkdown instance on deactivation.
 */
watch(
  () => props.active,
  async (val, oldVal) => {
    if (val === oldVal) return
    if (val) {
      await init()
    } else {
      if (rootEl.value) saveScroll(rootEl.value)
      await destroy()
    }
  },
)

/**
 * Saves scroll position and destroys the Milkdown editor before unmount.
 */
onBeforeUnmount(async () => {
  if (props.active && rootEl.value) {
    saveScroll(rootEl.value)
  }
  await destroy()
})
</script>

<template>
  <n-scrollbar style="height: 100%">
    <div ref="rootEl" class="milkdown-wrapper" />
  </n-scrollbar>
</template>

<style scoped>
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
