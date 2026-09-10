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

## Android에서 실행하기

Android 휴대폰에서는 Expo Go로 QR 코드를 스캔하거나, Android Studio 에뮬레이터를 실행한 뒤 아래 명령으로 앱을 엽니다.

```bash
cd mobile
npm run android
```

Android 앱 아이콘은 iOS와 동일한 RAM 모듈 로고와 밝은 민트 배경을 사용합니다. 네이티브 아이콘 변경 사항은 Expo Go가 아닌 새 Android 개발 빌드 또는 스토어 빌드에 반영됩니다.

로그인 후에는 상품 탭으로 이동합니다. 예시 상품은 포함하지 않으며, 판매글은 API와 Supabase DB에 저장되어 자동으로 사라지지 않습니다. 판매글에서는 카테고리와 별도로 **상품 종류**에서 데스크탑용 또는 노트북용을 선택하고, 휴대폰 앨범 사진을 최대 8장까지 선택합니다. DDR5/DDR4/기타 규격, 클럭, 용량을 입력하며, DDR5는 5600MHz·6000MHz 및 8GB·12GB·16GB·24GB·32GB·64GB·128GB를, DDR4는 2666MHz·3200MHz 및 4GB·8GB·16GB·32GB·64GB를 버튼으로 선택할 수 있습니다. 기타 규격을 선택하면 규격·클럭·용량을 직접 입력할 수 있습니다. 작성자 본인에게는 **수정하기**, 다른 사용자에게는 **채팅하기**가 표시됩니다. 관심 상품은 사용자별 기기 보안 저장소에 보관됩니다.

거래 희망 장소와 지도 연동은 추후 추가할 예정입니다. 현재 판매글은 장소 입력 없이 등록되며, 목록에는 **거래 장소 협의**로 표시됩니다.

하단 탭은 홈·상품·채팅·설정 순서로 전환됩니다. 상품 화면 우측 상단의 하트 버튼에서 찜한 상품을 바로 확인할 수 있습니다. 채팅 탭에서는 판매글과 연결된 판매자-구매자 1:1 대화를 이어갈 수 있습니다.

설정의 **사용자 계정**에서 이름·프로필 사진·비밀번호를 수정할 수 있으며, 로그아웃과 회원탈퇴도 이 화면에서만 제공합니다. 회원탈퇴를 확인하면 서버는 해당 사용자의 판매글과 연결 채팅 기록을 제거한 뒤 인증 계정을 삭제합니다. 설정의 **내 상품**과 **찜한 상품**은 각각 별도 목록으로 열리며, 판매글 수정 화면에서는 확인 후 판매글을 삭제할 수 있습니다.

설정의 **앱 설정**에서는 찜한 상품 할인 알림과 채팅 알림을 각각 켜거나 끌 수 있습니다. 방해 금지 시간은 기본값인 PM 10:00~AM 9:00에서 직접 변경할 수 있으며, 모든 앱 설정은 사용자별 기기에 저장됩니다.
