import { isBelowMinimum, toConfig } from './remoteConfig';

jest.mock('@sentry/react-native', () => ({ captureMessage: jest.fn(), init: jest.fn() }));

describe('remote config (Frontend Specification 8.3)', () => {
  it('reads the two switches the app needs', () => {
    expect(
      toConfig([
        { key: 'min_app_version', value_json: '1.4.0' },
        { key: 'maintenance_mode', value_json: true },
        { key: 'launch_phase', value_json: 'development' },
      ]),
    ).toEqual({ minAppVersion: '1.4.0', maintenance: true });
  });

  it('a missing or odd value blocks nothing', () => {
    expect(toConfig([])).toEqual({ minAppVersion: null, maintenance: false });
    expect(toConfig([{ key: 'maintenance_mode', value_json: 'yes' }]).maintenance).toBe(false);
  });

  it.each([
    ['1.2.0', '1.3.0', true],
    ['1.2.9', '1.10.0', true],
    ['1.10.0', '1.9.9', false],
    ['1.2.0', '1.2.0', false],
    ['1.2', '1.2.1', true],
    ['2.0.0', null, false],
  ])('%s is below %s: %s', (version, minimum, below) => {
    expect(isBelowMinimum(version, minimum)).toBe(below);
  });
});
