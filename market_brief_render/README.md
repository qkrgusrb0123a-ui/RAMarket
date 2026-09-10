# RAMarket API

중고 상품 등록·검색, 1:1 메시지, 주간 RAM 가격을 위한 TypeScript/Express API입니다. 인증, 데이터베이스, 이미지 저장소는 Supabase가 맡고, API와 주간 가격 수집 작업은 Render에서 실행합니다.

## 구조

```text
market_brief_render/
├── src/
│   ├── config/             # 환경변수 검증
│   ├── jobs/               # Render Cron 작업
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

최종 테이블은 `users`, `products`, `products_images`, `messages`, `reports`, `support_inquiries`, `support_messages`, `ram_price`입니다. `reports`와 관리자 문의 테이블은 앱 클라이언트에서 직접 읽을 수 없으며, 서버 API만 접근합니다.

## 주요 API

| Method | Path | 인증 | 설명 |
| --- | --- | --- | --- |
| GET | `/health` | - | Render 상태 확인 |
| POST | `/api/v1/auth/sign-up` | - | 아이디·비밀번호 회원가입 후 세션 발급 |
| POST | `/api/v1/auth/sign-in` | - | 아이디·비밀번호 로그인 후 세션 발급 |
| GET/PATCH/DELETE | `/api/v1/auth/account` | 필요 | 계정 조회·수정·탈퇴 |
| GET/POST | `/api/v1/products` | POST만 필요 | 상품 목록·등록 |
| GET | `/api/v1/products/:productId` | - | 상품 상세 |
| PATCH | `/api/v1/products/:productId` | 필요 | 판매자 본인의 판매글 수정 |
| DELETE | `/api/v1/products/:productId` | 필요 | 판매자 본인의 판매글 삭제 |
| PATCH | `/api/v1/products/:productId/status` | 필요 | 판매 상태 변경 |
| GET/POST | `/api/v1/messages` | 필요 | 개인 메시지 조회·전송 |
| GET | `/api/v1/messages/threads` | 필요 | 로그인 사용자의 1:1 대화 목록 |
| POST | `/api/v1/reports` | 필요 | 판매글 또는 참여 중인 1:1 채팅 신고 |
| GET/DELETE/POST | `/api/v1/support/thread`, `/api/v1/support/messages` | 필요 | 내 관리자 문의 대화 조회·종료 후 삭제·전송 |
| POST | `/api/v1/admin/session` | 관리자 비밀번호 | 관리자 웹 세션 발급 |
| GET | `/api/v1/admin/reports?targetType=product\|chat` | 관리자 | 분리된 신고 목록 조회 |
| DELETE | `/api/v1/admin/reports/:reportId` | 관리자 | 신고 요청 무시·목록에서 제거 |
| GET | `/api/v1/admin/suspensions` | 관리자 | 활동 정지 계정·해제 예정 시각 조회 |
| PATCH/DELETE | `/api/v1/admin/users/:userId/suspension` | 관리자 | 기간별 활동 정지 설정·관리자 임의 해제 |
| DELETE | `/api/v1/admin/products/:productId` | 관리자 | 게시글과 해당 채팅 삭제 |
| DELETE | `/api/v1/admin/users/:userId` | 관리자 | 계정과 해당 판매글·채팅 영구 삭제 |
| GET | `/api/v1/admin/inquiries` | 관리자 | 관리자 문의 목록 조회 |
| GET/POST | `/api/v1/admin/inquiries/:inquiryId/messages` | 관리자 | 문의 대화 조회·답변 |
| PATCH | `/api/v1/admin/inquiries/:inquiryId/close` | 관리자 | 문의 처리 완료 |
| GET | `/api/v1/ram-prices/history?ramName=<RAM명>` | - | 주간 RAM 가격 이력 |
| POST | `/internal/ram-prices` | cron secret | 주간 RAM 가격 적재 |

`POST /api/v1/messages` 본문은 `{ "productId", "recipientId", "content" }`이고, 조회에는 선택적으로 `productId`, `otherUserId` 쿼리를 사용할 수 있습니다. RAM 가격 수집 데이터는 `{ "prices": [{ "ramName", "price", "source", "weekStart" }] }` 형식입니다. `weekStart`를 생략하면 해당 주의 월요일이 저장됩니다.

웹/모바일 앱은 로그인 응답의 `session.accessToken`을 `Authorization: Bearer <token>`으로 보냅니다. 테이블의 RLS가 사용자의 소유 상품과 참여 메시지를 다시 검증합니다.

## 아이디·비밀번호 로그인

회원가입 아이디는 영문 소문자, 숫자, `_`, `-`를 사용한 4~20자이며, 이메일을 입력하거나 인증할 필요가 없습니다. API는 사용자에게 보이지 않는 내부 식별자만 만들어 Supabase Auth에 전달합니다. 비밀번호는 API나 `users` 테이블에 저장되지 않고, Supabase Auth가 안전한 단방향 해시로 `auth.users`에 저장합니다.

새 Supabase 프로젝트에는 `supabase/migrations`의 migration을 파일명 순서대로 모두 적용하세요. 이미 이전 스키마를 적용한 프로젝트라면 새 `202609100002_support_inquiries.sql`까지 적용하면 됩니다. 이 정책은 판매글을 자동으로 지우지 않고, 판매자와 기존 대화 참가자가 숨김·판매 완료된 글도 대화 맥락 안에서 볼 수 있게 합니다.

## 관리자 웹 페이지와 비밀번호 설정

관리자 페이지는 회원가입/관리자 계정 테이블 없이 **비밀번호 하나**로만 열립니다. 실제 비밀번호는 저장하지 않고 `scrypt` 단방향 해시만 서버 환경변수에 둡니다.

1. `market_brief_render`에서 `pnpm run admin:password`를 실행하고, 12자 이상의 새 관리자 비밀번호를 입력합니다.
2. 출력된 `ADMIN_PASSWORD_HASH=...` 전체를 서버의 `.env`와 Render의 `ADMIN_PASSWORD_HASH` 환경변수에 붙여넣습니다.
3. `ADMIN_SESSION_SECRET`에는 32자 이상의 무작위 값을 넣습니다. 예: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
4. Supabase migration `202609090004_reports_and_moderation.sql`을 적용하고 API를 배포합니다.
5. 브라우저에서 `https://<Render-API-주소>/admin`을 열고, 1단계에서 정한 평문 비밀번호를 입력합니다.

