# RAMarket Mobile

Expo 기반 React Native 모바일 앱입니다.

```text
mobile/
├── App.tsx                  # 로그인·회원가입 및 RAM 중고거래 상품 화면
├── src/auth.ts              # 인증 API 클라이언트
├── src/auth-storage.ts      # Expo SecureStore 세션 저장
└── .env.example             # 실제 기기에서 API에 연결할 주소 예시
```

## 클라우드 실행

```bash
cd mobile
npm start -- --go --clear
```

Expo Go에서 테스트합니다. `mobile/.env.local`에는 Render에서 배포된 API 주소와 Supabase의 공개 클라이언트 값을 설정합니다. 이 파일은 Git에 포함되지 않습니다.

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://YOUR_RENDER_SERVICE.onrender.com
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

`SUPABASE_SERVICE_ROLE_KEY`, Render 비밀값, 실제 `.env` 파일은 모바일 앱이나 GitHub에 절대 넣으면 안 됩니다.

이메일 인증 없이 아이디·비밀번호로 회원가입과 로그인을 지원합니다. 비밀번호는 기기에 저장하지 않으며, 로그인 토큰만 Expo SecureStore에 암호화해 보관합니다.

## Expo Go에서 실행하기

1. 휴대폰에 **Expo Go**를 설치하고, 휴대폰과 개발 컴퓨터를 같은 Wi-Fi에 연결합니다.
2. `mobile/.env.local` 파일에 배포된 Render API 주소와 Supabase 공개 설정값을 입력합니다.
3. `mobile` 폴더에서 `npm start -- --go --clear`를 실행합니다.
4. 표시된 QR 코드를 Expo Go 앱으로 스캔합니다. 연결이 막히면 `npm start -- --tunnel`로 터널 모드에서 다시 실행합니다.

로그인 후에는 상품 탭으로 이동합니다. 예시 상품은 포함하지 않으며, 판매글은 API와 Supabase DB에 저장되어 자동으로 사라지지 않습니다. 판매글에서는 휴대폰 앨범 사진을 최대 8장까지 선택하고, DDR4/DDR5·용량을 버튼으로 선택한 뒤 제조사와 500자 이내 설명을 입력합니다. 작성자 본인에게는 **수정하기**, 다른 사용자에게는 **채팅하기**가 표시됩니다. 관심 상품은 사용자별 기기 보안 저장소에 보관됩니다.

거래 희망 장소와 지도 연동은 추후 추가할 예정입니다. 현재 판매글은 장소 입력 없이 등록되며, 목록에는 **거래 장소 협의**로 표시됩니다.

하단 탭은 홈·상품·채팅·설정 순서로 전환됩니다. 상품 화면 우측 상단의 하트 버튼에서 찜한 상품을 바로 확인할 수 있습니다. 채팅 탭에서는 판매글과 연결된 판매자-구매자 1:1 대화를 이어갈 수 있습니다.
