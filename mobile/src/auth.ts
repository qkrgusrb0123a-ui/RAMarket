export type AuthSession = {
  user: { id: string; loginId: string };
  session: { accessToken: string; refreshToken: string; expiresIn: number };
};

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');

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
  if (!response.ok) throw new Error(data.error ?? '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  return data as AuthSession;
}

export const authApi = {
  signUp: (loginId: string, password: string) => request('/api/v1/auth/sign-up', { loginId, password }),
  signIn: (loginId: string, password: string) => request('/api/v1/auth/sign-in', { loginId, password }),
  refresh: (refreshToken: string) => request('/api/v1/auth/refresh', { refreshToken })
};
