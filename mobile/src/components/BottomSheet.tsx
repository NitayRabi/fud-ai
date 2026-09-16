import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { AppText, Row } from './primitives';

interface BottomSheetProps {
  visible: boolean;
  title?: string;
  onDismiss: () => void;
  children: React.ReactNode;
  /** Optional trailing action in the header (e.g. Done). */
  trailing?: React.ReactNode;
}

/**
 * Card-style sheet anchored to the bottom, the same on both platforms. Stands in for SwiftUI
 * `.sheet` / `Menu` presentations until native sheets are bridged.
 */
export function BottomSheet({ visible, title, onDismiss, children, trailing }: BottomSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel="Dismiss" onPress={onDismiss} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.35)' }} />
        <View
          style={{
            backgroundColor: theme.colors.appBackground,
            borderTopLeftRadius: theme.radii.cardLarge,
            borderTopRightRadius: theme.radii.cardLarge,
            paddingBottom: Math.max(insets.bottom, theme.spacing.lg),
            maxHeight: '85%',
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: theme.colors.fill }} />
          </View>
          {title || trailing ? (
            <Row style={{ paddingHorizontal: theme.spacing.lg, paddingTop: 12, paddingBottom: 4, justifyContent: 'space-between' }}>
              <AppText variant="headline">{title ?? ''}</AppText>
              {trailing}
            </Row>
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
