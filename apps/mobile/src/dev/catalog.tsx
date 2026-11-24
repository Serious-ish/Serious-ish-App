import { radius, space } from '@serious-ish/design-tokens';
import { useState, type ReactElement, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Banner, type BannerKind } from '@/components/ui/Banner';
import { CountBadge, PlanBadge, VerifiedBadge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { CodeInput } from '@/components/ui/CodeInput';
import { Dialog } from '@/components/ui/Dialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { BellIcon, GearIcon, TrashIcon, XIcon } from '@/components/ui/icons';
import { ListRow } from '@/components/ui/ListRow';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { Toast } from '@/components/ui/Toast';
import { en } from '@/i18n/en';
import { useTheme } from '@/theme/useTheme';

// Every component state from Frontend Specification section 05, in one list. The gallery screen
// shows it and the snapshot and accessibility tests render it in both themes, so the two cannot
// drift apart. Development builds only: sample words here are not member-facing.

export type Demo = { name: string; render: () => ReactElement };
// Wide sections stretch their demos to the full column; others keep their natural width.
export type Section = { title: string; wide?: boolean; demos: Demo[] };

const noop = () => {};

function Field(
  props: Omit<Parameters<typeof TextField>[0], 'value' | 'onChangeText'> & { initial?: string },
) {
  const [value, setValue] = useState(props.initial ?? '');
  return <TextField {...props} value={value} onChangeText={setValue} />;
}

function Code({ initial = '', error }: { initial?: string; error?: string }) {
  const [value, setValue] = useState(initial);
  return <CodeInput label="Six-digit code" value={value} onChangeText={setValue} error={error} />;
}

function ToggleChip({ label, initial }: { label: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  return <Chip label={label} selected={on} onPress={() => setOn(!on)} />;
}

function ToggleSwitch({ initial, disabled }: { initial: boolean; disabled?: boolean }) {
  const [on, setOn] = useState(initial);
  return (
    <Switch label="Show me in Discovery" value={on} onValueChange={setOn} disabled={disabled} />
  );
}

function Distance() {
  const [km, setKm] = useState(50);
  return (
    <Slider
      label="Maximum distance"
      min={1}
      max={160}
      value={km}
      onChange={setKm}
      format={(n) => `${n} km`}
    />
  );
}

function AgeRange() {
  const [ages, setAges] = useState<[number, number]>([24, 35]);
  return <Slider label="Age range" min={18} max={80} value={ages} onChange={setAges} />;
}

// Timed messages come back with a button, so the gallery can show them again.
function Again({ children }: { children: (hide: () => void) => ReactNode }) {
  const [shown, setShown] = useState(true);
  return shown ? (
    children(() => setShown(false))
  ) : (
    <Button label="Show again" variant="text" onPress={() => setShown(true)} />
  );
}

function BannerDemo({ kind, message }: { kind: BannerKind; message: string }) {
  return <Again>{(hide) => <Banner kind={kind} message={message} onHide={hide} />}</Again>;
}

// Overlays open from a button. The tests press "Show ..." to snapshot the open state.
function Overlay({
  name,
  children,
}: {
  name: string;
  children: (open: boolean, close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        label={`Show ${name}`}
        variant="secondary"
        size="medium"
        onPress={() => setOpen(true)}
      />
      {children(open, () => setOpen(false))}
    </>
  );
}

// A stand-in for a photo behind the photo badges.
function Photo({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  return <View style={[styles.photo, { backgroundColor: c.secondary }]}>{children}</View>;
}

export const catalog: Section[] = [
  {
    title: 'Buttons',
    demos: [
      { name: 'Primary, large', render: () => <Button label="Continue" onPress={noop} /> },
      {
        name: 'Primary, medium',
        render: () => <Button label="Continue" size="medium" onPress={noop} />,
      },
      {
        name: 'Primary, small',
        render: () => <Button label="Continue" size="small" onPress={noop} />,
      },
      {
        name: 'Primary, disabled',
        render: () => <Button label="Go live" disabled onPress={noop} />,
      },
      {
        name: 'Primary, loading',
        render: () => <Button label="Continue" loading onPress={noop} />,
      },
      {
        name: 'Secondary',
        render: () => <Button label="Not now" variant="secondary" onPress={noop} />,
      },
      {
        name: 'Secondary, disabled',
        render: () => <Button label="Not now" variant="secondary" disabled onPress={noop} />,
      },
      {
        name: 'Secondary, loading',
        render: () => <Button label="Not now" variant="secondary" loading onPress={noop} />,
      },
      { name: 'Text', render: () => <Button label="Skip for now" variant="text" onPress={noop} /> },
      {
        name: 'Text, emphasis',
        render: () => <Button label="Resend code" variant="text" emphasis onPress={noop} />,
      },
      {
        name: 'Text, disabled',
        render: () => <Button label="Resend code" variant="text" disabled onPress={noop} />,
      },
      {
        name: 'Destructive',
        render: () => (
          <Button label="Delete account" variant="destructive" icon={TrashIcon} onPress={noop} />
        ),
      },
      {
        name: 'Destructive, confirm',
        render: () => <Button label="Delete" variant="destructiveConfirm" onPress={noop} />,
      },
      {
        name: 'Icon button',
        render: () => <IconButton icon={XIcon} label="Close" onPress={noop} />,
      },
      {
        name: 'Icon button, in a header',
        render: () => <IconButton icon={XIcon} label="Close" onPress={noop} bare />,
      },
    ],
  },
  {
    title: 'Text fields',
    wide: true,
    demos: [
      { name: 'Empty', render: () => <Field label="First name" placeholder="e.g. Maya" /> },
      {
        name: 'Filled, with helper',
        render: () => <Field label="First name" initial="Maya" helper="Shown on your profile" />,
      },
      { name: 'Optional', render: () => <Field label="Job title" optional /> },
      {
        name: 'Error',
        render: () => (
          <Field label="Email" type="email" initial="maya@" error="Enter a full email address." />
        ),
      },
      {
        name: 'Disabled',
        render: () => (
          <Field
            label="Date of birth"
            initial="04 / 12 / 1996"
            disabled
            helper="You can't change this later."
          />
        ),
      },
      {
        name: 'Phone',
        render: () => <Field label="Phone number" type="phone" initial="4165550123" />,
      },
      {
        name: 'Email',
        render: () => <Field label="Email" type="email" placeholder="you@example.com" />,
      },
      {
        name: 'Text area with counter',
        render: () => (
          <Field
            label="About me"
            type="multiline"
            maxLength={500}
            initial="Coffee first, then hiking."
          />
        ),
      },
    ],
  },
  {
    title: 'Code input',
    demos: [
      { name: 'Empty', render: () => <Code /> },
      { name: 'Partly typed', render: () => <Code initial="482" /> },
      {
        name: 'Error',
        render: () => <Code initial="482913" error="That code didn't match. Try again." />,
      },
    ],
  },
  {
    title: 'Chips',
    demos: [
      { name: 'Off', render: () => <ToggleChip label="Hiking" initial={false} /> },
      { name: 'On', render: () => <ToggleChip label="Coffee" initial /> },
      { name: 'Read-only', render: () => <Chip label="Non-smoker" /> },
    ],
  },
  {
    title: 'Badges',
    demos: [
      { name: 'Verified, on a profile', render: () => <VerifiedBadge /> },
      {
        name: 'Verified, on a photo',
        render: () => (
          <Photo>
            <VerifiedBadge photoTag />
          </Photo>
        ),
      },
      { name: 'Spark', render: () => <PlanBadge plan="spark" /> },
      { name: 'Elite', render: () => <PlanBadge plan="elite" /> },
      {
        name: 'Elite, on a photo',
        render: () => (
          <Photo>
            <PlanBadge plan="elite" photoTag />
          </Photo>
        ),
      },
      { name: 'Count', render: () => <CountBadge count={3} /> },
      { name: 'Count over 9', render: () => <CountBadge count={12} /> },
    ],
  },
  {
    title: 'Cards',
    wide: true,
    demos: [
      {
        name: 'Basic',
        render: () => (
          <Card>
            <Text>Cards hold related content on --raise.</Text>
          </Card>
        ),
      },
      {
        name: 'Tappable',
        render: () => (
          <Card onPress={noop} accessibilityLabel="Open your plan">
            <Text>Free plan</Text>
          </Card>
        ),
      },
      {
        name: 'Settings group',
        render: () => (
          <Card padded={false}>
            <ListRow icon={BellIcon} label="Notifications" onPress={noop} divider />
            <ListRow icon={GearIcon} label="Appearance" value="System" onPress={noop} />
          </Card>
        ),
      },
    ],
  },
  {
    title: 'List rows',
    wide: true,
    demos: [
      { name: 'Plain', render: () => <ListRow label="Version" value="1.0.0" /> },
      {
        name: 'Tappable',
        render: () => <ListRow icon={GearIcon} label="Privacy" onPress={noop} />,
      },
      {
        name: 'With divider',
        render: () => <ListRow label="Contact details" onPress={noop} divider />,
      },
    ],
  },
  {
    title: 'Switches',
    wide: true,
    demos: [
      { name: 'Off', render: () => <ToggleSwitch initial={false} /> },
      { name: 'On', render: () => <ToggleSwitch initial /> },
      { name: 'Disabled', render: () => <ToggleSwitch initial disabled /> },
    ],
  },
  {
    title: 'Sliders',
    wide: true,
    demos: [
      { name: 'Single value', render: () => <Distance /> },
      { name: 'Range', render: () => <AgeRange /> },
    ],
  },
  {
    title: 'Progress',
    wide: true,
    demos: [
      { name: 'Continuous', render: () => <ProgressBar label="Upload" progress={0.4} /> },
      {
        name: 'Segmented',
        render: () => <ProgressBar label="Step 3 of 11" progress={3 / 11} segments={11} />,
      },
    ],
  },
  {
    title: 'Skeletons',
    wide: true,
    demos: [
      {
        name: 'Row',
        render: () => (
          <View style={styles.skeletonRow}>
            <Skeleton width={56} height={56} radius="pill" />
            <View style={styles.skeletonLines}>
              <Skeleton width="60%" height={16} />
              <Skeleton width="90%" height={12} />
            </View>
          </View>
        ),
      },
    ],
  },
  {
    title: 'Banners',
    wide: true,
    demos: [
      {
        name: 'Success',
        render: () => <BannerDemo kind="success" message="Your photos were approved." />,
      },
      {
        name: 'Info',
        render: () => <BannerDemo kind="info" message="Add two photos to go live." />,
      },
      {
        name: 'Warning',
        render: () => <BannerDemo kind="warning" message="Your match ends in 1 hour." />,
      },
      {
        name: 'Error',
        render: () => <BannerDemo kind="error" message="We couldn't save that. Try again." />,
      },
    ],
  },
  {
    title: 'Error state',
    wide: true,
    demos: [
      {
        name: 'Screen that cannot load (G02)',
        render: () => (
          <View style={styles.errorFrame}>
            <ErrorState message={en.errors.G02} onRetry={noop} />
          </View>
        ),
      },
    ],
  },
  {
    title: 'Toast',
    demos: [
      {
        name: 'Confirmation',
        render: () => <Again>{(hide) => <Toast message="Saved" onHide={hide} />}</Again>,
      },
    ],
  },
  {
    title: 'Sheet',
    demos: [
      {
        name: 'Bottom sheet',
        render: () => (
          <Overlay name="sheet">
            {(open, close) => (
              <Sheet visible={open} onClose={close} title="Report">
                <ListRow label="Fake profile" onPress={close} divider />
                <ListRow label="Inappropriate photos" onPress={close} />
              </Sheet>
            )}
          </Overlay>
        ),
      },
    ],
  },
  {
    title: 'Dialogs',
    demos: [
      {
        name: 'Ordinary',
        render: () => (
          <Overlay name="dialog">
            {(open, close) => (
              <Dialog
                visible={open}
                title="Turn on notifications?"
                body="We'll tell you when someone likes you back."
                primary={{ label: 'Turn on', onPress: close }}
                secondary={{ label: 'Not now', onPress: close }}
                onDismiss={close}
              />
            )}
          </Overlay>
        ),
      },
      {
        name: 'Destructive',
        render: () => (
          <Overlay name="destructive dialog">
            {(open, close) => (
              <Dialog
                visible={open}
                title="Unmatch?"
                body="You won't be able to message each other again."
                primary={{ label: 'Unmatch', onPress: close, destructive: true }}
                secondary={{ label: 'Not now', onPress: close }}
                onDismiss={close}
              />
            )}
          </Overlay>
        ),
      },
      {
        name: 'Blocking',
        render: () => (
          <Overlay name="blocking dialog">
            {(open, close) => (
              <Dialog
                visible={open}
                title="Update required"
                body="This version of the app is no longer supported."
                primary={{ label: 'Update', onPress: close }}
              />
            )}
          </Overlay>
        ),
      },
    ],
  },
];

const styles = StyleSheet.create({
  photo: { alignSelf: 'flex-start', padding: space.md, borderRadius: radius.md },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  skeletonLines: { flex: 1, gap: space.xs },
  errorFrame: { height: 320 },
});
