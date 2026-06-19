<script setup lang="ts">
import { useCanBusStore } from './store/canbus';
import FrameTable from './components/FrameTable.vue';
import SignalChart from './components/SignalChart.vue';
import ComparePanel from './components/ComparePanel.vue';

const store = useCanBusStore();

function handleLoadDbc() {
  store.loadMockDbc();
  alert(`已加载 DBC 定义: ${store.dbcMessages.size} 条消息`);
}

function handleExport() {
  const csv = store.exportFrames();
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `can_frames_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function handleSaveSession() {
  if (store.frames.length === 0) {
    alert('暂无数据可保存，请先开始捕获');
    return;
  }
  const session = store.saveSession();
  alert(`已保存会话: ${session.name} (${session.frames.length} 帧)`);
}

function handleToggleCompare() {
  store.setCompareMode(!store.compareMode);
}
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-900 text-gray-100 overflow-hidden">
    <!-- Header -->
    <header class="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700 shrink-0">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-cyan-600 rounded-lg flex items-center justify-center">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        </div>
        <h1 class="text-lg font-bold text-gray-100">CAN 总线数据帧解析与诊断仪</h1>
      </div>

      <div class="flex items-center gap-2">
        <button
          v-if="!store.compareMode"
          @click="handleLoadDbc"
          class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm rounded transition-colors border border-gray-600"
        >
          加载DBC
        </button>
        <button
          v-if="!store.compareMode"
          @click="store.isCapturing ? store.stopCapture() : store.startCapture()"
          class="px-3 py-1.5 text-sm rounded transition-colors font-medium"
          :class="store.isCapturing
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-green-600 hover:bg-green-700 text-white'"
        >
          {{ store.isCapturing ? '停止捕获' : '开始捕获' }}
        </button>
        <button
          v-if="!store.compareMode"
          @click="store.clearFrames()"
          class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm rounded transition-colors border border-gray-600"
        >
          清除
        </button>
        <button
          v-if="!store.compareMode"
          @click="handleSaveSession"
          class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
        >
          保存会话
          <span v-if="store.sessions.length > 0" class="ml-1 px-1.5 py-0.5 bg-blue-800 rounded text-xs">{{ store.sessions.length }}</span>
        </button>
        <button
          v-if="!store.compareMode"
          @click="handleExport"
          class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm rounded transition-colors border border-gray-600"
        >
          导出CSV
        </button>
        <button
          @click="handleToggleCompare"
          class="px-3 py-1.5 text-sm rounded transition-colors font-medium"
          :class="store.compareMode
            ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
            : 'bg-purple-600 hover:bg-purple-700 text-white'"
        >
          {{ store.compareMode ? '返回采集' : '多车对比' }}
        </button>
      </div>
    </header>

    <!-- Main Area -->
    <main class="flex-1 flex overflow-hidden">
      <template v-if="store.compareMode">
        <div class="flex-1 flex flex-col overflow-hidden">
          <ComparePanel />
        </div>
      </template>
      <template v-else>
        <!-- Left Panel: Frame Table (60%) -->
        <div class="w-3/5 border-r border-gray-700 flex flex-col overflow-hidden">
          <FrameTable />
        </div>

        <!-- Right Panel: Signal Chart (40%) -->
        <div class="w-2/5 flex flex-col overflow-hidden">
          <SignalChart />
        </div>
      </template>
    </main>

    <!-- Status Bar -->
    <footer class="flex items-center justify-between px-6 py-1.5 bg-gray-800 border-t border-gray-700 text-xs shrink-0">
      <div class="flex items-center gap-4 text-gray-500">
        <template v-if="!store.compareMode">
          <span>
            <span :class="store.isCapturing ? 'text-green-400' : 'text-gray-500'">
              ● {{ store.isCapturing ? '捕获中' : '已停止' }}
            </span>
          </span>
          <span>DBC消息: {{ store.dbcMessages.size }}</span>
        </template>
        <template v-else>
          <span>
            <span class="text-purple-400">● 对比模式</span>
          </span>
          <span>会话数: {{ store.sessions.length }}</span>
          <span v-if="store.canCompare" class="text-cyan-400">
            {{ store.sessionA?.name }} ↔ {{ store.sessionB?.name }}
          </span>
        </template>
      </div>
      <div class="flex items-center gap-4 text-gray-500">
        <template v-if="!store.compareMode">
          <span>帧数: {{ store.busStats.totalFrames }}</span>
          <span>RX: {{ store.busStats.rxCount }}</span>
          <span>TX: {{ store.busStats.txCount }}</span>
          <span>负载: {{ store.busLoadPercent }}%</span>
        </template>
        <template v-else-if="store.canCompare">
          <span>异常: {{ store.anomalyDiffs.length }} 项</span>
          <span>信号差异: {{ store.signalDiffs.filter(d => d.isSignificant).length }} 个显著</span>
        </template>
      </div>
    </footer>
  </div>
</template>
