import { Ionicons } from '@expo/vector-icons';
import type { StyleProp, TextStyle } from 'react-native';

/**
 * SF Symbol names used by the SwiftUI app, mapped to one icon set rendered identically on both
 * platforms. Add to the map rather than using platform-specific symbols in screens.
 */
export const sfSymbolToIonicon = {
  'house.fill': 'home',
  'chart.bar.fill': 'stats-chart',
  'bubble.left.and.bubble.right.fill': 'chatbubbles',
  'gearshape.fill': 'settings-sharp',
  dumbbell: 'barbell',
  plus: 'add',
  sparkles: 'sparkles',
  'key.fill': 'key',
  'key.horizontal': 'key-outline',
  'bolt.horizontal.circle.fill': 'flash',
  'chevron.right': 'chevron-forward',
  'chevron.left': 'chevron-back',
  'checkmark.square.fill': 'checkbox',
  square: 'square-outline',
  'checkmark.circle.fill': 'checkmark-circle',
  'checkmark.seal.fill': 'ribbon',
  'photo.fill': 'image',
  'lock.shield.fill': 'shield-checkmark',
  cpu: 'hardware-chip-outline',
  brain: 'bulb-outline',
  link: 'link-outline',
  'eye.fill': 'eye',
  'eye.slash.fill': 'eye-off',
  'flame.fill': 'flame',
  'drop.fill': 'water',
  timer: 'timer-outline',
  'stop.fill': 'stop',
  trash: 'trash-outline',
  'trash.fill': 'trash',
  'heart.fill': 'heart',
  'heart.slash.fill': 'heart-dislike',
  'arrow.up.arrow.down': 'swap-vertical',
  'square.and.arrow.up': 'share-outline',
  'sunrise.fill': 'partly-sunny',
  'sun.max.fill': 'sunny',
  'moon.fill': 'moon',
  'cup.and.saucer.fill': 'cafe',
  'fork.knife': 'restaurant',
  'figure.walk': 'walk',
  'person.crop.circle': 'person-circle-outline',
  target: 'locate-outline',
  bell: 'notifications-outline',
  waveform: 'pulse-outline',
  'slider.horizontal.3': 'options-outline',
  heart: 'heart-outline',
  externaldrive: 'server-outline',
  'arrow.triangle.2.circlepath.circle.fill': 'refresh-circle',
  'exclamationmark.bubble.fill': 'chatbox-ellipses',
  'person.3.fill': 'people',
  camera: 'camera-outline',
  'text.bubble': 'chatbox-outline',
  mic: 'mic-outline',
  barcode: 'barcode-outline',
  'square.and.pencil': 'create-outline',
  'clock.arrow.circlepath': 'time-outline',
  'list.bullet.circle': 'list-circle-outline',
  xmark: 'close',
} as const;

export type SFSymbolName = keyof typeof sfSymbolToIonicon;

interface IconProps {
  name: SFSymbolName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function Icon({ name, size = 20, color, style }: IconProps) {
  return <Ionicons name={sfSymbolToIonicon[name]} size={size} color={color} style={style} />;
}
