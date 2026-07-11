const https = require('https');

/**
 * Recherche d'entreprises via l'API publique gratuite du gouvernement français
 * (recherche-entreprises.api.gouv.fr) — aucune clé requise.
 * Accepte un SIRET/SIREN ou un nom d'entreprise.
 */
const rechercherEntreprise = (query) => {
  return new Promise((resolve, reject) => {
    const q = encodeURIComponent(String(query || '').trim());
    if (!q) return resolve([]);
    const url = `https://recherche-entreprises.api.gouv.fr/search?q=${q}&per_page=8`;
    https.get(url, { timeout: 8000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const results = (json.results || []).map(mapEntreprise);
          resolve(results);
        } catch (e) { reject(new Error('Réponse SIRENE invalide')); }
      });
    }).on('error', reject).on('timeout', function () { this.destroy(new Error('Timeout API SIRENE')); });
  });
};

// Normalise un résultat de l'API vers les champs attendus par Novexa
const mapEntreprise = (r) => {
  const siege = r.siege || {};
  const cp = siege.code_postal || '';
  const ville = siege.libelle_commune || '';
  const adresse = [siege.numero_voie, siege.type_voie, siege.libelle_voie]
    .filter(Boolean).join(' ').trim() || siege.adresse || '';
  return {
    nom: r.nom_complet || r.nom_raison_sociale || '',
    siret: siege.siret || (r.siren ? r.siren + '00000' : ''),
    siren: r.siren || '',
    codeApe: siege.activite_principale || r.activite_principale || '',
    adresse,
    codePostal: cp,
    ville,
    tvaIntra: tvaIntracom(r.siren)
  };
};

// Numéro de TVA intracommunautaire français : FR + clé (2 chiffres) + SIREN
const tvaIntracom = (siren) => {
  if (!siren || !/^\d{9}$/.test(String(siren))) return '';
  const cle = (12 + 3 * (parseInt(siren, 10) % 97)) % 97;
  return `FR${String(cle).padStart(2, '0')}${siren}`;
};

module.exports = { rechercherEntreprise, tvaIntracom };
