const { genererFacturXXML } = require('../../utils/facturx');

const invoice = {
  numero: 'FAC-2025-0001',
  dateEmission: '2025-06-01',
  dateEcheance: '2025-07-01',
  client: { nom: 'Client & Co', adresse: '1 rue de Paris', siret: '11111111100011' },
  lignes: [
    { description: 'Prestation <conseil>', quantite: 2, prixUnitaire: 500, montantHT: 1000 }
  ],
  montantHT: 1000, tauxTVA: 20, montantTVA: 200, montantTTC: 1200
};
const company = {
  nom: 'Ma Société', siret: '40483304800010', tvaIntra: 'FR40404833048',
  adresse: '10 av. des Champs', codePostal: '75008', ville: 'Paris'
};

describe('genererFacturXXML (facture électronique CII EN 16931)', () => {
  const xml = genererFacturXXML(invoice, company);

  it('produit un XML CrossIndustryInvoice avec les namespaces requis', () => {
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
    expect(xml).toContain('rsm:CrossIndustryInvoice');
    expect(xml).toContain('urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100');
    expect(xml).toContain('urn:cen.eu:en16931:2017');
  });

  it('inclut le numéro, le type 380 et les montants', () => {
    expect(xml).toContain('<ram:ID>FAC-2025-0001</ram:ID>');
    expect(xml).toContain('<ram:TypeCode>380</ram:TypeCode>');
    expect(xml).toContain('<ram:GrandTotalAmount>1200.00</ram:GrandTotalAmount>');
    expect(xml).toContain('<ram:TaxBasisTotalAmount>1000.00</ram:TaxBasisTotalAmount>');
    expect(xml).toContain('<ram:RateApplicablePercent>20.00</ram:RateApplicablePercent>');
  });

  it('inclut vendeur (SIRET + TVA) et acheteur', () => {
    expect(xml).toContain('40483304800010');
    expect(xml).toContain('FR40404833048');
    expect(xml).toContain('11111111100011');
  });

  it('échappe correctement les caractères XML spéciaux', () => {
    expect(xml).toContain('Client &amp; Co');
    expect(xml).toContain('Prestation &lt;conseil&gt;');
    expect(xml).not.toMatch(/<ram:Name>Client & Co/);
  });

  it('formate les dates au format CII 102 (AAAAMMJJ)', () => {
    expect(xml).toContain('format="102">20250601');
    expect(xml).toContain('format="102">20250701');
  });
});
