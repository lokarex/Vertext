<script setup lang="ts">
import { NList, NListItem, NButton, NModal, NInput, NSelect, NSpace } from 'naive-ui';
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RepositoriesManager } from '@/repositories';

const { t } = useI18n();
const repositoriesManager = RepositoriesManager();

const showModal = ref(false);
const repoType = ref<'local' | 'remote'>('local');
const repoTypeOptions = computed(() => [
    { label: t('repository.label.localType'), value: 'local' },
    { label: t('repository.label.remoteType'), value: 'remote' },
]);
const repoName = ref('');
const remoteUrl = ref('');

function openModal() {
    repoType.value = 'local';
    repoName.value = '';
    remoteUrl.value = '';
    showModal.value = true;
}

function closeModal() {
    showModal.value = false;
}

function createRepository() {
    if (repoType.value === 'local') {
        if (repoName.value.trim()) {
            repositoriesManager.initLocalRepository(repoName.value.trim());
            showModal.value = false;
        }
    } else {
        if (remoteUrl.value.trim()) {
            repositoriesManager.cloneRemoteRepository(remoteUrl.value.trim());
            showModal.value = false;
        }
    }
}
</script>

<template>
    <div class="repository-list">
        <n-list>
            <n-button @click="openModal">{{ $t('repository.action.create') }}</n-button>
            <n-list-item v-for="repo in repositoriesManager.repositories" :key="repo.name">
                {{ repo.name }}
            </n-list-item>
        </n-list>

        <n-modal v-model:show="showModal" preset="card" :title="$t('repository.action.create')" :style="{ width: '440px' }" :mask-closable="false">
            <n-space vertical>
                <n-select v-model:value="repoType" :options="repoTypeOptions" />

                <n-input v-if="repoType === 'local'" v-model:value="repoName" :placeholder="$t('repository.label.name')" @keydown.enter="createRepository" />
                <n-input v-if="repoType === 'remote'" v-model:value="remoteUrl" :placeholder="$t('repository.label.remoteUrl')" @keydown.enter="createRepository" />
            </n-space>

            <template #footer>
                <div class="modal-footer">
                    <n-button @click="closeModal">{{ $t('repository.action.cancel') }}</n-button>
                    <n-button type="primary" @click="createRepository">{{ $t('repository.action.confirm') }}</n-button>
                </div>
            </template>
        </n-modal>
    </div>
</template>

<style scoped>
.repository-list {
    display: flex;
    justify-content: center;
    padding-top: 20px;
    margin-top: 40px;
}

.modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
}
</style>
