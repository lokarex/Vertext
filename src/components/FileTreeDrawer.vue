<script setup lang="ts">
/**
 * Repository file tree drawer that displays the directory/file hierarchy of the
 * selected repository. Supports file selection, rename, delete, new file/folder,
 * and refresh operations with modal confirmation dialogs.
 */
import { NDrawer, NDrawerContent, NIcon, NButtonGroup, NTree, NModal, NInput, NSpace, NTooltip, NButton, NSpin, NScrollbar, useMessage } from 'naive-ui'
import { ref, watch, computed, h, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { PanelRightExpand20Regular, DocumentAdd20Regular, FolderAdd20Regular, Rename20Regular, Delete20Regular, ArrowSync20Regular } from '@vicons/fluent'
import { useRepositoriesStore } from '@/stores/repositories'
import { useNavigationStore } from '@/stores/navigation'
import { useEditorStore } from '@/stores/editor'
import { useI18n } from 'vue-i18n'
import type { FileEntry } from '@/models/FileEntry'
import { attachIcons, getFileEntryIcon } from '@/composables/useFileTreeIcons'
import { findNodeByKey, removeNodeFromTree, getTargetParentDir, addNewEntryToTree, updateChildKeys } from '@/utils/fileTree'
import { useErrorHandler } from '@/composables/useErrorHandler'

const { t } = useI18n()

const repositoriesStore = useRepositoriesStore()
const navigationStore = useNavigationStore()
const editorStore = useEditorStore()
const { handleError } = useErrorHandler()
const message = useMessage()

/** Currently selected tree node key (file/directory path) */
const selectedFileEntryKey = ref<string | null>(null)

/** Root-level file entries of the repository tree */
const fileTree = ref<FileEntry[]>([])
/** Indicates the tree is being loaded from the backend */
const isLoading = ref(false)
/** Error message if the last tree load failed */
const loadError = ref<string | null>(null)

/** Controls visibility of the rename entry modal */
const showRenameModal = ref(false)
/** New name input value for the rename modal */
const renameNewName = ref('')

/** Controls visibility of the new file modal */
const showNewFileModal = ref(false)
/** File name input value for the new file modal */
const newFileName = ref('')

/** Controls visibility of the new folder modal */
const showNewFolderModal = ref(false)
/** Folder name input value for the new folder modal */
const newFolderName = ref('')

/** Controls visibility of the delete confirmation modal */
const showDeleteModal = ref(false)

/** Opens the rename modal and pre-fills the input with the currently selected node's label */
function openRenameModal() {
  const node = findNodeByKey(fileTree.value, selectedFileEntryKey.value!)
  if (node) {
    renameNewName.value = node.label
    showRenameModal.value = true
  }
}

/**
 * Renames the selected tree entry on the backend and updates local tree state.
 * Marks the repository as unsynced if it was previously synced.
 */
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
    editorStore.updateTabsAfterRename(oldKey, newKey)
    if (!node.isLeaf) {
      updateChildKeys(node, oldKey, newKey)
    }
    node.label = name
    const newIcon = getFileEntryIcon(node)
    node.prefix = newIcon ? () => h(NIcon, { component: newIcon, size: 18 }) : undefined
    node.key = newKey
    selectedFileEntryKey.value = newKey
    showRenameModal.value = false
    if (repositoriesStore.selectedRepository && repositoriesStore.selectedRepository.status === 'synced') {
      await repositoriesStore.setStatus(repoName, 'unsynced')
    }
    message.success(t('fileTree.message.renameSuccess'))
  } catch (err) {
    handleError('fileTree.message.renameFailed', err)
  }
}

/**
 * Loads the file tree for a given repository from the backend.
 * @param repoName - Name of the repository to load
 */
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

/**
 * Handles tree node selection. If the selected node is a leaf (file),
 * opens it in the editor and navigates to the editor view.
 * @param keys - Array of selected tree keys
 */
async function handleFileEntrySelect(keys: string[]) {
  if (keys.length > 0) {
    selectedFileEntryKey.value = keys[0]
    const node = findNodeByKey(fileTree.value, keys[0])
    if (node && node.isLeaf) {
      const repoName = repositoriesStore.selectedRepository!.name
      const filePath = node.key
      const fileName = node.label
      try {
        await editorStore.openFile(repoName, filePath, fileName)
        repositoriesStore.fileTreeOpen = false
        navigationStore.toEditor()
      } catch (err) {
        handleError('editor.message.loadFailed', err)
      }
    }
  } else {
    selectedFileEntryKey.value = null
  }
}

