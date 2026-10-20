-- Novexa — isolation multitenant au niveau du moteur
--
-- Le filtre applicatif sur companyId est la première barrière ; celle-ci est la
-- seconde. Une requête ayant omis le filtre — oubli dans un contrôleur, jointure
-- mal cadrée, script d'exploitation — ne peut pas franchir la frontière d'un
-- client, parce que PostgreSQL l'en empêche indépendamment du code.
--
-- Application : psql "$DATABASE_URL" -f prisma/rls.sql
-- À rejouer après chaque `prisma migrate deploy` (les politiques ne sont pas
-- gérées par Prisma Migrate).

-- Rôle applicatif : contrairement au propriétaire des tables, il est soumis aux
-- politiques. Un superutilisateur ou le propriétaire les contournerait.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'novexa_app') THEN
    CREATE ROLE novexa_app LOGIN PASSWORD 'a_remplacer_par_le_secret_deploiement';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO novexa_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO novexa_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO novexa_app;

-- L'application ouvre chaque transaction par :
--   SET LOCAL app.company_id = '<uuid du tenant>';
-- SET LOCAL est impératif : la valeur meurt avec la transaction et ne peut pas
-- fuiter vers la requête suivante servie par la même connexion du pool.
CREATE OR REPLACE FUNCTION current_company_id() RETURNS uuid
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN nullif(current_setting('app.company_id', true), '')::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

DO $$
DECLARE
  t text;
  tables_tenant text[] := ARRAY[
    'users', 'subscriptions', 'usage_counters', 'ledger_accounts',
    'journal_entries', 'invoices', 'source_documents', 'ai_jobs',
    'employees', 'payslips', 'audit_logs', 'api_keys'
  ];
BEGIN
  FOREACH t IN ARRAY tables_tenant LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
        USING ("companyId" = current_company_id())
        WITH CHECK ("companyId" = current_company_id())
    $f$, t);
  END LOOP;
END
$$;

-- Tables filles : elles ne portent pas companyId, leur cloisonnement découle du
-- parent. La politique remonte la relation plutôt que de dupliquer la colonne.
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON journal_lines;
CREATE POLICY tenant_isolation ON journal_lines
  USING (EXISTS (
    SELECT 1 FROM journal_entries e
    WHERE e.id = journal_lines."entryId" AND e."companyId" = current_company_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM journal_entries e
    WHERE e.id = journal_lines."entryId" AND e."companyId" = current_company_id()
  ));

ALTER TABLE absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE absences FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON absences;
CREATE POLICY tenant_isolation ON absences
  USING (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = absences."employeeId" AND e."companyId" = current_company_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = absences."employeeId" AND e."companyId" = current_company_id()
  ));

ALTER TABLE billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_invoices FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON billing_invoices;
CREATE POLICY tenant_isolation ON billing_invoices
  USING (EXISTS (
    SELECT 1 FROM subscriptions s
    WHERE s.id = billing_invoices."subscriptionId" AND s."companyId" = current_company_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM subscriptions s
    WHERE s.id = billing_invoices."subscriptionId" AND s."companyId" = current_company_id()
  ));

-- La table companies se filtre sur sa propre clé primaire.
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON companies;
CREATE POLICY tenant_isolation ON companies
  USING (id = current_company_id())
  WITH CHECK (id = current_company_id());
