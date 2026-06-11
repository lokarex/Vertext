<script setup lang="ts">
import { ref, watch } from 'vue';
import { NModal, NButton, NInput, NTag, NSpace, NAlert, NScrollbar } from 'naive-ui';
import type { CommitSuggestion } from '@/models/AiConfig';

interface Props {
    visible: boolean;
    loading: boolean;
    errorMessage: string | null;
    suggestion: CommitSuggestion | null;
    providerName: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void;
    (e: 'submit', message: string): void;
    (e: 'regenerate'): void;
    (e: 'cancel'): void;
}>();

const editedMessage = ref('');

watch(
    () => props.suggestion,
    (val) => {
        if (val) {
            editedMessage.value = val.message;
        }
    }
);

function statusType(status: string): 'default' | 'success' | 'error' | 'warning' | 'info' {
    switch (status) {
        case 'A': return 'success';
        case 'M': return 'warning';
        case 'D': return 'error';
        default: return 'default';
    }
}

function handleClose() {
    emit('cancel');
}

function handleSubmit() {
    emit('submit', editedMessage.value.trim() || (props.suggestion?.message ?? ''));
}

function handleRegenerate() {
    emit('regenerate');
}
</script>

<template>
    <n-modal
        preset="card"
        :show="visible"
        :mask-closable="false"
        :title="$t('ai.label.dialogTitle')"
        style="width: 640px; max-width: 90vw;"
        @update:show="(val: boolean) => { if (!val) handleClose(); }"
    >
        <div class="ai-dialog">
            <n-alert
                v-if="errorMessage"
                type="error"
                :title="errorMessage"
                class="ai-error"
            />

            <div v-if="loading && !suggestion" class="ai-loading">
                <p>{{ $t('ai.message.loading') }}</p>
            </div>

            <template v-if="suggestion">
                <div class="ai-files-section">
                    <label class="ai-label">{{ $t('ai.label.filesChanged') }}</label>
                    <n-scrollbar style="max-height: 120px;">
                        <div v-for="file in suggestion.filesChanged" :key="file.path" class="ai-file-item">
                            <n-tag :type="statusType(file.status)" size="small" class="ai-file-status">
                                {{ file.status }}
                            </n-tag>
                            <span class="ai-file-path">{{ file.path }}</span>
                            <span class="ai-file-stats">
                                <span class="ai-additions">+{{ file.additions }}</span>
                                <span class="ai-deletions">-{{ file.deletions }}</span>
                            </span>
                        </div>
                    </n-scrollbar>
                </div>

                <div class="ai-message-section">
                    <label class="ai-label">{{ $t('ai.label.commitMessage') }}</label>
                    <n-input
                        v-model:value="editedMessage"
                        type="textarea"
                        :autosize="{ minRows: 3, maxRows: 10 }"
                        :placeholder="$t('ai.label.commitMessagePlaceholder')"
                        :disabled="loading"
                    />
                </div>
            </template>

            <div class="ai-footer-info">
                {{ $t('ai.label.provider') }}: {{ providerName }}
            </div>

            <n-space justify="end" class="ai-actions">
                <n-button @click="handleClose">
                    {{ $t('ai.label.cancel') }}
                </n-button>
                <n-button
                    @click="handleRegenerate"
                    :disabled="loading"
                    secondary
                >
                    {{ $t('ai.label.regenerate') }}
                </n-button>
                <n-button
                    type="primary"
                    @click="handleSubmit"
                    :disabled="loading || !!errorMessage || !suggestion"
                >
                    {{ $t('ai.label.submit') }}
                </n-button>
            </n-space>
        </div>
    </n-modal>
</template>

<style scoped>
.ai-dialog {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.ai-error {
    margin-bottom: 4px;
}

.ai-loading {
    padding: 24px 0;
    text-align: center;
    color: var(--n-text-color-3);
}

.ai-label {
    font-size: 0.9em;
    font-weight: 600;
    margin-bottom: 8px;
    display: block;
}

.ai-file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-size: 0.85em;
}

.ai-file-status {
    min-width: 24px;
    text-align: center;
}

.ai-file-path {
    flex: 1;
    font-family: monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ai-file-stats {
    display: flex;
    gap: 8px;
    font-family: monospace;
    font-size: 0.85em;
}

.ai-additions {
    color: #2da44e;
}

.ai-deletions {
    color: #cf222e;
}

.ai-message-section {
    flex: 1;
}

.ai-footer-info {
    font-size: 0.8em;
    color: var(--n-text-color-3);
}

.ai-actions {
    margin-top: 4px;
}
</style>
