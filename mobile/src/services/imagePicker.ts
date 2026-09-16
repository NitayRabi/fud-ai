/**
 * Camera / photo-library capture for food analysis and Coach attachments. Returns JPEG bytes
 * as base64 (the transport shape every provider takes), downscaled like `resizedJPEGData` in
 * `ChatView.swift` before upload so a 12 MP capture never travels or persists at full size.
 * Permission denials reject with `ImagePermissionError`, which callers turn into an alert.
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export interface PickedImage {
  /** Upload-sized JPEG (longest side ≤ `UPLOAD_MAX_DIMENSION`), base64. */
  base64: string;
  /** Local URI of the original pick, for previews while analyzing. */
  uri: string;
  width: number;
  height: number;
}

export type ImageSource = 'camera' | 'library';

export class ImagePermissionError extends Error {
  constructor(readonly source: ImageSource) {
    super(source === 'camera' ? 'Camera access is off. Enable it in Settings to scan food.' : 'Photo access is off. Enable it in Settings to pick a photo.');
    this.name = 'ImagePermissionError';
  }
}

/** Same bounds as `ChatView.send()` on iOS: 1600 px for the model, 700 px for the persisted thumbnail. */
export const UPLOAD_MAX_DIMENSION = 1600;
export const UPLOAD_JPEG_QUALITY = 0.78;
export const THUMBNAIL_MAX_DIMENSION = 700;
export const THUMBNAIL_JPEG_QUALITY = 0.68;

const pickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 1,
  base64: false,
  allowsEditing: false,
  exif: false,
};

export interface ImageRefLike {
  uri: string;
  width: number;
  height: number;
}

/**
 * `resizedJPEGData(from:maxDimension:compressionQuality:)` — scale the longest side down to
 * `maxDimension` (never up) and re-encode as JPEG, returning base64.
 */
export async function resizedJPEGBase64(image: ImageRefLike, maxDimension: number, quality: number): Promise<string> {
  const longest = Math.max(image.width, image.height);
  const context = ImageManipulator.manipulate(image.uri);
  if (longest > maxDimension && longest > 0) {
    const scale = maxDimension / longest;
    context.resize(image.width >= image.height ? { width: Math.round(image.width * scale) } : { height: Math.round(image.height * scale) });
  }
  const rendered = await context.renderAsync();
  try {
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: quality, base64: true });
    if (!saved.base64) throw new Error('Image encoding returned no data.');
    return saved.base64;
  } finally {
    rendered.release();
    context.release();
  }
}

/** Bounded thumbnail for persisted chat history (`thumbnailData` in `ChatView.send()`). */
export function thumbnailJPEGBase64(image: ImageRefLike): Promise<string> {
  return resizedJPEGBase64(image, THUMBNAIL_MAX_DIMENSION, THUMBNAIL_JPEG_QUALITY);
}

export async function pickImage(source: ImageSource): Promise<PickedImage | undefined> {
  const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new ImagePermissionError(source);
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(pickerOptions) : await ImagePicker.launchImageLibraryAsync(pickerOptions);
  if (result.canceled) return undefined;
  const asset = result.assets[0];
  if (!asset?.uri) return undefined;
  const ref: ImageRefLike = { uri: asset.uri, width: asset.width, height: asset.height };
  const base64 = await resizedJPEGBase64(ref, UPLOAD_MAX_DIMENSION, UPLOAD_JPEG_QUALITY);
  return { ...ref, base64 };
}
