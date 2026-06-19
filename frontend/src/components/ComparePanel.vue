<script setup lang="ts">
import { computed, ref } from 'vue';
import { useCanBusStore } from '../store/canbus';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart, BarChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent
} from 'echarts/components';

use([CanvasRenderer, LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent]);

const store = useCanBusStore();
const activeTab = ref<'overview' | 'signals' | 'anomalies'>('overview');

const loadCompareChart = computed(() => {
  if (!store.sessionA || !store.sessionB) return { series: [] };

  const historyA = store.sessionA.busLoadHistory;
  const historyB = store.sessionB.busLoadHistory;

  const normalizeTime = (arr: { time: number; value: number }[]) => {
    if (arr.length === 0) return [];
    const start = arr[0].time;
    return arr.map(d => [(d.time - start) / 1000, d.value]);
  };

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1f2937',
      borderColor: '#374151',
      textStyle: { color: '#e5e7eb', fontSize: 12 },
      formatter: (params: any) => {
        let html = '';
        for (const p of params) {
          html += `<div style="display:flex;align-items:center;gap:6px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
            <span>${p.seriesName}: <b>${Number(p.value[1]).toFixed(1)}%</b></span>
          </div>`;
        }
        return html;
      }
    },
    legend: {
      top: 8,
      textStyle: { color: '#9ca3af', fontSize: 11 },
      itemWidth: 12,
      itemHeight: 2
    },
    grid: {
      left: 50,
      right: 20,
      top: 40,
      bottom: 30
    },
    xAxis: {
      type: 'value',
      name: '时间 (s)',
      nameTextStyle: { color: '#6b7280', fontSize: 10 },
      axisLabel: { color: '#6b7280', fontSize: 10 },
      axisLine: { lineStyle: { color: '#374151' } },
      splitLine: { lineStyle: { color: '#1f2937' } }
    },
    yAxis: {
      type: 'value',
      name: '负载 (%)',
      nameTextStyle: { color: '#6b7280', fontSize: 10 },
      axisLabel: { color: '#6b7280', fontSize: 10 },
      axisLine: { lineStyle: { color: '#374151' } },
      splitLine: { lineStyle: { color: '#1f2937' } },
      min: 0,
      max: 100
    },
    series: [
      {
        name: store.sessionA.name,
        type: 'line' as const,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: '#06b6d4' },
        itemStyle: { color: '#06b6d4' },
        data: normalizeTime(historyA)
      },
      {
        name: store.sessionB.name,
        type: 'line' as const,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: '#f59e0b' },
        itemStyle: { color: '#f59e0b' },
        data: normalizeTime(historyB)
      }
    ]
  };
});

const signalCompareChart = computed(() => {
  if (!store.sessionA || !store.sessionB) return { series: [] };

  const signalNames = store.signalDiffs.slice(0, 8).map(d => d.name);

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1f2937',
      borderColor: '#374151',
      textStyle: { color: '#e5e7eb', fontSize: 12 },
      axisPointer: { type: 'shadow' }
    },
    legend: {
      top: 8,
      textStyle: { color: '#9ca3af', fontSize: 11 },
      itemWidth: 12,
      itemHeight: 12
    },
    grid: {
      left: 50,
      right: 20,
      top: 40,
      bottom: 30
    },
    xAxis: {
      type: 'category',
      data: signalNames,
      axisLabel: { color: '#6b7280', fontSize: 10, rotate: 30 },
      axisLine: { lineStyle: { color: '#374151' } }
    },
    yAxis: {
      type: 'value',
      name: '平均值',
      nameTextStyle: { color: '#6b7280', fontSize: 10 },
      axisLabel: { color: '#6b7280', fontSize: 10 },
      axisLine: { lineStyle: { color: '#374151' } },
      splitLine: { lineStyle: { color: '#1f2937' } }
    },
    series: [
      {
        name: store.sessionA.name,
        type: 'bar' as const,
        data: signalNames.map(name => {
          const stats = store.sessionA?.signalStats.get(name);
          return stats?.avg ?? 0;
        }),
        itemStyle: { color: '#06b6d4' },
        barWidth: '30%'
      },
      {
        name: store.sessionB.name,
        type: 'bar' as const,
        data: signalNames.map(name => {
          const stats = store.sessionB?.signalStats.get(name);
          return stats?.avg ?? 0;
        }),
        itemStyle: { color: '#f59e0b' },
        barWidth: '30%'
      }
    ]
  };
});

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', { hour12: false });
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'high': return 'text-red-400 bg-red-900/30';
    case 'medium': return 'text-yellow-400 bg-yellow-900/30';
    case 'low': return 'text-blue-400 bg-blue-900/30';
    default: return 'text-gray-400 bg-gray-900/30';
  }
}

