import type { AuthSession } from './auth';

type ApiProductImage = { path: string; sort_order: number };
type ApiSeller = { id: string; nickname: string } | { id: string; nickname: string }[] | null;

type ApiProduct = {
  id: string;
  title: string;
  description: string;
  category: string;
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
  condition: 'new' | 'like_new' | 'good' | 'fair';
  askingPrice: number;
  status: 'active' | 'reserved' | 'sold' | 'hidden';
  createdAt: string;
  seller: { id: string; nickname: string };
  imagePaths: string[];
};

export type ProductInput = {
  title: string;
  description: string;
  category: string;
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
  if (!response.ok) throw new Error(data.error ?? '요청을 처리하지 못했습니다.');
  return data as T;
}

function oneSeller(seller: ApiSeller) {
  if (Array.isArray(seller)) return seller[0] ?? { id: '', nickname: '알 수 없음' };
  return seller ?? { id: '', nickname: '알 수 없음' };
}

function productFromApi(product: ApiProduct): Product {
  return {
    id: product.id,
    title: product.title,
    description: product.description,
    category: product.category,
    condition: product.condition,
    askingPrice: product.asking_price,
    status: product.status,
    createdAt: product.created_at,
    seller: oneSeller(product.seller),
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
    formData.append('image', { uri: image.uri, type: mimeType, name: `product.${extension}` } as unknown as Blob);
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

export const productsApi = {
  async list(session: AuthSession) {
    const result = await apiRequest<{ data: ApiProduct[] }>('/api/v1/products?limit=50', session);
    return result.data.map(productFromApi);
  },
  async create(input: ProductInput, session: AuthSession) {
    const result = await apiRequest<{ data: ApiProduct }>('/api/v1/products', session, { method: 'POST', body: JSON.stringify(input) });
    return productFromApi({ ...result.data, seller: { id: session.user.id, nickname: session.user.loginId }, products_images: input.imagePaths.map((path, sort_order) => ({ path, sort_order })) });
  },
  async update(productId: string, input: ProductInput, session: AuthSession) {
    const result = await apiRequest<{ data: ApiProduct }>(`/api/v1/products/${productId}`, session, { method: 'PATCH', body: JSON.stringify(input) });
    return productFromApi({ ...result.data, seller: { id: session.user.id, nickname: session.user.loginId }, products_images: input.imagePaths.map((path, sort_order) => ({ path, sort_order })) });
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
