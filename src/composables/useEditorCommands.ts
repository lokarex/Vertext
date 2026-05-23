/**
 * @file Editor formatting commands composable.
 * Provides dual-mode formatting operations that work in both
 * plain textarea (markdown syntax injection) and ProseMirror
 * WYSIWYG (schema-based commands) environments.
 *
 * @see {@link https://prosemirror.net/docs/ref/#commands}
 */
import { nextTick } from 'vue'
import type { EditorView } from 'prosemirror-view'
import { toggleMark, setBlockType, wrapIn } from 'prosemirror-commands'

/**
 * Context dependencies injected into the editor commands composable
 * from the parent MarkdownEditor component.
 */
interface EditorCommandsContext {
  /** Returns the current ProseMirror EditorView, or null if unavailable. */
  getEditorView: () => EditorView | null
  /** Returns the current textarea element, or null in WYSIWYG mode. */
  getTextareaElement: () => HTMLTextAreaElement | null
  /** Whether the editor is currently in plain-text textarea mode. */
  isTextareaMode: () => boolean
  /** Returns the scroll container element for a given editor element. */
  getScrollContainer: (el: HTMLElement) => HTMLElement | null
}

/**
 * Adjusts a textarea's height to fit its content.
 * @param el - The textarea element to resize.
 */
function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

/**
 * Composable providing markdown formatting commands for the editor.
 * Each command works in both textarea and WYSIWYG modes, dispatching
 * to the appropriate implementation internally.
 *
 * @param ctx - Context providing access to editor view, textarea, and mode detection.
 * @returns An object with formatting command functions.
 */
