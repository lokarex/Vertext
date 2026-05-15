<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import type { Component } from 'vue'
import { NButton, NButtonGroup, NIcon, NTooltip, NScrollbar, NModal, NInput, NSpace, useMessage } from 'naive-ui'
import {
  Save24Regular,
  CheckmarkCircle24Regular,
  DocumentEdit24Regular,
  SplitHorizontal24Regular,
  Code24Regular,
  Eye24Regular,
  TextBold24Regular,
  TextItalic24Regular,
  TextStrikethrough24Regular,
  TextHeader124Regular,
  TextHeader220Regular,
  TextHeader320Regular,
  TextBulletListSquare24Regular,
  TextNumberListLtr24Regular,
  TextQuote24Regular,
  Link24Regular,
  LineHorizontal320Regular,
} from '@vicons/fluent'
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx, editorViewCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { clipboard } from '@milkdown/kit/plugin/clipboard'
import { history } from '@milkdown/kit/plugin/history'
import { cursor } from '@milkdown/kit/plugin/cursor'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { nord } from '@milkdown/theme-nord'
import { toggleMark, setBlockType, wrapIn } from 'prosemirror-commands'
import type { EditorView } from 'prosemirror-view'
import { useEditorStore } from '@/stores/editor'
import { useI18n } from 'vue-i18n'
import type { MarkdownMode, Tab } from '@/stores/editor'

const props = defineProps<{
  tabId: string
}>()

const { t } = useI18n()
const editorStore = useEditorStore()
const message = useMessage()

const tab = ref<Tab | null>(null)

const editorRootEl = ref<HTMLDivElement>()
const splitPreviewEl = ref<HTMLDivElement>()
const previewRootEl = ref<HTMLDivElement>()
const splitTextareaEl = ref<HTMLTextAreaElement>()
const editTextareaEl = ref<HTMLTextAreaElement>()

const splitTextarea = ref('')
const editTextareaValue = ref('')

const justSaved = ref(false)

const showLinkModal = ref(false)
const linkTextInput = ref('')
const linkUrlInput = ref('')
let linkInsertMode: 'textarea' | 'wysiwyg' | null = null

let editorInstance: Editor | null = null
let splitPreviewInstance: Editor | null = null
let previewInstance: Editor | null = null
let editorView: EditorView | null = null

function autoResize(el: HTMLTextAreaElement | undefined) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

watch(
  () => editorStore.activeTabId,
  () => {
    tab.value = editorStore.tabs.find((t) => t.id === props.tabId) ?? null
  },
  { immediate: true },
)

watch(
  () => tab.value?.markdownMode,
  (mode, oldMode) => {
    if (oldMode === mode || !tab.value) return
    destroyEditor()
    destroySplitPreview()
    destroyPreview()
    if (mode === 'edit') {
      editTextareaValue.value = tab.value.content
      nextTick(() => autoResize(editTextareaEl.value))
    }
    if (mode === 'split') {
      splitTextarea.value = tab.value.content
      nextTick(() => autoResize(splitTextareaEl.value))
    }
    nextTick(() => initMode())
  },
)

function initMode() {
  if (!tab.value) return
  const mode = tab.value.markdownMode
  if (mode === 'wysiwyg') {
    createWysiwygEditor()
  } else if (mode === 'split') {
    createSplitPreview()
    splitTextarea.value = tab.value.content
  } else if (mode === 'preview') {
    createPreviewEditor()
  }
}

function createWysiwygEditor() {
  if (!editorRootEl.value || !tab.value) return
  destroyEditor()

  const container = editorRootEl.value
  container.innerHTML = ''

  editorInstance = Editor.make()
    .config((ctx: any) => {
      ctx.set(rootCtx, container)
      ctx.set(defaultValueCtx, tab.value!.content)
      nord(ctx)
      ctx.get(listenerCtx).markdownUpdated((_ctx: any, md: string) => {
        editorStore.updateContent(props.tabId, md)
      })
    })
    .use(commonmark)
    .use(gfm)
    .use(clipboard)
    .use(history)
    .use(cursor)
    .use(listener)

  editorInstance.create().then(() => {
    editorInstance?.action((ctx) => {
      editorView = ctx.get(editorViewCtx)
    })
  })
}

