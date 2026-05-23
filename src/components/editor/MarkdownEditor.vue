<script setup lang="ts">
/**
 * Markdown editor toolbar component providing formatting buttons,
 * mode switching (wysiwyg / split / edit / preview), keyboard shortcuts,
 * save functionality, and link insertion modal.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { Component } from 'vue'
import { NButton, NButtonGroup, NIcon, NTooltip, NModal, NInput, NSpace, useMessage } from 'naive-ui'
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
  Image24Regular,
  LineHorizontal320Regular,
} from '@vicons/fluent'
import { useEditorStore } from '@/stores/editor'
import { useI18n } from 'vue-i18n'
import type { MarkdownMode } from '@/stores/editor'
import { useEditorCommands } from '@/composables/useEditorCommands'
import { fileToBase64 } from '@/utils/image'
import WysiwygEditor from './WysiwygEditor.vue'
import SplitEditor from './SplitEditor.vue'
import TextareaEditor from './TextareaEditor.vue'
import PreviewEditor from './PreviewEditor.vue'

/** @property tabId - Unique identifier of the editor tab to manage */
const props = defineProps<{
  tabId: string
}>()

const { t } = useI18n()
const editorStore = useEditorStore()
const message = useMessage()

/** Currently active tab data computed from the editor store */
const tab = computed(() => editorStore.tabs.find((t) => t.id === props.tabId) ?? null)

/** Ref to the WysiwygEditor child component instance */
const wysiwygRef = ref<InstanceType<typeof WysiwygEditor>>()
/** Ref to the SplitEditor child component instance */
const splitRef = ref<InstanceType<typeof SplitEditor>>()
/** Ref to the TextareaEditor child component instance */
const editRef = ref<InstanceType<typeof TextareaEditor>>()

/** Retrieves the ProseMirror editor view from the wysiwyg child, or null if unavailable */
const getEditorView = () => wysiwygRef.value?.getEditorView() ?? null
/** Retrieves the raw textarea element based on current mode (split or edit), or null */
const getTextareaElement = () => {
  if (!tab.value) return null
  if (tab.value.markdownMode === 'split') return splitRef.value?.getTextarea() ?? null
  if (tab.value.markdownMode === 'edit') return editRef.value?.getTextarea() ?? null
  return null
}
/** Returns true when the current tab is in split or edit mode (textarea-based modes) */
const isTextareaModeFn = () =>
  tab.value ? (['split', 'edit'] as MarkdownMode[]).includes(tab.value.markdownMode) : false

/** Finds the closest scroll container element from a given descendant element */
function getScrollContainer(el: HTMLElement): HTMLElement | null {
  const scrollbar = el.closest('.n-scrollbar')
  if (!scrollbar) return null
  return scrollbar.querySelector('.n-scrollbar-container') as HTMLElement | null
}

/** Composition of editor format commands adapted for wysiwyg and textarea modes */
const commands = useEditorCommands({
  getEditorView,
  getTextareaElement,
  isTextareaMode: isTextareaModeFn,
  getScrollContainer,
})

/** Indicates the file was just saved; used to show a brief checkmark icon */
const justSaved = ref(false)

/** Controls visibility of the insert-link modal */
const showLinkModal = ref(false)
/** Text label for the link being inserted */
const linkTextInput = ref('')
/** URL target for the link being inserted */
const linkUrlInput = ref('')

/** Hidden file input element for image insertion */
const imageInputRef = ref<HTMLInputElement>()

/** Opens the file picker for image insertion */
function openImagePicker() {
  imageInputRef.value?.click()
}

/** Handles image file selection from the hidden input */
async function onImageFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const dataUrl = await fileToBase64(file)
    commands.insertImage(dataUrl, file.name)
  } catch (err) {
    message.error(t('editor.message.saveFailed', { error: String(err) }))
  }
  input.value = ''
}

/** Opens the link insertion modal, pre-filling text with the current editor selection */
function openLinkModal() {
  linkTextInput.value = commands.getSelectedText()
  linkUrlInput.value = ''
  showLinkModal.value = true
}

/** Inserts a markdown link at the cursor/selection with the given text and URL from the modal */
function confirmInsertLink() {
  const text = linkTextInput.value
  const url = linkUrlInput.value
  if (!url || !text) return
  commands.insertLinkAtSelection(text, url)
  showLinkModal.value = false
}

