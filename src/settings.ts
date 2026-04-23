import { Store } from '@tauri-apps/plugin-store';
import { ref } from 'vue';
import { defineStore } from 'pinia';
import logger from '@/utils/logger';
import { i18n } from '@/i18n';
import { createI18n } from 'vue-i18n';

export type Theme = 'lightTheme' | 'darkTheme' | null;
export type Language = 'en' | 'zh-CN' | null;

export const SettingsManager = defineStore('settings', () => {
    let store: Store | null = null;
    let i18nInstance: ReturnType<typeof createI18n> | null = null;

    const theme = ref<Theme>('darkTheme');
    const fontSize = ref<number>(14);
    const language = ref<Language>('en');

    const isInitialized = ref<boolean>(false);

    async function initialize() {
        try {
            logger.trace('Initializing settings manager...');

            logger.trace('Loading tauri store...');
            store = await Store.load('settings.json');
            logger.trace('Tauri store loaded successfully.');

            logger.trace('Loading settings...');
            theme.value = await store?.get('theme') as Theme ?? 'darkTheme';
            logger.debug('Loaded theme:', theme.value);
            fontSize.value = await store?.get('fontSize') as number ?? 14;
            logger.debug('Loaded font size:', fontSize.value);
            language.value = await store?.get('language') as Language ?? 'en';
            logger.debug('Loaded language:', language.value);
            isInitialized.value = true;
            logger.trace('Settings loaded successfully.');

            if (!i18nInstance) {
                i18nInstance = i18n();
            }
            (i18nInstance.global.locale as any).value = language.value || 'en';

            logger.trace('Settings manager initialized successfully.');
        }
        catch (error) {
            logger.error('Failed to initialize settings manager:', error);
            isInitialized.value = false;
            throw error;
        }
    }

    initialize();

    async function setTheme(newTheme: Theme) {
        logger.debug('New theme:', newTheme);
        await store?.set('theme', newTheme);
        await store?.save();
        theme.value = newTheme;
    }

    async function setFontSize(newFontSize: number) {
        logger.debug('New font size:', newFontSize);
        await store?.set('fontSize', newFontSize);
        await store?.save();
        fontSize.value = newFontSize;
    }

    async function setLanguage(newLanguage: Language) {
        logger.debug('New language:', newLanguage);
        await store?.set('language', newLanguage);
        await store?.save();
        language.value = newLanguage;

        if (!i18nInstance) {
            i18nInstance = i18n();
        }

        (i18nInstance.global.locale as any).value = newLanguage || 'en';
    }

    return {
        theme,
        fontSize,
        language,
        isInitialized,
        setTheme,
        setFontSize,
        setLanguage,
    };
});