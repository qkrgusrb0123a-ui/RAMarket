# RAMarket Mobile

Expo 기반 React Native 모바일 앱입니다.

```text
mobile/
├── App.tsx                  # RAMarket 로그인·회원가입 화면
├── src/auth.ts              # 인증 API 클라이언트
├── src/auth-storage.ts      # Expo SecureStore 세션 저장
└── .env.example             # 실제 기기에서 API에 연결할 주소 예시
```

## 로컬 실행

```bash
cd mobile
npm start
```

Expo Go에서 테스트합니다. 실제 휴대폰에서는 `.env`의 `EXPO_PUBLIC_API_BASE_URL`에 컴퓨터의 로컬 IP 주소를 설정해야 합니다. 예: `http://192.168.0.10:10001`

이메일 인증 없이 아이디·비밀번호로 회원가입과 로그인을 지원합니다. 비밀번호는 기기에 저장하지 않으며, 로그인 토큰만 Expo SecureStore에 암호화해 보관합니다.

## Expo Go에서 실행하기

1. 휴대폰에 **Expo Go**를 설치하고, 휴대폰과 개발 컴퓨터를 같은 Wi-Fi에 연결합니다.
2. `mobile/.env.example`을 복사해 `mobile/.env` 파일을 만들고, `EXPO_PUBLIC_API_BASE_URL`의 `YOUR_LOCAL_IP`를 컴퓨터의 IPv4 주소로 바꿉니다. 예: `http://192.168.0.10:10001`
3. API 서버를 먼저 실행한 뒤, `mobile` 폴더에서 `npm start`를 실행합니다.
4. 표시된 QR 코드를 Expo Go 앱으로 스캔합니다. 연결이 막히면 `npm start -- --tunnel`로 터널 모드에서 다시 실행합니다.

로그인 버튼은 누르는 동안 더 진한 녹색과 축소 효과를 표시하며, 요청 중에는 로딩 표시로 바뀝니다. 회원가입 버튼과 비밀번호 보기 버튼도 눌림 상태를 표시합니다.
