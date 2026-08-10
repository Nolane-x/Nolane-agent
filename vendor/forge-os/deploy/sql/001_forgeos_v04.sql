BEGIN;
CREATE TABLE IF NOT EXISTS forge_projects (
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  revision bigint NOT NULL CHECK (revision >= 1),
  fencing_token bigint NOT NULL CHECK (fencing_token >= 1),
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, project_id)
);
CREATE TABLE IF NOT EXISTS forge_idempotency (
  tenant_id text NOT NULL,
  idempotency_key text NOT NULL,
  request_digest char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS forge_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  sequence integer NOT NULL,
  event_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (tenant_id, project_id, sequence, id)
);
CREATE INDEX IF NOT EXISTS forge_outbox_unpublished_idx ON forge_outbox (created_at) WHERE published_at IS NULL;
COMMIT;
