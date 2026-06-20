/**
 * @file Repository management Pinia store.
 * Provides CRUD operations for Git repositories including local
 * initialization, remote cloning, configuration, synchronization,
 * and deletion. Credentials are stored in the OS keychain via
 * the Tauri password API.
 */
import { defineStore } from "pinia";
import { Store } from "@tauri-apps/plugin-store";
import { ref } from "vue";
import { invoke } from '@tauri-apps/api/core';
import { debug, error, trace } from '@tauri-apps/plugin-log';
import type { Repository, RepositoryStatus } from '@/models/Repository';
import type { CommitSuggestion } from '@/models/AiConfig';
import { useSettingsStore } from '@/stores/settings';

/**
 * Retrieves a password from the OS keychain for the given user/service.
 * @param user - The service identifier (typically the repository name).
 * @returns The stored password, or null if not found.
 */
async function getPassword(user: string): Promise<string | null> {
    return invoke('get_password', { service: 'vertext', user });
}
/**
 * Stores a password in the OS keychain.
 * @param user - The service identifier.
 * @param password - The password to store.
 */
async function setPassword(user: string, password: string): Promise<void> {
    await invoke('set_password', { service: 'vertext', user, password });
}
/**
 * Deletes a password from the OS keychain.
 * @param user - The service identifier.
 */
async function deletePassword(user: string): Promise<void> {
    await invoke('delete_password', { service: 'vertext', user });
}

/**
 * Pinia store for repository lifecycle management.
 * All changes are persisted to `repositories.json` via Tauri's Store plugin.
 */
