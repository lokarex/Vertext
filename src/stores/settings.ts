import { Store } from '@tauri-apps/plugin-store';
import { ref } from 'vue';
import { defineStore } from 'pinia';
import { debug, trace } from '@tauri-apps/plugin-log';
import { i18n } from '@/i18n';
import { createI18n } from 'vue-i18n';

export type Theme = 'lightTheme' | 'darkTheme' | null;
export type Language = 'en' | 'zh-CN' | null;

export const useSettingsStore = defineStore('settings', () => {
    let store: Store | null = null;
    let i18nInstance: ReturnType<typeof createI18n> | null = null;

    const theme = ref<Theme>('darkTheme');
    const fontSize = ref<number>(14);
    const language = ref<Language>('en');
    const autoSaveInterval = ref<number>(10);

    const isInitialized = ref<boolean>(false);

    async function initialize() {
        try {
            trace('Initializing settings manager...');

            trace('Loading tauri store...');
            store = await Store.load('settings.json');
            trace('Tauri store loaded successfully.');

            trace('Loading settings...');
            theme.value = await store?.get('theme') as Theme ?? 'darkTheme';
            debug(`Loaded theme: ${theme.value}`);
            fontSize.value = await store?.get('fontSize') as number ?? 14;
            debug(`Loaded font size: ${fontSize.value}`);
            language.value = await store?.get('language') as Language ?? 'en';
            debug(`Loaded language: ${language.value}`);
            autoSaveInterval.value = await store?.get('autoSaveInterval') as number ?? 10;
            debug(`Loaded auto save interval: ${autoSaveInterval.value}`);
            isInitialized.value = true;
            trace('Settings loaded successfully.');

            if (!i18nInstance) {
                i18nInstance = i18n();
            }
            (i18nInstance.global.locale as any).value = language.value || 'en';

            trace('Settings manager initialized successfully.');
        }
        catch (err) {
            trace(`Failed to initialize settings manager: ${err}`);
            isInitialized.value = false;
            throw err;
        }
    }

    initialize();

    async function setTheme(newTheme: Theme) {
        debug(`New theme: ${newTheme}`);
        await store?.set('theme', newTheme);
        await store?.save();
        theme.value = newTheme;
    }

    async function setFontSize(newFontSize: number) {
        debug(`New font size: ${newFontSize}`);
        await store?.set('fontSize', newFontSize);
        await store?.save();
        fontSize.value = newFontSize;
    }

    async function setLanguage(newLanguage: Language) {
        debug(`New language: ${newLanguage}`);
        await store?.set('language', newLanguage);
        await store?.save();
        language.value = newLanguage;

        if (!i18nInstance) {
            i18nInstance = i18n();
        }

        (i18nInstance.global.locale as any).value = newLanguage || 'en';
    }

    async function setAutoSaveInterval(newInterval: number) {
        debug(`New auto save interval: ${newInterval}`);
        await store?.set('autoSaveInterval', newInterval);
        await store?.save();
        autoSaveInterval.value = newInterval;
    }

    return {
        theme,
        fontSize,
        language,
        autoSaveInterval,
        isInitialized,
        setTheme,
        setFontSize,
        setLanguage,
        setAutoSaveInterval,
    };
});
