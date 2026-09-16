declare global {
  interface Window {
    ttq?: {
      page: (...args: unknown[]) => void;
      track: (event: string, params?: Record<string, unknown>) => void;
      [key: string]: unknown;
    };
  }
}

export {};
