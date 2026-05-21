/**
 * @file File tree node model.
 * @interface FileEntry
 */

import type { h } from 'vue'

/**
 * Represents a node in the repository file tree.
 * Used with Naive UI's Tree (`n-tree`) component.
 */
export interface FileEntry {
  /** Unique path-based key used by the tree component for identification. */
  key: string
  /** Display label (typically the file or directory name). */
  label: string
  /** Whether this node is a leaf (file) rather than a directory. */
  isLeaf: boolean
  /** Child entries for directories; empty array for files. */
  children: FileEntry[]
  /** Optional render function for a prefix icon (e.g. folder/file type icon). */
  prefix?: () => ReturnType<typeof h>
}
