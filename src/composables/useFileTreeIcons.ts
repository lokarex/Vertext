import { h } from 'vue'
import type { Component } from 'vue'
import { NIcon } from 'naive-ui'
import { FolderSharp, DocumentSharp, CodeSlashSharp, CodeOutline, DocumentTextOutline, FileTrayOutline, ColorFilterSharp } from '@vicons/ionicons5'
import type { FileEntry } from '@/models/FileEntry'

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
