<script lang="ts" setup>
import { SettingsManager, Theme } from '@/settings';
import { NSelect, SelectOption, NInputNumber, NCard, NDivider } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';

const { t } = useI18n();

const settingsManager = SettingsManager();

const themeOptions = computed(() => [
    {
        value: 'darkTheme',
        label: t('theme.dark'),
    },
    {
        value: 'lightTheme',
        label: t('theme.light'),
    },
]);

function handleThemeChange(value: string, _options: SelectOption) {
    settingsManager.setTheme(value as Theme);
}

function handleFontSizeChange(value: number | null) {
    if (value !== null) {
        settingsManager.setFontSize(value)
    }
}

const languageOptions = computed(() => [
    {
        value: 'en',
        label: t('language.en'),
    },
    {
        value: 'zh-CN',
        label: t('language.zh'),
    },
]);

function handleLanguageChange(value: "en" | "zh-CN", _options: SelectOption) {
    settingsManager.setLanguage(value);
}
</script>

<template>
    <n-card class="settings-card">
        <label class="settings-title">{{ $t('settings.title') }}</label>
        
        <div>
            <label class="settings-section-title">{{ $t('settings.appearance') }}</label>

            <div class="settings-item">
                <label class="settings-item-title">{{ $t('settings.theme') }}</label>
                <n-select v-model:value="settingsManager.theme" :options="themeOptions" @update-value="handleThemeChange"/>
            </div>

            <n-divider/>

            <div class="settings-item">
                <label class="settings-item-title">{{ $t('settings.fontSize') }}</label>
                <n-input-number v-model:value="settingsManager.fontSize" size="small" @update:value="handleFontSizeChange" :min="12" :max="36"/>
            </div>

            <n-divider/>

            <div class="settings-item">
                <label class="settings-item-title">{{ $t('settings.language') }}</label>
                <n-select v-model:value="settingsManager.language" :options="languageOptions" @update-value="handleLanguageChange"/>
            </div>

        </div>

    </n-card>
</template>

<style scoped>
.settings-card {
    padding: 20px 10px;
    margin: 10% 7%;
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
</style>