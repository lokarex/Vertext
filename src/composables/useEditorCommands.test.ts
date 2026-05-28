import { describe, it, expect, vi } from 'vitest'
import { useEditorCommands } from '@/composables/useEditorCommands'

function mockTextarea(value: string, ss: number, se: number): HTMLTextAreaElement {
  const el = document.createElement('textarea')
  el.value = value
  Object.defineProperty(el, 'selectionStart', { value: ss, writable: true })
  Object.defineProperty(el, 'selectionEnd', { value: se, writable: true })
  el.dispatchEvent = vi.fn()
  el.focus = vi.fn()
  return el
}

function ctx(textarea: HTMLTextAreaElement | null, isTextarea = true) {
  return {
    getEditorView: () => null,
    getTextareaElement: () => textarea,
    isTextareaMode: () => isTextarea,
    getScrollContainer: () => null,
  }
}

const tick = () => new Promise(r => setTimeout(r, 0))

describe('useEditorCommands textarea mode', () => {
  describe('wrap commands', () => {
    it('toggleBold wraps selection with **', async () => {
      const el = mockTextarea('hello', 0, 5)
      const cmds = useEditorCommands(ctx(el) as any)
      cmds.toggleBold()
      await tick()
      expect(el.value).toBe('**hello**')
    })

    it('toggleBold inserts **** at cursor with no selection', async () => {
      const el = mockTextarea('hi', 1, 1)
      const cmds = useEditorCommands(ctx(el) as any)
      cmds.toggleBold()
      await tick()
      expect(el.value).toBe('h****i')
    })

    it('toggleItalic wraps with *', async () => {
      const el = mockTextarea('text', 0, 4)
      const cmds = useEditorCommands(ctx(el) as any)
      cmds.toggleItalic()
      await tick()
      expect(el.value).toBe('*text*')
    })

    it('toggleStrikethrough wraps with ~~', async () => {
      const el = mockTextarea('text', 0, 4)
      const cmds = useEditorCommands(ctx(el) as any)
      cmds.toggleStrikethrough()
      await tick()
      expect(el.value).toBe('~~text~~')
    })

    it('toggleInlineCode wraps with backtick', async () => {
      const el = mockTextarea('text', 0, 4)
      const cmds = useEditorCommands(ctx(el) as any)
      cmds.toggleInlineCode()
      await tick()
      expect(el.value).toBe('`text`')
    })
  })

  describe('line prefix commands', () => {
    it('setHeading(1) prepends #', async () => {
      const el = mockTextarea('hello', 2, 2)
      const cmds = useEditorCommands(ctx(el) as any)
      cmds.setHeading(1)
      await tick()
      expect(el.value).toBe('# hello')
    })

    it('setHeading(3) prepends ###', async () => {
      const el = mockTextarea('hello', 0, 5)
      const cmds = useEditorCommands(ctx(el) as any)
      cmds.setHeading(3)
      await tick()
      expect(el.value).toBe('### hello')
    })

    it('toggleBulletList prepends - ', async () => {
      const el = mockTextarea('item', 2, 2)
      const cmds = useEditorCommands(ctx(el) as any)
      cmds.toggleBulletList()
      await tick()
      expect(el.value).toBe('- item')
    })

    it('toggleOrderedList prepends 1. ', async () => {
      const el = mockTextarea('item', 2, 2)
      const cmds = useEditorCommands(ctx(el) as any)
      cmds.toggleOrderedList()
      await tick()
      expect(el.value).toBe('1. item')
    })

    it('toggleBlockquote prepends > ', async () => {
      const el = mockTextarea('quote', 2, 2)
      const cmds = useEditorCommands(ctx(el) as any)
      cmds.toggleBlockquote()
      await tick()
      expect(el.value).toBe('> quote')
    })

    it('insertHorizontalRule prepends ---\\n', async () => {
      const el = mockTextarea('content', 2, 2)
      const cmds = useEditorCommands(ctx(el) as any)
      cmds.insertHorizontalRule()
      await tick()
      expect(el.value).toBe('---\ncontent')
    })
  })

  describe('getSelectedText', () => {
    it('returns selected text', () => {
      const el = mockTextarea('hello world', 0, 5)
      expect(useEditorCommands(ctx(el) as any).getSelectedText()).toBe('hello')
    })

    it('returns empty when no selection', () => {
      const el = mockTextarea('hello', 2, 2)
      expect(useEditorCommands(ctx(el) as any).getSelectedText()).toBe('')
    })

    it('returns empty when textarea is null', () => {
      expect(useEditorCommands(ctx(null) as any).getSelectedText()).toBe('')
    })
  })

  describe('insertLinkAtSelection', () => {
    it('replaces selection with markdown link', async () => {
      const el = mockTextarea('click here', 6, 10)
      const cmds = useEditorCommands(ctx(el) as any)
      cmds.insertLinkAtSelection('link', 'https://x.com')
      await tick()
      expect(el.value).toBe('click [link](https://x.com)')
    })

    it('inserts link at cursor without selection', async () => {
      const el = mockTextarea('text', 2, 2)
      const cmds = useEditorCommands(ctx(el) as any)
      cmds.insertLinkAtSelection('a', 'http://b')
      await tick()
      expect(el.value).toBe('te[a](http://b)xt')
    })
  })

  describe('insertImage', () => {
    it('inserts image with alt text', async () => {
      const el = mockTextarea('text', 2, 2)
      const cmds = useEditorCommands(ctx(el) as any)
      cmds.insertImage('data:img', 'photo')
      await tick()
      expect(el.value).toBe('te![photo](data:img)xt')
    })

    it('inserts image with default alt', async () => {
      const el = mockTextarea('text', 2, 2)
      const cmds = useEditorCommands(ctx(el) as any)
      cmds.insertImage('data:img')
      await tick()
      expect(el.value).toBe('te![image](data:img)xt')
    })
  })

  describe('null safety', () => {
    it('toggleBold with null textarea does not throw', () => {
      const cmds = useEditorCommands(ctx(null) as any)
      expect(() => cmds.toggleBold()).not.toThrow()
    })
  })
})
