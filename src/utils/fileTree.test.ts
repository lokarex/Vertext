import { describe, it, expect } from 'vitest'
import {
  findNodeByKey,
  removeNodeFromTree,
  insertNodeSorted,
  getTargetParentDir,
  addNewEntryToTree,
  updateChildKeys,
} from '@/utils/fileTree'
import type { FileEntry } from '@/models/FileEntry'

function e(key: string, label: string, isLeaf: boolean, children: FileEntry[] = []): FileEntry {
  return { key, label, isLeaf, children }
}

describe('findNodeByKey', () => {
  const tree: FileEntry[] = [
    e('src', 'src', false, [e('src/index.ts', 'index.ts', true), e('src/utils.ts', 'utils.ts', true)]),
    e('README.md', 'README.md', true),
  ]

  it('finds root-level node', () => { expect(findNodeByKey(tree, 'README.md')?.label).toBe('README.md') })
  it('finds deeply nested node', () => { expect(findNodeByKey(tree, 'src/index.ts')?.label).toBe('index.ts') })
  it('returns null for non-existent key', () => { expect(findNodeByKey(tree, 'nonexistent')).toBeNull() })
  it('returns null for empty array', () => { expect(findNodeByKey([], 'key')).toBeNull() })

  it('finds node in sibling subtrees', () => {
    const t: FileEntry[] = [
      e('a', 'a', false, [e('a/x', 'x', true)]),
      e('b', 'b', false, [e('b/y', 'y', true)]),
    ]
    expect(findNodeByKey(t, 'b/y')?.label).toBe('y')
  })
})

describe('removeNodeFromTree', () => {
  it('removes root-level node', () => {
    const t: FileEntry[] = [e('a', 'a', true), e('b', 'b', true)]
    expect(removeNodeFromTree(t, 'a')).toBe(true)
    expect(t).toHaveLength(1)
  })

  it('removes deeply nested node', () => {
    const t: FileEntry[] = [e('dir', 'dir', false, [e('dir/a', 'a', true), e('dir/b', 'b', true)])]
    expect(removeNodeFromTree(t, 'dir/a')).toBe(true)
    expect(t[0].children).toHaveLength(1)
  })

  it('returns false for non-existent key', () => {
    expect(removeNodeFromTree([e('a', 'a', true)], 'x')).toBe(false)
  })

  it('returns false for empty array', () => {
    expect(removeNodeFromTree([], 'x')).toBe(false)
  })
})

describe('insertNodeSorted', () => {
  it('dirs come before files', () => {
    const c: FileEntry[] = [e('a.txt', 'a.txt', true)]
    expect(insertNodeSorted(c, e('z', 'z', false))[0].isLeaf).toBe(false)
  })

  it('directories sorted alphabetically', () => {
    const c: FileEntry[] = [e('z_dir', 'z_dir', false)]
    expect(insertNodeSorted(c, e('a_dir', 'a_dir', false))[0].label).toBe('a_dir')
  })

  it('files sorted alphabetically', () => {
    const c: FileEntry[] = [e('z.txt', 'z.txt', true)]
    expect(insertNodeSorted(c, e('a.txt', 'a.txt', true))[0].label).toBe('a.txt')
  })

  it('empty array returns new node only', () => {
    const n = e('a', 'a', true)
    expect(insertNodeSorted([], n)).toEqual([n])
  })

  it('mixing file into dir+file group', () => {
    const c: FileEntry[] = [e('z_dir', 'z_dir', false), e('z.txt', 'z.txt', true)]
    const r = insertNodeSorted(c, e('a.txt', 'a.txt', true))
    expect(r[0].isLeaf).toBe(false)
    expect(r[1].isLeaf).toBe(true)
    expect(r[2].isLeaf).toBe(true)
  })
})

describe('getTargetParentDir', () => {
  const tree: FileEntry[] = [
    e('docs', 'docs', false, [e('docs/readme.md', 'readme.md', true)]),
    e('src', 'src', false),
  ]

  it('returns empty string for null selectedKey', () => { expect(getTargetParentDir(tree, null)).toBe('') })
  it('returns parent dir for file key', () => { expect(getTargetParentDir(tree, 'docs/readme.md')).toBe('docs') })
  it('returns self for directory key', () => { expect(getTargetParentDir(tree, 'docs')).toBe('docs') })
  it('returns empty for non-existent key', () => { expect(getTargetParentDir(tree, 'nonexistent')).toBe('') })

  it('handles deeply nested file', () => {
    const t: FileEntry[] = [e('a', 'a', false, [e('a/b', 'b', false, [e('a/b/c.md', 'c.md', true)])])]
    expect(getTargetParentDir(t, 'a/b/c.md')).toBe('a/b')
  })
})

describe('addNewEntryToTree', () => {
  it('adds to root when parentKey is empty', () => {
    const t: FileEntry[] = [e('readme.md', 'readme.md', true)]
    const r = addNewEntryToTree(t, '', e('notes.md', 'notes.md', true))
    expect(r).toHaveLength(2)
  })

  it('adds to specific child directory', () => {
    const t: FileEntry[] = [e('dir', 'dir', false, [e('dir/a.txt', 'a.txt', true)])]
    const r = addNewEntryToTree(t, 'dir', e('dir/b.txt', 'b.txt', true))
    expect(r[0].children).toHaveLength(2)
  })

  it('returns original tree if parentKey not found', () => {
    const t: FileEntry[] = [e('a', 'a', true)]
    expect(addNewEntryToTree(t, 'nonexistent', e('b', 'b', true))).toEqual(t)
  })

  it('handles deeply nested parentKey', () => {
    const t: FileEntry[] = [e('a', 'a', false, [e('a/b', 'b', false, [])])]
    const r = addNewEntryToTree(t, 'a/b', e('a/b/c.md', 'c.md', true))
    expect(r[0].children[0].children).toHaveLength(1)
  })

  it('sorts after insertion', () => {
    const t: FileEntry[] = [e('dir', 'dir', false, [e('dir/c.txt', 'c.txt', true)])]
    const r = addNewEntryToTree(t, 'dir', e('dir/a.txt', 'a.txt', true))
    expect(r[0].children[0].label).toBe('a.txt')
  })
})

describe('updateChildKeys', () => {
  it('replaces root key prefix', () => {
    const n = e('old/a', 'a', false, [])
    updateChildKeys(n, 'old', 'new')
    expect(n.key).toBe('new/a')
  })

  it('replaces all children keys', () => {
    const n = e('old', 'old', false, [e('old/a', 'a', true), e('old/b', 'b', true)])
    updateChildKeys(n, 'old', 'new')
    expect(n.children[0].key).toBe('new/a')
    expect(n.children[1].key).toBe('new/b')
  })

  it('deeply nested structure', () => {
    const n = e('old', 'old', false, [e('old/dir', 'dir', false, [e('old/dir/deep.md', 'deep.md', true)])])
    updateChildKeys(n, 'old', 'new')
    expect(n.children[0].children[0].key).toBe('new/dir/deep.md')
  })

  it('leaves non-matching keys unchanged', () => {
    const n = e('keep', 'keep', false, [e('keep/a', 'a', true)])
    updateChildKeys(n, 'old', 'new')
    expect(n.key).toBe('keep')
    expect(n.children[0].key).toBe('keep/a')
  })
})
