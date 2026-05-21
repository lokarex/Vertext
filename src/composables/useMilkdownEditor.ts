/**
 * @file Milkdown markdown editor composable.
 * Provides lifecycle management ({@link create}, {@link destroy})
 * for a Milkdown editor instance with GFM, clipboard, history,
 * cursor, and listener plugins.
 */
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

/**
 * Options for creating a Milkdown editor instance.
 */
export interface MilkdownEditorOptions {
  /** Whether the editor content is user-editable. */
  editable: boolean
  /** Optional callback invoked whenever the markdown content changes. */
  onUpdate?: (markdown: string) => void
}

/**
 * A composable that manages a Milkdown editor lifecycle.
 *
 * @returns An object with {@link create}, {@link destroy}, and the {@link editorView} shallow ref.
 */
export function useMilkdownEditor() {
  /** The Milkdown {@link Editor} instance. */
  const instance = shallowRef<Editor | null>(null)
  /** The underlying ProseMirror {@link EditorView}. */
  const editorView = shallowRef<EditorView | null>(null)

  /**
   * Creates a new Milkdown editor inside the given container.
   * Destroys any previous instance first.
   *
   * @param container - The DOM element to render the editor into.
   * @param content - Initial markdown string content.
   * @param options - Editor configuration options.
   */
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

  /**
   * Destroys the current editor instance and cleans up resources.
   */
  async function destroy() {
    if (instance.value) {
      await instance.value.destroy(true).catch(() => {})
      instance.value = null
      editorView.value = null
    }
  }

  return { create, destroy, editorView }
}
