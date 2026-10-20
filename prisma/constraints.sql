-- Novexa — invariants comptables imposés par le moteur
--
-- Ces règles ne peuvent pas vivre uniquement dans le code applicatif : un import
-- en masse, un script de reprise ou un correctif exécuté en direct les
-- contournerait. PostgreSQL les fait respecter quelle que soit la voie d'écriture.
--
-- Application : psql "$DATABASE_URL" -f prisma/constraints.sql

-- 1. Une ligne d'écriture est soit au débit, soit au crédit, jamais les deux,
--    et jamais ni l'un ni l'autre.
ALTER TABLE journal_lines DROP CONSTRAINT IF EXISTS chk_debit_xor_credit;
ALTER TABLE journal_lines ADD CONSTRAINT chk_debit_xor_credit CHECK (
  (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
);

-- 2. Aucun montant négatif : une contrepassation s'exprime par l'inversion du
--    sens, pas par un signe.
ALTER TABLE journal_lines DROP CONSTRAINT IF EXISTS chk_montants_positifs;
ALTER TABLE journal_lines ADD CONSTRAINT chk_montants_positifs CHECK (
  debit >= 0 AND credit >= 0
);

-- 3. Partie double : une écriture validée est équilibrée au centime près.
--    Le contrôle est différé en fin de transaction, car les lignes s'insèrent
--    une à une — l'équilibre n'existe qu'une fois toutes posées.
CREATE OR REPLACE FUNCTION verifier_equilibre_ecriture() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_entry uuid;
  v_debit numeric(14,2);
  v_credit numeric(14,2);
  v_validee boolean;
BEGIN
  v_entry := COALESCE(NEW."entryId", OLD."entryId");

  SELECT validee INTO v_validee FROM journal_entries WHERE id = v_entry;
  IF v_validee IS DISTINCT FROM TRUE THEN
    RETURN NULL; -- un brouillon a le droit d'être déséquilibré
  END IF;

  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
    INTO v_debit, v_credit
    FROM journal_lines WHERE "entryId" = v_entry;

  IF v_debit <> v_credit THEN
    RAISE EXCEPTION
      'Écriture % déséquilibrée : débit % / crédit %', v_entry, v_debit, v_credit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_equilibre_ecriture ON journal_lines;
CREATE CONSTRAINT TRIGGER trg_equilibre_ecriture
  AFTER INSERT OR UPDATE OR DELETE ON journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION verifier_equilibre_ecriture();

-- 4. Immuabilité après validation (PCG art. 420-5) : une écriture validée ne se
--    modifie ni ne se supprime. La correction se fait par contrepassation.
CREATE OR REPLACE FUNCTION bloquer_modification_ecriture_validee() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.validee THEN
      RAISE EXCEPTION 'Suppression interdite : écriture % validée. Contrepassez-la.', OLD.id
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  -- Seul le passage de brouillon à validé est permis.
  IF OLD.validee AND NOT (NEW.validee AND OLD.id = NEW.id
      AND OLD."journalCode" = NEW."journalCode"
      AND OLD."numeroPiece" = NEW."numeroPiece"
      AND OLD."dateEcriture" = NEW."dateEcriture"
      AND OLD.libelle = NEW.libelle) THEN
    RAISE EXCEPTION 'Modification interdite : écriture % validée. Contrepassez-la.', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_immuabilite_ecriture ON journal_entries;
CREATE TRIGGER trg_immuabilite_ecriture
  BEFORE UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION bloquer_modification_ecriture_validee();

-- Les lignes d'une écriture validée sont figées au même titre.
CREATE OR REPLACE FUNCTION bloquer_lignes_ecriture_validee() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_validee boolean;
BEGIN
  SELECT validee INTO v_validee
    FROM journal_entries
   WHERE id = COALESCE(NEW."entryId", OLD."entryId");

  IF v_validee THEN
    RAISE EXCEPTION 'Les lignes d''une écriture validée ne peuvent plus être modifiées.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_immuabilite_lignes ON journal_lines;
CREATE TRIGGER trg_immuabilite_lignes
  BEFORE UPDATE OR DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION bloquer_lignes_ecriture_validee();

-- 5. Un règlement ne dépasse jamais le montant dû.
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS chk_reglement_coherent;
ALTER TABLE invoices ADD CONSTRAINT chk_reglement_coherent CHECK (
  "montantRegle" >= 0 AND "montantRegle" <= "montantTTC"
);

-- 6. Cohérence du total de facture au centime près.
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS chk_total_ttc;
ALTER TABLE invoices ADD CONSTRAINT chk_total_ttc CHECK (
  abs("montantTTC" - ("montantHT" + "montantTva")) < 0.01
);

-- 7. Un bulletin de paie ne peut pas produire un net à payer négatif.
ALTER TABLE payslips DROP CONSTRAINT IF EXISTS chk_net_positif;
ALTER TABLE payslips ADD CONSTRAINT chk_net_positif CHECK (
  "netAPayer" >= 0 AND brut >= 0
);

-- 8. Une période de paie valide.
ALTER TABLE payslips DROP CONSTRAINT IF EXISTS chk_periode_valide;
ALTER TABLE payslips ADD CONSTRAINT chk_periode_valide CHECK (
  "periodeMois" BETWEEN 1 AND 12 AND "periodeAnnee" BETWEEN 2000 AND 2100
);

-- 9. Une absence se termine après avoir commencé.
ALTER TABLE absences DROP CONSTRAINT IF EXISTS chk_dates_absence;
ALTER TABLE absences ADD CONSTRAINT chk_dates_absence CHECK ("dateFin" >= "dateDebut");
