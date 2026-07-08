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

    // Fiche Mongoose → objet simple
    const p = (payslip && typeof payslip.toObject === 'function') ? payslip.toObject() : { ...payslip };

    // Rétro-compatibilité : si le détail des cotisations est absent (fiche générée
    // avec l'ancien format), on le reconstruit à partir du salaire de base afin que
    // le bulletin affiche TOUJOURS le détail complet des cotisations et contributions.
    if (!p.lignesCotisations || p.lignesCotisations.length === 0) {
      try {
        const { genererFichePaie } = require('./payslipGenerator');
        const recalc = genererFichePaie(
          p.salaireBase || 0,
          p.heuresSupplementaires || 0,
          null,
          p.primes || 0,
          p.tauxImpot || 0,
          {
            autresElements: p.autresElements || [],
            congesDebut: p.congesPayes?.soldeEnDebut || 0,
            congesPris: p.congesPayes?.pris || 0
          }
        );
        payslip = Object.assign({}, recalc, {
          mois: p.mois, annee: p.annee, numeroBulletin: p.numeroBulletin,
          periodeDebut: p.periodeDebut, periodeFin: p.periodeFin, statut: p.statut
        });
      } catch (e) {
        payslip = p; // en cas d'échec, on garde la fiche telle quelle
      }
    } else {
      payslip = p;
    }

    const L = 40, W = 515, R = L + W;
    const PMSS = 3864; // Plafond Mensuel Sécurité Sociale 2024
    const C = {
      black: '#111111', gray: '#555555', light: '#888888',
      head: '#1F2937', headBg: '#EAEEF3', grid: '#C3CAD3',
      blue: '#DCE9F6', brut: '#EDF1F6', net: '#D9E6F5', totalBg: '#F1F3F6'
    };

    // Format nombre « 2 778,98 » ; renvoie '' si undefined/null
    const num = (n) => {
      if (n === null || n === undefined || n === '') return '';
      const v = Number(n); if (isNaN(v)) return '';
      const s = Math.abs(v).toFixed(2);
      const [i, d] = s.split('.');
      return (v < 0 ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + d;
    };
    // Taux à 4 décimales ; '' si 0
    const taux = (n) => (!n || Number(n) === 0) ? '' : Number(n).toFixed(4);

    // Colonnes : { x, w } — alignées à droite
    const col = {
      base:   { x: L + 200, w: 44 },
      taux:   { x: L + 244, w: 44 },
      deduit: { x: L + 288, w: 46 },
      payer:  { x: L + 334, w: 50 },
      pbase:  { x: L + 384, w: 46 },
      ptaux:  { x: L + 430, w: 40 },
      pmont:  { x: L + 470, w: 45 } // bord droit = R
    };
    const libX = L + 3, libW = 194;

    let y = 40;

    // ══════════════════════════════════════════════════════════════════════
    // EN-TÊTE — Employeur (gauche) · Titre + Salarié (droite)
    // ══════════════════════════════════════════════════════════════════════
    let ey = y;
    doc.fontSize(10).font('Helvetica-Bold').fillColor(C.black)
       .text((company?.nom || 'Employeur').toUpperCase(), L, ey, { width: 250 });
    ey += 14;
    doc.fontSize(7.5).font('Helvetica').fillColor(C.gray);
    const eLine = (t) => { if (t) { doc.text(t, L, ey, { width: 250, lineBreak: false }); ey += 9.5; } };
    eLine(company?.adresse);
    eLine([company?.codePostal, company?.ville].filter(Boolean).join(' '));
    ey += 3;
    eLine(`Siret : ${company?.siret || '—'}      Code Naf : ${company?.codeApe || '—'}`);
    eLine(`Urssaf : ${company?.urssaf || '—'}`);
    if (employee?.matricule) eLine(`Matricule : ${employee.matricule}`);
    if (employee?.numeroSecu) eLine(`N° SS : ${employee.numeroSecu}`);
    if (employee?.iban) eLine(`Iban / Bic : ${employee.iban}`);
    eLine(`Emploi : ${employee?.poste || '—'}`);
    eLine(`Statut professionnel : ${employee?.statut || 'Employé'}`);
    if (employee?.dateEmbauche) eLine(`Entrée : ${new Date(employee.dateEmbauche).toLocaleDateString('fr-FR')}`);
    eLine(`Convention collective : ${company?.conventionCollective || '—'}`);

    // Titre + période (haut droite)
    doc.fontSize(15).font('Helvetica-Bold').fillColor(C.black)
       .text('BULLETIN DE SALAIRE', L + 265, y, { width: R - (L + 265), align: 'right' });
    const per = `${String(payslip.mois || '').padStart(2, '0')}/${payslip.annee || ''}`;
    doc.fontSize(8.5).font('Helvetica').fillColor(C.gray)
       .text(`Période : ${per}`, L + 265, y + 22, { width: R - (L + 265), align: 'right' });

    // Encadré salarié (bleu clair)
    const bX = L + 275, bY = y + 44, bW = R - bX, bH = 58;
    doc.rect(bX, bY, bW, bH).fill(C.blue);
    doc.fillColor(C.black).font('Helvetica-Bold').fontSize(10)
       .text(`${employee?.civilite ? employee.civilite + ' ' : ''}${employee?.prenom || ''} ${employee?.nom || ''}`.trim(), bX + 12, bY + 12, { width: bW - 20 });
    let sy = bY + 28;
    doc.font('Helvetica').fontSize(8).fillColor(C.gray);
    if (employee?.adresse) { doc.text(employee.adresse, bX + 12, sy, { width: bW - 20, lineBreak: false }); sy += 11; }
    const villeSal = [employee?.codePostal, employee?.ville].filter(Boolean).join(' ');
    if (villeSal) doc.text(villeSal, bX + 12, sy, { width: bW - 20, lineBreak: false });

    y = Math.max(ey, bY + bH) + 12;

    // ══════════════════════════════════════════════════════════════════════
    // EN-TÊTE DU TABLEAU
    // ══════════════════════════════════════════════════════════════════════
    const tableTop = y;
    const hH = 26;
    doc.rect(L, y, W, hH).fill(C.headBg);
    doc.fillColor(C.head).font('Helvetica-Bold').fontSize(7.5);
    doc.text('Éléments de paie', libX, y + 9, { width: libW });
    doc.text('Base', col.base.x, y + 9, { width: col.base.w, align: 'right' });
    doc.text('Taux', col.taux.x, y + 9, { width: col.taux.w, align: 'right' });
    doc.text('À déduire', col.deduit.x, y + 9, { width: col.deduit.w, align: 'right' });
    doc.text('À payer', col.payer.x, y + 9, { width: col.payer.w, align: 'right' });
    doc.fontSize(7).text('Charges patronales', col.pbase.x - 2, y + 3, { width: R - col.pbase.x + 2, align: 'center' });
    doc.fontSize(6.3).fillColor(C.gray);
    doc.text('Base', col.pbase.x, y + 15, { width: col.pbase.w, align: 'right' });
    doc.text('Taux', col.ptaux.x, y + 15, { width: col.ptaux.w, align: 'right' });
    doc.text('Montant', col.pmont.x, y + 15, { width: col.pmont.w, align: 'right' });
    y += hH;

    // ── Helpers de lignes ──
    const RH = 11.5;
    const drawRow = (o) => {
      if (o.fill) doc.rect(L, y, W, RH).fill(o.fill);
      doc.font(o.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(o.size || 6.8).fillColor(C.black);
      doc.text(o.lib || '', libX + (o.indent || 0), y + 3, { width: libW - (o.indent || 0), lineBreak: false });
      const cell = (key, val, isTaux) => {
        if (val === undefined || val === null || val === '') return;
        const t = isTaux ? taux(val) : num(val);
        if (t === '') return;
        doc.text(t, col[key].x, y + 3, { width: col[key].w, align: 'right' });
      };
      cell('base', o.base); cell('taux', o.tx, true); cell('deduit', o.deduit);
      cell('payer', o.payer); cell('pbase', o.pbase); cell('ptaux', o.ptaux, true); cell('pmont', o.pmont);
      y += RH;
    };
    const sectionLabel = (t) => {
      doc.font('Helvetica-Bold').fontSize(6.8).fillColor(C.gray);
      doc.text(t, libX, y + 3, { width: libW });
      y += RH;
    };

    const totalSal = payslip.cotisationsSalariales?.total || 0;
    const totalPat = payslip.cotisationsPatronales?.total || 0;

    // ── Rémunération ──
    drawRow({ lib: 'Salaire de base', base: payslip.heuresBase || 151.67, tx: payslip.tauxHoraire, payer: payslip.salaireBase });
    if (payslip.heuresSupplementaires > 0)
      drawRow({ lib: 'Heures supplémentaires 25%', base: payslip.heuresSupplementaires, tx: payslip.heuresSupplementaires ? (payslip.montantHeuresSup / payslip.heuresSupplementaires) : undefined, payer: payslip.montantHeuresSup });
    if (payslip.primes > 0) drawRow({ lib: "Prime d'ancienneté / prime", payer: payslip.primes });
    (payslip.elementsBrut || []).forEach(e => drawRow({ lib: e.libelle, base: e.base, tx: e.taux, payer: e.montant }));
    drawRow({ lib: 'Salaire brut', payer: payslip.salaireBrut, bold: true, fill: C.brut });

    // ── Cotisations par catégorie ──
    let cur = null;
    (payslip.lignesCotisations || []).forEach((l) => {
      if (l.categorie !== cur) { cur = l.categorie; sectionLabel(cur); }
      drawRow({
        lib: l.libelle,
        base: l.montantSalarial ? l.base : undefined,
        tx: l.tauxSalarial || undefined,
        deduit: l.montantSalarial || undefined,
        pbase: l.montantPatronal ? l.base : undefined,
        ptaux: l.tauxPatronal || undefined,
        pmont: l.montantPatronal || undefined,
        indent: 6
      });
    });

    // ── Total cotisations ──
    drawRow({ lib: 'Total des cotisations et contributions', deduit: totalSal, pmont: totalPat, bold: true, fill: C.totalBg });

    // ── Autres éléments (avantages, forfaits, titres restaurant…) ──
    (payslip.autresElements || []).forEach(e => {
      const montant = Number(e.montant) || 0;
      drawRow({
        lib: e.libelle,
        base: e.base, tx: e.taux,
        deduit: montant < 0 ? Math.abs(montant) : undefined,
        payer: montant >= 0 ? montant : undefined
      });
    });

    // ── Net ──
    const netAvant = payslip.netAvantImpot || payslip.salaireNet || 0;
    const montantPAS = payslip.montantPAS || 0;
    const netAPayer = payslip.netAPayer || netAvant;
    const netImposable = payslip.netImposable || netAvant;

    drawRow({ lib: 'Net à payer avant impôt sur le revenu', payer: netAvant, bold: true, fill: C.brut, size: 7.5 });
    drawRow({
      lib: `Impôt sur le revenu prélevé à la source - PAS${payslip.tauxImpot ? ` (taux ${(payslip.tauxImpot * 100).toFixed(1)} %)` : ''}`,
      base: netImposable,
      tx: payslip.tauxImpot ? payslip.tauxImpot * 100 : undefined,
      deduit: montantPAS
    });
    drawRow({ lib: 'Net payé', payer: netAPayer, bold: true, fill: C.net, size: 8 });

    const tableBottom = y;

    // ── Grille du tableau (bordures + séparateurs verticaux) ──
    doc.lineWidth(0.4).strokeColor(C.grid);
    [L, col.base.x, col.taux.x, col.deduit.x, col.payer.x, col.pbase.x, col.ptaux.x, col.pmont.x, R]
      .forEach(x => doc.moveTo(x, tableTop).lineTo(x, tableBottom).stroke());
    doc.lineWidth(0.6).rect(L, tableTop, W, tableBottom - tableTop).stroke();

    y = tableBottom + 14;

    // ══════════════════════════════════════════════════════════════════════
    // RÉCAPITULATIF Mensuel / Annuel
    // ══════════════════════════════════════════════════════════════════════
    const recapCols = ['', 'Heures', 'H. suppl.', 'Brut', 'Plafond S.S.', 'Net imposable', 'Ch. patronales', 'Coût global', 'Total versé', 'Allègements'];
    const rc = W / recapCols.length;
    const recapTop = y;

    doc.rect(L, y, W, 15).fill(C.headBg);
    doc.fillColor(C.head).font('Helvetica-Bold').fontSize(5.8);
    recapCols.forEach((h, i) => doc.text(h, L + i * rc + 2, y + 5, { width: rc - 4, align: i === 0 ? 'left' : 'right' }));
    y += 15;

    const chPat = totalPat;
    const brut = payslip.salaireBrut || 0;
    const cout = brut + chPat;
    const h0 = payslip.heuresBase || 151.67;
    const hs = payslip.heuresSupplementaires || 0;
    const m = payslip.mois || 1; // cumul année = valeur × n° du mois
    const mensuel = ['Mensuel', h0.toFixed(2), hs ? hs.toFixed(2) : '', brut, PMSS, netImposable, chPat, cout, netAPayer, 0];
    const annuel = ['Annuel', (h0 * m).toFixed(2), hs ? (hs * m).toFixed(2) : '', brut * m, PMSS * m, netImposable * m, chPat * m, cout * m, netAPayer * m, 0];

    [mensuel, annuel].forEach((row, ri) => {
      if (ri === 1) doc.rect(L, y, W, 13).fill('#F9FAFB');
      doc.font(ri === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(6).fillColor(C.black);
      row.forEach((v, i) => {
        const t = i === 0 ? v : (i === 1 || i === 2 ? v : num(v));
        doc.text(t, L + i * rc + 2, y + 3.5, { width: rc - 4, align: i === 0 ? 'left' : 'right' });
      });
      y += 13;
    });

    // Grille récap
    doc.lineWidth(0.4).strokeColor(C.grid);
    for (let i = 1; i < recapCols.length; i++) doc.moveTo(L + i * rc, recapTop).lineTo(L + i * rc, y).stroke();
    doc.lineWidth(0.6).rect(L, recapTop, W, y - recapTop).stroke();

    y += 12;

    // ── Congés payés (ligne compacte) ──
    const cp = payslip.congesPayes || {};
    doc.font('Helvetica').fontSize(7).fillColor(C.gray).text(
      `Congés payés — Solde début : ${(cp.soldeEnDebut || 0).toFixed(1)} j    |    Acquis : ${(cp.acquis || 2.5).toFixed(1)} j    |    Pris : ${(cp.pris || 0).toFixed(1)} j    |    Solde fin : ${(cp.solde || 0).toFixed(1)} j`,
      L, y, { width: W }
    );
    y += 14;

    // ── Pied de page légal ──
    const pageH = doc.page.height;
    doc.moveTo(L, pageH - 46).lineTo(R, pageH - 46).strokeColor(C.grid).lineWidth(0.5).stroke();
    doc.fontSize(6.3).fillColor(C.light).font('Helvetica').text(
      'Bulletin de paie à conserver sans limitation de durée (Art. L3243-4 du Code du travail). ' +
      'En cas de rupture du contrat, ce bulletin est remis avec le solde de tout compte. ' +
      `Document généré le ${new Date().toLocaleDateString('fr-FR')} — ${company?.nom || 'Novexa by Nexulys'}.`,
      L, pageH - 40, { width: W, align: 'center' }
    );

    doc.end();
  });
};

module.exports = { generateInvoicePDF, generatePayslipPDF };
