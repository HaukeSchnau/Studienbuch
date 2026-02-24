export class Logger {
  with(_: Record<string, unknown>) {
    return this;
  }

  debug(_: string, __?: Record<string, unknown>) {}
  info(_: string, __?: Record<string, unknown>) {}
  warn(_: string, __?: Record<string, unknown>) {}
  error(_: string, __?: Record<string, unknown>) {}
  flush() {}
}

export const withAxiom = <T extends (...args: any[]) => any>(handler: T): T => handler;

export const AxiomWebVitals = () => null;
