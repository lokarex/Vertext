import type { FileEntry } from '@/models/FileEntry'

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

export function updateChildKeys(node: FileEntry, oldPrefix: string, newPrefix: string): void {
  if (node.key.startsWith(oldPrefix)) {
    node.key = node.key.replace(oldPrefix, newPrefix)
  }
  for (const child of node.children) {
    updateChildKeys(child, oldPrefix, newPrefix)
  }
}
