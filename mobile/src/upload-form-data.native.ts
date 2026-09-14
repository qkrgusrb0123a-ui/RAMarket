import { File } from 'expo-file-system';
import type { UploadableImage } from './market-api';

export async function createImageFormData(image: UploadableImage, filename: string, mimeType: string) {
  const formData = new FormData();
  // Expo SDK 57 requires a real File/Blob value; the legacy React Native
  // { uri, type, name } object is not a supported FormData part on iOS.
  formData.append('image', new File(image.uri), filename);
  formData.append('mimeType', mimeType);
  return formData;
}
