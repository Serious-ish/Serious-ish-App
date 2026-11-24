import { render, screen } from '@testing-library/react-native';

import { ErrorBoundary } from '../app/_layout';

jest.mock('@sentry/react-native', () => ({ captureMessage: jest.fn(), init: jest.fn() }));
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: { getItemSync: () => null, setItemSync: () => {} },
}));

// The root layout's error boundary (app/_layout.tsx). Tests live outside app/, where every file is a
// route. A crash shows the general error (G08), never the error's own text or stack (Security 06).
it('shows G08, not the error, when something crashes', async () => {
  const error = new Error('TypeError: cannot read secret_token of undefined');
  error.stack = 'at Profile (/app/profile.tsx:12:3)';
  await render(<ErrorBoundary error={error} retry={async () => {}} />);
  expect(screen.getByText('Something went wrong. Restart Serious-ish.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  const shown = JSON.stringify(screen.toJSON());
  expect(shown).not.toContain('secret_token');
  expect(shown).not.toContain('profile.tsx');
});
