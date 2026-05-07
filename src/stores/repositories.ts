import { defineStore } from "pinia";
import { Store } from "@tauri-apps/plugin-store";
import { ref } from "vue";
import { invoke } from '@tauri-apps/api/core';
import { debug, error, trace } from '@tauri-apps/plugin-log';
import type { Repository, RepositoryStatus } from '@/models/Repository';

export const useRepositoriesStore = defineStore('repositories', () => {
    let store: Store | null = null;

    const repositories = ref<Repository[]>([]);
    const selectedRepository = ref<Repository | null>(null);
    const fileTreeOpen = ref(false);

    function toggleFileTree() {
        fileTreeOpen.value = !fileTreeOpen.value
    }

    async function initialize() {
        try {
            trace('Initializing repositories manager...');
            store = await Store.load('repositories.json');
            trace('Tauri store loaded successfully.');

            trace('Loading repositories...');
            repositories.value = await store?.get('repositories') as Repository[] ?? [];
            debug(`Loaded repositories: ${JSON.stringify(repositories.value)}`);

            const selectedName = await store?.get('selectedRepositoryName') as string | null;
            if (selectedName) {
                selectedRepository.value = repositories.value.find(r => r.name === selectedName) ?? null;
                debug(`Restored selected repository: ${selectedName}`);
            }

            trace('Repositories manager initialized successfully.');
        }
        catch (err) {
            error(`Failed to initialize repositories manager: ${err}`);
        }
    }

    initialize();

    async function initLocalRepository(repoName: string) {
        try {
            await invoke('init_local_repository', { repoName });
            repositories.value.push({ name: repoName, status: 'unconfigured', remoteUrl: null, userName: null, password: null });
            await store?.set('repositories', repositories.value);
            await store?.save();
        }
        catch (err) {
            error(`Failed to init local repository: ${err}`);
        }
    }

    async function cloneRemoteRepository(remoteUrl: string, repoName?: string) {
        try {
            const resolvedRepoName = repoName || (remoteUrl.split('/').pop() || '').replace(/\.git$/, '');
            await invoke('clone_remote_repository', { remoteUrl, repoName: resolvedRepoName });
            repositories.value.push({ name: resolvedRepoName, status: 'unconfigured', remoteUrl, userName: null, password: null });
            await store?.set('repositories', repositories.value);
            await store?.save();
        }
        catch (err) {
            error(`Failed to clone remote repository: ${err}`);
        }
    }

    async function configureRepository(repoName: string, remoteUrl: string | null, userName: string | null, password: string | null) {
        const repository = repositories.value.find(repo => repo.name === repoName)!;

        repository.remoteUrl = remoteUrl || '';
        repository.userName = userName || '';
        repository.password = password || '';

        if (remoteUrl != null && userName != null && password != null && (repository.status == 'unconfigured' || repository.status == 'synced')) {
            repository.status = 'unsynced';
        }

        if (remoteUrl == null || userName == null || password == null) {
            repository.status = 'unconfigured';
        }

        await store?.set('repositories', repositories.value);
        await store?.save();
    }

    async function deleteRepository(repoName: string) {
        try {
            await invoke('delete_repository', { repoName });
            repositories.value = repositories.value.filter(repo => repo.name !== repoName);
            await store?.set('repositories', repositories.value);
            await store?.save();
        }
        catch (err) {
            error(`Failed to delete repository: ${err}`);
        }
    }

    async function syncRepository(repoName: string) {
        try {
            const repo = repositories.value.find(r => r.name === repoName);
            if (!repo || !repo.remoteUrl || !repo.userName || !repo.password) {
                error(`Repository '${repoName}' is not configured for sync`);
                throw new Error('Repository is not configured for sync');
            }
            await invoke('sync_repository', {
                repoName,
                remoteUrl: repo.remoteUrl,
                userName: repo.userName,
                password: repo.password,
            });
            repo.status = 'synced';
            await store?.set('repositories', repositories.value);
            await store?.save();
            trace(`Sync completed for repository: ${repoName}`);
        }
        catch (err) {
            error(`Failed to sync repository: ${err}`);
            throw err;
        }
    }

    async function setStatus(repoName: string, status: RepositoryStatus) {
        const repo = repositories.value.find(r => r.name === repoName);
        if (repo) {
            repo.status = status;
            await store?.set('repositories', repositories.value);
            await store?.save();
        }
    }

    function selectRepository(repoName: string | null) {
        if (repoName === null) {
            selectedRepository.value = null;
        } else {
            selectedRepository.value = repositories.value.find(r => r.name === repoName) ?? null;
        }
        store?.set('selectedRepositoryName', repoName);
        store?.save();
    }

    return {
        repositories,
        selectedRepository,
        fileTreeOpen,
        toggleFileTree,
        initLocalRepository,
        cloneRemoteRepository,
        configureRepository,
        deleteRepository,
        syncRepository,
        setStatus,
        selectRepository,
    };
})