export function useEditorCommands(ctx: EditorCommandsContext) {
  const { getEditorView, getTextareaElement, isTextareaMode, getScrollContainer } = ctx

  /**
   * Executes a ProseMirror command in WYSIWYG mode.
   * @param cmd - A ProseMirror command function (e.g. toggleMark).
   */
  function execWysiwyg(cmd: (state: any, dispatch?: any) => boolean) {
    const view = getEditorView()
    if (!view) return
    cmd(view.state, view.dispatch)
    view.dom.focus({ preventScroll: true } as any)
  }

  /**
   * Wraps the selected text in the textarea with a prefix and suffix.
   * @param prefix - Text to insert before the selection.
   * @param suffix - Text to insert after the selection.
   */
  function textareaWrap(prefix: string, suffix: string) {
    const el = getTextareaElement()
    if (!el) return
    const scrollContainer = getScrollContainer(el)
    const savedScrollTop = scrollContainer?.scrollTop ?? 0
    const start = el.selectionStart
    const end = el.selectionEnd
    const value = el.value
    const selected = value.slice(start, end)
    const replaced = prefix + selected + suffix
    const newValue = value.slice(0, start) + replaced + value.slice(end)
    el.value = newValue
    el.dispatchEvent(new Event('input', { bubbles: true }))
    nextTick(() => {
      el.selectionStart = start + prefix.length
      el.selectionEnd = start + prefix.length + selected.length
      el.focus({ preventScroll: true } as any)
      autoResize(el)
      if (scrollContainer) {
        scrollContainer.scrollTop = savedScrollTop
      }
    })
  }

  /**
   * Prepends a prefix to the current line in the textarea.
   * @param prefix - Text to insert at the start of the current line.
   */
  function textareaLinePrefix(prefix: string) {
    const el = getTextareaElement()
    if (!el) return
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
    el.value = newValue
    el.dispatchEvent(new Event('input', { bubbles: true }))
    nextTick(() => {
      const newPos = lineStart + newLine.length
      el.selectionStart = newPos
      el.selectionEnd = newPos
      el.focus({ preventScroll: true } as any)
      autoResize(el)
      if (scrollContainer) {
        scrollContainer.scrollTop = savedScrollTop
      }
    })
  }

  /** Toggles bold (strong) formatting. */
  function toggleBold() {
    if (isTextareaMode()) { textareaWrap('**', '**'); return }
    const view = getEditorView()
    if (!view) return
    execWysiwyg(toggleMark(view.state.schema.marks.strong))
  }

  /** Toggles italic (emphasis) formatting. */
  function toggleItalic() {
    if (isTextareaMode()) { textareaWrap('*', '*'); return }
    const view = getEditorView()
    if (!view) return
    execWysiwyg(toggleMark(view.state.schema.marks.emphasis))
  }

  /** Toggles strikethrough formatting. */
  function toggleStrikethrough() {
    if (isTextareaMode()) { textareaWrap('~~', '~~'); return }
    const view = getEditorView()
    if (!view) return
    const strike = view.state.schema.marks.strike_through
    if (strike) execWysiwyg(toggleMark(strike))
  }

  /** Toggles inline code formatting. */
  function toggleInlineCode() {
    if (isTextareaMode()) { textareaWrap('`', '`'); return }
    const view = getEditorView()
    if (!view) return
    execWysiwyg(toggleMark(view.state.schema.marks.inlineCode))
  }

  /**
   * Sets the current block to a heading level.
   * @param level - Heading level (1-6).
   */
  function setHeading(level: number) {
    if (isTextareaMode()) { textareaLinePrefix('#'.repeat(level) + ' '); return }
    const view = getEditorView()
    if (!view) return
    execWysiwyg(setBlockType(view.state.schema.nodes.heading, { level }))
  }

  /** Toggles bullet (unordered) list formatting. */
  function toggleBulletList() {
    if (isTextareaMode()) { textareaLinePrefix('- '); return }
    const view = getEditorView()
    if (!view) return
    execWysiwyg(wrapIn(view.state.schema.nodes.bullet_list))
  }

  /** Toggles ordered (numbered) list formatting. */
  function toggleOrderedList() {
    if (isTextareaMode()) { textareaLinePrefix('1. '); return }
    const view = getEditorView()
    if (!view) return
    execWysiwyg(wrapIn(view.state.schema.nodes.ordered_list))
  }

  /** Toggles blockquote formatting. */
  function toggleBlockquote() {
    if (isTextareaMode()) { textareaLinePrefix('> '); return }
    const view = getEditorView()
    if (!view) return
    execWysiwyg(wrapIn(view.state.schema.nodes.blockquote))
  }

  /**
   * Returns the currently selected text in either textarea or WYSIWYG mode.
   * @returns The selected text string, or an empty string if nothing is selected.
   */
  function getSelectedText(): string {
    if (isTextareaMode()) {
      const el = getTextareaElement()
      if (!el) return ''
      return el.value.slice(el.selectionStart, el.selectionEnd)
    }
    const view = getEditorView()
    if (!view) return ''
    const { from, to } = view.state.selection
    return from < to ? view.state.doc.textBetween(from, to) : ''
  }

  /**
   * Inserts a markdown link at the current selection.
   * If text is selected, it becomes the link text; otherwise a placeholder is used.
   *
   * @param text - The link display text.
   * @param url - The link target URL.
   */
  function insertLinkAtSelection(text: string, url: string) {
    if (isTextareaMode()) {
      const el = getTextareaElement()
      if (!el) return
      const scrollContainer = getScrollContainer(el)
      const savedScrollTop = scrollContainer?.scrollTop ?? 0
      const start = el.selectionStart
      const end = el.selectionEnd
      const value = el.value
      const replacement = '[' + text + '](' + url + ')'
      const newValue = value.slice(0, start) + replacement + value.slice(end)
      el.value = newValue
      el.dispatchEvent(new Event('input', { bubbles: true }))
      nextTick(() => {
        const pos = start + replacement.length
        el.selectionStart = pos
        el.selectionEnd = pos
        el.focus({ preventScroll: true } as any)
        autoResize(el)
        if (scrollContainer) {
          scrollContainer.scrollTop = savedScrollTop
        }
      })
      return
    }
    const view = getEditorView()
    if (!view) return
    const { state, dispatch } = view
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
    view.dom.focus({ preventScroll: true } as any)
  }

  /** Inserts a horizontal rule (`---`) at the current position. */
  function insertHorizontalRule() {
    if (isTextareaMode()) { textareaLinePrefix('---\n'); return }
    const view = getEditorView()
    if (!view) return
    const { state, dispatch } = view
    const hr = state.schema.nodes.horizontal_rule || state.schema.nodes.hr
    if (!hr) return
    const tr = state.tr.replaceSelectionWith(hr.create()).scrollIntoView()
    dispatch(tr)
    view.dom.focus({ preventScroll: true } as any)
  }

  /**
   * Inserts an image at the current cursor position.
   * @param src - The image source URL or base64 data URL.
   * @param alt - Alternative text for the image.
   */
  function insertImage(src: string, alt?: string) {
    if (isTextareaMode()) {
      const el = getTextareaElement()
      if (!el) return
      const scrollContainer = getScrollContainer(el)
      const savedScrollTop = scrollContainer?.scrollTop ?? 0
      const start = el.selectionStart
      const end = el.selectionEnd
      const value = el.value
      const replacement = '![' + (alt || 'image') + '](' + src + ')'
      const newValue = value.slice(0, start) + replacement + value.slice(end)
      el.value = newValue
      el.dispatchEvent(new Event('input', { bubbles: true }))
      nextTick(() => {
        const pos = start + replacement.length
        el.selectionStart = pos
        el.selectionEnd = pos
        el.focus({ preventScroll: true } as any)
        autoResize(el)
        if (scrollContainer) {
          scrollContainer.scrollTop = savedScrollTop
        }
      })
      return
    }
    const view = getEditorView()
    if (!view) return
    const { state, dispatch } = view
    const imageNode = state.schema.nodes.image.create({ src, alt: alt || '', title: '' })
    const tr = state.tr.replaceSelectionWith(imageNode).scrollIntoView()
    dispatch(tr)
    view.dom.focus({ preventScroll: true } as any)
  }

  return {
    toggleBold,
    toggleItalic,
    toggleStrikethrough,
    toggleInlineCode,
    setHeading,
    toggleBulletList,
    toggleOrderedList,
    toggleBlockquote,
    getSelectedText,
    insertLinkAtSelection,
    insertHorizontalRule,
    insertImage,
  }
}
