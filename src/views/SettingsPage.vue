<script lang="ts" setup>
/**
 * Settings page for configuring theme, language, font size, auto-save interval,
 * and AI assistant settings. All settings are persisted through the settings store.
 */
import { useSettingsStore, Theme } from '@/stores/settings';
import { NSelect, SelectOption, NInputNumber, NCard, NDivider, NScrollbar, NInput } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { computed, ref, watch } from 'vue';
import type { AiProviderType } from '@/models/AiConfig';

const { t } = useI18n();

const settingsStore = useSettingsStore();

const themeOptions = computed(() => [
    { value: 'darkTheme', label: t('theme.label.dark') },
    { value: 'lightTheme', label: t('theme.label.light') },
]);

function handleThemeChange(value: string, _options: SelectOption) {
    settingsStore.setTheme(value as Theme);
}

function handleFontSizeChange(value: number | null) {
    if (value !== null) { settingsStore.setFontSize(value) }
}

const languageOptions = computed(() => [
    { value: 'en', label: t('language.label.en') },
    { value: 'zh-CN', label: t('language.label.zh_CN') },
]);

function handleLanguageChange(value: "en" | "zh-CN", _options: SelectOption) {
    settingsStore.setLanguage(value);
}

function handleAutoSaveIntervalChange(value: number | null) {
    if (value !== null) { settingsStore.setAutoSaveInterval(value) }
}

const apiKeyInput = ref('');
const apiKeyLoaded = ref(false);

const providerOptions = computed(() => [
    { value: '__none__', label: t('settings.label.aiProviderNone') },
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'deepseek', label: 'DeepSeek' },
    { value: 'ollama', label: 'Ollama' },
]);

const modelOptions = computed(() => {
    switch (settingsStore.aiProvider) {
        case 'openai':
            return [
                { value: 'gpt-4.1', label: 'GPT-4.1' },
                { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
                { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
            ];
        case 'anthropic':
            return [
                { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
                { value: 'claude-haiku-3-5-20241022', label: 'Claude Haiku 3.5' },
            ];
        case 'deepseek':
            return [
                { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
                { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
            ];
        default:
            return [];
    }
});

watch(() => settingsStore.aiProvider, async (val) => {
    if (!val) {
        apiKeyInput.value = '';
        apiKeyLoaded.value = false;
        return;
    }
    try {
        const key = await settingsStore.getAiApiKey();
        apiKeyInput.value = key ? '••••••••' : '';
        apiKeyLoaded.value = true;
    } catch {
        apiKeyInput.value = '';
        apiKeyLoaded.value = false;
    }
}, { immediate: true });

function handleAiProviderChange(value: string | null) {
    if (value === '__none__' || value === null) {
        settingsStore.setAiProvider(null);
    } else {
        settingsStore.setAiProvider(value as AiProviderType);
    }
    apiKeyLoaded.value = false;
    apiKeyInput.value = '';
}

function handleAiModelChange(value: string) {
    settingsStore.setAiModel(value);
}

function handleAiEndpointChange(value: string) {
    settingsStore.setAiOllamaEndpoint(value);
}

async function handleApiKeyChange(value: string) {
    if (!settingsStore.aiProvider) return;
    if (!value || value === '••••••••') return;
    await settingsStore.setAiApiKey(value);
    apiKeyInput.value = '••••••••';
}
</script>

<template>
    <n-scrollbar>
      <n-card class="settings-card">
        <label class="settings-title">{{ $t('settings.title') }}</label>

        <div>
            <label class="settings-section-title">{{ $t('settings.label.appearance') }}</label>

            <div class="settings-item">
                <label class="settings-item-title">{{ $t('settings.label.theme') }}</label>
                <n-select v-model:value="settingsStore.theme" :options="themeOptions" @update-value="handleThemeChange"/>
            </div>

            <n-divider/>

            <div class="settings-item">
                <label class="settings-item-title">{{ $t('settings.label.fontSize') }}</label>
                <n-input-number v-model:value="settingsStore.fontSize" size="small" @update:value="handleFontSizeChange" :min="12" :max="36"/>
            </div>

            <n-divider/>

            <div class="settings-item">
                <label class="settings-item-title">{{ $t('settings.label.language') }}</label>
                <n-select v-model:value="settingsStore.language" :options="languageOptions" @update-value="handleLanguageChange"/>
            </div>

            <n-divider/>

            <label class="settings-section-title">{{ $t('settings.label.editor') }}</label>

            <div class="settings-item">
                <label class="settings-item-title">{{ $t('settings.label.autoSaveInterval') }}</label>
                <n-input-number v-model:value="settingsStore.autoSaveInterval" size="small" @update:value="handleAutoSaveIntervalChange" :min="1" :max="120"/>
            </div>

            <n-divider/>

            <label class="settings-section-title">{{ $t('settings.label.ai') }}</label>

            <div class="settings-item">
                <label class="settings-item-title">{{ $t('settings.label.aiProvider') }}</label>
                <n-select
                    :value="settingsStore.aiProvider"
                    :options="providerOptions"
                    clearable
                    @update:value="handleAiProviderChange"
                />
            </div>

            <n-divider/>

            <div class="settings-item">
                <label class="settings-item-title">{{ $t('settings.label.aiModel') }}</label>
                <n-select
                    v-if="settingsStore.aiProvider !== 'ollama'"
                    :value="settingsStore.aiModel"
                    :options="modelOptions"
                    @update:value="handleAiModelChange"
                />
                <n-input
                    v-else
                    :value="settingsStore.aiModel"
                    :placeholder="$t('settings.label.aiModelPlaceholder')"
                    @update:value="handleAiModelChange"
                />
            </div>

            <n-divider/>

            <div class="settings-item">
                <label class="settings-item-title">{{ $t('settings.label.aiApiKey') }}</label>
                <n-input
                    v-model:value="apiKeyInput"
                    type="password"
                    show-password-on="click"
                    :placeholder="$t('settings.label.aiApiKeyPlaceholder')"
                    :disabled="!settingsStore.aiProvider"
                    @update:value="handleApiKeyChange"
                />
            </div>

            <n-divider v-if="settingsStore.aiProvider === 'ollama'"/>

            <div v-if="settingsStore.aiProvider === 'ollama'" class="settings-item">
                <label class="settings-item-title">{{ $t('settings.label.aiEndpoint') }}</label>
                <n-input
                    :value="settingsStore.aiOllamaEndpoint"
                    placeholder="http://localhost:11434"
                    @update:value="handleAiEndpointChange"
                />
            </div>

        </div>

      </n-card>
    </n-scrollbar>
</template>

<style scoped>
.settings-card {
    padding: 20px 10px;
    margin: 5% 7%;
    width: 86%;
}

.settings-title {
    font-size: 1.5em;
    font-weight: bold;
    display: block;
    margin-bottom: 20px;
}

.settings-section-title {
    font-size: 1.2em;
    font-weight: 600;
    display: block;
    margin-bottom: 16px;
}

.settings-item {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 16px;
    margin-bottom: 12px;
}

.settings-item-title {
    font-size: 1em;
}

.settings-item :deep(.n-select) {
    width: 150px;
    justify-self: end;
}

.settings-item :deep(.n-input-number) {
    width: 150px;
    justify-self: end;
}

.settings-item :deep(.n-input) {
    width: 250px;
    justify-self: end;
}
</style>
