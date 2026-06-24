const PDFDocument = require('pdfkit');

const generateInvoicePDF = (invoice, company) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];
    doc.on('data', d => buffers.push(d));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const PRIMARY = '#2563EB';
    const GRAY = '#6B7280';
    const BLACK = '#111827';

    // En-tête société
    doc.fontSize(22).fillColor(PRIMARY).font('Helvetica-Bold').text(company.nom || 'Mon Entreprise', 50, 50);
    doc.fontSize(9).fillColor(GRAY).font('Helvetica');
    if (company.adresse) doc.text(company.adresse);
    if (company.codePostal && company.ville) doc.text(`${company.codePostal} ${company.ville}`);
    if (company.email) doc.text(company.email);
    if (company.siret) doc.text(`SIRET : ${company.siret}`);

    // Bloc FACTURE
    doc.fontSize(28).fillColor(PRIMARY).font('Helvetica-Bold').text('FACTURE', 350, 50, { align: 'right' });
    doc.fontSize(11).fillColor(BLACK).font('Helvetica');
    doc.text(`N° ${invoice.numero}`, 350, 90, { align: 'right' });
    doc.fontSize(9).fillColor(GRAY).text(`Date d'émission : ${new Date(invoice.dateEmission || invoice.createdAt).toLocaleDateString('fr-FR')}`, 350, 108, { align: 'right' });
    if (invoice.dateEcheance) doc.text(`Échéance : ${new Date(invoice.dateEcheance).toLocaleDateString('fr-FR')}`, 350, 124, { align: 'right' });

    // Ligne séparatrice
    doc.moveTo(50, 160).lineTo(545, 160).strokeColor('#E5E7EB').lineWidth(1).stroke();

    // Bloc client
    doc.fontSize(9).fillColor(GRAY).font('Helvetica').text('FACTURÉ À', 50, 175);
    doc.fontSize(11).fillColor(BLACK).font('Helvetica-Bold').text(invoice.client?.nom || '', 50, 192);
    doc.fontSize(9).fillColor(GRAY).font('Helvetica');
    if (invoice.client?.email) doc.text(invoice.client.email);
    if (invoice.client?.adresse) doc.text(invoice.client.adresse);

    // Statut badge
    const statutColors = { payee: '#10B981', en_retard: '#EF4444', envoyee: '#F59E0B', brouillon: GRAY };
    doc.roundedRect(400, 180, 100, 24, 4).fill(statutColors[invoice.statut] || GRAY);
    doc.fontSize(10).fillColor('white').font('Helvetica-Bold').text(
      (invoice.statut || 'brouillon').toUpperCase(), 400, 187, { width: 100, align: 'center' }
    );

    // Tableau des lignes
    const tableTop = 270;
    doc.fillColor(PRIMARY).rect(50, tableTop, 495, 24).fill();
    doc.fillColor('white').font('Helvetica-Bold').fontSize(9);
    doc.text('Description', 58, tableTop + 8);
    doc.text('Qté', 340, tableTop + 8, { width: 50, align: 'right' });
    doc.text('Prix unit. HT', 395, tableTop + 8, { width: 80, align: 'right' });
    doc.text('Total HT', 480, tableTop + 8, { width: 65, align: 'right' });

    let y = tableTop + 30;
    doc.font('Helvetica').fillColor(BLACK).fontSize(9);
    (invoice.lignes || []).forEach((ligne, i) => {
      if (i % 2 === 0) doc.fillColor('#F9FAFB').rect(50, y - 4, 495, 22).fill();
      doc.fillColor(BLACK);
      doc.text(ligne.description || ligne.designation || '', 58, y, { width: 270 });
      doc.text(String(ligne.quantite || 1), 340, y, { width: 50, align: 'right' });
      doc.text(`${(ligne.prixUnitaire || ligne.prixHT || 0).toFixed(2)} €`, 395, y, { width: 80, align: 'right' });
      doc.text(`${(ligne.montantHT || (ligne.quantite * ligne.prixUnitaire) || 0).toFixed(2)} €`, 480, y, { width: 65, align: 'right' });
      y += 22;
    });

    // Ligne finale
    doc.moveTo(50, y + 8).lineTo(545, y + 8).strokeColor('#E5E7EB').lineWidth(1).stroke();
    y += 20;

    // Totaux
    const totalsX = 380;
    doc.fillColor(GRAY).fontSize(9);
    doc.text('Total HT', totalsX, y); doc.fillColor(BLACK).text(`${(invoice.montantHT||0).toFixed(2)} €`, 480, y, { width: 65, align: 'right' }); y += 18;
    doc.fillColor(GRAY).text(`TVA (${invoice.tauxTVA || 20}%)`, totalsX, y); doc.fillColor(BLACK).text(`${(invoice.montantTVA||0).toFixed(2)} €`, 480, y, { width: 65, align: 'right' }); y += 18;

    doc.fillColor(PRIMARY).rect(370, y, 175, 28).fill();
    doc.fillColor('white').font('Helvetica-Bold').fontSize(11);
    doc.text('TOTAL TTC', 378, y + 8); doc.text(`${(invoice.montantTTC||0).toFixed(2)} €`, 480, y + 8, { width: 65, align: 'right' });
    y += 45;

    // Notes
    if (invoice.notes) {
      doc.fillColor(GRAY).font('Helvetica').fontSize(8).text('Notes :', 50, y);
      doc.fillColor(BLACK).text(invoice.notes, 50, y + 12, { width: 495 });
    }

    // IBAN
    if (company.iban) {
      doc.fillColor(GRAY).fontSize(8).text(`Virement : IBAN ${company.iban}`, 50, 760);
    }

    // Pied de page
    doc.fillColor(GRAY).fontSize(7).text(
      `${company.nom || ''} — Document généré le ${new Date().toLocaleDateString('fr-FR')}`,
      50, 800, { align: 'center', width: 495 }
    );

    doc.end();
  });
};