관리자 세션은 브라우저를 닫으면 삭제되는 `sessionStorage`에만 저장되고 4시간 후 만료됩니다. 비밀번호, service role key, `ADMIN_SESSION_SECRET`은 모바일 앱이나 Git에 절대 저장하지 마세요. 활동 정지는 1일·3일·7일·30일·1년·무기한 중에서 설정할 수 있으며, 임시 정지는 만료 시 서버가 자동 해제합니다. 관리자는 활동 정지 관리 탭에서 언제든 해제할 수 있습니다. 신고를 무시하거나 신고 대상 계정을 활동 정지·삭제하면 해당 신고는 목록에서 제거됩니다. 관리자 문의 탭에서는 앱의 로그인·설정 화면에서 접수된 문의를 채팅 형식으로 답변하고 처리 완료할 수 있습니다.

## 이미지 업로드 규칙

앱이 Supabase Storage `product-images` 버킷에 `products/<user-id>/<filename>` 경로로 먼저 업로드하고, 반환된 path들을 상품 생성 요청의 `imagePaths`에 보냅니다. 업로드 크기는 5MB이며 JPEG/PNG/WebP만 허용됩니다.

## 배포 순서

1. GitHub에서 빈 저장소를 만들고 이 프로젝트를 `main` 브랜치로 push합니다.
2. Supabase 프로젝트를 만들고 migration을 반영합니다. Authentication의 앱 URL/리디렉션 URL도 모바일·웹 클라이언트에 맞춰 설정합니다.
3. Render에서 **New → Blueprint**로 GitHub 저장소를 연결합니다. `render.yaml`이 API와 매주 월요일 03:00 UTC 가격 수집 작업을 생성합니다.
4. Render 환경변수에 `.env.example`의 Supabase 키와 `ALLOWED_ORIGINS`, `CRON_SECRET`을 입력합니다. `PRICE_FEED_URL`은 `{ "prices": [{ "ramName", "price", "source", "weekStart" }] }` 형식의 합법적인 제휴 API/자체 수집 서비스 주소를 지정할 때만 설정합니다.
5. Render가 제공하는 API 주소를 앱의 `API_BASE_URL`로 설정합니다. GitHub의 main push마다 Render가 자동 배포하고 Actions가 타입 검사를 수행합니다.

### `Route not found.`가 표시될 때

`PATCH /api/v1/auth/account`, `DELETE /api/v1/products/:productId`를 포함한 관리 API는 현재 서버 코드에 등록되어 있습니다. 이 문구가 보이면 데이터베이스 문제가 아니라, 앱이 이전 Render 배포본 또는 다른 API 주소를 사용 중인 것입니다. 최신 커밋을 GitHub `main`에 push하고 Render 배포가 완료됐는지 확인한 뒤, 모바일 앱의 `EXPO_PUBLIC_API_BASE_URL`이 해당 Render 서비스 주소인지 확인합니다.

가격 수집은 대상 사이트의 이용약관과 공식 API 정책을 준수해야 하므로, 특정 쇼핑몰을 무단으로 스크래핑하는 코드는 포함하지 않았습니다. `PRICE_FEED_URL` 어댑터 또는 보호된 내부 적재 API로 검증된 수집 결과만 저장합니다.
