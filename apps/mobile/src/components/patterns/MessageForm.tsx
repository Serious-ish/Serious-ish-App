import { space } from '@serious-ish/design-tokens';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Header } from '@/components/ui/Header';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { en } from '@/i18n/en';
import { ApiError } from '@/lib/api';
import { describeError } from '@/lib/errorCatalog';
import { MESSAGE_MAX } from '@/lib/support';
import { useTheme } from '@/theme/useTheme';

type Props = {
  title: string;
  intro: string;
  label: string;
  sendLabel: string;
  // Sends the trimmed text and returns what to tell the member once it has gone.
  send: (text: string) => Promise<string>;
};

// The appeal and support forms (FT-046): one message, sent once, then a confirmation. A failure
// shows the component the error catalogue names, and the typed text is kept for Try again.
export function MessageForm({ title, intro, label, sendLabel, send }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const mutation = useMutation({ mutationFn: () => send(text.trim()) });
  const error = mutation.error
    ? describeError(mutation.error instanceof ApiError ? mutation.error : new ApiError('', null))
    : null;

  if (error?.message && (error.show === 'screen' || error.show === 'dialog')) {
    // ponytail: the sign-in-expired dialog (A15) shows as a screen until sign-in lands (FT-013).
    return <ErrorState message={error.message} onRetry={() => mutation.reset()} />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <Header title={title} onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: space.lg + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {mutation.isSuccess ? (
          <>
            <Text accessibilityLiveRegion="polite">{mutation.data}</Text>
            <Button label={en.notices.done} onPress={() => router.back()} />
          </>
        ) : (
          <>
            <Text>{intro}</Text>
            {error?.message && <Banner kind="error" message={error.message} />}
            <TextField
              label={label}
              type="multiline"
              value={text}
              onChangeText={setText}
              maxLength={MESSAGE_MAX}
            />
            <Button
              label={sendLabel}
              onPress={() => mutation.mutate()}
              disabled={text.trim() === ''}
              loading={mutation.isPending}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md },
});
