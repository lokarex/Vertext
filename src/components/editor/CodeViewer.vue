<script setup lang="ts">
import { computed } from 'vue'
import { NCode, NScrollbar } from 'naive-ui'
import { useEditorStore } from '@/stores/editor'

const props = defineProps<{
  tabId: string
}>()

const editorStore = useEditorStore()

const tab = computed(() => editorStore.tabs.find((t) => t.id === props.tabId) ?? null)
const code = computed(() => tab.value?.content ?? '')
const language = computed(() => {
  if (!tab.value) return 'text'
  return getLanguageFromFileName(tab.value.fileName)
})

function getLanguageFromFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    vue: 'html',
    rs: 'rust',
    py: 'python',
    css: 'css',
    scss: 'scss',
    less: 'less',
    html: 'html',
    htm: 'html',
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    md: 'markdown',
    mdx: 'markdown',
    sql: 'sql',
    sh: 'bash',
    bat: 'bash',
    ps1: 'powershell',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    java: 'java',
    go: 'go',
    rb: 'ruby',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    dart: 'dart',
    lua: 'lua',
    r: 'r',
    ini: 'ini',
    cfg: 'ini',
    conf: 'ini',
    gitignore: 'gitignore',
    env: 'ini',
    txt: 'text',
  }
  return map[ext] ?? 'text'
}
</script>

<template>
  <div class="code-viewer" v-if="tab">
    <div class="code-header">
      <span class="code-filename">{{ tab.fileName }}</span>
      <span class="code-lang">{{ language }}</span>
    </div>
    <div class="code-body">
      <n-scrollbar style="height: 100%">
        <n-code :code="code" :language="language" word-wrap />
      </n-scrollbar>
    </div>
  </div>
  <div class="code-viewer code-viewer-empty" v-else>
    <span>Loading...</span>
  </div>
</template>

<style scoped>
.code-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.code-viewer-empty {
  justify-content: center;
  align-items: center;
}

.code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  flex-shrink: 0;
  font-size: 1em;
}

.code-filename {
  font-weight: 500;
}

.code-lang {
  text-transform: uppercase;
  opacity: 0.7;
}

.code-body {
  flex: 1;
  overflow: hidden;
  padding: 16px;
}
</style>
