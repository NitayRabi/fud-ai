import { View } from 'react-native';

import { Icon, type SFSymbolName } from '../components/Icon';
import { AppText, Screen } from '../components/primitives';
import { useTheme } from '../theme';

interface PlaceholderScreenProps {
  title: string;
  icon: SFSymbolName;
  description: string;
}

/** Tab stand-in for features not yet ported (Progress, Coach, Workouts). */
export function PlaceholderScreen({ title, icon, description }: PlaceholderScreenProps) {
  const theme = useTheme();
  return (
    <Screen style={{ alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl }}>
      <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: theme.colors.fill, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
        <Icon name={icon} size={42} color={theme.colors.accent} />
      </View>
      <AppText variant="title" align="center">
        {title}
      </AppText>
      <AppText variant="callout" tone="secondary" align="center" style={{ marginTop: 8 }}>
        {description}
      </AppText>
    </Screen>
  );
}
