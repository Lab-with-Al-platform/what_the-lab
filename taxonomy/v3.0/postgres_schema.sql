-- WHAT THE LAB | taxonomy v3.0 release candidate. NOT a tested production migration.
-- PostgreSQL DDL starter. RBAC/RLS policies, migrations and auditing must be reviewed before release.
CREATE TABLE taxonomy_categories (id text PRIMARY KEY, axis text NOT NULL CHECK(axis IN('capability','research_field')), label_ko text NOT NULL, label_en text NOT NULL, sort_order integer NOT NULL);
CREATE TABLE taxonomy_terms (id text PRIMARY KEY, axis text NOT NULL CHECK(axis IN('capability','research_field')), category_id text NOT NULL REFERENCES taxonomy_categories(id), code text NOT NULL UNIQUE, label_ko text NOT NULL, label_en text NOT NULL, definition text NOT NULL, not_equivalent_to text, status text NOT NULL DEFAULT 'pending_review' CHECK(status IN('pending_review','active','retired')), replaced_by_id text REFERENCES taxonomy_terms(id), approved_at timestamptz, reviewed_by text, version text NOT NULL, UNIQUE(axis,label_ko));
CREATE TABLE taxonomy_aliases (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, term_id text NOT NULL REFERENCES taxonomy_terms(id), relation text NOT NULL CHECK(relation IN('PREFERRED','EXACT')), language text, raw_text text NOT NULL, normalized_text text NOT NULL, auto_match boolean NOT NULL DEFAULT false, UNIQUE(term_id, normalized_text));
CREATE TABLE taxonomy_related_terms (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, term_id text NOT NULL REFERENCES taxonomy_terms(id), raw_text text NOT NULL, normalized_text text NOT NULL, relation text NOT NULL DEFAULT 'RELATED');
CREATE INDEX ON taxonomy_aliases(normalized_text);
CREATE INDEX ON taxonomy_terms(axis,status,category_id);
CREATE TABLE taxonomy_ui_groups (id text PRIMARY KEY, label_ko text NOT NULL, sort_order integer NOT NULL, status text NOT NULL);
CREATE TABLE taxonomy_ui_group_members (group_id text NOT NULL REFERENCES taxonomy_ui_groups(id), capability_id text NOT NULL REFERENCES taxonomy_terms(id), PRIMARY KEY(group_id, capability_id));
-- Expert id type (uuid/text) must match your real expert table; shown as text intentionally.
CREATE TABLE expert_capabilities (expert_id text NOT NULL, capability_id text NOT NULL REFERENCES taxonomy_terms(id), verification_status text NOT NULL DEFAULT 'self_declared' CHECK (verification_status IN ('self_declared','in_review','verified','rejected')), evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb, PRIMARY KEY(expert_id,capability_id));
CREATE TABLE expert_research_fields (expert_id text NOT NULL, field_id text NOT NULL REFERENCES taxonomy_terms(id), relationship_type text NOT NULL CHECK(relationship_type IN('experience','collaboration_interest')), PRIMARY KEY(expert_id,field_id,relationship_type));
-- Applications MUST enforce term.axis and active status, exposure restrictions and expert ownership server-side.
-- Do not expose private evidence_refs through public GET APIs.
