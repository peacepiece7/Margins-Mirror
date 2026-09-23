# Architecture

Margins는 `React web / Expo mobile -> Spring Boot API -> MySQL` 흐름을 기본 경계로 사용합니다.

## Frontend

공통 transport와 인증 session은 `front/src/lib`가 담당합니다. 기능별 UI, API facade와 상태는 `front/src/features`에 두고, route와 기능 간 조합은 `front/src/app`에서 수행합니다. 서버 상태는 React Query, 여러 화면이 공유하는 workflow 상태는 Zustand를 사용합니다.

## Backend

HTTP controller, application service, business rule과 MyBatis mapper를 분리합니다. JWT 인증과 refresh cookie, 개인정보 동의, 계정 lifecycle, 독서 session, reflection과 AI 토론 기능이 각 domain 경계 안에서 동작합니다.

## Mobile

`mobile/src/shared`는 API transport, 메모리 access token과 SecureStore refresh token을 소유합니다. `mobile/src/features`는 화면과 기능별 query를, `mobile/src/app`은 Expo Router 경로와 인증 경계를 조합합니다. 공개 Terms 경로는 검토된 문서가 게시될 때까지 수락 불가능한 준비 화면을 표시합니다.

## Persistence

`db/schema`의 versioned SQL이 schema의 기준입니다. `db/seed`와 `db/reset`은 로컬 개발 및 E2E 전용 deterministic 데이터만 관리하며, 운영 진입점에서는 사용하지 않습니다.

## AI integration

AI provider 호출은 backend adapter 뒤에 두고, 사용자 입력과 생성 결과를 product domain 흐름에서 검증합니다. 스트리밍 응답과 provider 실패는 명시적인 상태로 frontend에 전달합니다.

## Security boundary

실제 API key, OAuth secret, JWT secret과 데이터베이스 credential은 저장소 밖의 환경변수로 주입합니다. 공개본에는 운영 host, SSH 설정, 운영 runbook과 배포 workflow가 포함되지 않습니다. 모바일의 `EXPO_PUBLIC_*` 값에는 공개 origin과 검증된 redirect URI만 사용하며 secret을 넣지 않습니다.
