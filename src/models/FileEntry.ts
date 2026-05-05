import type { h } from 'vue'

export interface FileEntry {
  key: string
  label: string
  isLeaf: boolean
  children: FileEntry[]
  prefix?: () => ReturnType<typeof h>
}
