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
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];
    doc.on('data', d => buffers.push(d));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const MOIS = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const PRIMARY = '#2563EB';
    const GRAY = '#6B7280';

    // En-tête
    doc.fontSize(18).fillColor(PRIMARY).font('Helvetica-Bold').text(company?.nom || 'Entreprise', 50, 50);
    doc.fontSize(9).fillColor(GRAY).font('Helvetica');
    if (company?.siret) doc.text(`SIRET : ${company.siret}`);
    if (company?.adresse) doc.text(company.adresse);

    doc.fontSize(16).fillColor('#111827').font('Helvetica-Bold').text('BULLETIN DE PAIE', 350, 50, { align: 'right' });
    doc.fontSize(10).fillColor(GRAY).font('Helvetica').text(`${MOIS[payslip.mois] || ''} ${payslip.annee}`, 350, 76, { align: 'right' });

    doc.moveTo(50, 110).lineTo(545, 110).strokeColor('#E5E7EB').lineWidth(1).stroke();

    // Infos employé
    doc.fontSize(9).fillColor(GRAY).text('EMPLOYÉ', 50, 125);
    doc.fontSize(11).fillColor('#111827').font('Helvetica-Bold').text(`${employee?.prenom || ''} ${employee?.nom || ''}`, 50, 142);
    doc.fontSize(9).fillColor(GRAY).font('Helvetica');
    if (employee?.poste) doc.text(`Poste : ${employee.poste}`);
    if (employee?.departement) doc.text(`Département : ${employee.departement}`);
    if (employee?.dateEmbauche) doc.text(`Date d'embauche : ${new Date(employee.dateEmbauche).toLocaleDateString('fr-FR')}`);

    // Tableau de paie
    const tblY = 210;
    doc.fillColor(PRIMARY).rect(50, tblY, 495, 24).fill();
    doc.fillColor('white').font('Helvetica-Bold').fontSize(9);
    doc.text('Libellé', 58, tblY + 8);
    doc.text('Base', 300, tblY + 8, { width: 80, align: 'right' });
    doc.text('Taux', 385, tblY + 8, { width: 70, align: 'right' });
    doc.text('Montant', 460, tblY + 8, { width: 80, align: 'right' });

    let y = tblY + 32;
    const row = (label, base, taux, montant, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#111827').fontSize(9);
      doc.text(label, 58, y);
      if (base != null) doc.text(String(base), 300, y, { width: 80, align: 'right' });
      if (taux != null) doc.text(String(taux), 385, y, { width: 70, align: 'right' });
      if (montant != null) doc.text(`${Number(montant).toFixed(2)} €`, 460, y, { width: 80, align: 'right' });
      y += 20;
    };

    row('Salaire brut de base', '', '', payslip.salaireBase, true);
    y += 5;
    doc.fillColor(GRAY).fontSize(8).text('COTISATIONS SALARIALES', 58, y); y += 16;
    if (payslip.cotisations) {
      Object.entries(payslip.cotisations).forEach(([k, v]) => row(`  ${k}`, '', '', -Math.abs(v)));
    }
    y += 5;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#E5E7EB').lineWidth(1).stroke(); y += 10;

    // Net à payer
    doc.fillColor(PRIMARY).rect(370, y, 175, 30).fill();
    doc.fillColor('white').font('Helvetica-Bold').fontSize(12);
    doc.text('NET À PAYER', 378, y + 9);
    doc.text(`${(payslip.netAPayer || 0).toFixed(2)} €`, 460, y + 9, { width: 80, align: 'right' });
    y += 50;

    if (employee?.iban) {
      doc.fillColor(GRAY).font('Helvetica').fontSize(8).text(`Virement sur : IBAN ${employee.iban}`, 50, y);
    }

    doc.fillColor(GRAY).fontSize(7).text(
      `Bulletin de paie — ${company?.nom || ''} — Généré le ${new Date().toLocaleDateString('fr-FR')}`,
      50, 800, { align: 'center', width: 495 }
    );

    doc.end();
  });
};

module.exports = { generateInvoicePDF, generatePayslipPDF };
