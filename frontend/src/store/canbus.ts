import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  CanFrame,
  DbcMessage,
  BusStats,
  CaptureSession,
  SignalStats,
  SignalDiff,
  AnomalyDiff
} from '../types';
import { parseDbc, decodeCanFrame, DEFAULT_DBC_CONTENT } from '../utils/dbc-parser';

let frameIdCounter = 0;
let sessionIdCounter = 0;

export const useCanBusStore = defineStore('canbus', () => {
  const frames = ref<CanFrame[]>([]);
  const signals = ref<Map<string, { name: string; data: { time: number; value: number }[] }>>(new Map());
  const dbcMessages = ref<Map<number, DbcMessage>>(new Map());
  const filterId = ref('');
  const filterText = ref('');
  const isCapturing = ref(false);
  const pollInterval = ref<number | null>(null);
  const busLoadHistory = ref<{ time: number; value: number }[]>([]);

  const sessions = ref<CaptureSession[]>([]);
  const compareMode = ref(false);
  const selectedSessionA = ref<string | null>(null);
  const selectedSessionB = ref<string | null>(null);

  const busStats = ref<BusStats>({
    totalFrames: 0,
    rxCount: 0,
    txCount: 0,
    errorCount: 0,
    busLoad: 0,
    lastUpdate: Date.now()
  });

  const filteredFrames = computed(() => {
    let result = frames.value;

    if (filterId.value.trim()) {
      const idFilter = filterId.value.trim().toLowerCase().replace(/^0x/, '');
      result = result.filter(f =>
        f.arbitrationId.toString(16).toLowerCase().includes(idFilter)
      );
    }

    if (filterText.value.trim()) {
      const textFilter = filterText.value.trim().toLowerCase();
      result = result.filter(f => {
        if (f.arbitrationId.toString(16).toLowerCase().includes(textFilter)) return true;
        if (f.data.toLowerCase().includes(textFilter)) return true;
        for (const key of Object.keys(f.decoded)) {
          if (key.toLowerCase().includes(textFilter)) return true;
        }
        return false;
      });
    }

    return result;
  });

  const busLoadPercent = computed(() => {
    return busStats.value.busLoad.toFixed(1);
  });

  function addFrame(frame: CanFrame) {
    frames.value.push(frame);
    if (frames.value.length > 500) {
      frames.value = frames.value.slice(-500);
    }

    busStats.value.totalFrames++;
    if (frame.direction === 'RX') busStats.value.rxCount++;
    else busStats.value.txCount++;
    busStats.value.lastUpdate = Date.now();

    // Update signal history
    const msgDef = dbcMessages.value.get(frame.arbitrationId);
    if (msgDef) {
      const decoded = decodeCanFrame(frame, msgDef);
      frame.decoded = decoded;
      for (const [name, value] of Object.entries(decoded)) {
        if (!signals.value.has(name)) {
          signals.value.set(name, { name, data: [] });
        }
        const sig = signals.value.get(name)!;
        sig.data.push({ time: frame.timestamp, value });
        if (sig.data.length > 100) {
          sig.data = sig.data.slice(-100);
        }
      }
    }

    // Simulate bus load (random 15-45%)
    busStats.value.busLoad = 15 + Math.random() * 30;
    busLoadHistory.value.push({ time: frame.timestamp, value: busStats.value.busLoad });
    if (busLoadHistory.value.length > 100) {
      busLoadHistory.value = busLoadHistory.value.slice(-100);
    }
  }

  function clearFrames() {
    frames.value = [];
    signals.value = new Map();
    busLoadHistory.value = [];
    busStats.value = {
      totalFrames: 0,
      rxCount: 0,
      txCount: 0,
      errorCount: 0,
      busLoad: 0,
      lastUpdate: Date.now()
    };
    frameIdCounter = 0;
  }

  function calculateSignalStats(
    signalData: { time: number; value: number }[]
  ): Omit<SignalStats, 'name'> | null {
    if (signalData.length === 0) return null;
    const values = signalData.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    return {
      min,
      max,
      avg,
      latest: values[values.length - 1],
      count: values.length
    };
  }

  function getAllSignalStats(
    sigMap: Map<string, { name: string; data: { time: number; value: number }[] }>
  ): Map<string, SignalStats> {
    const result = new Map<string, SignalStats>();
    for (const [name, sig] of sigMap.entries()) {
      const stats = calculateSignalStats(sig.data);
      if (stats) {
        result.set(name, { name, ...stats });
      }
    }
    return result;
  }

  function saveSession(name?: string): CaptureSession {
    const session: CaptureSession = {
      id: `session-${++sessionIdCounter}`,
      name: name || `采集 ${sessionIdCounter}`,
      createdAt: Date.now(),
      frames: [...frames.value],
      signals: new Map(signals.value),
      busStats: { ...busStats.value },
      signalStats: getAllSignalStats(signals.value),
      busLoadHistory: [...busLoadHistory.value]
    };
    sessions.value.push(session);
    return session;
  }

  function deleteSession(id: string) {
    const idx = sessions.value.findIndex(s => s.id === id);
    if (idx >= 0) {
      sessions.value.splice(idx, 1);
      if (selectedSessionA.value === id) selectedSessionA.value = null;
      if (selectedSessionB.value === id) selectedSessionB.value = null;
    }
  }

  function getSessionById(id: string): CaptureSession | undefined {
    return sessions.value.find(s => s.id === id);
  }

  function setCompareMode(enabled: boolean) {
    compareMode.value = enabled;
  }

  function selectSessionForCompare(side: 'A' | 'B', sessionId: string | null) {
    if (side === 'A') {
      selectedSessionA.value = sessionId;
    } else {
      selectedSessionB.value = sessionId;
    }
  }

  const sessionA = computed(() =>
    selectedSessionA.value ? getSessionById(selectedSessionA.value) || null : null
  );

  const sessionB = computed(() =>
    selectedSessionB.value ? getSessionById(selectedSessionB.value) || null : null
  );

  const canCompare = computed(() =>
    selectedSessionA.value !== null && selectedSessionB.value !== null
  );

  const signalDiffs = computed((): SignalDiff[] => {
    if (!sessionA.value || !sessionB.value) return [];

    const allNames = new Set<string>();
    for (const name of sessionA.value.signalStats.keys()) allNames.add(name);
    for (const name of sessionB.value.signalStats.keys()) allNames.add(name);

    const diffs: SignalDiff[] = [];
    for (const name of allNames) {
      const statsA = sessionA.value.signalStats.get(name) || null;
      const statsB = sessionB.value.signalStats.get(name) || null;

      let diffAvg = 0;
      let diffPercent = 0;
      let isSignificant = false;

      if (statsA && statsB) {
        diffAvg = statsB.avg - statsA.avg;
        diffPercent = statsA.avg !== 0 ? (diffAvg / Math.abs(statsA.avg)) * 100 : 0;
        isSignificant = Math.abs(diffPercent) > 10;
      }

      diffs.push({
        name,
        sessionA: statsA,
        sessionB: statsB,
        diffAvg,
        diffPercent,
        isSignificant
      });
    }

    return diffs.sort((a, b) => Math.abs(b.diffPercent) - Math.abs(a.diffPercent));
  });

  const anomalyDiffs = computed((): AnomalyDiff[] => {
    if (!sessionA.value || !sessionB.value) return [];

    const anomalies: AnomalyDiff[] = [];

    const statsA = sessionA.value.busStats;
    const statsB = sessionB.value.busStats;

    const busLoadDiff = statsB.busLoad - statsA.busLoad;
    const busLoadDiffPercent = statsA.busLoad !== 0
      ? (busLoadDiff / Math.abs(statsA.busLoad)) * 100
      : 0;

    if (Math.abs(busLoadDiffPercent) > 15) {
      anomalies.push({
        type: 'busload',
        name: '总线负载',
        sessionA: statsA.busLoad,
        sessionB: statsB.busLoad,
        diff: busLoadDiff,
        severity: Math.abs(busLoadDiffPercent) > 30 ? 'high' : 'medium',
        description: `总线负载变化 ${busLoadDiffPercent > 0 ? '+' : ''}${busLoadDiffPercent.toFixed(1)}%`
      });
    }

    const frameDiff = statsB.totalFrames - statsA.totalFrames;
    const frameDiffPercent = statsA.totalFrames !== 0
      ? (frameDiff / Math.abs(statsA.totalFrames)) * 100
      : 0;

    if (Math.abs(frameDiffPercent) > 20) {
      anomalies.push({
        type: 'framerate',
        name: '总帧数',
        sessionA: statsA.totalFrames,
        sessionB: statsB.totalFrames,
        diff: frameDiff,
        severity: Math.abs(frameDiffPercent) > 50 ? 'high' : 'medium',
        description: `总帧数变化 ${frameDiffPercent > 0 ? '+' : ''}${frameDiffPercent.toFixed(1)}%`
      });
    }

    for (const diff of signalDiffs.value) {
      if (diff.isSignificant && diff.sessionA && diff.sessionB) {
        anomalies.push({
          type: 'signal',
          name: diff.name,
          sessionA: diff.sessionA.avg,
          sessionB: diff.sessionB.avg,
          diff: diff.diffAvg,
          severity: Math.abs(diff.diffPercent) > 30 ? 'high' : Math.abs(diff.diffPercent) > 20 ? 'medium' : 'low',
          description: `${diff.name} 均值变化 ${diff.diffPercent > 0 ? '+' : ''}${diff.diffPercent.toFixed(1)}%`
        });
      }
    }

    return anomalies.sort((a, b) => {
      const sevOrder = { high: 0, medium: 1, low: 2 };
      return sevOrder[a.severity] - sevOrder[b.severity];
    });
  });

  function loadMockDbc() {
    parseAndLoadDbc(DEFAULT_DBC_CONTENT);
  }

  function parseAndLoadDbc(text: string) {
    dbcMessages.value = parseDbc(text);
  }

  function generateMockFrame(): CanFrame {
    const messageIds = Array.from(dbcMessages.value.keys());
    const arbId = messageIds.length > 0
      ? messageIds[Math.floor(Math.random() * messageIds.length)]
      : 0x7DF;

    const msgDef = dbcMessages.value.get(arbId);

    // Generate realistic OBD-II values
    const rpm = Math.floor(800 + Math.random() * 5200);
    const speed = Math.floor(Math.random() * 120);
    const temp = Math.floor(70 + Math.random() * 35);
    const throttle = Math.floor(Math.random() * 100);
    const load = Math.floor(Math.random() * 100);

    // Encode values into bytes (simplified encoding for display)
    const rpmRaw = Math.round(rpm / 0.25);
    const rpmLow = rpmRaw & 0xFF;
    const rpmHigh = (rpmRaw >> 8) & 0xFF;
    const speedByte = speed & 0xFF;
    const tempByte = (temp + 40) & 0xFF;
    const throttleByte = Math.round(throttle / 0.392) & 0xFF;
    const loadByte = Math.round(load / 0.392) & 0xFF;

    const dataBytes = [rpmLow, rpmHigh, speedByte, tempByte, throttleByte, loadByte, 0x00, 0x00];
    const dataHex = dataBytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

    const frame: CanFrame = {
      id: `frame-${++frameIdCounter}`,
      timestamp: Date.now(),
      arbitrationId: arbId,
      dlc: 8,
      data: dataHex,
      decoded: {},
      direction: Math.random() > 0.3 ? 'RX' : 'TX'
    };

    if (msgDef) {
      frame.decoded = {
        EngineRPM: rpm,
        VehicleSpeed: speed,
        CoolantTemp: temp,
        ThrottlePosition: throttle,
        EngineLoad: load
      };
    }

    return frame;
  }

  function startCapture() {
    if (isCapturing.value) return;
    isCapturing.value = true;

    // Load mock DBC if not loaded
    if (dbcMessages.value.size === 0) {
      loadMockDbc();
    }

    pollInterval.value = window.setInterval(() => {
      const frame = generateMockFrame();
      addFrame(frame);
    }, 200);
  }

  function stopCapture() {
    isCapturing.value = false;
    if (pollInterval.value !== null) {
      clearInterval(pollInterval.value);
      pollInterval.value = null;
    }
  }

  function decodeFrame(frame: CanFrame): Record<string, number> {
    const msgDef = dbcMessages.value.get(frame.arbitrationId);
    if (!msgDef) return {};
    return decodeCanFrame(frame, msgDef);
  }

  function exportFrames(): string {
    const header = 'Timestamp,Direction,CAN_ID,DLC,Data,Decoded\n';
    const rows = frames.value.map(f => {
      const decodedStr = Object.entries(f.decoded)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
      return `${f.timestamp},${f.direction},0x${f.arbitrationId.toString(16).toUpperCase()},${f.dlc},"${f.data}","${decodedStr}"`;
    }).join('\n');
    return header + rows;
  }

  return {
    frames,
    signals,
    dbcMessages,
    filterId,
    filterText,
    busStats,
    isCapturing,
    busLoadHistory,
    filteredFrames,
    busLoadPercent,
    sessions,
    compareMode,
    selectedSessionA,
    selectedSessionB,
    sessionA,
    sessionB,
    canCompare,
    signalDiffs,
    anomalyDiffs,
    addFrame,
    clearFrames,
    loadMockDbc,
    parseAndLoadDbc,
    startCapture,
    stopCapture,
    decodeFrame,
    exportFrames,
    saveSession,
    deleteSession,
    getSessionById,
    setCompareMode,
    selectSessionForCompare
  };
});
