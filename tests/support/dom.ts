// Matchers do Testing Library (toBeInTheDocument, toHaveFocus...) para os projetos com jsdom.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