const generatePayslipPDF = (payslip, employee, company) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const buffers = [];
    doc.on('data', d => buffers.push(d));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const MOIS = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const C = { primary: '#1e40af', gray: '#6B7280', lightgray: '#9CA3AF', black: '#111827', bg: '#F8FAFC', green: '#065F46', red: '#991B1B', border: '#E5E7EB' };
    const W = 515; // largeur utile
    const L = 40;  // marge gauche

    const fmt = (n) => (n || 0).toFixed(2).replace('.', ',');
    const fmtTaux = (n) => n ? n.toFixed(2).replace('.', ',') + ' %' : '';

    let y = 40;

    // ══════════════════════════════════════════════════════════════════════
    // EN-TÊTE : Employeur à gauche, Employé à droite
    // ══════════════════════════════════════════════════════════════════════

    // Box employeur
    doc.rect(L, y, 240, 100).fill('#EEF2FF');
    doc.fontSize(11).fillColor(C.primary).font('Helvetica-Bold')
       .text(company?.nom || 'Employeur', L + 8, y + 8, { width: 224 });
    doc.fontSize(8).fillColor(C.gray).font('Helvetica');
    if (company?.adresse) doc.text(company.adresse, L + 8, doc.y, { width: 224 });
    if (company?.codePostal && company?.ville) doc.text(`${company.codePostal} ${company.ville}`, L + 8, doc.y, { width: 224 });
    if (company?.siret) doc.text(`SIRET : ${company.siret}`, L + 8, doc.y + 2, { width: 224 });
    if (company?.codeApe) doc.text(`Code APE : ${company.codeApe}`, L + 8, doc.y, { width: 224 });
    if (company?.urssaf) doc.text(`N° URSSAF : ${company.urssaf}`, L + 8, doc.y, { width: 224 });

    // Box employé
    doc.rect(L + 255, y, 260, 100).fill('#EEF2FF');
    doc.fontSize(11).fillColor(C.primary).font('Helvetica-Bold')
       .text(`${employee?.prenom || ''} ${employee?.nom || ''}`.trim(), L + 263, y + 8, { width: 244 });
    doc.fontSize(8).fillColor(C.gray).font('Helvetica');
    if (employee?.poste) doc.text(`Emploi : ${employee.poste}`, L + 263, doc.y, { width: 244 });
    if (employee?.departement) doc.text(`Service : ${employee.departement}`, L + 263, doc.y, { width: 244 });
    if (employee?.dateEmbauche) doc.text(`Entrée le : ${new Date(employee.dateEmbauche).toLocaleDateString('fr-FR')}`, L + 263, doc.y + 2, { width: 244 });
    if (employee?.numeroSecu) doc.text(`N° SS : ${employee.numeroSecu}`, L + 263, doc.y, { width: 244 });
    if (employee?.statut) doc.text(`Contrat : ${employee.statut.toUpperCase()}`, L + 263, doc.y, { width: 244 });

    y += 110;

    // ══════════════════════════════════════════════════════════════════════
    // TITRE + PÉRIODE
    // ══════════════════════════════════════════════════════════════════════
    doc.rect(L, y, W, 28).fill(C.primary);
    doc.fontSize(13).fillColor('white').font('Helvetica-Bold')
       .text('BULLETIN DE PAIE', L + 8, y + 8);
    const periodeStr = payslip.periodeDebut
      ? `Période du ${payslip.periodeDebut} au ${payslip.periodeFin}`
      : `${MOIS[payslip.mois] || ''} ${payslip.annee}`;
    doc.fontSize(10).fillColor('white').font('Helvetica')
       .text(periodeStr, L + 8, y + 10, { align: 'right', width: W - 16 });
    y += 36;

    // Convention collective + mentions
    doc.fontSize(7.5).fillColor(C.lightgray).font('Helvetica');
    const conv = company?.conventionCollective || 'Convention collective applicable';
    doc.text(`Convention collective : ${conv}`, L, y);
    if (payslip.numeroBulletin) {
      doc.text(`Bulletin N° ${payslip.numeroBulletin}`, L, y, { align: 'right', width: W });
    }
    y += 14;

    // ══════════════════════════════════════════════════════════════════════
    // BLOC RÉMUNÉRATION
    // ══════════════════════════════════════════════════════════════════════
    doc.rect(L, y, W, 16).fill('#DBEAFE');
    doc.fontSize(8.5).fillColor(C.primary).font('Helvetica-Bold')
       .text('RÉMUNÉRATION BRUTE', L + 4, y + 4);
    y += 18;

    const heures = payslip.heuresBase || 151.67;
    const tauxH = payslip.tauxHoraire || (payslip.salaireBase / 151.67);

    const lignesRem = [
      { libelle: `Salaire de base (${heures.toFixed(2)} h × ${fmt(tauxH)} €)`, montant: payslip.salaireBase }
    ];
    if (payslip.heuresSupplementaires > 0) {
      lignesRem.push({ libelle: `Heures supplémentaires (${payslip.heuresSupplementaires} h majorées 25%)`, montant: payslip.montantHeuresSup });
    }
    if (payslip.primes > 0) {
      lignesRem.push({ libelle: 'Prime(s)', montant: payslip.primes });
    }
    if (payslip.autresElements && payslip.autresElements.length > 0) {
      payslip.autresElements.forEach(e => lignesRem.push({ libelle: e.libelle, montant: e.montant }));
    }

    lignesRem.forEach((l, i) => {
      if (i % 2 === 0) doc.rect(L, y, W, 16).fill('#F9FAFB');
      doc.fontSize(8.5).fillColor(C.black).font('Helvetica');
      doc.text(l.libelle, L + 4, y + 4, { width: W - 80 });
      doc.text(fmt(l.montant) + ' €', L, y + 4, { align: 'right', width: W - 4 });
      y += 16;
    });

    // Total brut
    doc.rect(L, y, W, 18).fill(C.primary);
    doc.fontSize(9).fillColor('white').font('Helvetica-Bold')
       .text('SALAIRE BRUT', L + 4, y + 5);
    doc.text(fmt(payslip.salaireBrut) + ' €', L, y + 5, { align: 'right', width: W - 4 });
    y += 24;

    // ══════════════════════════════════════════════════════════════════════
    // TABLEAU DES COTISATIONS
    // ══════════════════════════════════════════════════════════════════════
    doc.rect(L, y, W, 16).fill(C.primary);
    doc.fontSize(7.5).fillColor('white').font('Helvetica-Bold');
    doc.text('COTISATIONS ET CONTRIBUTIONS SOCIALES', L + 4, y + 4, { width: W * 0.40 });
    doc.text('Base', L + W * 0.40, y + 4, { width: W * 0.13, align: 'right' });
    doc.text('Taux sal.', L + W * 0.53, y + 4, { width: W * 0.10, align: 'right' });
    doc.text('Montant sal.', L + W * 0.63, y + 4, { width: W * 0.14, align: 'right' });
    doc.text('Taux pat.', L + W * 0.77, y + 4, { width: W * 0.10, align: 'right' });
    doc.text('Montant pat.', L + W * 0.87, y + 4, { width: W * 0.13, align: 'right' });
    y += 18;

    const lignes = payslip.lignesCotisations && payslip.lignesCotisations.length > 0
      ? payslip.lignesCotisations
      : [];

    let currentCategorie = null;
    let rowIdx = 0;

    lignes.forEach((l) => {
      // En-tête de catégorie
      if (l.categorie !== currentCategorie) {
        currentCategorie = l.categorie;
        doc.rect(L, y, W, 14).fill('#EEF2FF');
        doc.fontSize(7.5).fillColor(C.primary).font('Helvetica-Bold')
           .text(l.categorie.toUpperCase(), L + 4, y + 3);
        y += 14;
        rowIdx = 0;
      }

      if (rowIdx % 2 === 0) doc.rect(L, y, W, 14).fill('white');
      else doc.rect(L, y, W, 14).fill('#F9FAFB');

      doc.fontSize(7.5).fillColor(C.black).font('Helvetica');
      doc.text(l.libelle, L + 4, y + 3, { width: W * 0.40 - 4, ellipsis: true });
      doc.text(fmt(l.base) + ' €', L + W * 0.40, y + 3, { width: W * 0.13, align: 'right' });
      doc.text(l.tauxSalarial ? l.tauxSalarial.toFixed(2) + ' %' : '', L + W * 0.53, y + 3, { width: W * 0.10, align: 'right' });
      if (l.montantSalarial > 0) {
        doc.fillColor(C.red).text('- ' + fmt(l.montantSalarial) + ' €', L + W * 0.63, y + 3, { width: W * 0.14, align: 'right' });
        doc.fillColor(C.black);
      } else {
        doc.text('', L + W * 0.63, y + 3, { width: W * 0.14, align: 'right' });
      }
      doc.text(l.tauxPatronal ? l.tauxPatronal.toFixed(2) + ' %' : '', L + W * 0.77, y + 3, { width: W * 0.10, align: 'right' });
      doc.fillColor(C.gray).text(l.montantPatronal ? fmt(l.montantPatronal) + ' €' : '', L + W * 0.87, y + 3, { width: W * 0.13, align: 'right' });
      doc.fillColor(C.black);
      y += 14;
      rowIdx++;
    });

    // Ligne total cotisations
    const totalSal = payslip.cotisationsSalariales?.total || 0;
    const totalPat = payslip.cotisationsPatronales?.total || 0;
    doc.rect(L, y, W, 16).fill('#DBEAFE');
    doc.fontSize(8).fillColor(C.primary).font('Helvetica-Bold');
    doc.text('TOTAL COTISATIONS', L + 4, y + 4);
    doc.fillColor(C.red).text('- ' + fmt(totalSal) + ' €', L + W * 0.63, y + 4, { width: W * 0.14, align: 'right' });
    doc.fillColor(C.gray).text(fmt(totalPat) + ' €', L + W * 0.87, y + 4, { width: W * 0.13, align: 'right' });
    y += 22;

    // ══════════════════════════════════════════════════════════════════════
    // RÉCAPITULATIF NET
    // ══════════════════════════════════════════════════════════════════════

    const netAvant = payslip.netAvantImpot || payslip.salaireNet || 0;
    const montantPAS = payslip.montantPAS || 0;
    const netAPayer = payslip.netAPayer || netAvant;
    const netImposable = payslip.netImposable || netAvant;
    const tauxPAS = payslip.tauxImpot ? (payslip.tauxImpot * 100).toFixed(1) : '0';

    // Net avant impôt
    doc.rect(L, y, W, 16).fill('#F3F4F6');
    doc.fontSize(8.5).fillColor(C.black).font('Helvetica');
    doc.text('Net avant impôt sur le revenu', L + 4, y + 4);
    doc.font('Helvetica-Bold').text(fmt(netAvant) + ' €', L, y + 4, { align: 'right', width: W - 4 });
    y += 18;

    // Prélèvement à la source
    doc.rect(L, y, W, 16).fill('#FEF3C7');
    doc.fontSize(8.5).fillColor('#92400E').font('Helvetica');
    doc.text(`Prélèvement à la source (PAS ${tauxPAS} %)`, L + 4, y + 4);
    doc.font('Helvetica-Bold').text('- ' + fmt(montantPAS) + ' €', L, y + 4, { align: 'right', width: W - 4 });
    y += 18;

    // Net à payer
    doc.rect(L, y, W, 24).fill(C.primary);
    doc.fontSize(13).fillColor('white').font('Helvetica-Bold')
       .text('NET À PAYER AU SALARIÉ', L + 8, y + 6);
    doc.text(fmt(netAPayer) + ' €', L, y + 6, { align: 'right', width: W - 8 });
    y += 30;

    // Net imposable (ligne informationnelle)
    doc.fontSize(7.5).fillColor(C.gray).font('Helvetica')
       .text(`Salaire net imposable (à reporter sur déclaration de revenus) : ${fmt(netImposable)} €`, L, y, { width: W });
    y += 16;

    // ══════════════════════════════════════════════════════════════════════
    // CONGÉS PAYÉS
    // ══════════════════════════════════════════════════════════════════════
    doc.rect(L, y, W, 16).fill('#DBEAFE');
    doc.fontSize(8).fillColor(C.primary).font('Helvetica-Bold')
       .text('CONGÉS PAYÉS', L + 4, y + 4);
    y += 18;

    const cp = payslip.congesPayes || {};
    const cpCols = [
      { label: 'Solde début période', val: (cp.soldeEnDebut || 0).toFixed(1) + ' j' },
      { label: 'Acquis ce mois', val: (cp.acquis || 2.5).toFixed(1) + ' j' },
      { label: 'Pris ce mois', val: (cp.pris || 0).toFixed(1) + ' j' },
      { label: 'Solde à fin période', val: (cp.solde || 0).toFixed(1) + ' j' }
    ];

    doc.rect(L, y, W, 30).fill('#F8FAFC');
    cpCols.forEach((c, i) => {
      const cx = L + (W / 4) * i;
      doc.fontSize(7).fillColor(C.lightgray).font('Helvetica').text(c.label, cx + 4, y + 4, { width: W / 4 - 8 });
      doc.fontSize(10).fillColor(C.primary).font('Helvetica-Bold').text(c.val, cx + 4, y + 14, { width: W / 4 - 8 });
    });
    y += 38;

    // ══════════════════════════════════════════════════════════════════════
    // MODE DE PAIEMENT
    // ══════════════════════════════════════════════════════════════════════
    if (employee?.iban) {
      doc.fontSize(8).fillColor(C.gray).font('Helvetica')
         .text(`Mode de règlement : Virement bancaire — IBAN : ${employee.iban}`, L, y);
      y += 14;
    }

    // ══════════════════════════════════════════════════════════════════════
    // PIED DE PAGE — mentions légales
    // ══════════════════════════════════════════════════════════════════════
    const pageH = doc.page.height;
    doc.moveTo(L, pageH - 50).lineTo(L + W, pageH - 50).strokeColor(C.border).lineWidth(0.5).stroke();
    doc.fontSize(6.5).fillColor(C.lightgray).font('Helvetica');
    doc.text(
      'Ce bulletin de paie est à conserver sans limitation de durée (Art. L3243-4 du Code du travail). ' +
      'En cas de rupture de contrat, ce bulletin vous sera remis avec votre solde de tout compte. ' +
      `Document émis le ${new Date().toLocaleDateString('fr-FR')} — ${company?.nom || 'Novexa'}`,
      L, pageH - 42, { width: W, align: 'center' }
    );

    doc.end();
  });
};

module.exports = { generateInvoicePDF, generatePayslipPDF };
