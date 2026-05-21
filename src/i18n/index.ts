/**
 * @file Internationalization (i18n) setup module.
 * Creates and lazily initializes a `vue-i18n` instance with
 * English and Simplified Chinese locales. The initial language
 * is read from the settings store.
 *
 * @see {@link https://vue-i18n.intlify.dev/}
 */
import { createI18n } from "vue-i18n";
import zhCN from './locales/zh-CN.ts';
import en from './locales/en.ts'
import { useSettingsStore } from "@/stores/settings";

/** Singleton i18n instance. Created once, reused across calls. */
let i18nInstance: ReturnType<typeof createI18n> | null = null;

/**
 * Initializes (or returns the existing) vue-i18n instance.
 * Reads the initial locale from the settings store.
 *
 * @returns The configured i18n instance.
 */
export function initializeI18n() {
    if (!i18nInstance) {
        const settingsStore = useSettingsStore();

        i18nInstance = createI18n({
            messages: {
                'zh-CN': zhCN,
                'en': en,
            },
            legacy: false,
            globalInjection: true,
            locale: settingsStore.language as string || 'en',
            fallbackLocale: 'en',
        });
    }

    return i18nInstance;
}

/**
 * Returns the current i18n instance.
 *
 * @throws {Error} If {@link initializeI18n} has not been called yet.
 * @returns The configured i18n instance.
 */
export function i18n() {
    if (!i18nInstance) {
        throw new Error('i18n instance not initialized. Call initializeI18n() first.');
    }
    return i18nInstance;
}

export default initializeI18n;