export const useRepositoriesStore = defineStore('repositories', () => {
    /** Reference to the Tauri persistent store. */
    let store: Store | null = null;

    /** Array of managed repositories. */
    const repositories = ref<Repository[]>([]);
    /** The currently selected repository, or null. */
    const selectedRepository = ref<Repository | null>(null);
    /** Whether the file tree drawer is open. */
    const fileTreeOpen = ref(false);

    /** Toggles the file tree drawer visibility. */
    function toggleFileTree() {
        fileTreeOpen.value = !fileTreeOpen.value
    }

    /**
     * Loads persisted repositories and the last selected repository from disk.
     */
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

    /**
     * Generates an AI commit message suggestion for a repository.
     * Returns null if AI is not configured in settings.
     *
     * @param repoName - The repository to generate a message for.
     * @returns The commit suggestion or null if AI is disabled.
     */
    async function prepareCommitMessage(repoName: string): Promise<CommitSuggestion | null> {
        const settings = useSettingsStore();
        if (!settings.isAiConfigured) {
            return null;
        }
        const repo = repositories.value.find(r => r.name === repoName);
        if (!repo || !repo.remoteUrl || !repo.userName) {
            return null;
        }
        const password = await getPassword(repoName);
        if (!password) {
            return null;
        }
        const suggestion = await invoke<CommitSuggestion>('prepare_commit_message', {
            repoName,
            remoteUrl: repo.remoteUrl,
            userName: repo.userName,
            password,
            aiProvider: settings.aiProvider,
            aiModel: settings.aiModel,
            aiEndpoint: settings.aiOllamaEndpoint || null,
            language: settings.language || 'en',
        });
        return suggestion;
    }

    /**
     * Completes the sync workflow with a user-confirmed commit message.
     *
     * @param repoName - The repository to sync.
     * @param commitMessage - The commit message to use.
     * @throws {Error} If the repository is not configured or sync fails.
     */
    async function finishSync(repoName: string, commitMessage: string): Promise<void> {
        const repo = repositories.value.find(r => r.name === repoName);
        if (!repo || !repo.remoteUrl || !repo.userName) {
            throw new Error('Repository is not configured for sync');
        }
        const password = await getPassword(repoName);
        if (!password) {
            throw new Error('Repository is not configured for sync');
        }
        await invoke('finish_sync', {
            repoName,
            remoteUrl: repo.remoteUrl,
            userName: repo.userName,
            password,
            commitMessage,
        });
        repo.status = 'synced';
        await store?.set('repositories', repositories.value);
        await store?.save();
        trace(`Sync completed for repository: ${repoName}`);
    }

    /**
     * Creates a new local (non-remote) Git repository.
     * @param repoName - The name for the new repository.
     */
    async function initLocalRepository(repoName: string) {
        try {
            await invoke('init_local_repository', { repoName });
            repositories.value.push({ name: repoName, status: 'unconfigured', remoteUrl: null, userName: null });
            await store?.set('repositories', repositories.value);
            await store?.save();
        }
        catch (err) {
            error(`Failed to init local repository: ${err}`);
            throw err;
        }
    }

    /**
     * Clones a remote Git repository.
     * The repository name is auto-derived from the URL if not provided.
     *
     * @param remoteUrl - The remote repository URL to clone.
     * @param repoName - Optional custom name (defaults to URL-derived name).
     * @param userName - Optional authentication username.
     * @param password - Optional authentication password (stored in keychain).
     */
    async function cloneRemoteRepository(remoteUrl: string, repoName?: string, userName?: string, password?: string) {
        try {
            const resolvedRepoName = repoName || (remoteUrl.split('/').pop() || '').replace(/\.git$/, '');
            await invoke('clone_remote_repository', {
                remoteUrl,
                repoName: resolvedRepoName,
                userName: userName || null,
                password: password || null,
            });
            const status: RepositoryStatus = (remoteUrl && userName && password) ? 'unsynced' : 'unconfigured';
            repositories.value.push({ name: resolvedRepoName, status, remoteUrl, userName: userName || null });
            if (password) {
                await setPassword(resolvedRepoName, password);
            }
            await store?.set('repositories', repositories.value);
            await store?.save();
        }
        catch (err) {
            error(`Failed to clone remote repository: ${err}`);
            throw err;
        }
    }

    /**
     * Configures or updates remote connection details for a repository.
     * Setting all three values (url, username, password) marks the repo as `'unsynced'`.
     * Clearing them reverts to `'unconfigured'`.
     *
     * @param repoName - The repository to configure.
     * @param remoteUrl - The remote origin URL.
     * @param userName - Authentication username.
     * @param password - Authentication password (stored in keychain).
     */
    async function configureRepository(repoName: string, remoteUrl: string | null, userName: string | null, password: string | null) {
        const repository = repositories.value.find(repo => repo.name === repoName)!;

        repository.remoteUrl = remoteUrl || '';
        repository.userName = userName || '';

        if (password) {
            await setPassword(repoName, password);
        } else {
            try { await deletePassword(repoName); } catch { /* ignore if not exists */ }
        }

        if (remoteUrl != null && userName != null && password != null && (repository.status == 'unconfigured' || repository.status == 'synced')) {
            repository.status = 'unsynced';
        }

        if (remoteUrl == null || userName == null || password == null) {
            repository.status = 'unconfigured';
        }

        await store?.set('repositories', repositories.value);
        await store?.save();
    }

    /**
     * Permanently deletes a repository (local directory and stored credentials).
     * @param repoName - The repository to delete.
     */
    async function deleteRepository(repoName: string) {
        try {
            await invoke('delete_repository', { repoName });
            repositories.value = repositories.value.filter(repo => repo.name !== repoName);
            try { await deletePassword(repoName); } catch { /* ignore */ }
            await store?.set('repositories', repositories.value);
            await store?.save();
        }
        catch (err) {
            error(`Failed to delete repository: ${err}`);
            throw err;
        }
    }

    /**
     * Synchronizes a repository with its remote (commit + fetch + merge + push).
     * Requires the repository to be fully configured with credentials.
     *
     * @param repoName - The repository to sync.
     * @throws {Error} If the repository is not configured or has no stored password.
     */
    async function syncRepository(repoName: string) {
        try {
            const repo = repositories.value.find(r => r.name === repoName);
            if (!repo || !repo.remoteUrl || !repo.userName) {
                error(`Repository '${repoName}' is not configured for sync`);
                throw new Error('Repository is not configured for sync');
            }
            const password = await getPassword(repoName);
            if (!password) {
                error(`Repository '${repoName}' has no password configured`);
                throw new Error('Repository is not configured for sync');
            }
            await invoke('sync_repository', {
                repoName,
                remoteUrl: repo.remoteUrl,
                userName: repo.userName,
                password,
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

    /**
     * Updates the sync status of a repository and persists it.
     * @param repoName - The repository to update.
     * @param status - The new status value.
     */
    async function setStatus(repoName: string, status: RepositoryStatus) {
        const repo = repositories.value.find(r => r.name === repoName);
        if (repo) {
            repo.status = status;
            await store?.set('repositories', repositories.value);
            await store?.save();
        }
    }

    /**
     * Renames a repository on disk and updates all state references.
     * Credentials are automatically migrated by the backend.
     *
     * @param oldName - The current repository name.
     * @param newName - The desired new name.
     * @throws {Error} If the backend rename operation fails.
     */
    async function renameRepository(oldName: string, newName: string) {
        try {
            await invoke('rename_repository', { oldName, newName });

            const repo = repositories.value.find(r => r.name === oldName);
            if (repo) {
                repo.name = newName;
            }

            if (selectedRepository.value?.name === oldName) {
                selectedRepository.value = repo ?? null;
                await store?.set('selectedRepositoryName', newName);
            }

            await store?.set('repositories', repositories.value);
            await store?.save();
            trace(`Repository '${oldName}' renamed to '${newName}' successfully`);
        }
        catch (err) {
            error(`Failed to rename repository: ${err}`);
            throw err;
        }
    }

    /**
     * Selects a repository by name and persists the selection.
     * Pass `null` to deselect.
     *
     * @param repoName - The repository name to select, or null.
     */
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
        renameRepository,
        prepareCommitMessage,
        finishSync,
    };
})
