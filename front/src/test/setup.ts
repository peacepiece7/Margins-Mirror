import '@testing-library/jest-dom/vitest';

class TestResizeObserver implements ResizeObserver {
  observe() {}

  unobserve() {}

  disconnect() {}
}

globalThis.ResizeObserver ??= TestResizeObserver;

const createTestStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  } as Storage;
};

for (const name of ['localStorage', 'sessionStorage'] as const) {
  try {
    if (!window[name])
      Object.defineProperty(window, name, { configurable: true, value: createTestStorage() });
  } catch {
    Object.defineProperty(window, name, { configurable: true, value: createTestStorage() });
  }
}