function createSplitPreview() {
  if (!splitPreviewEl.value || !tab.value) return
  destroySplitPreview()

  const container = splitPreviewEl.value
  container.innerHTML = ''

  splitPreviewInstance = Editor.make()
    .config((ctx: any) => {
      ctx.set(rootCtx, container)
      ctx.set(defaultValueCtx, tab.value!.content)
      ctx.set(editorViewOptionsCtx, { editable: () => false })
      nord(ctx)
    })
    .use(commonmark)
    .use(gfm)

  splitPreviewInstance.create()
}

function createPreviewEditor() {
  if (!previewRootEl.value || !tab.value) return
  destroyPreview()

  const container = previewRootEl.value
  container.innerHTML = ''

  previewInstance = Editor.make()
    .config((ctx: any) => {
      ctx.set(rootCtx, container)
      ctx.set(defaultValueCtx, tab.value!.content)
      ctx.set(editorViewOptionsCtx, { editable: () => false })
      nord(ctx)
    })
    .use(commonmark)
    .use(gfm)

  previewInstance.create()
}

function updateSplitPreview() {
  if (!tab.value) return
  editorStore.updateContent(props.tabId, splitTextarea.value)

  if (splitPreviewEl.value) {
    destroySplitPreview()
    createSplitPreview()
  }
}

function destroyEditor() {
  if (editorInstance) {
    editorInstance.destroy(true).catch(() => {})
    editorInstance = null
    editorView = null
  }
}

function destroySplitPreview() {
  if (splitPreviewInstance) {
    splitPreviewInstance.destroy(true).catch(() => {})
    splitPreviewInstance = null
  }
}

function destroyPreview() {
  if (previewInstance) {
    previewInstance.destroy(true).catch(() => {})
    previewInstance = null
  }
}

function setMode(mode: MarkdownMode) {
  if (!tab.value) return
  editorStore.setMarkdownMode(props.tabId, mode)
}

function modeIcon(mode: MarkdownMode): Component {
  const icons: Record<MarkdownMode, Component> = {
    wysiwyg: DocumentEdit24Regular,
    split: SplitHorizontal24Regular,
    edit: Code24Regular,
    preview: Eye24Regular,
  }
  return icons[mode]
}

function exec(cmd: (state: any, dispatch?: any) => boolean) {
  if (!editorView) return
  cmd(editorView.state, editorView.dispatch)
  editorView.dom.focus({ preventScroll: true } as any)
}

const textareaModes = ['split', 'edit'] as MarkdownMode[]

function isTextareaMode(): boolean {
  return tab.value ? textareaModes.includes(tab.value.markdownMode) : false
}

function getActiveTextarea(): HTMLTextAreaElement | null {
  if (!tab.value) return null
  if (tab.value.markdownMode === 'split') return splitTextareaEl.value ?? null
  if (tab.value.markdownMode === 'edit') return editTextareaEl.value ?? null
  return null
}

function getScrollContainer(el: HTMLElement): HTMLElement | null {
  const scrollbar = el.closest('.n-scrollbar')
  if (!scrollbar) return null
  return scrollbar.querySelector('.n-scrollbar-container') as HTMLElement | null
}

function textareaWrap(prefix: string, suffix: string) {
  const el = getActiveTextarea()
  if (!el || !tab.value) return
  const scrollContainer = getScrollContainer(el)
  const savedScrollTop = scrollContainer?.scrollTop ?? 0
  const start = el.selectionStart
  const end = el.selectionEnd
  const value = el.value
  const selected = value.slice(start, end)
  const replaced = prefix + selected + suffix
  const newValue = value.slice(0, start) + replaced + value.slice(end)
  const storeKey = tab.value.markdownMode === 'split' ? splitTextarea : editTextareaValue
  storeKey.value = newValue
  nextTick(() => {
    el.selectionStart = start + prefix.length
    el.selectionEnd = start + prefix.length + selected.length
    el.focus({ preventScroll: true } as any)
    autoResize(el)
    updateTextareaContent()
    if (scrollContainer) {
      requestAnimationFrame(() => {
        scrollContainer.scrollTop = savedScrollTop
      })
    }
  })
}

