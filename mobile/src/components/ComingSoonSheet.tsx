import { View } from 'react-native';

import { useTheme } from '../theme';
import { BottomSheet } from './BottomSheet';
import { Icon, type SFSymbolName } from './Icon';
import { AppText, PrimaryButton } from './primitives';

interface ComingSoonSheetProps {
  visible: boolean;
  title: string;
  message: string;
  icon?: SFSymbolName;
  onDismiss: () => void;
  buttonTitle?: string;
}

/**
 * Native-styled empty / “still in the native apps” surface. Prefer this over `Alert.alert` for
 * Settings placeholders and features that are named but not yet ported.
 */
export function ComingSoonSheet({ visible, title, message, icon = 'info.circle', onDismiss, buttonTitle = 'OK' }: ComingSoonSheetProps) {
  const theme = useTheme();
  return (
    <BottomSheet visible={visible} title={title} onDismiss={onDismiss} surface="card" detent="auto">
      <View style={{ alignItems: 'center', gap: 12, paddingVertical: 8 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.accentAlpha(0.12), alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={28} color={theme.colors.accent} />
        </View>
        <AppText variant="subheadline" tone="secondary" align="center">
          {message}
        </AppText>
      </View>
      <PrimaryButton title={buttonTitle} onPress={onDismiss} />
    </BottomSheet>
  );
}
