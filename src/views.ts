import { defineStore } from "pinia";
import { ref } from "vue";
import { Store } from '@tauri-apps/plugin-store';
import logger from '@/utils/logger';

export type View = 'repositoryList' | 'editor' | 'settingsView';


export const ViewsManager = defineStore('views', () => {
    const selectedView = ref<View>('repositoryList');
    const previousViews = ref<View[]>([]);
    let store: Store | null = null;

    const isInitialized = ref<boolean>(false);

    async function initialize() {
        try {
            logger.trace('Initializing views manager...');

            logger.trace('Loading tauri store...');
            store = await Store.load('views.json');
            logger.trace('Tauri store loaded successfully.');

            logger.trace('Loading selected view...');
            selectedView.value = await store?.get('selectedView') as View ?? 'repositoryList';
            logger.debug('Loaded selected view:', selectedView.value);
            isInitialized.value = true;
            logger.trace('Selected view loaded successfully.');
        }
        catch (error) {
            logger.error('Failed to initialize views manager:', error);
            isInitialized.value = false;
            throw error;
        }
    }

    initialize();

    async function setView(newView: View) {
        if (newView == selectedView.value) {
            return;
        }

        logger.trace('Updating previous view:', selectedView.value);
        previousViews.value.push(selectedView.value);

        logger.debug('Setting selected view to:', newView);
        await store?.set('selectedView', newView);
        await store?.save();
        selectedView.value = newView;
    }

    async function toRepositoryList() {
        await setView('repositoryList');
    }

    async function toEditor() {
        await setView('editor');
    }

    async function toSettingsView() {
        if (selectedView.value == 'settingsView') {
            await toPreviousView();
        }
        else {
            await setView('settingsView');
        }
    }

    async function toPreviousView() {
        if (previousViews.value.length == 0) {
            return;
        }
        let previousView = previousViews.value.pop() as View;
        logger.trace('The previous view is:', previousView);

        logger.trace('Restoring previous view:', previousView);
        await store?.set('selectedView', previousView);
        await store?.save();
        selectedView.value = previousView;
    }

    return { selectedView, previousViews, setView, toRepositoryList, toEditor, toSettingsView, toPreviousView };
})