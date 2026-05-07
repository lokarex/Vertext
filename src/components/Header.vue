<script setup lang="ts">
import { NCard, NGradientText, NButton, NButtonGroup, NIcon } from 'naive-ui';
import { PanelLeftExpand16Regular, Settings20Regular } from '@vicons/fluent'
import { ReturnDownBackSharp } from '@vicons/ionicons5';
import { useRepositoriesStore } from '@/stores/repositories';
import { useNavigationStore } from '@/stores/navigation';

const repositoriesStore = useRepositoriesStore();
const navigationStore = useNavigationStore();
</script>

<template>
    <n-card class="header-card">
        <div class="header-content">
            <div class="header-left">
                <n-gradient-text type="primary" @click="navigationStore.toRepositoryList()" style="cursor: pointer">Vertext</n-gradient-text>
                <n-button-group style="margin-left: 3px;">
                    <n-button v-if="repositoriesStore.selectedRepository != null" @click="repositoriesStore.toggleFileTree()" class="file-tree-toggle" strong secondary round>
                        <n-icon :component="PanelLeftExpand16Regular" size="24" />
                    </n-button>
                    <n-button @click="navigationStore.toSettingsView()" strong secondary circle>
                        <n-icon :component="Settings20Regular" size="20" />
                    </n-button>
                </n-button-group>
            </div>

            <n-button strong secondary circle @click="navigationStore.toPreviousView()" :disabled="navigationStore.previousViews.length == 0">
                <n-icon :component="ReturnDownBackSharp" size="18" />
            </n-button>
        </div>
    </n-card>
</template>

<style scoped>
.header-card {
    position: sticky;
    top: 0;
    z-index: 100;
    padding-top: env(safe-area-inset-top, 0px);
    box-sizing: border-box;
}

.header-content {
    display: flex;
    justify-content: space-between;
}

.header-left {
    display: flex;
    align-items: center;
}

.file-tree-toggle {
    margin-left: 10px;
}
</style>
