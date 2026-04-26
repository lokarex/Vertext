<script setup lang="ts">
import { computed, ref } from 'vue';
import { NCard, NIcon, NButton, NModal, NInput, NSpace, NAlert } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { Folder24Regular, ChevronRight16Regular, ArrowSync20Regular, Settings20Regular, Delete20Regular } from '@vicons/fluent';
import { RepositoriesManager } from '@/repositories';
import type { Repository } from '@/repositories';

interface RepositoryCardProps {
    repository: Repository;
    width?: string;
}
const props = withDefaults(defineProps<RepositoryCardProps>(), {
    width: '440px'
});

const repositoriesManager = RepositoriesManager();
const isSelected = computed(() => repositoriesManager.selectedRepository?.name == props.repository.name);
const handleClick = () => {
    repositoriesManager.selectedRepository = props.repository;
};

const { t } = useI18n();

const isExpanded = ref(false);
const showDeleteConfirmModal = ref(false);
const showConfigModal = ref(false);
const configRemoteUrl = ref('');
const configUserName = ref('');
const configPassword = ref('');
const configErrorMessage = ref('');

const handleToggleExpand = () => {
    isExpanded.value = !isExpanded.value;
};

const handleDelete = () => {
    showDeleteConfirmModal.value = false;
    repositoriesManager.deleteRepository(props.repository.name);
};

const handleSync = () => {};

const handleConfigureRemote = () => {
    configRemoteUrl.value = props.repository.remoteUrl || '';
    configUserName.value = props.repository.userName || '';
    configPassword.value = props.repository.password || '';
    configErrorMessage.value = '';
    showConfigModal.value = true;
};

const handleSaveConfig = async () => {
    configErrorMessage.value = '';
    await repositoriesManager.configureRepository(
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
                    <div class="action-item" @click.stop="handleSync">
                        <NIcon :component="ArrowSync20Regular" :size="16" />
                        <span>{{ t('repository.label.sync') }}</span>
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
</style>
