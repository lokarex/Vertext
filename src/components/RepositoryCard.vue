<script setup lang="ts">
import { computed, ref } from 'vue';
import { NCard, NIcon, NButton, NModal, NInput, NSpace, NAlert, NProgress, NTimeline, NTimelineItem, NTag, NScrollbar, NTooltip, useMessage } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { Folder24Regular, ChevronRight16Regular, ArrowSync20Regular, Settings20Regular, Delete20Regular, History20Regular, ArrowUndo20Regular } from '@vicons/fluent';
import { useRepositoriesStore } from '@/stores/repositories';
import type { Repository } from '@/models/Repository';
import type { CommitInfo } from '@/models/CommitInfo';
import { listen } from '@tauri-apps/api/event';
import { error } from '@tauri-apps/plugin-log';
import { invoke } from '@tauri-apps/api/core';

interface RepositoryCardProps {
    repository: Repository;
    width?: string;
}
const props = withDefaults(defineProps<RepositoryCardProps>(), {
    width: '440px'
});

const repositoriesStore = useRepositoriesStore();
const isSelected = computed(() => repositoriesStore.selectedRepository?.name == props.repository.name);
const handleClick = () => {
    if (isSelected.value) {
        repositoriesStore.selectedRepository = null;
        return;
    }

    repositoriesStore.selectedRepository = props.repository;
};

const { t } = useI18n();

const isExpanded = ref(false);
const showDeleteConfirmModal = ref(false);
const showConfigModal = ref(false);
const configRemoteUrl = ref('');
const configUserName = ref('');
const configPassword = ref('');
const configErrorMessage = ref('');
const isSyncing = ref(false);
const syncProgress = ref(0);
const syncStep = ref('');
const syncError = ref('');
const showHistory = ref(false);
const historyCommits = ref<CommitInfo[]>([]);
const historyLoading = ref(false);
const restoreTargetOid = ref<string | null>(null);

const handleToggleExpand = () => {
    isExpanded.value = !isExpanded.value;
};

const handleDelete = () => {
    showDeleteConfirmModal.value = false;
    repositoriesStore.deleteRepository(props.repository.name);
};

const handleSync = async () => {
    if (isSyncing.value) return;

    const repo = props.repository;
    if (!repo.remoteUrl || !repo.userName || !repo.password) {
        messageRef.error(t('repository.message.syncNotConfigured'));
        return;
    }

    isSyncing.value = true;
    syncProgress.value = 0;
    syncStep.value = t('repository.message.syncChecking');
    syncError.value = '';

    let unlisten: (() => void) | null = null;
    try {
        unlisten = await listen<{ step: string; message: string }>('sync-progress', (event) => {
            const { step, message } = event.payload;
            syncStep.value = message;

            switch (step) {
                case 'checking':
                    syncProgress.value = 10;
                    break;
                case 'committing':
                    syncProgress.value = 30;
                    break;
                case 'fetching':
                    syncProgress.value = 50;
                    break;
                case 'merging':
                    syncProgress.value = 70;
                    break;
                case 'pushing':
                    syncProgress.value = 90;
                    break;
                case 'done':
                    syncProgress.value = 100;
                    break;
            }

            if (step === 'done') {
                setTimeout(() => {
                    isSyncing.value = false;
                    syncProgress.value = 0;
                    syncStep.value = '';
                    messageRef.success(t('repository.message.syncSuccess'));
                }, 500);
            }
        });

        await repositoriesStore.syncRepository(repo.name);
    }
    catch (err) {
        error(`Sync failed: ${err}`);
        syncError.value = String(err);
        isSyncing.value = false;
        syncProgress.value = 0;
        messageRef.error(t('repository.message.syncFailed'));
    }
    finally {
        unlisten?.();
    }
};

const handleToggleHistory = async () => {
    showHistory.value = !showHistory.value;
    if (showHistory.value && historyCommits.value.length === 0) {
        historyLoading.value = true;
        try {
            historyCommits.value = await invoke<CommitInfo[]>('list_commit_history', {
                repoName: props.repository.name
            });
        } catch (err) {
            error(`Failed to load history: ${err}`);
        } finally {
            historyLoading.value = false;
        }
    }
};