/** Watches the selected repository and loads its file tree, opening the drawer on change */
const stopWatcher = watch(() => repositoriesStore.selectedRepository, (newRepo) => {
  if (newRepo) {
    loadFileTree(newRepo.name)
    selectedFileEntryKey.value = null
    repositoriesStore.fileTreeOpen = true
  } else {
    fileTree.value = []
    selectedFileEntryKey.value = null
    repositoriesStore.fileTreeOpen = false
  }
}, { immediate: true })

/** Whether the rename button should be disabled (no selection) */
const renameDisabled = computed(() => selectedFileEntryKey.value == null)
/** Whether the delete button should be disabled (no selection) */
const deleteDisabled = computed(() => selectedFileEntryKey.value == null)
/** Indicates an in-progress manual refresh operation */
const isRefreshing = ref(false)

/** Opens the delete confirmation modal for the currently selected entry */
function openDeleteModal() {
  showDeleteModal.value = true
}

/**
 * Deletes the selected tree entry on the backend and removes it from the local tree.
 * Marks the repository as unsynced if it was previously synced.
 */
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
    if (repositoriesStore.selectedRepository && repositoriesStore.selectedRepository.status === 'synced') {
      await repositoriesStore.setStatus(repoName, 'unsynced')
    }
    message.success(t('fileTree.message.deleteSuccess'))
  } catch (err) {
    handleError('fileTree.message.deleteFailed', err)
  }
}

/** Reloads the file tree from the backend and resets the current selection */
async function refreshFileTree() {
  if (!repositoriesStore.selectedRepository || isRefreshing.value) return
  isRefreshing.value = true
  try {
    await loadFileTree(repositoriesStore.selectedRepository.name)
    selectedFileEntryKey.value = null
    message.success(t('fileTree.message.refreshSuccess'))
  } catch (err) {
    handleError('fileTree.message.refreshFailed', err)
  } finally {
    isRefreshing.value = false
  }
}

/** Opens the new file modal, resetting the input value */
function openNewFileModal() {
  newFileName.value = ''
  showNewFileModal.value = true
}

/**
 * Creates a new file entry in the selected directory on the backend and
 * appends it to the local tree. Marks the repository as unsynced.
 */
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
    if (repositoriesStore.selectedRepository && repositoriesStore.selectedRepository.status === 'synced') {
      await repositoriesStore.setStatus(repoName, 'unsynced')
    }
    message.success(t('fileTree.message.fileCreateSuccess'))
  } catch (err) {
    handleError('fileTree.message.createFailed', err)
  }
}

/** Opens the new folder modal, resetting the input value */
function openNewFolderModal() {
  newFolderName.value = ''
  showNewFolderModal.value = true
}

/**
 * Creates a new directory entry in the selected directory on the backend and
 * appends it to the local tree. Marks the repository as unsynced.
 */
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
    if (repositoriesStore.selectedRepository && repositoriesStore.selectedRepository.status === 'synced') {
      await repositoriesStore.setStatus(repoName, 'unsynced')
    }
    message.success(t('fileTree.message.folderCreateSuccess'))
  } catch (err) {
    handleError('fileTree.message.createFailed', err)
  }
}

/** Stops the selected repository watcher when the component is destroyed */
onUnmounted(() => {
  stopWatcher()
})
</script>

<template>
    <n-drawer v-model:show="repositoriesStore.fileTreeOpen" :default-width="300" :min-width="300" :placement="'left'" resizable>
        <n-drawer-content>
            <div class="drawer-body">
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
                <n-scrollbar v-if="!isLoading && fileTree.length > 0" style="position: absolute">
                  <n-tree
                    :data="fileTree"
                    :selected-keys="selectedFileEntryKey ? [selectedFileEntryKey] : []"
                    @update:selected-keys="handleFileEntrySelect"
                    block-line
                    selectable
                    style="padding: 12px;"
                  />
                </n-scrollbar>
                <div v-else-if="!isLoading && loadError" class="file-tree-placeholder">
                  {{ $t('fileTree.message.loadFailed', { error: loadError }) }}
                </div>
                <div v-else-if="!isLoading && fileTree.length === 0" class="file-tree-placeholder">
                  {{ $t('fileTree.message.empty') }}
                </div>
              </n-spin>
            </div>
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
.drawer-body {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding-top: env(safe-area-inset-top, 0px);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    box-sizing: border-box;
}

.file-tree-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
}

.file-tree-toggle {
    margin-left: 10px;
}

.file-tree-toolbar {
    padding: 12px 16px 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.file-tree-body {
    flex: 1;
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