/** Closes the link modal without inserting anything */
function cancelInsertLink() {
  showLinkModal.value = false
}

/** Saves the current tab's content to the filesystem via the editor store */
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

/**
 * Switches the current tab to the given editing mode.
 * @param mode - Target MarkdownMode to switch to
 */
function setMode(mode: MarkdownMode) {
  if (!tab.value) return
  editorStore.setMarkdownMode(props.tabId, mode)
}

/**
 * Returns the icon component corresponding to a given markdown mode.
 * @param mode - Target MarkdownMode
 * @returns The Fluent icon Component for that mode
 */
function modeIcon(mode: MarkdownMode): Component {
  const icons: Record<MarkdownMode, Component> = {
    wysiwyg: DocumentEdit24Regular,
    split: SplitHorizontal24Regular,
    edit: Code24Regular,
    preview: Eye24Regular,
  }
  return icons[mode]
}

/** Whether the current tab has unsaved modifications */
const isDirty = computed(() => {
  if (!tab.value) return false
  return editorStore.isTabDirty(tab.value)
})

/** Human-readable keyboard shortcut labels for toolbar tooltips */
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
  image: 'Ctrl+Shift+I',
  hr: 'Ctrl+Shift+H',
  save: 'Ctrl+S',
}

/** Checks whether the wysiwyg ProseMirror editor currently has focus */
function isWysiwygFocused(): boolean {
  return !!document.querySelector('.ProseMirror-focused')
}

/**
 * Defines a keyboard shortcut with modifiers and an action.
 * @property ctrl - Requires Ctrl/Meta modifier
 * @property shift - Requires Shift modifier
 * @property key - Expected key (lowercase)
 * @property action - Callback to invoke when the shortcut is matched
 * @property milkdown - If true, delegate to milkdown's native handler when wysiwyg is focused
 */
interface ShortcutDef {
  ctrl: boolean
  shift: boolean
  key: string
  action: () => void
  milkdown: boolean
}

/** Registered keyboard shortcut definitions with modifier keys, actions, and milkdown delegation flags */
const shortcutDefs: ShortcutDef[] = [
  { ctrl: true, shift: false, key: 'b', action: () => commands.toggleBold(), milkdown: true },
  { ctrl: true, shift: false, key: 'i', action: () => commands.toggleItalic(), milkdown: true },
  { ctrl: true, shift: true, key: 'b', action: () => commands.toggleBlockquote(), milkdown: true },
  { ctrl: true, shift: true, key: 'x', action: () => commands.toggleStrikethrough(), milkdown: false },
  { ctrl: true, shift: false, key: '`', action: () => commands.toggleInlineCode(), milkdown: false },
  { ctrl: true, shift: false, key: '1', action: () => commands.setHeading(1), milkdown: false },
  { ctrl: true, shift: false, key: '2', action: () => commands.setHeading(2), milkdown: false },
  { ctrl: true, shift: false, key: '3', action: () => commands.setHeading(3), milkdown: false },
  { ctrl: true, shift: true, key: 'u', action: () => commands.toggleBulletList(), milkdown: false },
  { ctrl: true, shift: true, key: 'o', action: () => commands.toggleOrderedList(), milkdown: false },
  { ctrl: true, shift: false, key: 'k', action: () => openLinkModal(), milkdown: false },
  { ctrl: true, shift: true, key: 'i', action: () => openImagePicker(), milkdown: false },
  { ctrl: true, shift: true, key: 'h', action: () => commands.insertHorizontalRule(), milkdown: false },
]

/**
 * Global keyboard handler dispatching shortcuts: Ctrl+S saves, others invoke formatting commands.
 * @param e - The native KeyboardEvent
 */
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

/** Registers the global keydown listener on mount */
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

