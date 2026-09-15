import type { AuthSession } from './auth';
import { createImageFormData } from './upload-form-data';

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
  favorite_count?: number;
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
  favoriteCount: number;
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
  status: 'active' | 'reserved' | 'sold';
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
  lastMessageId: string;
  lastMessageSenderId: string;
  lastMessage: string;
  createdAt: string;
};

export type ReportTargetType = 'product' | 'chat';
export type SupportMessage = { id: string; senderRole: 'user' | 'admin'; content: string; createdAt: string };
export type AdminUser = { id: string; loginId: string; nickname: string; status: 'active' | 'suspended'; suspendedUntil: string | null };
export type AdminReport = { id: string; targetType: ReportTargetType; productId: string; productTitle: string; createdAt: string; reporter: AdminUser | null; reportedUser: AdminUser | null; product: { id: string; title: string; description: string; askingPrice: number; status: Product['status'] } | null };
export type AdminInquiry = { id: string; contactLabel: string; status: 'open' | 'closed'; createdAt: string; updatedAt: string };
export type AdminConversationMessage = { id: string; content: string; createdAt: string; sender: Pick<AdminUser, 'id' | 'loginId' | 'nickname'> | null; recipient: Pick<AdminUser, 'id' | 'loginId' | 'nickname'> | null };
export type ListingPriceChart = { category: string; listingCount: number; minPrice: number | null; maxPrice: number | null; medianPrice: number | null; sortedPrices: number[] };

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

