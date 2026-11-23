import { palette } from '@serious-ish/design-tokens';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Reanimated from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeContext } from '@/theme/ThemeProvider';

import { Banner } from './Banner';
import { Button } from './Button';
import { CodeInput } from './CodeInput';
import { transition } from './constants';
import { Dialog } from './Dialog';
import { Skeleton } from './Skeleton';
import { Slider } from './Slider';
import { formatPhone, phoneDigits, TextField } from './TextField';
import { Toast } from './Toast';

jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: {} }));

const c = palette.light;
const show = (ui: ReactElement) =>
  render(ui, {
    wrapper: ({ children }) => (
      <GestureHandlerRootView>
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 393, height: 852 },
            insets: { top: 0, left: 0, right: 0, bottom: 0 },
          }}
        >
          <ThemeContext value={{ c, mode: 'light', preference: 'light', setPreference: () => {} }}>
            {children}
          </ThemeContext>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    ),
  });
const flat = (style: unknown) => StyleSheet.flatten(style as never) ?? {};

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('reduce motion (6.1)', () => {
  it('turns every slide and scale into a 150 ms fade', () => {
    expect(transition(true, 200)).toEqual({ duration: 150, move: false });
    expect(transition(false, 200)).toEqual({ duration: 200, move: true });
  });

  it('stills the skeleton shimmer', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    const repeat = jest.spyOn(Reanimated, 'withRepeat');
    await show(<Skeleton width={100} height={16} />);
    expect(repeat).not.toHaveBeenCalled();
  });
});

describe('Skeleton', () => {
  it('stops shimmering after 10 seconds', async () => {
    const stop = jest.spyOn(Reanimated, 'cancelAnimation');
    await show(<Skeleton width={100} height={16} />);
    jest.advanceTimersByTime(9_999);
    expect(stop).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(stop).toHaveBeenCalled();
  });
});

