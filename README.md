# Margins

Margins는 책을 발견하고 기록한 뒤, AI 질문과 여러 관점의 페르소나 토론을 통해 독서를 확장하는 웹 애플리케이션입니다.

이 저장소는 포트폴리오 검토를 위해 정리한 공개 스냅샷입니다. 비공개 원본의 Git 이력, 운영 배포 설정, 개인 환경 정보, 내부 작업 기록과 권리가 확정되지 않은 이미지 에셋은 포함하지 않습니다.

## 구성

- `front/`: React, TypeScript, Vite, React Query, Zustand
- `back/`: Java 21, Spring Boot, Spring Security, MyBatis
- `db/`: MySQL schema, deterministic local/E2E fixtures
- `docs/architecture.md`: 주요 경계와 요청 흐름

## 로컬 실행

필수 도구는 Node.js 22+, Java 21 JDK, Docker와 Docker Compose v2입니다.

```bash
cp .env.example .env
npm run local:doctor
npm run local:install
npm run local:db:up
npm run local:dev
```

계층별 검증은 다음 명령으로 실행합니다.

```bash
npm run test:back
npm run test:front
npm run test:back:integration
npm run test:e2e
npm run quality
```

## 보안 주의

`.env.example`, `infra/docker/mysql-compose.yml`과 테스트 fixture의 계정·비밀번호는 오직 격리된 로컬 개발 및 자동화 테스트를 위한 deterministic 기본값입니다. 인터넷에 노출된 환경이나 운영 환경에서 사용하면 안 됩니다. 실제 credential은 커밋하지 말고 ignored `.env` 또는 별도 secret manager에 보관하세요.

## 권리

이 공개본은 현재 오픈소스 배포물이 아닙니다. 별도 라이선스가 부여될 때까지 코드와 문서의 권리는 `COPYRIGHT.md`를 따릅니다. 이미지·아이콘은 공개 재배포 권리 확인 전까지 의도적으로 제외했습니다.
