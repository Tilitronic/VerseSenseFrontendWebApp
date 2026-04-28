// Public API — import from 'src/services/logging'
export { createLogger } from './logger';
export type { LogLevel, LogEntry, NamespaceConfig } from './types';
export {
  globalEnabled,
  namespaces,
  setGlobalEnabled,
  enableNamespace,
  disableNamespace,
} from './registry';

// Pre-built named loggers
export { trieLog, mlLog, stressAsyncLog, stressSyncLog, phoneticLog } from './loggers';
