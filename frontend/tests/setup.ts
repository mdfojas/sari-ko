import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// RTL's own auto-cleanup only registers when `afterEach` is a global
// (vitest.config.mts doesn't set test.globals), so it's wired explicitly here.
afterEach(() => {
  cleanup();
});
