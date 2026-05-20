import { shallowRef } from 'vue'
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx, editorViewCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { clipboard } from '@milkdown/kit/plugin/clipboard'
import { history } from '@milkdown/kit/plugin/history'
import { cursor } from '@milkdown/kit/plugin/cursor'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { nord } from '@milkdown/theme-nord'
import type { EditorView } from 'prosemirror-view'

export interface MilkdownEditorOptions {
  editable: boolean
  onUpdate?: (markdown: string) => void
}

export function useMilkdownEditor() {
  const instance = shallowRef<Editor | null>(null)
  const editorView = shallowRef<EditorView | null>(null)

  async function create(container: HTMLElement, content: string, options: MilkdownEditorOptions): Promise<void> {
    await destroy()

    let builder = Editor.make()
      .config((ctx: any) => {
        ctx.set(rootCtx, container)
        ctx.set(defaultValueCtx, content)
        if (!options.editable) {
          ctx.set(editorViewOptionsCtx, { editable: () => false })
        }
        if (options.onUpdate) {
          ctx.get(listenerCtx).markdownUpdated((_ctx: any, md: string) => {
            options.onUpdate!(md)
          })
        }
        nord(ctx)
      })
      .use(commonmark)
      .use(gfm)

    if (options.editable) {
      builder = builder.use(clipboard).use(history).use(cursor).use(listener)
    }

    instance.value = builder
    await instance.value.create()
    instance.value.action((ctx) => {
      editorView.value = ctx.get(editorViewCtx) ?? null
    })
  }

  async function destroy() {
    if (instance.value) {
      await instance.value.destroy(true).catch(() => {})
      instance.value = null
      editorView.value = null
    }
  }

  return { create, destroy, editorView }
}
