import { describe, it, expect } from 'vitest'
import { getFileEntryIcon, attachIcons } from '@/composables/useFileTreeIcons'
import type { FileEntry } from '@/models/FileEntry'

function e(key: string, label: string, isLeaf: boolean, children: FileEntry[] = []): FileEntry {
  return { key, label, isLeaf, children }
}

describe('getFileEntryIcon', () => {
  it('directory returns FolderSharp', () => {
    expect(getFileEntryIcon(e('dir', 'dir', false))).toBeTruthy()
  })
  it('.ts returns CodeSlashSharp', () => {
    expect(getFileEntryIcon(e('app.ts', 'app.ts', true))).toBeTruthy()
  })
  it('.js returns CodeSlashSharp', () => {
    expect(getFileEntryIcon(e('app.js', 'app.js', true))).toBeTruthy()
  })
  it('.vue returns CodeOutline', () => {
    expect(getFileEntryIcon(e('App.vue', 'App.vue', true))).toBeTruthy()
  })
  it('.jsx returns CodeOutline', () => {
    expect(getFileEntryIcon(e('x.jsx', 'x.jsx', true))).toBeTruthy()
  })
  it('.tsx returns CodeOutline', () => {
    expect(getFileEntryIcon(e('x.tsx', 'x.tsx', true))).toBeTruthy()
  })
  it('.md returns DocumentTextOutline', () => {
    expect(getFileEntryIcon(e('readme.md', 'readme.md', true))).toBeTruthy()
  })
  it('.json returns FileTrayOutline', () => {
    expect(getFileEntryIcon(e('data.json', 'data.json', true))).toBeTruthy()
  })
  it('.css returns ColorFilterSharp', () => {
    expect(getFileEntryIcon(e('style.css', 'style.css', true))).toBeTruthy()
  })
  it('.scss returns ColorFilterSharp', () => {
    expect(getFileEntryIcon(e('style.scss', 'style.scss', true))).toBeTruthy()
  })
  it('unknown ext returns DocumentSharp', () => {
    expect(getFileEntryIcon(e('f.xyz', 'f.xyz', true))).toBeTruthy()
  })
  it('no ext returns DocumentSharp', () => {
    expect(getFileEntryIcon(e('Makefile', 'Makefile', true))).toBeTruthy()
  })
})

describe('attachIcons', () => {
  it('attaches prefix to file nodes', () => {
    const result = attachIcons([e('a.md', 'a.md', true)])
    expect(result[0].prefix).toBeDefined()
    expect(typeof result[0].prefix).toBe('function')
  })

  it('recursively attaches to children', () => {
    const result = attachIcons([e('dir', 'dir', false, [e('dir/a.md', 'a.md', true)])])
    expect(result[0].children[0].prefix).toBeDefined()
  })

  it('deeply nested', () => {
    const result = attachIcons([e('a', 'a', false, [e('a/b', 'b', false, [e('a/b/c.md', 'c.md', true)])])])
    expect(result[0].prefix).toBeDefined()
    expect(result[0].children[0].children[0].prefix).toBeDefined()
  })

  it('empty returns empty', () => {
    expect(attachIcons([])).toEqual([])
  })
})
