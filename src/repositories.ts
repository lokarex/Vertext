import { defineStore } from "pinia";
import { ref } from "vue";

export type Repository = {
    name: string;
    path: string;
    status: string;
    isInitialized: boolean;
}

export const RepositoriesManager = defineStore('repositories', () => {
    const repositories = ref<Repository[]>([]);
    const selectedRepository = ref<Repository | null>(null);

    function addRepository() {
    }

    function removeRepository() {
    }

    function createRepository() {
    }

    function deleteRepository() {
    }

    return {
        repositories,
        selectedRepository,
        addRepository,
        removeRepository,
        createRepository,
        deleteRepository
    };
})