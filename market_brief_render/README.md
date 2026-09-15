# RAMarket API

중고 상품 등록·검색, 1:1 메시지, 주간 RAM 가격을 위한 TypeScript/Express API입니다. 인증, 데이터베이스, 이미지 저장소는 Supabase가 맡고, API와 주간 가격 수집 작업은 Render에서 실행합니다.

## 구조

```text
market_brief_render/
├── src/
│   ├── config/             # 환경변수 검증
│   ├── jobs/               # Render Cron 작업 (일요일 KST 시세 수집)
│   ├── lib/                # Supabase 클라이언트
│   ├── middleware/         # 인증·오류 처리
│   ├── routes/             # products, messages, prices, internal
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

CLI 없이 Supabase SQL Editor를 쓴다면 `supabase/migrations`의 SQL 파일을 파일명 순서대로 실행합니다. 기존 DB에는 새 migration만 한 번 실행합니다.

최종 테이블은 `users`, `products`, `products_images`, `product_favorites`, `messages`, `reports`, `support_inquiries`, `support_messages`, `ram_price`입니다. `reports`, `product_favorites`, 관리자 문의 테이블은 앱 클라이언트에서 직접 읽을 수 없으며, 서버 API만 접근합니다.

## 주요 API

| Method | Path | 인증 | 설명 |
| --- | --- | --- | --- |
| GET | `/health` | - | Render 상태 확인 |
| POST | `/api/v1/auth/sign-up` | - | 아이디·비밀번호 회원가입 후 세션 발급 |
| POST | `/api/v1/auth/sign-in` | - | 아이디·비밀번호 로그인 후 세션 발급 |
| GET/PATCH/DELETE | `/api/v1/auth/account` | 필요 | 계정 조회·수정·탈퇴 |
| GET/POST | `/api/v1/products` | POST만 필요 | 상품 목록·등록 |
| GET/PUT | `/api/v1/products/favorites/mine`, `/api/v1/products/favorites/:productId` | 필요 | 내 찜 목록 조회·변경 |
| GET | `/api/v1/products/:productId` | - | 상품 상세 |
| PATCH | `/api/v1/products/:productId` | 필요 | 판매자 본인의 판매글 수정 |
| DELETE | `/api/v1/products/:productId` | 필요 | 판매자 본인의 판매글 삭제 |
| PATCH | `/api/v1/products/:productId/status` | 필요 | 판매 상태 변경 |
| GET/POST | `/api/v1/messages` | 필요 | 개인 메시지 조회·전송 |
| GET | `/api/v1/messages/threads` | 필요 | 로그인 사용자의 1:1 대화 목록 |
| POST | `/api/v1/reports` | 필요 | 판매글 또는 참여 중인 1:1 채팅 신고 |
| GET/DELETE/POST | `/api/v1/support/thread`, `/api/v1/support/messages` | 필요 | 내 관리자 문의 대화 조회·종료 후 삭제·전송 |
| GET | `/api/v1/admin/reports?targetType=product\|chat` | 관리자 | 분리된 신고 목록 조회 |
| GET | `/api/v1/admin/users` | 관리자 | 전체 사용자 및 활동 상태 조회 |
| DELETE | `/api/v1/admin/reports/:reportId` | 관리자 | 신고 요청 무시·목록에서 제거 |
| GET | `/api/v1/admin/suspensions` | 관리자 | 활동 정지 계정·해제 예정 시각 조회 |
| PATCH/DELETE | `/api/v1/admin/users/:userId/suspension` | 관리자 | 기간별 활동 정지 설정·관리자 임의 해제 |
| DELETE | `/api/v1/admin/products/:productId` | 관리자 | 게시글과 해당 채팅 삭제 |
| DELETE | `/api/v1/admin/users/:userId` | 관리자 | 계정과 해당 판매글·채팅 영구 삭제 |
| GET | `/api/v1/admin/inquiries` | 관리자 | 관리자 문의 목록 조회 |
| GET/POST | `/api/v1/admin/inquiries/:inquiryId/messages` | 관리자 | 문의 대화 조회·답변 |
| PATCH | `/api/v1/admin/inquiries/:inquiryId/close` | 관리자 | 문의 처리 완료 |
| GET | `/api/v1/ram-prices/history?ramName=<RAM명>` | - | 주간 RAM 가격 이력 |
| GET | `/api/v1/ram-prices/market-specs` | - | 승인된 다나와 리서치 시세의 RAM 규격 목록 |
| GET | `/api/v1/ram-prices/market-chart?ramSpec=<규격>` | - | 다나와 리서치 승인 데이터 기반 차트 데이터 |
| GET | `/api/v1/admin/market-data` | 관리자 | 공급자별 수집 실행 이력 및 최근 원본 관측값 |
| POST | `/internal/ram-prices` | cron secret | 주간 RAM 가격 적재 |

`POST /api/v1/messages` 본문은 `{ "productId", "recipientId", "content" }`이고, 조회에는 선택적으로 `productId`, `otherUserId` 쿼리를 사용할 수 있습니다. RAM 가격 수집 데이터는 `{ "prices": [{ "ramName", "price", "source", "weekStart" }] }` 형식입니다. `weekStart`를 생략하면 해당 주의 월요일이 저장됩니다.

웹/모바일 앱은 로그인 응답의 `session.accessToken`을 `Authorization: Bearer <token>`으로 보냅니다. 테이블의 RLS가 사용자의 소유 상품과 참여 메시지를 다시 검증합니다.

## 아이디·비밀번호 로그인

회원가입 아이디는 영문 소문자, 숫자, `_`, `-`를 사용한 4~20자이며, 이메일을 입력하거나 인증할 필요가 없습니다. API는 사용자에게 보이지 않는 내부 식별자만 만들어 Supabase Auth에 전달합니다. 비밀번호는 API나 `users` 테이블에 저장되지 않고, Supabase Auth가 안전한 단방향 해시로 `auth.users`에 저장합니다.

새 Supabase 프로젝트에는 `supabase/migrations`의 migration을 파일명 순서대로 모두 적용하세요. 이미 이전 스키마를 적용한 프로젝트라면 새 `202609140002_show_listing_statuses.sql`까지 적용하면 됩니다. 이 정책은 판매글을 자동으로 지우지 않고, 판매자와 기존 대화 참가자가 숨김·판매 완료된 글도 대화 맥락 안에서 볼 수 있게 합니다.

## 앱 내부 관리자 설정

별도 `/admin` 웹 페이지는 제공하지 않습니다. Render 환경변수 `ADMIN_LOGIN_ID`에 관리자용으로 이미 가입한 아이디를 설정하고, `ADMIN_SESSION_SECRET`에는 32자 이상의 무작위 값을 설정하세요. 해당 계정이 일반 로그인에 성공하면 곧바로 앱 내부 관리자 화면이 열립니다.

관리자 토큰은 로그인 응답에만 포함되며 4시간 후 만료됩니다. `ADMIN_LOGIN_ID`, service role key, `ADMIN_SESSION_SECRET`은 Git이나 모바일 앱 환경변수에 넣지 마세요. 활동 정지는 1일·3일·7일·30일·1년·무기한 중에서 설정할 수 있고, 신고 무시·게시글 삭제·계정 삭제·문의 답변/종료를 웹과 모바일에서 같은 UI로 처리할 수 있습니다.

## 이미지 업로드 규칙

앱이 Supabase Storage `product-images` 버킷에 `products/<user-id>/<filename>` 경로로 먼저 업로드하고, 반환된 path들을 상품 생성 요청의 `imagePaths`에 보냅니다. 업로드 크기는 5MB이며 JPEG/PNG/WebP만 허용됩니다.

## 배포 순서

1. GitHub에서 빈 저장소를 만들고 이 프로젝트를 `main` 브랜치로 push합니다.
2. Supabase 프로젝트를 만들고 migration을 반영합니다. Authentication의 앱 URL/리디렉션 URL도 모바일·웹 클라이언트에 맞춰 설정합니다.
3. Render에서 **New → Blueprint**로 GitHub 저장소를 연결합니다. `render.yaml`이 API와 매주 **일요일 00:00 KST** 가격 수집 작업을 생성합니다. API 서비스는 Expo 웹 번들도 함께 빌드해 루트(`/`)에서 제공합니다.
4. Render 환경변수에 `.env.example`의 Supabase 키와 `ALLOWED_ORIGINS`, `CRON_SECRET`, `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`를 입력합니다. `EXPO_PUBLIC_API_BASE_URL`에는 이 API 서비스의 HTTPS 주소를 넣습니다.
5. 배포가 완료되면 Render API 주소에서 웹앱이 열리고, 모바일 앱도 같은 주소의 API를 사용합니다. GitHub의 main push마다 Render가 자동 배포하고 Actions가 타입 검사를 수행합니다.

### `Route not found.`가 표시될 때

`PATCH /api/v1/auth/account`, `DELETE /api/v1/products/:productId`를 포함한 관리 API는 현재 서버 코드에 등록되어 있습니다. 이 문구가 보이면 데이터베이스 문제가 아니라, 앱이 이전 Render 배포본 또는 다른 API 주소를 사용 중인 것입니다. 최신 커밋을 GitHub `main`에 push하고 Render 배포가 완료됐는지 확인한 뒤, 모바일 앱의 `EXPO_PUBLIC_API_BASE_URL`이 해당 Render 서비스 주소인지 확인합니다.

## 다나와 리서치 시세 수집

웹페이지 크롤러는 포함하지 않습니다. 다나와 리서치 데이터는 사용 범위가 확인된 API 또는 제휴 피드만 연결해야 하므로, 이 구현은 쇼핑 페이지 URL·브라우저 자동화·CAPTCHA/IP 우회 방식을 받지 않고 **서면/계약/API 승인을 받은 서버 간 JSON 피드**만 호출합니다.

`DANAWA_RESEARCH_PROVIDER_URL`, `DANAWA_RESEARCH_DATA_LICENSE_APPROVED=true`, `DANAWA_RESEARCH_DATA_LICENSE_REFERENCE`를 모두 설정해야 수집 작업이 실행됩니다. 수집 피드는 규격(DDR 세대·용량·클럭), 가격, 다나와 상품 식별자, 상품명을 보냅니다. 서버는 규격별 최대 1,000개의 고유 상품만 저장하고, 초과·중복 값은 거절 수로 수집 이력에 남깁니다. 사용자 차트와 관리자 웹 대시보드는 다나와 리서치 데이터만 표시합니다.
