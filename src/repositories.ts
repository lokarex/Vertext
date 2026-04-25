import { defineStore } from "pinia";
import { ref } from "vue";
import { invoke } from '@tauri-apps/api/core';
import logger from "./utils/logger";

export type RepositoryStatus = 'unconfigured' | 'unsynced' | 'synced';

export class Repository {
    name!: string;

    status: RepositoryStatus = 'unconfigured';
    remoteUrl: string | null = null;
    userName: string | null = null;
    password: string | null = null;
}

export const RepositoriesManager = defineStore('repositories', () => {
    const repositories = ref<Repository[]>([]);
    const selectedRepository = ref<Repository | null>(null);

    async function initLocalRepository(name: string) {
        try {
            await invoke('init_local_repository', { name });
            repositories.value.push({ name, status: 'unconfigured', remoteUrl: null, userName: null, password: null });
        }
        catch (error) {
            logger.error('Failed to init local repository:', error);
        }
    }

    async function cloneRemoteRepository(remoteUrl: string) {
        try {
            await invoke('clone_remote_repository', { remoteUrl });
            repositories.value.push({ name: (remoteUrl.split('/').pop() || '').replace(/\.git$/, ''), status: 'unconfigured', remoteUrl, userName: null, password: null });
        }
        catch (error) {
            logger.error('Failed to clone remote repository:', error);
        }
    }

    async function configureRepository(name: string, remoteUrl: string | null, userName: string | null, password: string | null) {
        const repository = repositories.value.find(repo => repo.name === name)!;

        repository.remoteUrl = remoteUrl || '';
        repository.userName = userName || '';
        repository.password = password || '';

        if (remoteUrl != null && userName != null && password != null && (repository.status == 'unconfigured' || repository.status == 'synced')) {
            repository.status = 'unsynced';
        }

        if (remoteUrl == null || userName == null || password == null) {
            repository.status = 'unconfigured';
        }
    }

    async function deleteRepository(name: string) {
        try {
            await invoke('delete_repository', { name });
            repositories.value = repositories.value.filter(repo => repo.name !== name);
        }
        catch (error) {
            logger.error('Failed to delete repository:', error);
        }
    }

    return {
        repositories,
        selectedRepository,
        initLocalRepository,
        cloneRemoteRepository,
        configureRepository,
        deleteRepository
    };
})