describe('Button (5.2)', () => {
  it('ignores taps and says "Loading" while loading', async () => {
    const onPress = jest.fn();
    await show(<Button label="Save" loading onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Save' });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityState).toMatchObject({ busy: true });
    expect(button.props.accessibilityValue).toEqual({ text: 'Loading' });
  });

  it('ignores taps when disabled', async () => {
    const onPress = jest.fn();
    await show(<Button label="Go live" disabled onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Go live' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows the focus ring on keyboard focus and removes it on blur', async () => {
    await show(<Button label="Continue" onPress={() => {}} />);
    const button = screen.getByRole('button', { name: 'Continue' });
    expect(screen.queryByTestId('focus-ring')).toBeNull();
    await fireEvent(button, 'focus');
    expect(flat(screen.getByTestId('focus-ring').props.style).borderColor).toBe(c.ink);
    await fireEvent(button, 'blur');
    expect(screen.queryByTestId('focus-ring')).toBeNull();
  });
});

describe('phone numbers (5.4)', () => {
  it('keeps 10 digits and drops the country code from pasted numbers', () => {
    expect(phoneDigits('+1 (416) 555-0123')).toBe('4165550123');
    expect(phoneDigits('416.555.0123 ext 9')).toBe('4165550123');
  });

  it('formats as (416) 555-0123 while typing', () => {
    expect(formatPhone('416')).toBe('416');
    expect(formatPhone('4165')).toBe('(416) 5');
    expect(formatPhone('4165550123')).toBe('(416) 555-0123');
  });
});

describe('TextField (5.3)', () => {
  it('hands the screen clean digits for a phone number', async () => {
    const onChangeText = jest.fn();
    await show(
      <TextField label="Phone number" type="phone" value="" onChangeText={onChangeText} />,
    );
    await fireEvent.changeText(screen.getByLabelText('Phone number'), '+1 (416) 555-0123');
    expect(onChangeText).toHaveBeenCalledWith('4165550123');
  });

  it('outlines the focused field in --brand, 2 points', async () => {
    await show(<TextField label="First name" value="" onChangeText={() => {}} />);
    const input = screen.getByLabelText('First name');
    await fireEvent(input, 'focus');
    expect(flat(input.parent?.props.style)).toMatchObject({ borderColor: c.brand, borderWidth: 2 });
  });

  it('announces an error and shows it under the field', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await show(
      <TextField
        label="Email"
        value="maya@"
        error="Enter a full email address."
        onChangeText={() => {}}
      />,
    );
    expect(screen.getByText('Enter a full email address.')).toBeTruthy();
    expect(announce).toHaveBeenCalledWith('Enter a full email address.');
  });

  it('says "(optional)" on optional fields', async () => {
    await show(<TextField label="Job title" optional value="" onChangeText={() => {}} />);
    expect(screen.getByLabelText('Job title (optional)')).toBeTruthy();
  });
});

describe('CodeInput (5.4)', () => {
  it('keeps digits only and fills all six from a pasted message', async () => {
    const onChangeText = jest.fn();
    const onComplete = jest.fn();
    await show(
      <CodeInput label="Code" value="" onChangeText={onChangeText} onComplete={onComplete} />,
    );
    const input = screen.getByLabelText('Code');
    await fireEvent.changeText(input, '4a8');
    expect(onChangeText).toHaveBeenLastCalledWith('48');
    expect(onComplete).not.toHaveBeenCalled();
    await fireEvent.changeText(input, 'Your code is 482913. It expires in 5 minutes.');
    expect(onChangeText).toHaveBeenLastCalledWith('482913');
    expect(onComplete).toHaveBeenCalledWith('482913');
  });

  it('offers the code from the text message', async () => {
    await show(<CodeInput label="Code" value="" onChangeText={() => {}} />);
    expect(screen.getByLabelText('Code').props).toMatchObject({
      textContentType: 'oneTimeCode',
      autoComplete: 'sms-otp',
      keyboardType: 'number-pad',
    });
  });
});

describe('Slider (5.4)', () => {
  const step = async (name: string, action: 'increment' | 'decrement') =>
    fireEvent(screen.getByLabelText(name), 'accessibilityAction', {
      nativeEvent: { actionName: action },
    });

  it('steps with the screen reader and stays within its limits', async () => {
    const onChange = jest.fn();
    await show(<Slider label="Distance" min={1} max={160} value={160} onChange={onChange} />);
    await step('Distance', 'increment');
    expect(onChange).toHaveBeenLastCalledWith(160);
    await step('Distance', 'decrement');
    expect(onChange).toHaveBeenLastCalledWith(159);
  });

  it('never lets the two ends of a range cross', async () => {
    const onChange = jest.fn();
    await show(<Slider label="Age" min={18} max={80} value={[30, 30]} onChange={onChange} />);
    await step('Age, minimum', 'increment');
    expect(onChange).toHaveBeenLastCalledWith([30, 30]);
    await step('Age, maximum', 'decrement');
    expect(onChange).toHaveBeenLastCalledWith([30, 30]);
  });
});

describe('Dialog (5.6)', () => {
  const modal = () => screen.root?.queryAll((n) => n.type === 'Modal')[0];

  it('closes an ordinary dialog with the back button', async () => {
    const onDismiss = jest.fn();
    await show(
      <Dialog
        visible
        title="Turn on?"
        body="Body"
        primary={{ label: 'Turn on', onPress: () => {} }}
        onDismiss={onDismiss}
      />,
    );
    await fireEvent(modal()!, 'requestClose');
    expect(onDismiss).toHaveBeenCalled();
  });

  it('keeps a blocking dialog open, with one button', async () => {
    await show(
      <Dialog
        visible
        title="Update required"
        body="Body"
        primary={{ label: 'Update', onPress: () => {} }}
      />,
    );
    await fireEvent(modal()!, 'requestClose');
    expect(screen.getByText('Update required')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});

describe('Banner and Toast (5.6)', () => {
  it('hides success after 4 seconds', async () => {
    const onHide = jest.fn();
    await show(<Banner kind="success" message="Saved." onHide={onHide} />);
    jest.advanceTimersByTime(3_999);
    expect(onHide).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('keeps an error until dismissed, and announces it', async () => {
    const onHide = jest.fn();
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await show(<Banner kind="error" message="We couldn't save that." onHide={onHide} />);
    expect(announce).toHaveBeenCalledWith("We couldn't save that.");
    jest.advanceTimersByTime(60_000);
    expect(onHide).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(onHide).toHaveBeenCalled();
  });

  it('hides a toast after 3 seconds', async () => {
    const onHide = jest.fn();
    await show(<Toast message="Saved" onHide={onHide} />);
    jest.advanceTimersByTime(3_000);
    expect(onHide).toHaveBeenCalledTimes(1);
  });
});