function textareaLinePrefix(prefix: string) {
  const el = getActiveTextarea()
  if (!el || !tab.value) return
  const scrollContainer = getScrollContainer(el)
  const savedScrollTop = scrollContainer?.scrollTop ?? 0
  const start = el.selectionStart
  const value = el.value
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const end = value.indexOf('\n', start)
  const lineEnd = end === -1 ? value.length : end
  const lineContent = value.slice(lineStart, lineEnd)
  const newLine = prefix + lineContent
  const newValue = value.slice(0, lineStart) + newLine + value.slice(lineEnd)
  const storeKey = tab.value.markdownMode === 'split' ? splitTextarea : editTextareaValue
  storeKey.value = newValue
  nextTick(() => {
    const newPos = lineStart + newLine.length
    el.selectionStart = newPos
    el.selectionEnd = newPos
    el.focus({ preventScroll: true } as any)
    autoResize(el)
    updateTextareaContent()
    if (scrollContainer) {
      requestAnimationFrame(() => {
        scrollContainer.scrollTop = savedScrollTop
      })
    }
  })
}

function updateTextareaContent() {
  if (!tab.value) return
  if (tab.value.markdownMode === 'split') {
    editorStore.updateContent(props.tabId, splitTextarea.value)
  } else if (tab.value.markdownMode === 'edit') {
    editorStore.updateContent(props.tabId, editTextareaValue.value)
  }
}

function toggleBold() {
  if (isTextareaMode()) { textareaWrap('**', '**'); return }
  if (!editorView) return
  exec(toggleMark(editorView.state.schema.marks.strong))
}

function toggleItalic() {
  if (isTextareaMode()) { textareaWrap('*', '*'); return }
  if (!editorView) return
  exec(toggleMark(editorView.state.schema.marks.emphasis))
}

function toggleStrikethrough() {
  if (isTextareaMode()) { textareaWrap('~~', '~~'); return }
  if (!editorView) return
  const strike = editorView.state.schema.marks.strike_through
  if (strike) exec(toggleMark(strike))
}

function toggleInlineCode() {
  if (isTextareaMode()) { textareaWrap('`', '`'); return }
  if (!editorView) return
  exec(toggleMark(editorView.state.schema.marks.inlineCode))
}

function setHeading(level: number) {
  if (isTextareaMode()) { textareaLinePrefix('#'.repeat(level) + ' '); return }
  if (!editorView) return
  exec(setBlockType(editorView.state.schema.nodes.heading, { level }))
}

function toggleBulletList() {
  if (isTextareaMode()) { textareaLinePrefix('- '); return }
  if (!editorView) return
  exec(wrapIn(editorView.state.schema.nodes.bullet_list))
}

function toggleOrderedList() {
  if (isTextareaMode()) { textareaLinePrefix('1. '); return }
  if (!editorView) return
  exec(wrapIn(editorView.state.schema.nodes.ordered_list))
}

function toggleBlockquote() {
  if (isTextareaMode()) { textareaLinePrefix('> '); return }
  if (!editorView) return
  exec(wrapIn(editorView.state.schema.nodes.blockquote))
}

function insertLink() {
  if (isTextareaMode()) {
    const el = getActiveTextarea()
    if (!el || !tab.value) return
    const selected = el.value.slice(el.selectionStart, el.selectionEnd)
    linkTextInput.value = selected
    linkUrlInput.value = ''
    linkInsertMode = 'textarea'
    showLinkModal.value = true
    return
  }
  if (!editorView) return
  const { from, to } = editorView.state.selection
  const selected = from < to ? editorView.state.doc.textBetween(from, to) : ''
  linkTextInput.value = selected
  linkUrlInput.value = ''
  linkInsertMode = 'wysiwyg'
  showLinkModal.value = true
}

