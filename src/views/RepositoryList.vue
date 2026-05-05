<script setup lang="ts">
import { NButton, NModal, NInput, NSelect, NSpace, NIcon } from 'naive-ui';
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Add24Regular } from '@vicons/fluent';
import { useRepositoriesStore } from '@/stores/repositories';
import RepositoryCard from '@/components/RepositoryCard.vue';

const { t } = useI18n();
const repositoriesStore = useRepositoriesStore();

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
            repositoriesStore.initLocalRepository(repoName.value.trim());
            showModal.value = false;
        }
    } else {
        if (remoteUrl.value.trim()) {
            repositoriesStore.cloneRemoteRepository(remoteUrl.value.trim(), repoName.value.trim() || undefined);
            showModal.value = false;
        }
    }
}
</script>

<template>
    <div class="repository-list">
        <div class="create-button" @click="openModal">
            <n-icon :component="Add24Regular" :size="24" />
            <span>{{ $t('repository.action.create') }}</span>
        </div>
        <RepositoryCard
            v-for="repo in repositoriesStore.repositories"
            :key="repo.name"
            :repository="repo"
            width="440px"
            @select="(name: string) => repositoriesStore.selectedRepository = repositoriesStore.repositories.find(r => r.name === name) || null"
        />

        <n-modal v-model:show="showModal" preset="card" :title="$t('repository.action.create')" :style="{ width: '440px' }" :mask-closable="false">
            <n-space vertical>
                <n-select v-model:value="repoType" :options="repoTypeOptions" />

                <n-input v-model:value="repoName" :placeholder="repoType === 'local' ? $t('repository.label.name') : $t('repository.label.nameHint')" @keydown.enter="createRepository" />
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
    flex-direction: column;
    align-items: center;
    padding-top: 20px;
    margin-top: 40px;
    gap: 16px;
}

.create-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 440px;
    padding-bottom: 16px;
    cursor: pointer;
    font-size: 0.95em;
}

.modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
}
</style>
