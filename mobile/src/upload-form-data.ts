import type { UploadableImage } from './market-api';

// TypeScript resolves this fallback file; Expo resolves the .native or .web
// variant at runtime for each platform.
export async function createImageFormData(_image: UploadableImage, _filename: string, _mimeType: string): Promise<FormData> {
  throw new Error('현재 플랫폼에서는 사진 업로드를 지원하지 않습니다.');
}
