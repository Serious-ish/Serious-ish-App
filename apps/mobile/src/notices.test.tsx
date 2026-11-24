import { palette } from '@serious-ish/design-tokens';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import Appeal from '../app/appeal';
import Deleted from '../app/deleted';
import HoldNotice from '../app/hold-notice';
import Restricted from '../app/restricted';
import Support from '../app/support';
import { en } from '@/i18n/en';
import { ApiError } from '@/lib/api';
import { useGate } from '@/lib/gate';
import { requestSupport, submitAppeal } from '@/lib/support';
import { ThemeContext } from '@/theme/ThemeProvider';

jest.mock('@sentry/react-native', () => ({ captureMessage: jest.fn(), init: jest.fn() }));
jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: {} }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('@/lib/gate', () => ({ useGate: jest.fn() }));
jest.mock('@/lib/support', () => ({
  MESSAGE_MAX: 1000,
  submitAppeal: jest.fn(),
  requestSupport: jest.fn(),
}));

// The hold, restricted and deletion notices and their appeal and support path (FT-046). Tests
// live outside app/, where every file is a route.

let client: QueryClient;
afterEach(() => client.clear());

const show = (ui: ReactElement, mode: 'light' | 'dark' = 'light') => {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(ui, {
    wrapper: ({ children }) => (
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 393, height: 852 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <ThemeContext value={{ c: palette[mode], mode, preference: mode, setPreference: () => {} }}>
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        </ThemeContext>
      </SafeAreaProvider>
    ),
  });
};

const button = (name: string) => screen.getByRole('button', { name });

describe('notices (7.2)', () => {
  it.each([
    ['held', HoldNotice, en.errors.R03, en.notices.heldBlocked, true],
    ['suspended', Restricted, en.errors.A18, en.notices.restrictedBlocked, true],
    ['deleted', Deleted, en.errors.X03, en.notices.deletedBody, false],
  ])(
    '%s: its message, what it blocks and only the actions it allows',
    async (_, Page, message, body, appeal) => {
      await show(<Page />);
      expect(screen.getByRole('header', { name: message })).toBeTruthy();
      expect(screen.getByText(body)).toBeTruthy();
      expect(screen.queryAllByRole('button', { name: en.notices.appeal })).toHaveLength(
        appeal ? 1 : 0,
      );
      await fireEvent.press(button(en.notices.contactSupport));
      expect(router.push).toHaveBeenCalledWith('/support');
    },
  );

  it('Appeal opens the appeal form', async () => {
    await show(<HoldNotice />);
    await fireEvent.press(button(en.notices.appeal));
    expect(router.push).toHaveBeenCalledWith('/appeal');
  });

  it.each(['light', 'dark'] as const)('draws from the theme in %s', async (mode) => {
    await show(<Restricted />, mode);
    expect(screen.toJSON()).toMatchSnapshot();
  });
});

describe('appeal', () => {
  const type = async (text: string) =>
    fireEvent.changeText(screen.getByLabelText(en.notices.appealLabel), text);

  it('sends nothing until there is something to send', async () => {
    await show(<Appeal />);
    await type('   ');
    expect(button(en.notices.appealSend)).toBeDisabled();
  });

  it('sends the trimmed message once and confirms', async () => {
    jest.mocked(submitAppeal).mockResolvedValue('appeal');
    await show(<Appeal />);
    await type('  Please look again.  ');
    await fireEvent.press(button(en.notices.appealSend));
    expect(submitAppeal).toHaveBeenCalledWith('Please look again.');
    expect(await screen.findByText(en.notices.appealSent)).toBeTruthy();
    await fireEvent.press(button(en.notices.done));
    expect(router.back).toHaveBeenCalled();
  });

  it('with nothing to appeal, says support has it instead (R08)', async () => {
    jest.mocked(submitAppeal).mockResolvedValue('support');
    await show(<Appeal />);
    await type('Why?');
    await fireEvent.press(button(en.notices.appealSend));
    expect(await screen.findByText(en.errors.R08)).toBeTruthy();
  });

  it('offline shows the G01 banner and keeps the message', async () => {
    jest.mocked(submitAppeal).mockRejectedValue(new ApiError('OFFLINE', null));
    await show(<Appeal />);
    await type('Please look again.');
    await fireEvent.press(button(en.notices.appealSend));
    expect(await screen.findByText(en.errors.G01)).toBeTruthy();
    expect(screen.getByDisplayValue('Please look again.')).toBeTruthy();
  });

  it('a server failure shows the G02 screen, and Try again returns to the message', async () => {
    jest.mocked(submitAppeal).mockRejectedValue(new ApiError('SERVER_ERROR', 500));
    await show(<Appeal />);
    await type('Please look again.');
    await fireEvent.press(button(en.notices.appealSend));
    expect(await screen.findByText(en.errors.G02)).toBeTruthy();
    await fireEvent.press(button(en.ui.tryAgain));
    expect(await screen.findByDisplayValue('Please look again.')).toBeTruthy();
  });
});

describe('support', () => {
  it.each([
    ['hold', 'other'],
    ['restricted', 'other'],
    ['deleted', 'deletion_query'],
  ] as const)('from the %s notice it sends a %s request', async (to, kind) => {
    jest.mocked(useGate).mockReturnValue({ ready: true, place: { to } });
    jest.mocked(requestSupport).mockResolvedValue('request-1');
    await show(<Support />);
    await fireEvent.changeText(screen.getByLabelText(en.notices.supportLabel), ' Help ');
    await fireEvent.press(button(en.notices.supportSend));
    expect(requestSupport).toHaveBeenCalledWith(kind, 'Help');
    expect(await screen.findByText(en.notices.supportSent)).toBeTruthy();
  });
});