function getSeverityLabel(severity: string): string {
  switch (severity) {
    case 'high': return '高';
    case 'medium': return '中';
    case 'low': return '低';
    default: return severity;
  }
}

function getDiffColor(diffPercent: number): string {
  if (diffPercent > 20) return 'text-red-400';
  if (diffPercent > 10) return 'text-yellow-400';
  if (diffPercent < -20) return 'text-red-400';
  if (diffPercent < -10) return 'text-yellow-400';
  return 'text-green-400';
}

function getDiffIcon(diffPercent: number): string {
  if (diffPercent > 5) return '↑';
  if (diffPercent < -5) return '↓';
  return '→';
}

function formatNumber(val: number | undefined): string {
  if (val === undefined || val === null) return '-';
  return val.toFixed(1);
}
</script>

<template>
  <div class="flex flex-col h-full bg-gray-900">
    <div class="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
      <h3 class="text-sm font-semibold text-gray-300">多车对比模式</h3>
      <button
        @click="store.setCompareMode(false)"
        class="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
      >
        退出对比
      </button>
    </div>

    <div class="grid grid-cols-2 gap-3 p-3 bg-gray-850 border-b border-gray-700" style="background-color: #1a2234;">
      <div class="bg-gray-800 rounded-lg p-3 border border-gray-700">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs text-cyan-400 font-semibold">会话 A</span>
          <span class="text-xs text-gray-500" v-if="store.sessionA">{{ formatTime(store.sessionA.createdAt) }}</span>
        </div>
        <select
          :value="store.selectedSessionA || ''"
          @change="store.selectSessionForCompare('A', ($event.target as HTMLSelectElement).value || null)"
          class="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-gray-200 focus:outline-none focus:border-cyan-500"
        >
          <option value="">请选择采集会话</option>
          <option v-for="s in store.sessions" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <div v-if="store.sessionA" class="mt-2 flex gap-3 text-xs">
          <div>
            <span class="text-gray-500">帧数:</span>
            <span class="text-gray-200 ml-1 font-mono">{{ store.sessionA.busStats.totalFrames }}</span>
          </div>
          <div>
            <span class="text-gray-500">负载:</span>
            <span class="text-yellow-400 ml-1 font-mono">{{ store.sessionA.busStats.busLoad.toFixed(1) }}%</span>
          </div>
        </div>
      </div>

      <div class="bg-gray-800 rounded-lg p-3 border border-gray-700">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs text-amber-400 font-semibold">会话 B</span>
          <span class="text-xs text-gray-500" v-if="store.sessionB">{{ formatTime(store.sessionB.createdAt) }}</span>
        </div>
        <select
          :value="store.selectedSessionB || ''"
          @change="store.selectSessionForCompare('B', ($event.target as HTMLSelectElement).value || null)"
          class="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-gray-200 focus:outline-none focus:border-cyan-500"
        >
          <option value="">请选择采集会话</option>
          <option v-for="s in store.sessions" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <div v-if="store.sessionB" class="mt-2 flex gap-3 text-xs">
          <div>
            <span class="text-gray-500">帧数:</span>
            <span class="text-gray-200 ml-1 font-mono">{{ store.sessionB.busStats.totalFrames }}</span>
          </div>
          <div>
            <span class="text-gray-500">负载:</span>
            <span class="text-yellow-400 ml-1 font-mono">{{ store.sessionB.busStats.busLoad.toFixed(1) }}%</span>
          </div>
        </div>
      </div>
    </div>

    <div class="flex gap-1 px-3 py-2 bg-gray-800 border-b border-gray-700">
      <button
        v-for="tab in [
          { key: 'overview', label: '总览对比' },
          { key: 'signals', label: '信号对比' },
          { key: 'anomalies', label: '异常差异' }
        ]"
        :key="tab.key"
        @click="activeTab = tab.key as any"
        class="px-3 py-1 text-xs rounded transition-colors"
        :class="activeTab === tab.key
          ? 'bg-cyan-600 text-white'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
      >
        {{ tab.label }}
        <span
          v-if="tab.key === 'anomalies' && store.anomalyDiffs.length > 0"
          class="ml-1 px-1.5 py-0.5 rounded-full text-xs"
          :class="store.anomalyDiffs.some(a => a.severity === 'high') ? 'bg-red-500 text-white' : 'bg-yellow-500 text-gray-900'"
        >
          {{ store.anomalyDiffs.length }}
        </span>
      </button>
    </div>

    <div class="flex-1 overflow-auto">
      <div v-if="!store.canCompare" class="flex items-center justify-center h-full">
        <div class="text-center text-gray-500">
          <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p class="text-sm">请选择两个会话进行对比</p>
          <p class="text-xs mt-1">先在采集模式保存会话，再到这里选择对比</p>
        </div>
      </div>

      <div v-else class="p-3 space-y-3">
        <template v-if="activeTab === 'overview'">
          <div class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <div class="px-3 py-2 bg-gray-850 border-b border-gray-700" style="background-color: #1a2234;">
              <h4 class="text-sm font-medium text-gray-300">总线负载对比</h4>
            </div>
            <div class="p-3" style="height: 220px;">
              <VChart :option="loadCompareChart" autoresize class="w-full h-full" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="bg-gray-800 rounded-lg border border-gray-700 p-3">
              <h4 class="text-sm font-medium text-gray-300 mb-2">{{ store.sessionA?.name }} 统计</h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-500">总帧数</span>
                  <span class="text-gray-200 font-mono">{{ store.sessionA?.busStats.totalFrames }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">RX 帧</span>
                  <span class="text-green-400 font-mono">{{ store.sessionA?.busStats.rxCount }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">TX 帧</span>
                  <span class="text-blue-400 font-mono">{{ store.sessionA?.busStats.txCount }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">平均负载</span>
                  <span class="text-yellow-400 font-mono">{{ store.sessionA?.busStats.busLoad.toFixed(1) }}%</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">信号数量</span>
                  <span class="text-cyan-400 font-mono">{{ store.sessionA?.signalStats.size }}</span>
                </div>
              </div>
            </div>
            <div class="bg-gray-800 rounded-lg border border-gray-700 p-3">
              <h4 class="text-sm font-medium text-gray-300 mb-2">{{ store.sessionB?.name }} 统计</h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-500">总帧数</span>
                  <span class="text-gray-200 font-mono">{{ store.sessionB?.busStats.totalFrames }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">RX 帧</span>
                  <span class="text-green-400 font-mono">{{ store.sessionB?.busStats.rxCount }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">TX 帧</span>
                  <span class="text-blue-400 font-mono">{{ store.sessionB?.busStats.txCount }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">平均负载</span>
                  <span class="text-yellow-400 font-mono">{{ store.sessionB?.busStats.busLoad.toFixed(1) }}%</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">信号数量</span>
                  <span class="text-cyan-400 font-mono">{{ store.sessionB?.signalStats.size }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <div class="px-3 py-2 bg-gray-850 border-b border-gray-700" style="background-color: #1a2234;">
              <h4 class="text-sm font-medium text-gray-300">信号均值对比</h4>
            </div>
            <div class="p-3" style="height: 250px;">
              <VChart :option="signalCompareChart" autoresize class="w-full h-full" />
            </div>
          </div>
        </template>

        <template v-else-if="activeTab === 'signals'">
          <div class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <table class="w-full text-sm">
              <thead class="bg-gray-850" style="background-color: #1a2234;">
                <tr class="text-gray-400 text-left">
                  <th class="px-3 py-2 font-medium">信号名称</th>
                  <th class="px-3 py-2 font-medium text-right">{{ store.sessionA?.name }} (均值)</th>
                  <th class="px-3 py-2 font-medium text-right">{{ store.sessionB?.name }} (均值)</th>
                  <th class="px-3 py-2 font-medium text-right">差值</th>
                  <th class="px-3 py-2 font-medium text-right">变化率</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="diff in store.signalDiffs"
                  :key="diff.name"
                  class="border-t border-gray-700 hover:bg-gray-750"
                >
                  <td class="px-3 py-2 text-gray-200 font-mono">{{ diff.name }}</td>
                  <td class="px-3 py-2 text-right text-gray-300 font-mono">
                    {{ diff.sessionA ? formatNumber(diff.sessionA.avg) : '-' }}
                  </td>
                  <td class="px-3 py-2 text-right text-gray-300 font-mono">
                    {{ diff.sessionB ? formatNumber(diff.sessionB.avg) : '-' }}
                  </td>
                  <td class="px-3 py-2 text-right font-mono" :class="getDiffColor(diff.diffPercent)">
                    {{ diff.sessionA && diff.sessionB
                      ? (diff.diffAvg > 0 ? '+' : '') + diff.diffAvg.toFixed(2)
                      : '-' }}
                  </td>
                  <td class="px-3 py-2 text-right">
                    <span
                      v-if="diff.sessionA && diff.sessionB"
                      class="px-1.5 py-0.5 rounded text-xs font-mono"
                      :class="getDiffColor(diff.diffPercent)"
                    >
                      {{ getDiffIcon(diff.diffPercent) }}
                      {{ diff.diffPercent > 0 ? '+' : '' }}{{ diff.diffPercent.toFixed(1) }}%
                    </span>
                    <span v-else class="text-gray-500">-</span>
                  </td>
                </tr>
                <tr v-if="store.signalDiffs.length === 0">
                  <td colspan="5" class="px-3 py-8 text-center text-gray-500">
                    无信号数据
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <template v-else-if="activeTab === 'anomalies'">
          <div v-if="store.anomalyDiffs.length === 0" class="flex items-center justify-center py-12">
            <div class="text-center text-gray-500">
              <svg class="w-12 h-12 mx-auto mb-3 opacity-50 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p class="text-sm">未检测到显著异常差异</p>
              <p class="text-xs mt-1">两次采集数据较为接近</p>
            </div>
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="(anomaly, idx) in store.anomalyDiffs"
              :key="idx"
              class="bg-gray-800 rounded-lg border border-gray-700 p-3"
            >
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-2">
                  <span
                    class="px-2 py-0.5 rounded text-xs font-semibold"
                    :class="getSeverityColor(anomaly.severity)"
                  >
                    {{ getSeverityLabel(anomaly.severity) }}
                  </span>
                  <span class="text-sm font-medium text-gray-200">{{ anomaly.name }}</span>
                  <span class="text-xs text-gray-500">
                    {{ anomaly.type === 'signal' ? '信号' : anomaly.type === 'busload' ? '总线负载' : '帧率' }}
                  </span>
                </div>
                <span class="text-xs text-gray-400">{{ anomaly.description }}</span>
              </div>
              <div class="mt-2 grid grid-cols-3 gap-4 text-xs">
                <div>
                  <span class="text-gray-500">{{ store.sessionA?.name }}:</span>
                  <span class="text-cyan-400 ml-1 font-mono">
                    {{ anomaly.type === 'framerate' ? anomaly.sessionA : anomaly.sessionA.toFixed(2) }}
                  </span>
                </div>
                <div>
                  <span class="text-gray-500">{{ store.sessionB?.name }}:</span>
                  <span class="text-amber-400 ml-1 font-mono">
                    {{ anomaly.type === 'framerate' ? anomaly.sessionB : anomaly.sessionB.toFixed(2) }}
                  </span>
                </div>
                <div>
                  <span class="text-gray-500">差值:</span>
                  <span
                    class="ml-1 font-mono"
                    :class="anomaly.diff > 0 ? 'text-red-400' : 'text-green-400'"
                  >
                    {{ anomaly.diff > 0 ? '+' : '' }}
                    {{ anomaly.type === 'framerate' ? anomaly.diff : anomaly.diff.toFixed(2) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