function confirmInsertLink() {
  const text = linkTextInput.value
  const url = linkUrlInput.value
  if (!url) return
  if (!text) return

  if (linkInsertMode === 'textarea') {
    const el = getActiveTextarea()
    if (!el || !tab.value) return
    const scrollContainer = getScrollContainer(el)
    const savedScrollTop = scrollContainer?.scrollTop ?? 0
    const start = el.selectionStart
    const end = el.selectionEnd
    const value = el.value
    const replacement = '[' + text + '](' + url + ')'
    const newValue = value.slice(0, start) + replacement + value.slice(end)
    const storeKey = tab.value.markdownMode === 'split' ? splitTextarea : editTextareaValue
    storeKey.value = newValue
    nextTick(() => {
      const pos = start + replacement.length
      el.selectionStart = pos
      el.selectionEnd = pos
      el.focus({ preventScroll: true } as any)
      autoResize(el)
      updateTextareaContent()
      if (scrollContainer) {
        requestAnimationFrame(() => {
          scrollContainer.scrollTop = savedScrollTop
        })
      }
    })
  } else if (linkInsertMode === 'wysiwyg') {
    if (!editorView) return
    const { state, dispatch } = editorView
    const { from, to } = state.selection
    let tr = state.tr
    if (from < to) {
      tr = tr.delete(from, to)
    }
    tr = tr.insertText(text, from)
    const linkMark = state.schema.marks.link?.create({ href: url })
    if (linkMark) {
      tr = tr.addMark(from, from + text.length, linkMark)
    }
    dispatch(tr.scrollIntoView())
    editorView.dom.focus({ preventScroll: true } as any)
  }

  showLinkModal.value = false
  linkInsertMode = null
}

function cancelInsertLink() {
  showLinkModal.value = false
  linkInsertMode = null
}

function insertHorizontalRule() {
  if (isTextareaMode()) { textareaLinePrefix('---\n'); return }
  if (!editorView) return
  const { state, dispatch } = editorView
  const hr = state.schema.nodes.horizontal_rule || state.schema.nodes.hr
  if (!hr) return
  const tr = state.tr.replaceSelectionWith(hr.create()).scrollIntoView()
  dispatch(tr)
  editorView.dom.focus({ preventScroll: true } as any)
}

function handleEditTextareaInput() {
  if (!tab.value) return
  editorStore.updateContent(props.tabId, editTextareaValue.value)
  autoResize(editTextareaEl.value)
}

function handleSplitTextareaInput() {
  if (!tab.value) return
  editorStore.updateContent(props.tabId, splitTextarea.value)
  autoResize(splitTextareaEl.value)
  updateSplitPreview()
}

async function handleSave() {
  try {
    await editorStore.saveFile(props.tabId)
    justSaved.value = true
    setTimeout(() => {
      justSaved.value = false
    }, 2000)
  } catch (err) {
    message.error(t('editor.message.saveFailed', { error: String(err) }))
  }
}

const shortcutLabels: Record<string, string> = {
  bold: 'Ctrl+B',
  italic: 'Ctrl+I',
  strikethrough: 'Ctrl+Shift+X',
  code: 'Ctrl+`',
  h1: 'Ctrl+1',
  h2: 'Ctrl+2',
  h3: 'Ctrl+3',
  bulletList: 'Ctrl+Shift+U',
  orderedList: 'Ctrl+Shift+O',
  blockquote: 'Ctrl+Shift+B',
  link: 'Ctrl+K',
  hr: 'Ctrl+Shift+H',
  save: 'Ctrl+S',
}

function isWysiwygFocused(): boolean {
  return !!editorRootEl.value?.contains(document.activeElement)
}

interface ShortcutDef {
  ctrl: boolean
  shift: boolean
  key: string
  action: () => void
  milkdown: boolean
}

const shortcutDefs: ShortcutDef[] = [
  { ctrl: true, shift: false, key: 'b', action: toggleBold, milkdown: true },
  { ctrl: true, shift: false, key: 'i', action: toggleItalic, milkdown: true },
  { ctrl: true, shift: true,  key: 'b', action: toggleBlockquote, milkdown: true },
  { ctrl: true, shift: true,  key: 'x', action: toggleStrikethrough, milkdown: false },
  { ctrl: true, shift: false, key: '`', action: toggleInlineCode, milkdown: false },
  { ctrl: true, shift: false, key: '1', action: () => setHeading(1), milkdown: false },
  { ctrl: true, shift: false, key: '2', action: () => setHeading(2), milkdown: false },
  { ctrl: true, shift: false, key: '3', action: () => setHeading(3), milkdown: false },
  { ctrl: true, shift: true,  key: 'u', action: toggleBulletList, milkdown: false },
  { ctrl: true, shift: true,  key: 'o', action: toggleOrderedList, milkdown: false },
  { ctrl: true, shift: false, key: 'k', action: insertLink, milkdown: false },
  { ctrl: true, shift: true,  key: 'h', action: insertHorizontalRule, milkdown: false },
]

