/**
 * @file File tree icon mapping composable.
 * Maps file extensions and entry types (directory vs file) to
 * corresponding Ionicons icons for display in the Naive UI tree.
 */
import { h } from 'vue'
import type { Component } from 'vue'
import { NIcon } from 'naive-ui'
import { FolderSharp, DocumentSharp, CodeSlashSharp, CodeOutline, DocumentTextOutline, FileTrayOutline, ColorFilterSharp } from '@vicons/ionicons5'
import type { FileEntry } from '@/models/FileEntry'

/**
 * Returns the appropriate icon component for a file tree entry.
 * Directories use a folder icon; files are mapped by extension.
 *
 * @param entry - The file tree entry to get an icon for.
 * @returns A Vue component for the icon, or `null` if no suitable icon is found.
 */
export function getFileEntryIcon(entry: FileEntry): Component | null {
  if (!entry.isLeaf) {
    return FolderSharp
  }
  const ext = entry.label.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ts':
    case 'js':
      return CodeSlashSharp
    case 'vue':
    case 'jsx':
    case 'tsx':
      return CodeOutline
    case 'md':
      return DocumentTextOutline
    case 'json':
      return FileTrayOutline
    case 'css':
    case 'scss':
      return ColorFilterSharp
    default:
      return DocumentSharp
  }
}

/**
 * Recursively attaches icon render functions to every node in a file tree.
 * Each node's {@link FileEntry.prefix | `prefix`} is set to a render function
 * that produces an {@link NIcon} component wrapped via `h()`.
 *
 * @param nodes - Array of file tree nodes (without icons).
 * @returns A new array with icon prefix functions attached to each node and its children.
 */
export function attachIcons(nodes: FileEntry[]): FileEntry[] {
  return nodes.map((node) => {
    const icon = getFileEntryIcon(node)
    return {
      ...node,
      prefix: icon ? () => h(NIcon, { component: icon, size: 18 }) : undefined,
      children: node.children ? attachIcons(node.children) : []
    }
  })
}
