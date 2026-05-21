<script setup lang="ts">
/**
 * Repository listing page with a create modal for local and remote repositories.
 * Displays all existing repositories as cards and allows creating new ones
 * through a modal dialog that supports authentication for remote repos.
 */
import { NButton, NModal, NInput, NSelect, NSpace, NIcon, NScrollbar, NCheckbox } from 'naive-ui';
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Add24Regular } from '@vicons/fluent';
import { useRepositoriesStore } from '@/stores/repositories';
import RepositoryCard from '@/components/RepositoryCard.vue';

const { t } = useI18n();
const repositoriesStore = useRepositoriesStore();

/** Whether the create repository modal is visible. */
const showModal = ref(false);
/** Type of repository to create: local or remote. */
const repoType = ref<'local' | 'remote'>('local');
/** Options for the repository type selector. */
const repoTypeOptions = computed(() => [
    { label: t('repository.label.localType'), value: 'local' },
    { label: t('repository.label.remoteType'), value: 'remote' },
]);
/** Name for the new repository. */
const repoName = ref('');
/** Remote URL for cloning (used when repoType is 'remote'). */
const remoteUrl = ref('');
/** Whether the remote repository requires authentication. */
const requiresAuth = ref(false);
/** Username for remote repository authentication. */
const userName = ref('');
/** Password for remote repository authentication. */
const password = ref('');

/**
 * Opens the create repository modal and resets all form fields to defaults.
 */
function openModal() {
    repoType.value = 'local';
    repoName.value = '';
    remoteUrl.value = '';
    requiresAuth.value = false;
    userName.value = '';
    password.value = '';
    showModal.value = true;
}

/**
 * Closes the create repository modal.
 */
function closeModal() {
    showModal.value = false;
}

/**
 * Creates a new repository based on the current form state.
 * For local repos, initializes with the given name.
 * For remote repos, clones with optional authentication credentials.
 */
function createRepository() {
    if (repoType.value === 'local') {
        if (repoName.value.trim()) {
            repositoriesStore.initLocalRepository(repoName.value.trim());
            showModal.value = false;
        }
    } else {
        if (remoteUrl.value.trim()) {
            const name = repoName.value.trim() || undefined;
            const user = requiresAuth.value && userName.value.trim() ? userName.value.trim() : undefined;
            const pass = requiresAuth.value && password.value ? password.value : undefined;
            repositoriesStore.cloneRemoteRepository(remoteUrl.value.trim(), name, user, pass);
            showModal.value = false;
        }
    }
}
</script>

<template>
    <n-scrollbar>
      <div class="repository-list">
        <div class="create-button" @click="openModal">
            <n-icon :component="Add24Regular" :size="24" />
            <span>{{ $t('repository.action.create') }}</span>
        </div>
        <RepositoryCard
            v-for="repo in repositoriesStore.repositories"
            :key="repo.name"
            :repository="repo"
            width="340px"
            @select="(name: string) => repositoriesStore.selectRepository(name)"
        />

        <n-modal v-model:show="showModal" preset="card" :title="$t('repository.action.create')" :style="{ width: '340px' }" :mask-closable="false">
            <n-space vertical>
                <n-select v-model:value="repoType" :options="repoTypeOptions" />

                <n-input v-model:value="repoName" :placeholder="repoType === 'local' ? $t('repository.label.name') : $t('repository.label.nameHint')" @keydown.enter="createRepository" />
                <n-input v-if="repoType === 'remote'" v-model:value="remoteUrl" :placeholder="$t('repository.label.remoteUrl')" @keydown.enter="createRepository" />
                <template v-if="repoType === 'remote'">
                    <n-checkbox v-model:checked="requiresAuth">{{ $t('repository.label.requiresAuth') }}</n-checkbox>
                    <n-input v-if="requiresAuth" v-model:value="userName" :placeholder="$t('repository.label.userName')" @keydown.enter="createRepository" />
                    <n-input v-if="requiresAuth" v-model:value="password" type="password" show-password-on="mousedown" :placeholder="$t('repository.label.password')" @keydown.enter="createRepository" />
                </template>
            </n-space>

            <template #footer>
                <div class="modal-footer">
                    <n-button @click="closeModal">{{ $t('repository.action.cancel') }}</n-button>
                    <n-button type="primary" @click="createRepository">{{ $t('repository.action.confirm') }}</n-button>
                </div>
            </template>
        </n-modal>
      </div>
    </n-scrollbar>
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
    width: 340px;
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
