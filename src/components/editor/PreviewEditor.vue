<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { NScrollbar } from 'naive-ui'
import { useEditorStore } from '@/stores/editor'
import { useMilkdownEditor } from '@/composables/useMilkdownEditor'
import { useEditorScroll } from '@/composables/useEditorScroll'

const props = defineProps<{
  tabId: string
  active: boolean
}>()

const editorStore = useEditorStore()
const rootEl = ref<HTMLDivElement>()
const { create, destroy } = useMilkdownEditor()
const { saveScroll, restoreScroll } = useEditorScroll(props.tabId)

async function init() {
  const tab = editorStore.tabs.find((t) => t.id === props.tabId)
  if (!tab || !rootEl.value) return
  rootEl.value.innerHTML = ''
  await create(rootEl.value, tab.content, { editable: false })
  restoreScroll(rootEl.value)
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
      if (rootEl.value) saveScroll(rootEl.value)
      await destroy()
    }
  },
)

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
