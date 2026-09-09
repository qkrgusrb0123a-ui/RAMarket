import type { AuthSession } from './auth';
import { File } from 'expo-file-system';

type ApiProductImage = { path: string; sort_order: number };
type ApiSeller = { id: string; nickname: string; avatar_url: string | null } | { id: string; nickname: string; avatar_url: string | null }[] | null;

type ApiProduct = {
  id: string;
  title: string;
  description: string;
  category: string;
  product_type: 'desktop' | 'laptop';
  condition: 'new' | 'like_new' | 'good' | 'fair';
  asking_price: number;
  status: 'active' | 'reserved' | 'sold' | 'hidden';
  created_at: string;
  seller: ApiSeller;
  products_images: ApiProductImage[] | null;
};

export type Product = {
  id: string;
  title: string;
  description: string;
  category: string;
  productType: 'desktop' | 'laptop';
  condition: 'new' | 'like_new' | 'good' | 'fair';
  askingPrice: number;
  status: 'active' | 'reserved' | 'sold' | 'hidden';
  createdAt: string;
  seller: { id: string; nickname: string; avatarUrl: string | null };
  imagePaths: string[];
};

export type ProductInput = {
  title: string;
  description: string;
  category: string;
  productType: 'desktop' | 'laptop';
  condition: 'new' | 'like_new' | 'good' | 'fair';
  askingPrice: number;
  imagePaths: string[];
};

export type ChatMessage = {
  id: string;
  productId: string;
  senderId: string;
  recipientId: string;
  content: string;
  createdAt: string;
};

export type ChatThread = {
  id: string;
  product: Pick<Product, 'id' | 'title' | 'askingPrice' | 'imagePaths'>;
  otherUser: { id: string; nickname: string };
  lastMessage: string;
  createdAt: string;
};

export type UploadableImage = { uri: string; mimeType?: string | null; fileSize?: number | null };

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');

function errorMessage(response: Response, data: { error?: unknown }) {
  const serverError = typeof data.error === 'string' ? data.error : undefined;
  // A current API has DELETE /api/v1/products/:productId. The global 404
  // response therefore indicates a stale deployment or an incorrect API URL.
  if (response.status === 404 && serverError === 'Route not found.') {
    return '연결된 서버에 최신 판매글 관리 기능이 배포되지 않았습니다. Render API를 최신 커밋으로 배포한 뒤 다시 시도해 주세요.';
  }
  return serverError ?? '요청을 처리하지 못했습니다.';
}

function requireApiBaseUrl() {
  if (!apiBaseUrl) throw new Error('클라우드 API 주소가 설정되지 않았습니다. EXPO_PUBLIC_API_BASE_URL을 확인해 주세요.');
  if (!/^https:\/\//.test(apiBaseUrl) || /YOUR_(LOCAL_IP|RENDER_SERVICE)/i.test(apiBaseUrl)) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL에 실제 Render HTTPS 주소를 입력해 주세요. 예시 문자열은 사용할 수 없습니다.');
  }
  return apiBaseUrl;
}

function tokenHeaders(session: AuthSession) {
  return { Authorization: `Bearer ${session.session.accessToken}`, 'Content-Type': 'application/json' };
}

