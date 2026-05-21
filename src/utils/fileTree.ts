/**
 * @file File tree utility functions.
 * Provides recursive tree traversal, manipulation, and sorting helpers
 * for the {@link FileEntry} node structure used by Naive UI's `n-tree`.
 */
import type { FileEntry } from '@/models/FileEntry'

/**
 * Recursively searches for a node with the given key in the file tree.
 *
 * @param nodes - Array of file tree nodes to search.
 * @param key - The key string to match.
 * @returns The matching node, or `null` if not found.
 */
export function findNodeByKey(nodes: FileEntry[], key: string): FileEntry | null {
  for (const node of nodes) {
    if (node.key === key) return node
    if (node.children.length > 0) {
      const found = findNodeByKey(node.children, key)
      if (found) return found
    }
  }
  return null
}

/**
 * Removes a node (and its subtree) from the file tree by key.
 *
 * @param nodes - Array of file tree nodes (mutated in place).
 * @param key - The key of the node to remove.
 * @returns `true` if a node was found and removed, `false` otherwise.
 */
export function removeNodeFromTree(nodes: FileEntry[], key: string): boolean {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].key === key) {
      nodes.splice(i, 1)
      return true
    }
    if (nodes[i].children.length > 0) {
      if (removeNodeFromTree(nodes[i].children, key)) {
        return true
      }
    }
  }
  return false
}

/**
 * Inserts a node into a sorted array of children.
 * Directories are sorted before files (leaves); within each group,
 * entries are sorted alphabetically by label.
 *
 * @param children - Existing sorted child nodes.
 * @param newNode - The new entry to insert.
 * @returns A new sorted array with the new node inserted.
 */
export function insertNodeSorted(children: FileEntry[], newNode: FileEntry): FileEntry[] {
  const updated = [...children, newNode]
  updated.sort((a, b) => {
    if (a.isLeaf !== b.isLeaf) {
      return a.isLeaf ? 1 : -1
    }
    return a.label.localeCompare(b.label)
  })
  return updated
}

/**
 * Returns the parent directory path for a given selected key.
 * If the selection is a directory, returns that directory's key.
 * If the selection is a file (leaf), returns its parent path.
 * If no key is selected, returns an empty string (root).
 *
 * @param nodes - The full file tree.
 * @param selectedKey - The currently selected node key, or `null`.
 * @returns The parent directory path (empty string for root).
 */
export function getTargetParentDir(nodes: FileEntry[], selectedKey: string | null): string {
  if (!selectedKey) return ''
  const node = findNodeByKey(nodes, selectedKey)
  if (!node) return ''
  if (node.isLeaf) {
    const parts = selectedKey.split('/')
    parts.pop()
    return parts.join('/')
  }
  return selectedKey
}

/**
 * Adds a new entry to the file tree at the specified parent path.
 * Creates a new immutable tree array with the entry inserted and sorted.
 *
 * @param nodes - The current file tree nodes.
 * @param parentKey - The parent directory key (empty string for root).
 * @param newEntry - The new file or directory entry to add.
 * @returns A new tree array with the entry inserted.
 */
export function addNewEntryToTree(nodes: FileEntry[], parentKey: string, newEntry: FileEntry): FileEntry[] {
  if (!parentKey) {
    return insertNodeSorted(nodes, newEntry)
  }
  const updated = nodes.map((node) => {
    if (node.key === parentKey) {
      return {
        ...node,
        children: insertNodeSorted(node.children, newEntry)
      }
    }
    if (node.children.length > 0) {
      return {
        ...node,
        children: addNewEntryToTree(node.children, parentKey, newEntry)
      }
    }
    return node
  })
  return updated
}

/**
 * Recursively updates all keys in a subtree by replacing a prefix.
 * Used after renaming a directory to update the keys of all descendants.
 *
 * @param node - The root node of the subtree to update (mutated in place).
 * @param oldPrefix - The old key prefix to replace.
 * @param newPrefix - The new key prefix.
 */
export function updateChildKeys(node: FileEntry, oldPrefix: string, newPrefix: string): void {
  if (node.key.startsWith(oldPrefix)) {
    node.key = node.key.replace(oldPrefix, newPrefix)
  }
  for (const child of node.children) {
    updateChildKeys(child, oldPrefix, newPrefix)
  }
}
