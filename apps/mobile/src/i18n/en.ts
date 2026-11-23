// Every word the app shows lives here so French can follow (Frontend Specification 6.2, FE-08).
// FT-005 adds the error catalogue's messages.
export const en = {
  ui: {
    loading: 'Loading',
    close: 'Close',
    optional: '(optional)',
    verified: 'Verified',
    plan: { spark: 'Spark', elite: 'Elite' },
    count: (n: number) => (n > 9 ? '9+' : String(n)),
    counter: (length: number, max: number) => `${length} / ${max}`,
    countryCode: '+1',
    minimum: 'minimum',
    maximum: 'maximum',
  },
} as const;