async function adminRequest<T>(path: string, adminToken: string, init?: RequestInit): Promise<T> {
  const baseUrl = requireApiBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/v1/admin${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${adminToken}`, ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...(init?.headers ?? {}) }
    });
  } catch {
    throw new Error('클라우드 서버에 연결할 수 없습니다. API 주소와 네트워크를 확인해 주세요.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorMessage(response, data));
  return data as T;
}

type ApiAdminUser = { id: string; login_id: string; nickname: string; status: 'active' | 'suspended'; suspended_until: string | null } | { id: string; login_id: string; nickname: string; status: 'active' | 'suspended'; suspended_until: string | null }[] | null;
function oneAdminUser(user: ApiAdminUser): AdminUser | null {
  const value = Array.isArray(user) ? user[0] : user;
  return value ? { id: value.id, loginId: value.login_id, nickname: value.nickname, status: value.status, suspendedUntil: value.suspended_until } : null;
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
    favoriteCount: product.favorite_count ?? 0,
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
    const formData = await createImageFormData(image, `product.${extension}`, mimeType);
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
  const formData = await createImageFormData(image, 'profile.' + extension, mimeType);
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
    return productFromApi({ ...result.data, favorite_count: 0, product_type: input.productType, seller: { id: session.user.id, nickname: session.user.loginId, avatar_url: null }, products_images: input.imagePaths.map((path, sort_order) => ({ path, sort_order })) });
  },
  async update(productId: string, input: ProductInput, session: AuthSession) {
    const result = await apiRequest<{ data: ApiProduct }>(`/api/v1/products/${productId}`, session, { method: 'PATCH', body: JSON.stringify(input) });
    return productFromApi({ ...result.data, favorite_count: 0, product_type: input.productType, seller: { id: session.user.id, nickname: session.user.loginId, avatar_url: null }, products_images: input.imagePaths.map((path, sort_order) => ({ path, sort_order })) });
  },
  async remove(productId: string, session: AuthSession) {
    await apiRequest<unknown>(`/api/v1/products/${productId}`, session, { method: 'DELETE' });
  }
};

export const favoritesApi = {
  async list(session: AuthSession) {
    const result = await apiRequest<{ data: string[] }>('/api/v1/products/favorites/mine', session);
    return result.data;
  },
  async set(productId: string, active: boolean, session: AuthSession) {
    await apiRequest<unknown>(`/api/v1/products/favorites/${productId}`, session, { method: 'PUT', body: JSON.stringify({ active }) });
  }
};

export const reportsApi = {
  async submit(input: { targetType: ReportTargetType; productId: string; reportedUserId: string }, session: AuthSession) {
    return apiRequest<{ data: { id: string; alreadyReported: boolean } }>('/api/v1/reports', session, { method: 'POST', body: JSON.stringify(input) });
  }
};

type ApiSupportMessage = { id: string; sender_role: 'user' | 'admin'; content: string; created_at: string };

function supportMessageFromApi(message: ApiSupportMessage): SupportMessage {
  return { id: message.id, senderRole: message.sender_role, content: message.content, createdAt: message.created_at };
}

export const supportApi = {
  async thread(session: AuthSession) {
    const result = await apiRequest<{ data: { id: string; status: 'open' | 'closed'; messages: ApiSupportMessage[] } | null }>('/api/v1/support/thread', session);
    return result.data ? { ...result.data, messages: result.data.messages.map(supportMessageFromApi) } : null;
  },
  async removeThread(session: AuthSession) {
    await apiRequest<unknown>('/api/v1/support/thread', session, { method: 'DELETE' });
  },
  async send(content: string, session: AuthSession) {
    const result = await apiRequest<{ data: ApiSupportMessage }>('/api/v1/support/messages', session, { method: 'POST', body: JSON.stringify({ content }) });
    return supportMessageFromApi(result.data);
  }
};

export const listingPriceApi = {
  async categories() {
    const result = await apiRequest<{ data: string[] }>('/api/v1/ram-prices/listing-categories');
    return result.data;
  },
  async chart(category: string) {
    const result = await apiRequest<{ data: ListingPriceChart }>(`/api/v1/ram-prices/listing-chart?category=${encodeURIComponent(category)}`);
    return result.data;
  }
};

export const adminApi = {
  async users(adminToken: string) {
    const result = await adminRequest<{ data: Exclude<ApiAdminUser, null | unknown[]>[] }>('/users', adminToken);
    return result.data.map((user) => oneAdminUser(user)).filter((user): user is AdminUser => user !== null);
  },
  async reports(adminToken: string, targetType: ReportTargetType) {
    type ApiReport = { id: string; target_type: ReportTargetType; product_id: string; product_title: string; created_at: string; reporter: ApiAdminUser; reportedUser: ApiAdminUser; product: { id: string; title: string; description: string; asking_price: number; status: Product['status'] } | { id: string; title: string; description: string; asking_price: number; status: Product['status'] }[] | null };
    const result = await adminRequest<{ data: ApiReport[] }>(`/reports?targetType=${targetType}`, adminToken);
    return result.data.map((report) => {
      const product = Array.isArray(report.product) ? report.product[0] : report.product;
      return { id: report.id, targetType: report.target_type, productId: report.product_id, productTitle: report.product_title, createdAt: report.created_at, reporter: oneAdminUser(report.reporter), reportedUser: oneAdminUser(report.reportedUser), product: product ? { id: product.id, title: product.title, description: product.description, askingPrice: product.asking_price, status: product.status } : null } satisfies AdminReport;
    });
  },
  async suspensions(adminToken: string) {
    const result = await adminRequest<{ data: Exclude<ApiAdminUser, null | unknown[]>[] }>('/suspensions', adminToken);
    return result.data.map((user) => oneAdminUser(user)).filter((user): user is AdminUser => user !== null);
  },
  async inquiries(adminToken: string) {
    type ApiInquiry = { id: string; contact_label: string; status: 'open' | 'closed'; created_at: string; updated_at: string };
    const result = await adminRequest<{ data: ApiInquiry[] }>('/inquiries', adminToken);
    return result.data.map((inquiry) => ({ id: inquiry.id, contactLabel: inquiry.contact_label, status: inquiry.status, createdAt: inquiry.created_at, updatedAt: inquiry.updated_at }));
  },
  async inquiry(adminToken: string, inquiryId: string) {
    type ApiInquiryMessage = { id: string; sender_role: 'user' | 'admin'; content: string; created_at: string };
    const result = await adminRequest<{ data: { inquiry: { id: string; contact_label: string; status: 'open' | 'closed' }; messages: ApiInquiryMessage[] } }>(`/inquiries/${inquiryId}/messages`, adminToken);
    return { inquiry: { id: result.data.inquiry.id, contactLabel: result.data.inquiry.contact_label, status: result.data.inquiry.status }, messages: result.data.messages.map(supportMessageFromApi) };
  },
  async sendInquiryMessage(adminToken: string, inquiryId: string, content: string) { await adminRequest(`/inquiries/${inquiryId}/messages`, adminToken, { method: 'POST', body: JSON.stringify({ content }) }); },
  async closeInquiry(adminToken: string, inquiryId: string) { await adminRequest(`/inquiries/${inquiryId}/close`, adminToken, { method: 'PATCH' }); },
  async conversation(adminToken: string, reportId: string) {
    type ApiConversationMessage = { id: string; content: string; created_at: string; sender: ApiAdminUser; recipient: ApiAdminUser };
    const result = await adminRequest<{ data: { productTitle: string; messages: ApiConversationMessage[] } }>(`/reports/${reportId}/conversation`, adminToken);
    return { productTitle: result.data.productTitle, messages: result.data.messages.map((message) => ({ id: message.id, content: message.content, createdAt: message.created_at, sender: oneAdminUser(message.sender), recipient: oneAdminUser(message.recipient) })) };
  },
  async ignoreReport(adminToken: string, reportId: string) { await adminRequest(`/reports/${reportId}`, adminToken, { method: 'DELETE' }); },
  async deleteProduct(adminToken: string, productId: string) { await adminRequest(`/products/${productId}`, adminToken, { method: 'DELETE' }); },
  async suspendUser(adminToken: string, userId: string, duration: '1d' | '3d' | '7d' | '30d' | '1y' | 'permanent') { await adminRequest(`/users/${userId}/suspension`, adminToken, { method: 'PATCH', body: JSON.stringify({ duration }) }); },
  async cancelSuspension(adminToken: string, userId: string) { await adminRequest(`/users/${userId}/suspension`, adminToken, { method: 'DELETE' }); },
  async deleteUser(adminToken: string, userId: string) { await adminRequest(`/users/${userId}`, adminToken, { method: 'DELETE' }); }
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
        lastMessageId: message.id,
        lastMessageSenderId: message.sender_id,
        lastMessage: message.content,
        createdAt: message.created_at
      } satisfies ChatThread];
    });
  }
};
