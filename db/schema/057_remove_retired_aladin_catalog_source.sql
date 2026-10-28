-- 2026-10-30 종료되는 알라딘 OpenAPI를 미출시 catalog source에서 제거한다.
-- 알라딘 키와 수집 데이터가 없으므로 source 설정 행만 삭제한다.
-- 참조 데이터가 있으면 외래키가 migration을 실패시켜 별도 처분 결정을 요구한다.
DELETE FROM catalog_sources
WHERE code = 'aladin';
