import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom performs no layout, so scrollIntoView is missing from Element entirely.
Element.prototype.scrollIntoView = vi.fn();