/** Removes the global keydown listener on unmount */
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="markdown-editor" v-if="tab">
    <div class="editor-toolbar">
      <n-button-group size="small" v-show="tab.markdownMode !== 'preview'">
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button strong secondary round size="small" @click="commands.toggleBold()">
              <n-icon :component="TextBold24Regular" :size="18" />
            </n-button>
          </template>
          {{ $t('editor.label.format.bold') }} ({{ shortcutLabels.bold }})
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button strong secondary round size="small" @click="commands.toggleItalic()">
              <n-icon :component="TextItalic24Regular" :size="18" />
            </n-button>
          </template>
          {{ $t('editor.label.format.italic') }} ({{ shortcutLabels.italic }})
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button strong secondary round size="small" @click="commands.toggleStrikethrough()">
              <n-icon :component="TextStrikethrough24Regular" :size="18" />
            </n-button>
          </template>
          {{ $t('editor.label.format.strikethrough') }} ({{ shortcutLabels.strikethrough }})
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button strong secondary round size="small" @click="commands.toggleInlineCode()">
              <n-icon :component="Code24Regular" :size="18" />
            </n-button>
          </template>
          {{ $t('editor.label.format.code') }} ({{ shortcutLabels.code }})
        </n-tooltip>
      </n-button-group>

      <n-button-group size="small" v-show="tab.markdownMode !== 'preview'">
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button strong secondary round size="small" @click="commands.setHeading(1)">
              <n-icon :component="TextHeader124Regular" :size="18" />
            </n-button>
          </template>
          {{ $t('editor.label.format.h1') }} ({{ shortcutLabels.h1 }})
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button strong secondary round size="small" @click="commands.setHeading(2)">
              <n-icon :component="TextHeader220Regular" :size="18" />
            </n-button>
          </template>
          {{ $t('editor.label.format.h2') }} ({{ shortcutLabels.h2 }})
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button strong secondary round size="small" @click="commands.setHeading(3)">
              <n-icon :component="TextHeader320Regular" :size="18" />
            </n-button>
          </template>
          {{ $t('editor.label.format.h3') }} ({{ shortcutLabels.h3 }})
        </n-tooltip>
      </n-button-group>

      <n-button-group size="small" v-show="tab.markdownMode !== 'preview'">
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button strong secondary round size="small" @click="commands.toggleBulletList()">
              <n-icon :component="TextBulletListSquare24Regular" :size="18" />
            </n-button>
          </template>
          {{ $t('editor.label.format.bulletList') }} ({{ shortcutLabels.bulletList }})
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button strong secondary round size="small" @click="commands.toggleOrderedList()">
              <n-icon :component="TextNumberListLtr24Regular" :size="18" />
            </n-button>
          </template>
          {{ $t('editor.label.format.orderedList') }} ({{ shortcutLabels.orderedList }})
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button strong secondary round size="small" @click="commands.toggleBlockquote()">
              <n-icon :component="TextQuote24Regular" :size="18" />
            </n-button>
          </template>
          {{ $t('editor.label.format.blockquote') }} ({{ shortcutLabels.blockquote }})
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button strong secondary round size="small" @click="openLinkModal">
              <n-icon :component="Link24Regular" :size="18" />
            </n-button>
          </template>
          {{ $t('editor.label.format.link') }} ({{ shortcutLabels.link }})
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button strong secondary round size="small" @click="openImagePicker">
              <n-icon :component="Image24Regular" :size="18" />
            </n-button>
          </template>
          {{ $t('editor.label.format.image') }} ({{ shortcutLabels.image }})
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button strong secondary round size="small" @click="commands.insertHorizontalRule()">
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

      <div v-show="tab.markdownMode !== 'preview'">
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
    </div>

    <div class="editor-content" v-show="tab.markdownMode === 'wysiwyg'">
      <WysiwygEditor
        ref="wysiwygRef"
        :tabId="tabId"
        :active="tab.markdownMode === 'wysiwyg'"
      />
    </div>

    <div class="editor-content" v-show="tab.markdownMode === 'split'">
      <SplitEditor
        ref="splitRef"
        :tabId="tabId"
        :active="tab.markdownMode === 'split'"
      />
    </div>

    <div class="editor-content" v-show="tab.markdownMode === 'edit'">
      <TextareaEditor
        ref="editRef"
        :tabId="tabId"
        :active="tab.markdownMode === 'edit'"
      />
    </div>

    <div class="editor-content" v-show="tab.markdownMode === 'preview'">
      <PreviewEditor
        :tabId="tabId"
        :active="tab.markdownMode === 'preview'"
      />
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

    <input
      ref="imageInputRef"
      type="file"
      accept="image/*"
      style="display: none"
      @change="onImageFileSelected"
    />
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
</style>
