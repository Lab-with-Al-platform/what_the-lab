-- 전송 묶음 접수 이력. Alembic 20261029_18과 같은 표·제약입니다.
-- 이미 초기화된 Docker volume에는 이 파일이 자동으로 다시 적용되지 않습니다.
CREATE TABLE insight_private.transfer_receipts (
    id VARCHAR(36) PRIMARY KEY,
    trust_scope VARCHAR(64) NOT NULL,
    bundle_id VARCHAR(100) NOT NULL,
    run_id VARCHAR(100) NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    outcome VARCHAR(30) NOT NULL,
    first_result JSON NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_transfer_receipt_scope_bundle UNIQUE (trust_scope, bundle_id),
    CONSTRAINT ck_transfer_receipt_outcome CHECK (outcome IN ('imported', 'existing_preserved'))
);

CREATE TABLE insight_private.transfer_receipt_items (
    id VARCHAR(36) PRIMARY KEY,
    receipt_id VARCHAR(36) NOT NULL REFERENCES insight_private.transfer_receipts(id),
    item_index INTEGER NOT NULL,
    candidate_id VARCHAR(36),
    revision_number INTEGER,
    action VARCHAR(30) NOT NULL,
    CONSTRAINT uq_transfer_receipt_item_index UNIQUE (receipt_id, item_index),
    CONSTRAINT ck_transfer_receipt_item_action CHECK (
        action IN ('created', 'existing_preserved', 'duplicate_in_batch')
    )
);

ALTER TABLE insight_private.transfer_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_private.transfer_receipt_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE insight_private.transfer_receipts FROM PUBLIC;
REVOKE ALL ON TABLE insight_private.transfer_receipt_items FROM PUBLIC;

DO $protect$
DECLARE table_name TEXT;
role_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['transfer_receipts', 'transfer_receipt_items'] LOOP
        FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
                EXECUTE format('REVOKE ALL ON TABLE insight_private.%I FROM %I', table_name, role_name);
            END IF;
        END LOOP;
    END LOOP;
END $protect$;

-- 021이 적어 둔 개정 번호를 이 변경까지 포함하도록 올립니다.
-- Alembic SQL에는 넣지 않습니다. Alembic이 책갈피를 직접 바꿉니다.
-- 이미 만들어진 volume은 이 UPDATE를 자동 실행하지 않으므로 별도 적용이 필요합니다.
UPDATE public.insight_alembic_version
SET version_num = '20261029_18'
WHERE version_num = '20261028_17';
