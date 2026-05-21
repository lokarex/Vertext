/**
 * @file Navigation state Pinia store.
 * Manages the current application view and a history stack of
 * previous views for back navigation. Persisted via the Tauri
 * Store plugin.
 */
import { defineStore } from "pinia";
import { ref } from "vue";
import { Store } from '@tauri-apps/plugin-store';
import { debug, trace } from '@tauri-apps/plugin-log';

/** Available top-level application views. */
export type View = 'repositoryList' | 'editor' | 'settingsView';


/**
 * Pinia store for navigation state.
 * Tracks the currently active view and a back-navigation stack.
 */
export const useNavigationStore = defineStore('navigation', () => {
    /** The currently displayed view. */
    const selectedView = ref<View>('repositoryList');
    /** Stack of previous views for back navigation. */
    const previousViews = ref<View[]>([]);
    /** Reference to the Tauri persistent store. */
    let store: Store | null = null;

    /** Whether the store has completed initial load. */
    const isInitialized = ref<boolean>(false);

    /**
     * Loads persisted navigation state from disk.
     * Restores the previously active view on application launch.
     */
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

    /**
     * Switches to a new view, pushing the current view onto the history stack.
     * @param newView - The target view to navigate to.
     */
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

    /** Navigates to the repository list view. */
    async function toRepositoryList() {
        await setView('repositoryList');
    }

    /** Navigates to the editor view. */
    async function toEditor() {
        await setView('editor');
    }

    /**
     * Toggles the settings view.
     * If already on settings, navigates back to the previous view.
     */
    async function toSettingsView() {
        if (selectedView.value == 'settingsView') {
            await toPreviousView();
        }
        else {
            await setView('settingsView');
        }
    }

    /**
     * Navigates back to the most recent view in the history stack.
     * Does nothing if the history stack is empty.
     */
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