function formatCommitTime(timestamp: number): string {
    const d = new Date(timestamp * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function handleConfirmRestore() {
    const oid = restoreTargetOid.value;
    if (!oid) return;
    restoreTargetOid.value = null;
    try {
        await invoke('restore_commit', {
            repoName: props.repository.name,
            commitOid: oid,
        });
        historyCommits.value = [];
        await handleToggleHistory();
        repositoriesStore.setStatus(props.repository.name, 'unsynced');
        messageRef.success(t('repository.message.restoreSuccess'));
    } catch (err) {
        error(`Restore failed: ${err}`);
        messageRef.error(t('repository.message.restoreFailed'));
    }
}

const messageRef = useMessage();

const handleConfigureRemote = () => {
    configRemoteUrl.value = props.repository.remoteUrl || '';
    configUserName.value = props.repository.userName || '';
    configPassword.value = props.repository.password || '';
    configErrorMessage.value = '';
    showConfigModal.value = true;
};

const handleSaveConfig = async () => {
    configErrorMessage.value = '';
    await repositoriesStore.configureRepository(
        props.repository.name,
        configRemoteUrl.value || null,
        configUserName.value || null,
        configPassword.value || null
    );
    showConfigModal.value = false;
};

const handleCancelConfig = () => {
    showConfigModal.value = false;
};

const statusText = computed(() => {
    switch (props.repository.status) {
        case 'synced': return t('repository.label.synced');
        case 'unsynced': return t('repository.label.unsynced');
        case 'unconfigured': return t('repository.label.unconfigured');
        default: return '';
    }
});

const statusColor = computed(() => {
    switch (props.repository.status) {
        case 'synced': return '#18a058';
        case 'unsynced': return '#f0a020';
        case 'unconfigured': return '#909399';
        default: return '#909399';
    }
});
</script>

<template>
    <div class="accordion-item" :style="{ width: width }">
        <NCard @click="handleClick" :class="[{ 'selected-card': isSelected }]" :content-style="{ padding: 0 }">
            <div class="repo-card">
                <div class="repo-icon">
                    <NIcon :component="Folder24Regular" :size="24" />
                </div>
                <div class="repo-info">
                    <div class="repo-name">{{ repository.name }}</div>
                    <div class="repo-meta">
                        <span class="sync-dot" :style="{ backgroundColor: statusColor }"></span>
                        <span class="repo-status">{{ statusText }}</span>
                    </div>
                </div>
                <NButton text circle size="small" @click.stop="handleToggleExpand" class="expand-button">
                    <NIcon :component="ChevronRight16Regular" :size="16" :class="['expand-icon', { 'expand-icon-rotated': isExpanded }]" />
                </NButton>
            </div>
            <div v-if="isExpanded" class="accordion-content">
                <div class="actions-section">
                    <div class="action-item" @click.stop="handleConfigureRemote">
                        <NIcon :component="Settings20Regular" :size="16" />
                        <span>{{ t('repository.label.configureRemote') }}</span>
                    </div>
                    <div class="action-item" :class="{ 'action-item-disabled': isSyncing }" @click.stop="handleSync">
                        <NIcon :component="ArrowSync20Regular" :size="16" :class="{ 'icon-spin': isSyncing }" />
                        <span>{{ isSyncing ? t('repository.label.syncing') : t('repository.label.sync') }}</span>
                    </div>
                    <div v-if="isSyncing" class="sync-progress">
                        <NProgress :percentage="syncProgress" :processing="syncProgress < 100" :status="syncProgress < 100 ? 'default' : 'success'" />
                        <span class="sync-step-text">{{ syncStep }}</span>
                    </div>
                    <div class="action-item" @click.stop="handleToggleHistory">
                        <NIcon :component="History20Regular" :size="16" />
                        <span>{{ t('repository.label.history') }}</span>
                    </div>
                    <div v-if="showHistory" class="history-section">
                        <n-scrollbar style="max-height: 260px">
                            <div v-if="historyLoading" class="history-loading">{{ t('repository.label.loading') }}</div>
                            <div v-else-if="historyCommits.length === 0" class="history-empty">{{ t('repository.message.noHistory') }}</div>
                            <NTimeline v-else>
                                <NTimelineItem v-for="commit in historyCommits" :key="commit.fullOid" type="info">
                                    <div class="history-row history-row-top">
                                        <span class="history-oid">{{ commit.oid }}</span>
                                        <NTag v-for="branch in commit.branches" :key="branch" size="tiny" :bordered="false" type="success">
                                            {{ branch }}
                                        </NTag>
                                        <NTag v-for="tag in commit.tags" :key="tag" size="tiny" :bordered="false" type="warning">
                                            {{ tag }}
                                        </NTag>
                                        <NTooltip v-if="!commit.isHead" trigger="hover">
                                            <template #trigger>
                                                <NButton text size="tiny" @click.stop="restoreTargetOid = commit.fullOid">
                                                    <template #icon>
                                                        <NIcon :component="ArrowUndo20Regular" :size="14" />
                                                    </template>
                                                    {{ t('repository.action.restore') }}
                                                </NButton>
                                            </template>
                                            {{ t('repository.action.restore') }}
                                        </NTooltip>
                                    </div>
                                    <div class="history-row history-msg">{{ commit.message }}</div>
                                    <div class="history-row history-author">{{ commit.author }} · {{ formatCommitTime(commit.time) }}</div>
                                </NTimelineItem>
                            </NTimeline>
                        </n-scrollbar>
                    </div>
                    <div class="action-item action-item-danger" @click.stop="showDeleteConfirmModal = true">
                        <NIcon :component="Delete20Regular" :size="16" />
                        <span>{{ t('repository.label.delete') }}</span>
                    </div>
                </div>
            </div>
        </NCard>

        <NModal v-model:show="showConfigModal" preset="card" :title="t('repository.label.configureRemote')" :mask-closable="false">
            <div class="config-content">
                <div class="config-item">
                    <span class="config-label">{{ t('repository.label.remoteUrl') }}</span>
                    <NInput v-model:value="configRemoteUrl" :placeholder="t('repository.label.remoteUrlPlaceholder')" @keyup.enter="handleSaveConfig" />
                </div>
                <div class="config-item">
                    <span class="config-label">{{ t('repository.label.userName') }}</span>
                    <NInput v-model:value="configUserName" :placeholder="t('repository.label.userNamePlaceholder')" />
                </div>
                <div class="config-item">
                    <span class="config-label">{{ t('repository.label.password') }}</span>
                    <NInput v-model:value="configPassword" :placeholder="t('repository.label.passwordPlaceholder')" type="password" show-password-on="mousedown" />
                </div>
                <NAlert v-if="configErrorMessage" type="error" style="margin-top: 12px;">
                    {{ configErrorMessage }}
                </NAlert>
            </div>
            <template #footer>
                <NSpace justify="end">
                    <NButton @click="handleCancelConfig">{{ t('repository.action.cancel') }}</NButton>
                    <NButton type="primary" @click="handleSaveConfig">{{ t('repository.action.save') }}</NButton>
                </NSpace>
            </template>
        </NModal>

        <NModal v-model:show="showDeleteConfirmModal" preset="card" :title="t('repository.label.delete')" :style="{ width: '360px' }" :mask-closable="false">
            <div>{{ t('repository.message.deleteConfirm', { name: repository.name }) }}</div>
            <template #footer>
                <NSpace justify="end">
                    <NButton @click="showDeleteConfirmModal = false">{{ t('repository.action.cancel') }}</NButton>
                    <NButton type="error" @click="handleDelete">{{ t('repository.action.delete') }}</NButton>
                </NSpace>
            </template>
        </NModal>

        <NModal :show="restoreTargetOid !== null" @update:show="(v: boolean) => { if (!v) restoreTargetOid = null }" preset="card" :title="t('repository.action.restore')" :mask-closable="false" :style="{ width: '400px' }">
            <div>{{ t('repository.message.restoreConfirm') }}</div>
            <template #footer>
                <NSpace justify="end">
                    <NButton @click="restoreTargetOid = null">{{ t('repository.action.cancel') }}</NButton>
                    <NButton type="warning" @click="handleConfirmRestore">{{ t('repository.action.restore') }}</NButton>
                </NSpace>
            </template>
        </NModal>
    </div>
</template>

<style scoped>
.accordion-item {
    display: flex;
    flex-direction: column;
}

.selected-card {
    border-color: var(--n-primary-color);
    box-shadow: 0 2px 8px rgba(var(--n-primary-color), 0.2);
}

.repo-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
}

.repo-icon {
    flex-shrink: 0;
    opacity: 0.8;
}

.repo-info {
    flex: 1;
}

.repo-name {
    font-weight: 600;
    font-size: 0.95em;
}

.repo-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.85em;
    margin-top: 4px;
}

