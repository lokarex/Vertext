<script setup lang="ts">
import { NCard, NGradientText, NButton, NDrawer, NDrawerContent, NIcon, NButtonGroup } from 'naive-ui';
import { ref } from 'vue'
import { PanelLeftExpand16Regular,PanelRightExpand20Regular, Settings20Regular } from '@vicons/fluent'
import { ReturnDownBackSharp } from '@vicons/ionicons5';
import { ViewsManager } from '@/views';

const viewsManager = ViewsManager();

const drawerActive = ref(false)
function openDrawer() {
    drawerActive.value = true
}

function closeDrawer() {
    drawerActive.value = false
}
</script>

<template>
    <n-card class="header-card">
        <div class="header-content">
            <div class="header-left">
                <n-gradient-text type="primary" @click="viewsManager.toRepositoryList()" style="cursor: pointer">Vertext</n-gradient-text>
                <n-button-group>
                    <n-button @click="openDrawer" class="drawer-toggle" strong secondary round>
                        <n-icon :component="PanelLeftExpand16Regular" size="24" />
                    </n-button>
                    <n-button @click="viewsManager.toSettingsView()" strong secondary circle>
                        <n-icon :component="Settings20Regular" size="20" />
                    </n-button>
                </n-button-group>
            </div>

            <n-button strong secondary circle @click="viewsManager.toPreviousView()" :disabled="viewsManager.previousViews.length == 0">
                <n-icon :component="ReturnDownBackSharp" size="18" />
            </n-button>
        </div>
    </n-card>

    <n-drawer v-model:show="drawerActive" :default-width="200" :min-width="200" :placement="'left'" resizable>
        <n-drawer-content>
            <div class="drawer-header">
                <label>File Tree</label>
                <n-button @click="closeDrawer" class="drawer-toggle" strong secondary round>
                    <n-icon :component="PanelRightExpand20Regular" size="24" />
                </n-button>
            </div>
        </n-drawer-content>
    </n-drawer>
</template>

<style scoped>
.header-card {
    position: sticky;
    top: 0;
    z-index: 100;
}

.header-content {
    display: flex;
    justify-content: space-between;
}

.header-left {
    display: flex;
    align-items: center;
}

.drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
}

.drawer-toggle {
    margin-left: 10px;
}
</style>