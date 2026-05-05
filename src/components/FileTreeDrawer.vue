<script setup lang="ts">
import { NDrawer, NDrawerContent, NIcon, NButtonGroup, NTree, NModal, NInput, NSpace, NTooltip, NButton, NSpin, useMessage } from 'naive-ui'
import { ref, watch, computed, h, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { PanelRightExpand20Regular, DocumentAdd20Regular, FolderAdd20Regular, Rename20Regular, Delete20Regular, ArrowSync20Regular } from '@vicons/fluent'
import { useRepositoriesStore } from '@/stores/repositories'
import { useI18n } from 'vue-i18n'
import type { FileEntry } from '@/models/FileEntry'
import { attachIcons, getFileEntryIcon } from '@/composables/useFileTreeIcons'
import { findNodeByKey, removeNodeFromTree, getTargetParentDir, addNewEntryToTree, updateChildKeys } from '@/utils/fileTree'

const { t } = useI18n()

const repositoriesStore = useRepositoriesStore()
const message = useMessage()

const selectedFileEntryKey = ref<string | null>(null)

const fileTree = ref<FileEntry[]>([])
const isLoading = ref(false)
const loadError = ref<string | null>(null)

const showRenameModal = ref(false)
const renameNewName = ref('')

const showNewFileModal = ref(false)
const newFileName = ref('')

const showNewFolderModal = ref(false)
const newFolderName = ref('')

const showDeleteModal = ref(false)

function openRenameModal() {
  const node = findNodeByKey(fileTree.value, selectedFileEntryKey.value!)
  if (node) {
    renameNewName.value = node.label
    showRenameModal.value = true
  }
}

async function confirmRename() {
  const name = renameNewName.value.trim()
  if (!name) {
    message.error(t('fileTree.message.nameEmpty'))
    return
  }
  const node = findNodeByKey(fileTree.value, selectedFileEntryKey.value!)
  if (!node) return
  if (name === node.label) {
    showRenameModal.value = false
    return
  }
  try {
    const repoName = repositoriesStore.selectedRepository!.name
    await invoke('rename_entry', { repoName, entryKey: selectedFileEntryKey.value, newName: name })
    const oldKey = node.key
    const parts = oldKey.split('/')
    parts.pop()
    parts.push(name)
    const newKey = parts.join('/')
    if (!node.isLeaf) {
      updateChildKeys(node, oldKey, newKey)
    }
    node.label = name
    node.key = newKey
    selectedFileEntryKey.value = newKey
    showRenameModal.value = false
    message.success(t('fileTree.message.renameSuccess'))
  } catch (err) {
    message.error(t('fileTree.message.renameFailed', { error: String(err) }))
  }
}

async function loadFileTree(repoName: string) {
  isLoading.value = true
  loadError.value = null
  try {
    const data = await invoke<FileEntry[]>('list_repository_tree', { repoName })
    fileTree.value = attachIcons(data)
  } catch (err) {
    loadError.value = String(err)
    fileTree.value = []
  } finally {
    isLoading.value = false
  }
}

function handleFileEntrySelect(keys: string[]) {
  if (keys.length > 0) {
    selectedFileEntryKey.value = keys[0]
  } else {
    selectedFileEntryKey.value = null
  }
}

const stopWatcher = watch(() => repositoriesStore.selectedRepository, (newRepo) => {
  if (newRepo) {
    loadFileTree(newRepo.name)
    repositoriesStore.fileTreeOpen = true
  } else {
    fileTree.value = []
    selectedFileEntryKey.value = null
    repositoriesStore.fileTreeOpen = false
  }
}, { immediate: true })

const renameDisabled = computed(() => selectedFileEntryKey.value == null)
const deleteDisabled = computed(() => selectedFileEntryKey.value == null)
const isRefreshing = ref(false)

function openDeleteModal() {
  showDeleteModal.value = true
}

async function confirmDelete() {
  const node = findNodeByKey(fileTree.value, selectedFileEntryKey.value!)
  if (!node) {
    showDeleteModal.value = false
    return
  }
  try {
    const repoName = repositoriesStore.selectedRepository!.name
    await invoke('delete_entry', { repoName, entryKey: selectedFileEntryKey.value })
    removeNodeFromTree(fileTree.value, selectedFileEntryKey.value!)
    selectedFileEntryKey.value = null
    showDeleteModal.value = false
    message.success(t('fileTree.message.deleteSuccess'))
  } catch (err) {
    message.error(t('fileTree.message.deleteFailed', { error: String(err) }))
  }
}

async function refreshFileTree() {
  if (!repositoriesStore.selectedRepository || isRefreshing.value) return
  isRefreshing.value = true
  try {
    await loadFileTree(repositoriesStore.selectedRepository.name)
    selectedFileEntryKey.value = null
    message.success(t('fileTree.message.refreshSuccess'))
  } catch (err) {
    message.error(t('fileTree.message.refreshFailed', { error: String(err) }))
  } finally {
    isRefreshing.value = false
  }
}

function openNewFileModal() {
  newFileName.value = ''
  showNewFileModal.value = true
}

async function confirmNewFile() {
  const name = newFileName.value.trim()
  if (!name) {
    message.error(t('fileTree.message.fileNameEmpty'))
    return
  }
  try {
    const repoName = repositoriesStore.selectedRepository!.name
    const parentPath = getTargetParentDir(fileTree.value, selectedFileEntryKey.value)
    await invoke('create_file_entry', { repoName, parentPath, fileName: name })
    const newEntry: FileEntry = {
      key: parentPath ? `${parentPath}/${name}` : name,
      label: name,
      isLeaf: true,
      children: [],
      prefix: () => h(NIcon, { component: getFileEntryIcon({ key: '', label: name, isLeaf: true, children: [] }) ?? undefined, size: 18 })
    }
    fileTree.value = addNewEntryToTree(fileTree.value, parentPath, newEntry)
    showNewFileModal.value = false
    message.success(t('fileTree.message.fileCreateSuccess'))
  } catch (err) {
    message.error(t('fileTree.message.createFailed', { error: String(err) }))
  }
}

function openNewFolderModal() {
  newFolderName.value = ''
  showNewFolderModal.value = true
}

async function confirmNewFolder() {
  const name = newFolderName.value.trim()
  if (!name) {
    message.error(t('fileTree.message.folderNameEmpty'))
    return
  }
  try {
    const repoName = repositoriesStore.selectedRepository!.name
    const parentPath = getTargetParentDir(fileTree.value, selectedFileEntryKey.value)
    await invoke('create_directory_entry', { repoName, parentPath, dirName: name })
    const newEntry: FileEntry = {
      key: parentPath ? `${parentPath}/${name}` : name,
      label: name,
      isLeaf: false,
      children: [],
      prefix: () => h(NIcon, { component: getFileEntryIcon({ key: '', label: name, isLeaf: false, children: [] }) ?? undefined, size: 18 })
    }
    fileTree.value = addNewEntryToTree(fileTree.value, parentPath, newEntry)
    showNewFolderModal.value = false
    message.success(t('fileTree.message.folderCreateSuccess'))
  } catch (err) {
    message.error(t('fileTree.message.createFailed', { error: String(err) }))
  }
}

onUnmounted(() => {
  stopWatcher()
})
</script>

<template>
    <n-drawer v-model:show="repositoriesStore.fileTreeOpen" :default-width="300" :min-width="300" :placement="'left'" resizable>
        <n-drawer-content>
            <div class="file-tree-header">
                <h3 style="margin-left: 20px;">{{ repositoriesStore.selectedRepository?.name }}</h3>
                <n-button @click="repositoriesStore.fileTreeOpen = false" class="file-tree-toggle" strong secondary round>
                    <n-icon :component="PanelRightExpand20Regular" size="24" />
                </n-button>
            </div>
            <div class="file-tree-toolbar">
              <n-button-group size="small">
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-button strong secondary round @click="openNewFileModal" :disabled="!repositoriesStore.selectedRepository">
                      <n-icon :component="DocumentAdd20Regular" :size="18" />
                    </n-button>
                  </template>
                  {{ $t('fileTree.action.newFile') }}
                </n-tooltip>
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-button strong secondary round @click="openNewFolderModal" :disabled="!repositoriesStore.selectedRepository">
                      <n-icon :component="FolderAdd20Regular" :size="18" />
                    </n-button>
                  </template>
                  {{ $t('fileTree.action.newFolder') }}
                </n-tooltip>
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-button strong secondary round @click="openRenameModal" :disabled="renameDisabled">
                      <n-icon :component="Rename20Regular" :size="18" />
                    </n-button>
                  </template>
                  {{ $t('fileTree.action.rename') }}
                </n-tooltip>
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-button strong secondary round @click="openDeleteModal" :disabled="deleteDisabled">
                      <n-icon :component="Delete20Regular" :size="18" />
                    </n-button>
                  </template>
                  {{ $t('fileTree.action.delete') }}
                </n-tooltip>
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-button strong secondary round @click="refreshFileTree" :disabled="!repositoriesStore.selectedRepository || isRefreshing">
                      <n-icon :component="ArrowSync20Regular" :size="18" />
                    </n-button>
                  </template>
                  {{ $t('fileTree.action.refresh') }}
                </n-tooltip>
              </n-button-group>
            </div>
            <n-spin :show="isLoading" class="file-tree-body">
              <n-tree
                v-if="!isLoading && fileTree.length > 0"
                :data="fileTree"
                :selected-keys="selectedFileEntryKey ? [selectedFileEntryKey] : []"
                @update:selected-keys="handleFileEntrySelect"
                block-line
                selectable
                style="flex: 1; overflow-y: auto; padding: 12px;"
              />
              <div v-else-if="!isLoading && loadError" class="file-tree-placeholder">
                {{ $t('fileTree.message.loadFailed', { error: loadError }) }}
              </div>
              <div v-else-if="!isLoading && fileTree.length === 0" class="file-tree-placeholder">
                {{ $t('fileTree.message.empty') }}
              </div>
            </n-spin>
        </n-drawer-content>
    </n-drawer>

    <n-modal v-model:show="showRenameModal" preset="card" :title="$t('fileTree.label.rename')" :mask-closable="false" style="width: 400px;">
      <n-input v-model:value="renameNewName" :placeholder="$t('fileTree.label.renamePlaceholder')" @keydown.enter="confirmRename" />
      <template #footer>
        <n-space justify="end">
          <n-button @click="showRenameModal = false; renameNewName = ''">{{ $t('fileTree.action.cancel') }}</n-button>
          <n-button type="primary" @click="confirmRename">{{ $t('fileTree.action.confirm') }}</n-button>
        </n-space>
      </template>
    </n-modal>

    <n-modal v-model:show="showDeleteModal" preset="card" :title="$t('fileTree.label.deleteConfirmTitle')" :mask-closable="false" style="width: 400px;">
      <p style="color: var(--n-text-color);">
        {{ $t('fileTree.message.deleteConfirm', { name: findNodeByKey(fileTree, selectedFileEntryKey!)?.label }) }}
      </p>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showDeleteModal = false">{{ $t('fileTree.action.cancel') }}</n-button>
          <n-button type="error" @click="confirmDelete">{{ $t('fileTree.action.delete') }}</n-button>
        </n-space>
      </template>
    </n-modal>

    <n-modal v-model:show="showNewFileModal" preset="card" :title="$t('fileTree.label.newFile')" :mask-closable="false" style="width: 400px;">
      <n-input v-model:value="newFileName" :placeholder="$t('fileTree.label.fileNamePlaceholder')" @keydown.enter="confirmNewFile" />
      <template #footer>
        <n-space justify="end">
          <n-button @click="showNewFileModal = false; newFileName = ''">{{ $t('fileTree.action.cancel') }}</n-button>
          <n-button type="primary" @click="confirmNewFile">{{ $t('fileTree.action.confirm') }}</n-button>
        </n-space>
      </template>
    </n-modal>

    <n-modal v-model:show="showNewFolderModal" preset="card" :title="$t('fileTree.label.newFolder')" :mask-closable="false" style="width: 400px;">
      <n-input v-model:value="newFolderName" :placeholder="$t('fileTree.label.folderNamePlaceholder')" @keydown.enter="confirmNewFolder" />
      <template #footer>
        <n-space justify="end">
          <n-button @click="showNewFolderModal = false; newFolderName = ''">{{ $t('fileTree.action.cancel') }}</n-button>
          <n-button type="primary" @click="confirmNewFolder">{{ $t('fileTree.action.confirm') }}</n-button>
        </n-space>
      </template>
    </n-modal>
</template>

<style scoped>
.file-tree-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.file-tree-toggle {
    margin-left: 10px;
}

.file-tree-toolbar {
    padding: 12px 16px 8px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.file-tree-body {
    flex: 1;
    display: flex;
}

.file-tree-placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    color: var(--n-text-color);
}
</style>
