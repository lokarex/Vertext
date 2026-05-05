<script setup lang="ts">
import SettingsPage from "@/views/SettingsPage.vue";
import { darkTheme, lightTheme, NConfigProvider, NGlobalStyle, NMessageProvider } from 'naive-ui';
import type { GlobalTheme, GlobalThemeOverrides } from 'naive-ui';
import { useSettingsStore, Theme } from '@/stores/settings';
import { computed } from 'vue';
import Header from '@/components/Header.vue';
import FileTreeDrawer from '@/components/FileTreeDrawer.vue';
import { useNavigationStore } from '@/stores/navigation';
import RepositoryList from '@/views/RepositoryList.vue';
import Editor from '@/views/Editor.vue';

const navigationStore = useNavigationStore();
const settingsStore = useSettingsStore();

const themeMap: Record<Exclude<Theme, null>, GlobalTheme> = {
  'lightTheme': lightTheme,
  'darkTheme': darkTheme,
};

const themeOverrides = computed<GlobalThemeOverrides>(() => ({
  common: {
    fontSize: settingsStore.fontSize + 'px',
  },
}));
</script>

<template>
  <n-config-provider :theme="themeMap[settingsStore.theme ?? 'lightTheme']" :theme-overrides="themeOverrides">
    <n-global-style />
    <n-message-provider>
      <main class="container">
        <Header />
        <div v-if="navigationStore.selectedView == 'settingsView'">
          <SettingsPage />
        </div>
        <div v-if="navigationStore.selectedView == 'repositoryList'">
          <RepositoryList />
        </div>
        <div v-if="navigationStore.selectedView == 'editor'">
          <Editor />
        </div>
        <FileTreeDrawer />
      </main>
    </n-message-provider>
  </n-config-provider>
</template>

<style scoped>
</style>

<style>
</style>