async function apiRequest<T>(path: string, session?: AuthSession, init?: RequestInit): Promise<T> {
  const baseUrl = requireApiBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...(session ? tokenHeaders(session) : {}), ...(init?.headers ?? {}) }
    });
  } catch {
    throw new Error('클라우드 서버에 연결할 수 없습니다. API 주소와 네트워크를 확인해 주세요.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorMessage(response, data));
  return data as T;
}

function oneSeller(seller: ApiSeller) {
  if (Array.isArray(seller)) return seller[0] ?? { id: '', nickname: '알 수 없음', avatar_url: null };
  return seller ?? { id: '', nickname: '알 수 없음', avatar_url: null };
}

function productFromApi(product: ApiProduct): Product {
  return {
    id: product.id,
    title: product.title,
    description: product.description,
    category: product.category,
    productType: product.product_type,
    condition: product.condition,
    askingPrice: product.asking_price,
    status: product.status,
    createdAt: product.created_at,
    seller: (() => {
      const seller = oneSeller(product.seller);
      return { id: seller.id, nickname: seller.nickname, avatarUrl: seller.avatar_url };
    })(),
    imagePaths: [...(product.products_images ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((image) => image.path)
  };
}

export function imageUrl(path?: string) {
  if (!path || !supabaseUrl) return undefined;
  return `${supabaseUrl}/storage/v1/object/public/product-images/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export async function uploadProductImages(images: UploadableImage[], session: AuthSession) {
  if (!images.length) return [];
  const paths: string[] = [];
  for (const image of images) {
    if (image.fileSize && image.fileSize > 5 * 1024 * 1024) throw new Error('사진 한 장은 5MB 이하만 등록할 수 있습니다. 더 작은 사진을 선택해 주세요.');
    const mimeType = image.mimeType === 'image/jpg' ? 'image/jpeg' : image.mimeType || 'image/jpeg';
    const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const formData = new FormData();
    // Expo SDK 57 requires a real File/Blob value here; the legacy RN
    // { uri, type, name } object causes "Unsupported FormDataPart implementation" on iOS.
    formData.append('image', new File(image.uri), `product.${extension}`);
    formData.append('mimeType', mimeType);
    const response = await fetch(`${requireApiBaseUrl()}/api/v1/uploads/product-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.session.accessToken}` },
      body: formData
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.data?.path) throw new Error(data.error ?? '사진을 클라우드 저장소에 올리지 못했습니다. 잠시 후 다시 시도해 주세요.');
    paths.push(data.data.path);
  }
  return paths;
}

export async function uploadProfileImage(image: UploadableImage, session: AuthSession) {
  if (image.fileSize && image.fileSize > 5 * 1024 * 1024) throw new Error('프로필 사진은 5MB 이하만 등록할 수 있습니다.');
  const mimeType = image.mimeType === 'image/jpg' ? 'image/jpeg' : image.mimeType || 'image/jpeg';
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const formData = new FormData();
  formData.append('image', new File(image.uri), 'profile.' + extension);
  formData.append('mimeType', mimeType);
  const response = await fetch(`${requireApiBaseUrl()}/api/v1/uploads/profile-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.session.accessToken}` },
    body: formData
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.data?.path) throw new Error(data.error ?? '프로필 사진을 올리지 못했습니다. 잠시 후 다시 시도해 주세요.');
  return data.data.path as string;
}

export const productsApi = {
  async list(session: AuthSession) {
    const result = await apiRequest<{ data: ApiProduct[] }>('/api/v1/products?limit=50', session);
    return result.data.map(productFromApi);
  },
  async create(input: ProductInput, session: AuthSession) {
    const result = await apiRequest<{ data: ApiProduct }>('/api/v1/products', session, { method: 'POST', body: JSON.stringify(input) });
    return productFromApi({ ...result.data, product_type: input.productType, seller: { id: session.user.id, nickname: session.user.loginId, avatar_url: null }, products_images: input.imagePaths.map((path, sort_order) => ({ path, sort_order })) });
  },
  async update(productId: string, input: ProductInput, session: AuthSession) {
    const result = await apiRequest<{ data: ApiProduct }>(`/api/v1/products/${productId}`, session, { method: 'PATCH', body: JSON.stringify(input) });
    return productFromApi({ ...result.data, product_type: input.productType, seller: { id: session.user.id, nickname: session.user.loginId, avatar_url: null }, products_images: input.imagePaths.map((path, sort_order) => ({ path, sort_order })) });
  },
  async remove(productId: string, session: AuthSession) {
    await apiRequest<unknown>(`/api/v1/products/${productId}`, session, { method: 'DELETE' });
  }
};

type ApiMessage = { id: string; product_id: string; sender_id: string; recipient_id: string; content: string; created_at: string };

function messageFromApi(message: ApiMessage): ChatMessage {
  return { id: message.id, productId: message.product_id, senderId: message.sender_id, recipientId: message.recipient_id, content: message.content, createdAt: message.created_at };
}

export const chatApi = {
  async messages(productId: string, otherUserId: string, session: AuthSession) {
    const result = await apiRequest<{ data: ApiMessage[] }>(`/api/v1/messages?productId=${encodeURIComponent(productId)}&otherUserId=${encodeURIComponent(otherUserId)}`, session);
    return result.data.map(messageFromApi);
  },
  async send(productId: string, recipientId: string, content: string, session: AuthSession) {
    const result = await apiRequest<{ data: ApiMessage }>('/api/v1/messages', session, { method: 'POST', body: JSON.stringify({ productId, recipientId, content }) });
    return messageFromApi(result.data);
  },
  async threads(session: AuthSession) {
    type ApiThreadMessage = ApiMessage & { product: { id: string; title: string; asking_price: number; products_images: ApiProductImage[] | null } | null; sender: { id: string; nickname: string } | null; recipient: { id: string; nickname: string } | null };
    const result = await apiRequest<{ data: ApiThreadMessage[] }>('/api/v1/messages/threads', session);
    const seen = new Set<string>();
    return result.data.flatMap((message) => {
      const otherUser = message.sender_id === session.user.id ? message.recipient : message.sender;
      if (!message.product || !otherUser) return [];
      const key = `${message.product_id}:${otherUser.id}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{
        id: key,
        product: {
          id: message.product.id,
          title: message.product.title,
          askingPrice: message.product.asking_price,
          imagePaths: [...(message.product.products_images ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((image) => image.path)
        },
        otherUser,
        lastMessage: message.content,
        createdAt: message.created_at
      } satisfies ChatThread];
    });
  }
};
