<script setup lang="ts">
import { NCard, NGradientText, NButton, NDrawer, NDrawerContent, NIcon, NButtonGroup, NTree } from 'naive-ui';
import { ref, watch, computed, h } from 'vue'
import type { Component } from 'vue'
import { invoke } from '@tauri-apps/api/core';
import { PanelLeftExpand16Regular,PanelRightExpand20Regular, Settings20Regular } from '@vicons/fluent'
import { ReturnDownBackSharp, FolderSharp, DocumentSharp, CodeSlashSharp, CodeOutline, DocumentTextOutline, FileTrayOutline, ColorFilterSharp } from '@vicons/ionicons5';
import { RepositoriesManager } from '@/repositories';
import { ViewsManager } from '@/views';

interface FileEntry {
  key: string;
  label: string;
  isLeaf: boolean;
  children: FileEntry[];
  prefix?: () => any;
}

function getFileEntryIcon(entry: FileEntry): Component | null {
  if (!entry.isLeaf) {
    return FolderSharp;
  }
  const ext = entry.label.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'js':
      return CodeSlashSharp;
    case 'vue':
    case 'jsx':
    case 'tsx':
      return CodeOutline;
    case 'md':
      return DocumentTextOutline;
    case 'json':
      return FileTrayOutline;
    case 'css':
    case 'scss':
      return ColorFilterSharp;
    default:
      return DocumentSharp;
  }
}

const repositoriesManager = RepositoriesManager();
const viewsManager = ViewsManager();

const FileTree = ref<FileEntry[]>([]);

function attachIcons(nodes: FileEntry[]): FileEntry[] {
  return nodes.map((node) => {
    const icon = getFileEntryIcon(node);
    return {
      ...node,
      prefix: icon ? () => h(NIcon, { component: icon, size: 18 }) : undefined,
      children: node.children ? attachIcons(node.children) : []
    };
  });
}

const selectedFileKey = ref<string | null>(null);
const drawerActive = ref(false)

async function loadFileTree(repoName: string) {
  try {
    const data = await invoke<FileEntry[]>('list_repository_tree', { repoName });
    FileTree.value = attachIcons(data);
  } catch (err) {
    console.error('Failed to load file tree:', err);
    FileTree.value = [];
  }
}

function handleFileEntrySelect(keys: string[]) {
  if (keys.length > 0) {
    selectedFileKey.value = keys[0];
  } else {
    selectedFileKey.value = null;
  }
}

watch(() => repositoriesManager.selectedRepository, (newRepo) => {
  if (newRepo) {
    loadFileTree(newRepo.name);
    openDrawer();
  } else {
    FileTree.value = [];
    selectedFileKey.value = null;
    closeDrawer();
  }
});

function openDrawer() {
    drawerActive.value = true
}

function closeDrawer() {
    drawerActive.value = false
}
</script>

<template>
    <n-card class="header-card">
        <div class="header-content">
            <div class="header-left">
                <n-gradient-text type="primary" @click="viewsManager.toRepositoryList()" style="cursor: pointer">Vertext</n-gradient-text>
                <n-button-group style="margin-left: 3px;">
                    <n-button v-if="repositoriesManager.selectedRepository != null" @click="openDrawer" class="drawer-toggle" strong secondary round>
                        <n-icon :component="PanelLeftExpand16Regular" size="24" />
                    </n-button>
                    <n-button @click="viewsManager.toSettingsView()" strong secondary circle>
                        <n-icon :component="Settings20Regular" size="20" />
                    </n-button>
                </n-button-group>
            </div>

            <n-button strong secondary circle @click="viewsManager.toPreviousView()" :disabled="viewsManager.previousViews.length == 0">
                <n-icon :component="ReturnDownBackSharp" size="18" />
            </n-button>
        </div>
    </n-card>

    <n-drawer v-model:show="drawerActive" :default-width="300" :min-width="300" :placement="'left'" resizable>
        <n-drawer-content>
            <div class="drawer-header">
                <h3 style="margin-left: 20px;">{{ repositoriesManager.selectedRepository?.name }}</h3>
                <n-button @click="closeDrawer" class="drawer-toggle" strong secondary round>
                    <n-icon :component="PanelRightExpand20Regular" size="24" />
                </n-button>
            </div>
            <n-tree
              :data="FileTree"
              :selected-keys="selectedFileKey ? [selectedFileKey] : []"
              @update:selected-keys="handleFileEntrySelect"
              block-line
              selectable
              style="flex: 1; overflow-y: auto; padding: 12px;"
            />
        </n-drawer-content>
    </n-drawer>
</template>

<style scoped>
.header-card {
    position: sticky;
    top: 0;
    z-index: 100;
}

.header-content {
    display: flex;
    justify-content: space-between;
}

.header-left {
    display: flex;
    align-items: center;
}

.drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

}

.drawer-toggle {
    margin-left: 10px;
}
</style>
