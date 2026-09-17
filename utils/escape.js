/**
 * Utilitaires d'échappement — neutralisent les entrées utilisateur avant de les
 * réinjecter dans un contexte interprété (regex MongoDB, HTML, cellule CSV).
 */

/**
 * Neutralise les métacaractères d'une expression régulière.
 * Indispensable avant tout `new RegExp(entreeUtilisateur)` : sans cela, une valeur
 * comme `.*` élargit silencieusement la requête (fuite de données) et une valeur
 * comme `(a+)+$` provoque un ReDoS qui fige l'event loop Node.
 */
const escapeRegex = (str) => String(str ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Échappe les caractères significatifs en HTML (contexte texte et attribut). */
const escapeHtml = (str) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Neutralise l'injection de formule dans un export CSV (CWE-1236).
 * Excel/LibreOffice/Sheets interprètent toute cellule débutant par = + - @ (ou une
 * tabulation / un retour chariot) comme une formule, ce qui permet l'exfiltration
 * de données ou l'exécution de commandes sur le poste qui ouvre le fichier.
 */
const escapeCsvCell = (value) => {
  const str = String(value ?? '');
  const neutralised = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${neutralised.replace(/"/g, '""')}"`;
};

module.exports = { escapeRegex, escapeHtml, escapeCsvCell };
