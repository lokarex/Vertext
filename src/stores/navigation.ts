import { defineStore } from "pinia";
import { ref } from "vue";
import { Store } from '@tauri-apps/plugin-store';
import { debug, trace } from '@tauri-apps/plugin-log';

export type View = 'repositoryList' | 'editor' | 'settingsView';


export const useNavigationStore = defineStore('navigation', () => {
    const selectedView = ref<View>('repositoryList');
    const previousViews = ref<View[]>([]);
    let store: Store | null = null;

    const isInitialized = ref<boolean>(false);

    async function initialize() {
        try {
            trace('Initializing navigation store...');

            trace('Loading tauri store...');
            store = await Store.load('navigation.json');
            trace('Tauri store loaded successfully.');

            trace('Loading selected view...');
            selectedView.value = await store?.get('selectedView') as View ?? 'repositoryList';
            debug(`Loaded selected view: ${selectedView.value}`);
            isInitialized.value = true;
            trace('Selected view loaded successfully.');
        }
        catch (err) {
            trace(`Failed to initialize navigation store: ${err}`);
            isInitialized.value = false;
            throw err;
        }
    }

    initialize();

    async function setView(newView: View) {
        if (newView == selectedView.value) {
            return;
        }

        trace(`Updating previous view: ${selectedView.value}`);
        previousViews.value.push(selectedView.value);

        debug(`Setting selected view to: ${newView}`);
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
        trace(`The previous view is: ${previousView}`);

        trace(`Restoring previous view: ${previousView}`);
        await store?.set('selectedView', previousView);
        await store?.save();
        selectedView.value = previousView;
    }

    return { selectedView, previousViews, setView, toRepositoryList, toEditor, toSettingsView, toPreviousView };
})
