export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  ts: number; // Date.now()
  level: LogLevel;
  namespace: string;
  message: string;
  args: unknown[];
}

export interface NamespaceConfig {
  /** Whether this namespace emits to console. Inherits global if undefined. */
  enabled?: boolean;
}
