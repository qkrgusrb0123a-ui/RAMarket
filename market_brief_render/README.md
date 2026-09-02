# RAMarket API

중고 상품 등록·검색, 가격 이력, 1:1 채팅을 위한 TypeScript/Express API입니다. 인증, 데이터베이스, 이미지 저장소는 Supabase가 맡고, API와 주간 가격 수집 작업은 Render에서 실행합니다.

## 구조

```text
market_brief_render/
├── src/
│   ├── config/             # 환경변수 검증
│   ├── jobs/               # Render Cron 작업
│   ├── lib/                # Supabase 클라이언트
│   ├── middleware/         # 인증·오류 처리
│   ├── routes/             # products, chats, prices, internal
│   └── services/           # 가격 수집/저장
├── supabase/migrations/    # 스키마, RLS, Storage 정책
└── Dockerfile              # 컨테이너 배포 대안
```

GitHub Actions와 Render Blueprint는 GitHub가 인식할 수 있도록 저장소 루트의 `.github/workflows/ci.yml`, `render.yaml`에 두었습니다.

## 로컬 실행

```bash
cd market_brief_render
cp .env.example .env
corepack enable
pnpm install
pnpm run dev
```

`.env`에 Supabase **URL**, **anon key**, **service role key**를 채웁니다. service role key는 Render 서버/크론 환경에만 넣고 모바일 앱에는 절대 넣지 않습니다.

Supabase CLI를 사용한다면 루트에서 아래 명령으로 데이터베이스를 반영합니다.

```bash
supabase link --project-ref <project-ref>
supabase db push
```

CLI 없이 Supabase SQL Editor에서 `supabase/migrations/202609020001_initial_schema.sql` 내용을 한 번 실행해도 됩니다.

## 주요 API

| Method | Path | 인증 | 설명 |
| --- | --- | --- | --- |
| GET | `/health` | - | Render 상태 확인 |
| GET/POST | `/api/v1/products` | POST만 필요 | 상품 목록·등록 |
| GET | `/api/v1/products/:productId` | - | 상품 상세 |
| PATCH | `/api/v1/products/:productId/status` | 필요 | 판매 상태 변경 |
| GET/POST | `/api/v1/chats` | 필요 | 내 채팅 목록·채팅 시작 |
| GET/POST | `/api/v1/chats/:chatId/messages` | 필요 | 메시지 목록·전송 |
| GET | `/api/v1/prices/products/:productId/history` | - | 가격 이력 |
| POST | `/internal/price-snapshots` | cron secret | 가격 수집 결과 적재 |

모바일 앱은 Supabase Auth로 로그인한 뒤 받은 access token을 `Authorization: Bearer <token>`으로 보냅니다. 테이블의 RLS가 사용자의 소유 상품과 참여 채팅을 다시 검증합니다.

## 이미지 업로드 규칙

앱이 Supabase Storage `product-images` 버킷에 `products/<user-id>/<filename>` 경로로 먼저 업로드하고, 반환된 path들을 상품 생성 요청의 `imagePaths`에 보냅니다. 업로드 크기는 5MB이며 JPEG/PNG/WebP만 허용됩니다.

## 배포 순서

1. GitHub에서 빈 저장소를 만들고 이 프로젝트를 `main` 브랜치로 push합니다.
2. Supabase 프로젝트를 만들고 migration을 반영합니다. Authentication의 앱 URL/리디렉션 URL도 모바일·웹 클라이언트에 맞춰 설정합니다.
3. Render에서 **New → Blueprint**로 GitHub 저장소를 연결합니다. `render.yaml`이 API와 매주 월요일 03:00 UTC 가격 수집 작업을 생성합니다.
4. Render 환경변수에 `.env.example`의 Supabase 키와 `ALLOWED_ORIGINS`, `CRON_SECRET`을 입력합니다. `PRICE_FEED_URL`은 `{ "snapshots": [...] }` 형식의 합법적인 제휴 API/자체 수집 서비스 주소를 지정할 때만 설정합니다.
5. Render가 제공하는 API 주소를 앱의 `API_BASE_URL`로 설정합니다. GitHub의 main push마다 Render가 자동 배포하고 Actions가 타입 검사를 수행합니다.

가격 수집은 대상 사이트의 이용약관과 공식 API 정책을 준수해야 하므로, 특정 쇼핑몰을 무단으로 스크래핑하는 코드는 포함하지 않았습니다. `PRICE_FEED_URL` 어댑터 또는 보호된 내부 적재 API로 검증된 수집 결과만 저장합니다.
