export type AuthSession = {
  user: { id: string; loginId: string };
  session: { accessToken: string; refreshToken: string; expiresIn: number };
};
export type Account = { loginId: string; nickname: string; avatarUrl: string | null };

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');

function errorMessage(response: Response, data: { error?: unknown }) {
  const serverError = typeof data.error === 'string' ? data.error : undefined;
  // This is the API's catch-all 404 response. Account management routes are
  // available in the current API, so this specifically means the app is
  // connected to an older deployment (or to the wrong API address).
  if (response.status === 404 && serverError === 'Route not found.') {
    return '연결된 서버에 최신 계정 관리 기능이 배포되지 않았습니다. Render API를 최신 커밋으로 배포한 뒤 다시 시도해 주세요.';
  }
  return serverError ?? '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

async function request(path: string, body: Record<string, string>): Promise<AuthSession> {
  if (!apiBaseUrl) {
    throw new Error('서버 주소가 설정되지 않았습니다. .env의 EXPO_PUBLIC_API_BASE_URL을 확인해 주세요.');
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch {
    throw new Error('서버에 연결할 수 없습니다. 휴대폰과 컴퓨터가 같은 Wi-Fi에 연결되어 있는지 확인해 주세요.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorMessage(response, data));
  return data as AuthSession;
}

async function authorizedRequest<T>(path: string, session: AuthSession, method: 'GET' | 'PATCH' | 'DELETE', body?: Record<string, string | null>) {
  if (!apiBaseUrl) throw new Error('서버 주소가 설정되지 않았습니다. .env의 EXPO_PUBLIC_API_BASE_URL을 확인해 주세요.');
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${session.session.accessToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
  } catch {
    throw new Error('서버에 연결할 수 없습니다. 휴대폰과 컴퓨터가 같은 Wi-Fi에 연결되어 있는지 확인해 주세요.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorMessage(response, data));
  return data as T;
}

export const authApi = {
  signUp: (loginId: string, password: string) => request('/api/v1/auth/sign-up', { loginId, password }),
  signIn: (loginId: string, password: string) => request('/api/v1/auth/sign-in', { loginId, password }),
  refresh: (refreshToken: string) => request('/api/v1/auth/refresh', { refreshToken }),
  account: async (session: AuthSession) => (await authorizedRequest<{ data: Account }>('/api/v1/auth/account', session, 'GET')).data,
  updateAccount: async (input: { nickname: string; password?: string; avatarUrl: string | null }, session: AuthSession) => (await authorizedRequest<{ data: Account }>('/api/v1/auth/account', session, 'PATCH', input)).data,
  deleteAccount: (session: AuthSession) => authorizedRequest<unknown>('/api/v1/auth/account', session, 'DELETE')
};
