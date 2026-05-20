import { nextTick } from 'vue'
import type { EditorView } from 'prosemirror-view'
import { toggleMark, setBlockType, wrapIn } from 'prosemirror-commands'

interface EditorCommandsContext {
  getEditorView: () => EditorView | null
  getTextareaElement: () => HTMLTextAreaElement | null
  isTextareaMode: () => boolean
  getScrollContainer: (el: HTMLElement) => HTMLElement | null
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

export function useEditorCommands(ctx: EditorCommandsContext) {
  const { getEditorView, getTextareaElement, isTextareaMode, getScrollContainer } = ctx

  function execWysiwyg(cmd: (state: any, dispatch?: any) => boolean) {
    const view = getEditorView()
    if (!view) return
    cmd(view.state, view.dispatch)
    view.dom.focus({ preventScroll: true } as any)
  }

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

  function toggleBold() {
    if (isTextareaMode()) { textareaWrap('**', '**'); return }
    const view = getEditorView()
    if (!view) return
    execWysiwyg(toggleMark(view.state.schema.marks.strong))
  }

  function toggleItalic() {
    if (isTextareaMode()) { textareaWrap('*', '*'); return }
    const view = getEditorView()
    if (!view) return
    execWysiwyg(toggleMark(view.state.schema.marks.emphasis))
  }

  function toggleStrikethrough() {
    if (isTextareaMode()) { textareaWrap('~~', '~~'); return }
    const view = getEditorView()
    if (!view) return
    const strike = view.state.schema.marks.strike_through
    if (strike) execWysiwyg(toggleMark(strike))
  }

  function toggleInlineCode() {
    if (isTextareaMode()) { textareaWrap('`', '`'); return }
    const view = getEditorView()
    if (!view) return
    execWysiwyg(toggleMark(view.state.schema.marks.inlineCode))
  }

  function setHeading(level: number) {
    if (isTextareaMode()) { textareaLinePrefix('#'.repeat(level) + ' '); return }
    const view = getEditorView()
    if (!view) return
    execWysiwyg(setBlockType(view.state.schema.nodes.heading, { level }))
  }

  function toggleBulletList() {
    if (isTextareaMode()) { textareaLinePrefix('- '); return }
    const view = getEditorView()
    if (!view) return
    execWysiwyg(wrapIn(view.state.schema.nodes.bullet_list))
  }

  function toggleOrderedList() {
    if (isTextareaMode()) { textareaLinePrefix('1. '); return }
    const view = getEditorView()
    if (!view) return
    execWysiwyg(wrapIn(view.state.schema.nodes.ordered_list))
  }

  function toggleBlockquote() {
    if (isTextareaMode()) { textareaLinePrefix('> '); return }
    const view = getEditorView()
    if (!view) return
    execWysiwyg(wrapIn(view.state.schema.nodes.blockquote))
  }

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
  }
}