.sync-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}

.repo-status {
    padding: 2px 6px;
    font-weight: 500;
}

.expand-button {
    flex-shrink: 0;
    opacity: 0.6;
    transition: opacity 0.2s ease;
}

.expand-icon {
    transition: transform 0.3s ease;
}

.expand-icon-rotated {
    transform: rotate(90deg);
}

.accordion-content {
    animation: slideDown 0.3s ease;
    border-top: 1px solid var(--n-border-color);
    padding: 8px 16px 12px;
}

@keyframes slideDown {
    from {
        max-height: 0;
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        max-height: 500px;
        opacity: 1;
        transform: translateY(0);
    }
}

.actions-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.action-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 0.9em;
    transition: background-color 0.2s ease;
}

.action-item-danger {
    color: var(--n-error-color);
}

.action-item-danger:hover {
    background-color: rgba(208, 48, 80, 0.08);
}

.action-item-disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
}

.icon-spin {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.sync-progress {
    padding: 8px 16px 12px;
}

.sync-step-text {
    display: block;
    margin-top: 4px;
    font-size: 0.8em;
    opacity: 0.7;
    text-align: center;
}

.config-content {
    margin: 8px 0;
}

.config-item {
    margin-bottom: 16px;
}

.config-item:last-child {
    margin-bottom: 0;
}

.config-label {
    display: block;
    margin-bottom: 8px;
    font-size: 1.15em;
    font-weight: 500;
    color: var(--n-text-color);
}

.history-section {
    border-top: 1px solid var(--n-border-color);
    padding: 8px 0 4px;
    margin: 0 12px;
}

.history-loading,
.history-empty {
    padding: 12px 0;
    text-align: center;
    font-size: 0.85em;
    opacity: 0.6;
}

.history-oid {
    font-family: monospace;
    font-size: 0.85em;
    opacity: 0.7;
    margin-right: 4px;
}

.history-row {
    margin-bottom: 4px;
}

.history-row:last-child {
    margin-bottom: 0;
}

.history-row-top {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
}

.history-msg {
    font-size: 0.9em;
}

.history-author {
    font-size: 0.8em;
    opacity: 0.6;
}
</style>
