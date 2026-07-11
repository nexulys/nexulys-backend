/**
 * Générateur de facture électronique au format Factur-X / CII (UN/CEFACT Cross Industry Invoice),
 * profil EN 16931. Produit le XML structuré exigé par la réforme de la facturation
 * électronique française. La transmission via une PDP et l'embarquement PDF/A-3 se font
 * ensuite avec le prestataire agréé ; ici on produit la donnée normée, valide et complète.
 */

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const num = (n) => (Number(n) || 0).toFixed(2);
const dateCII = (d) => {
  const dt = d ? new Date(d) : new Date();
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const j = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}${m}${j}`;
};

const genererFacturXXML = (invoice, company) => {
  const tauxTVA = invoice.tauxTVA != null ? invoice.tauxTVA : 20;
  const lignes = (invoice.lignes || []).map((l, i) => {
    const qte = Number(l.quantite) || 0;
    const pu = Number(l.prixUnitaire) || 0;
    const ht = l.montantHT != null ? Number(l.montantHT) : qte * pu;
    return `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct><ram:Name>${esc(l.description)}</ram:Name></ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice><ram:ChargeAmount>${num(pu)}</ram:ChargeAmount></ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="C62">${qte}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>S</ram:CategoryCode><ram:RateApplicablePercent>${num(tauxTVA)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${num(ht)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
  }).join('');

  const vendeurTVA = company?.tvaIntra || '';
  const acheteurAdresse = invoice.client?.adresse || '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${esc(invoice.numero)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">${dateCII(invoice.dateEmission)}</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>${lignes}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${esc(company?.nom)}</ram:Name>
        ${company?.siret ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${esc(company.siret)}</ram:ID></ram:SpecifiedLegalOrganization>` : ''}
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${esc(company?.codePostal)}</ram:PostcodeCode>
          <ram:LineOne>${esc(company?.adresse)}</ram:LineOne>
          <ram:CityName>${esc(company?.ville)}</ram:CityName>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
        ${vendeurTVA ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(vendeurTVA)}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${esc(invoice.client?.nom)}</ram:Name>
        ${invoice.client?.siret ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${esc(invoice.client.siret)}</ram:ID></ram:SpecifiedLegalOrganization>` : ''}
        <ram:PostalTradeAddress>
          <ram:LineOne>${esc(acheteurAdresse)}</ram:LineOne>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${num(invoice.montantTVA)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${num(invoice.montantHT)}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>${num(tauxTVA)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      ${invoice.dateEcheance ? `<ram:SpecifiedTradePaymentTerms><ram:DueDateDateTime><udt:DateTimeString format="102">${dateCII(invoice.dateEcheance)}</udt:DateTimeString></ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>` : ''}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${num(invoice.montantHT)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${num(invoice.montantHT)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${num(invoice.montantTVA)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${num(invoice.montantTTC)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${num(invoice.montantTTC)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
};

module.exports = { genererFacturXXML };
