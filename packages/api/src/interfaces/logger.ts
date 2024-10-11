export interface Logger {
  debug: (message: string, args?: Record<string, unknown>) => void;
  info: (message: string, args?: Record<string, unknown>) => void;
  warn: (message: string, args?: Record<string, unknown>) => void;
  error: (message: string, args?: Record<string, unknown>) => void;
  flush: () => Promise<void> | void;
}
