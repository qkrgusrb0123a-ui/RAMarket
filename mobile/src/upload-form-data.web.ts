import type { UploadableImage } from './market-api';

export async function createImageFormData(image: UploadableImage, filename: string, mimeType: string) {
  const response = await fetch(image.uri);
  const blob = await response.blob();
  const formData = new FormData();
  formData.append('image', blob, filename);
  formData.append('mimeType', mimeType);
  return formData;
}
