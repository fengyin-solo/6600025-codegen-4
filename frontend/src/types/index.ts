export interface CanFrame {
  id: string;
  timestamp: number;
  arbitrationId: number;
  dlc: number;
  data: string;
  decoded: Record<string, number>;
  direction: 'RX' | 'TX';
}

export interface DbcSignal {
  name: string;
  startBit: number;
  bitLength: number;
  factor: number;
  offset: number;
  unit: string;
  minValue: number;
  maxValue: number;
  messageId: number;
}

export interface DbcMessage {
  id: number;
  name: string;
  dlc: number;
  sender: string;
  signals: DbcSignal[];
}

export interface BusStats {
  totalFrames: number;
  rxCount: number;
  txCount: number;
  errorCount: number;
  busLoad: number;
  lastUpdate: number;
}

export interface SignalStats {
  name: string;
  min: number;
  max: number;
  avg: number;
  latest: number;
  count: number;
}

export interface CaptureSession {
  id: string;
  name: string;
  createdAt: number;
  frames: CanFrame[];
  signals: Map<string, { name: string; data: { time: number; value: number }[] }>;
  busStats: BusStats;
  signalStats: Map<string, SignalStats>;
  busLoadHistory: { time: number; value: number }[];
}

export interface SignalDiff {
  name: string;
  sessionA: SignalStats | null;
  sessionB: SignalStats | null;
  diffAvg: number;
  diffPercent: number;
  isSignificant: boolean;
}

export interface AnomalyDiff {
  type: 'signal' | 'busload' | 'framerate';
  name: string;
  sessionA: number;
  sessionB: number;
  diff: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
}