function handleKeydown(e: KeyboardEvent) {
  const ctrl = e.ctrlKey || e.metaKey

  if (ctrl && e.key.toLowerCase() === 's') {
    e.preventDefault()
    handleSave()
    return
  }

  if (!tab.value) return

  const key = e.key.toLowerCase()
  const shift = e.shiftKey
  const inWysiwyg = isWysiwygFocused()

  for (const def of shortcutDefs) {
    if (ctrl === def.ctrl && shift === def.shift && key === def.key) {
      if (def.milkdown && inWysiwyg) continue
      e.preventDefault()
      def.action()
      return
    }
  }
}

const isDirty = ref(false)
watch(
  () => tab.value,
  (val) => {
    if (val) {
      isDirty.value = editorStore.isTabDirty(val)
    }
  },
  { deep: true },
)

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  tab.value = editorStore.tabs.find((t) => t.id === props.tabId) ?? null
  if (tab.value) {
    nextTick(() => initMode())
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  destroyEditor()
  destroySplitPreview()
  destroyPreview()
})
</script>

<template>
  <div class="markdown-editor" v-if="tab">
    <div class="editor-toolbar">
      <n-button-group size="small">
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button strong secondary round size="small" @click="toggleBold">
              <n-icon :component="TextBold24Regular" :size="18" />
            </n-button>
          </template>
          {{ $t('editor.label.format.bold') }} ({{ shortcutLabels.bold }})
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button strong secondary round size="small" @click="toggleItalic">
              <n-icon :component="TextItalic24Regular" :size="18" />
            </n-button>
          </template>
          {{ $t('editor.label.format.italic') }} ({{ shortcutLabels.italic }})
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button strong secondary round size="small" @click="toggleStrikethrough">
              <n-icon :component="TextStrikethrough24Regular" :size="18" />
            </n-button>
          </template>
          {{ $t('editor.label.format.strikethrough') }} ({{ shortcutLabels.strikethrough }})
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button strong secondary round size="small" @click="toggleInlineCode">
              <n-icon :component="Code24Regular" :size="18" />
            </n-button>
          </template>
          {{ $t('editor.label.format.code') }} ({{ shortcutLabels.code }})
        </n-tooltip>
      </n-button-group>

      <n-button-group size="small">
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button strong secondary round size="small" @click="setHeading(1)">
              <n-icon :component="TextHeader124Regular" :size="18" />
            </n-button>
          </template>
          {{ $t('editor.label.format.h1') }} ({{ shortcutLabels.h1 }})
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button strong secondary round size="small" @click="setHeading(2)">
              <n-icon :component="TextHeader220Regular" :size="18" />
            </n-button>
          </template>
          {{ $t('editor.label.format.h2') }} ({{ shortcutLabels.h2 }})
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button strong secondary round size="small" @click="setHeading(3)">
              <n-icon :component="TextHeader320Regular" :size="18" />
            </n-button>
          </template>
          {{ $t('editor.label.format.h3') }} ({{ shortcutLabels.h3 }})
        </n-tooltip>
      </n-button-group>

      <n-button-group size="small">
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button strong secondary round size="small" @click="toggleBulletList">
              <n-icon :component="TextBulletListSquare24Regular" :size="18" />
            </n-button>
          </template>
          {{ $t('editor.label.format.bulletList') }} ({{ shortcutLabels.bulletList }})
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button strong secondary round size="small" @click="toggleOrderedList">
              <n-icon :component="TextNumberListLtr24Regular" :size="18" />
            </n-button>
          </template>
          {{ $t('editor.label.format.orderedList') }} ({{ shortcutLabels.orderedList }})
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button strong secondary round size="small" @click="toggleBlockquote">
              <n-icon :component="TextQuote24Regular" :size="18" />
            </n-button>
          </template>
          {{ $t('editor.label.format.blockquote') }} ({{ shortcutLabels.blockquote }})
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button strong secondary round size="small" @click="insertLink">
              <n-icon :component="Link24Regular" :size="18" />
            </n-button>
          </template>
          {{ $t('editor.label.format.link') }} ({{ shortcutLabels.link }})
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button strong secondary round size="small" @click="insertHorizontalRule">
              <n-icon :component="LineHorizontal320Regular" :size="18" />
            </n-button>
          </template>
          {{ $t('editor.label.format.hr') }} ({{ shortcutLabels.hr }})
        </n-tooltip>
      </n-button-group>

      <div class="toolbar-spacer" />

      <n-button-group size="small">
        <n-tooltip
          v-for="mode in (['wysiwyg', 'split', 'edit', 'preview'] as MarkdownMode[])"
          :key="mode"
          trigger="hover"
        >
          <template #trigger>
            <n-button
              strong secondary round
              :type="tab.markdownMode === mode ? 'primary' : 'default'"
              @click="setMode(mode)"
              size="small"
            >
              <n-icon :component="modeIcon(mode)" :size="18" />
            </n-button>
          </template>
          {{ $t('editor.label.mode.' + mode) }}
        </n-tooltip>
      </n-button-group>

      <n-tooltip trigger="hover">
        <template #trigger>
          <n-button
            strong secondary round
            size="small"
            @click="handleSave"
            :type="isDirty ? 'warning' : 'default'"
          >
            <n-icon :component="justSaved ? CheckmarkCircle24Regular : Save24Regular" :size="18" />
          </n-button>
        </template>
        {{ justSaved ? $t('editor.message.saved') : $t('editor.action.save') }} ({{ shortcutLabels.save }})
      </n-tooltip>
    </div>

    <div class="editor-content" v-show="tab.markdownMode === 'wysiwyg'">
      <n-scrollbar style="height: 100%">
        <div ref="editorRootEl" class="milkdown-wrapper" />
      </n-scrollbar>
    </div>

    <div class="editor-content split-layout" v-show="tab.markdownMode === 'split'">
      <div class="split-pane">
        <n-scrollbar style="height: 100%">
          <textarea
            ref="splitTextareaEl"
            v-model="splitTextarea"
            @input="handleSplitTextareaInput"
            class="markdown-textarea"
            spellcheck="false"
          />
        </n-scrollbar>
      </div>
      <div class="split-divider" />
      <div class="split-pane">
        <n-scrollbar style="height: 100%">
          <div ref="splitPreviewEl" class="milkdown-wrapper" />
        </n-scrollbar>
      </div>
    </div>

    <div class="editor-content" v-show="tab.markdownMode === 'edit'">
      <n-scrollbar style="height: 100%">
        <textarea
          ref="editTextareaEl"
          v-model="editTextareaValue"
          @input="handleEditTextareaInput"
          class="markdown-textarea"
          spellcheck="false"
        />
      </n-scrollbar>
    </div>

    <div class="editor-content" v-show="tab.markdownMode === 'preview'">
      <n-scrollbar style="height: 100%">
        <div ref="previewRootEl" class="milkdown-wrapper" />
      </n-scrollbar>
    </div>

    <n-modal v-model:show="showLinkModal" preset="card"
      :title="$t('editor.label.insertLink')" :mask-closable="false" style="width: 420px">
      <n-space vertical>
        <n-input v-model:value="linkTextInput" :placeholder="$t('editor.label.linkText')" />
        <n-input v-model:value="linkUrlInput" :placeholder="$t('editor.label.linkUrl')"
          @keydown.enter="confirmInsertLink" />
      </n-space>
      <template #footer>
        <n-space justify="end">
          <n-button @click="cancelInsertLink">{{ $t('editor.action.cancel') }}</n-button>
          <n-button type="primary" @click="confirmInsertLink">{{ $t('editor.action.confirm') }}</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.markdown-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  row-gap: 4px;
  border-bottom: 1px solid var(--n-border-color);
  background: var(--n-color-embedded);
  flex-shrink: 0;
}

.toolbar-spacer {
  flex: 1;
}

.editor-content {
  flex: 1;
  overflow: hidden;
}

.milkdown-wrapper {
  min-height: 100%;
  padding: 16px 24px;
}

.split-layout {
  display: flex;
  flex-direction: row;
  overflow: hidden;
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

:deep(.milkdown) {
  max-width: 820px;
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
