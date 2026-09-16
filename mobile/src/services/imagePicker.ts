/**
 * Camera / photo-library capture for food analysis. Returns JPEG bytes as base64 (the
 * transport shape every provider takes), downscaled the same way `UIImage.jpegData` is on
 * iOS before upload. Permission denials resolve to `undefined` with an explanatory alert
 * left to the caller.
 */

import * as ImagePicker from 'expo-image-picker';

export interface PickedImage {
  base64: string;
  /** Local URI for previews while analyzing. */
  uri: string;
}

export type ImageSource = 'camera' | 'library';

export class ImagePermissionError extends Error {
  constructor(readonly source: ImageSource) {
    super(source === 'camera' ? 'Camera access is off. Enable it in Settings to scan food.' : 'Photo access is off. Enable it in Settings to pick a photo.');
    this.name = 'ImagePermissionError';
  }
}

const pickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.7,
  base64: true,
  allowsEditing: false,
  exif: false,
};

export async function pickImage(source: ImageSource): Promise<PickedImage | undefined> {
  const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new ImagePermissionError(source);
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(pickerOptions) : await ImagePicker.launchImageLibraryAsync(pickerOptions);
  if (result.canceled) return undefined;
  const asset = result.assets[0];
  if (!asset?.base64) return undefined;
  return { base64: asset.base64, uri: asset.uri };
}
