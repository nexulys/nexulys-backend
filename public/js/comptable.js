// Jeton d'accès : lu dans le fragment d'URL (#token=…), qui n'est jamais transmis
// au serveur ni journalisé. Les liens déjà distribués utilisent encore ?token=, on
// les accepte puis on réécrit l'URL pour retirer le jeton de la query string.
const token = (function () {
  const hash = new URLSearchParams(location.hash.replace(/^#/, '')).get('token');
  if (hash) return hash;
  const query = new URLSearchParams(location.search).get('token');
  if (query) {
    try {
      const url = new URL(location.href);
      url.searchParams.delete('token');
      url.hash = 'token=' + query;
      history.replaceState(null, '', url.toString());
    } catch (e) {}
  }
  return query;
})();

// Le jeton part en en-tête plutôt que dans le chemin : dans l'URL il serait écrit en
// clair dans les logs d'accès nginx et morgan.
const authHeaders = () => ({ 'Content-Type': 'application/json', 'X-Access-Token': token || '' });

const fmt = n => (n||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €';
// Échappement obligatoire : intitulés de dépenses, noms de clients et numéros de
// facture sont saisis côté entreprise et rendus ici chez l'expert-comptable.
const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const statusBadge = s => {
  const m = {payee:['badge-green','Payée'],envoyee:['badge-orange','Envoyée'],en_retard:['badge-red','En retard'],brouillon:['badge-gray','Brouillon'],annulee:['badge-gray','Annulée']};
  const [cls,lbl] = m[s]||['badge-gray',esc(s)];
  return `<span class="badge ${cls}">${lbl}</span>`;
};
const catLabels = {fournitures:'Fournitures',transport:'Transport',restauration:'Restauration',logiciel:'Logiciels',marketing:'Marketing',loyer:'Loyer',salaires:'Salaires',autre:'Autres'};

async function load() {
  if (!token) { show('error-view'); return; }
  try {
    const res = await fetch('https://nexulys-backend-1.onrender.com/api/expert/acces', { headers: authHeaders() });
    const data = await res.json();
    if (!data.success) { show('error-view'); return; }
    const d = data.data;

    document.title = `Accès comptable — ${d.company.nom}`;
    document.getElementById('company-label').textContent = d.company.nom + ' | Exercice ' + d.annee;

    const kpis = d.kpis;
    const resultatColor = kpis.resultatNet >= 0 ? '#34d399' : '#f87171';

    const chargesParCat = d.recentExpenses.reduce((acc, e) => {
      acc[e.categorie] = (acc[e.categorie] || 0) + e.montant;
      return acc;
    }, {});
    const totalChargesAff = Object.values(chargesParCat).reduce((a,b)=>a+b,0);

    document.getElementById('content').innerHTML = `
<div class="kpi-grid" style="margin-bottom:28px;">
  ${[
    ['CA HT', fmt(kpis.caHT), '#a5b4fc'],
    ['Total charges', fmt(kpis.totalCharges), '#f87171'],
    ['Résultat net', (kpis.resultatNet>=0?'+':'')+fmt(kpis.resultatNet), resultatColor],
    ['Employés actifs', kpis.nbEmployes, '#34d399'],
    ['Factures encaissées', kpis.nbFactures, '#a5b4fc']
  ].map(([l,v,c])=>`<div class="kpi"><div class="kpi-val" style="color:${c};">${v}</div><div class="kpi-label">${l} — ${d.annee}</div></div>`).join('')}
</div>

<div class="two-col">
  <div class="card">
    <div class="card-header">Compte de résultat ${d.annee}</div>
    <div class="card-body">
      <div class="section-title" style="color:#34d399;">PRODUITS</div>
      <div class="row-item"><span class="lbl">Chiffre d'affaires HT</span><span>${fmt(kpis.caHT)}</span></div>
      <div class="row-total"><span>Total produits</span><span class="val">${fmt(kpis.caHT)}</span></div>
      <div class="section-title" style="color:#f87171;margin-top:20px;">CHARGES</div>
      ${Object.entries(chargesParCat).map(([cat,m])=>`<div class="row-item"><span class="lbl">${catLabels[cat]||esc(cat)}</span><span>${fmt(m)}</span></div>`).join('')}
      <div class="row-total"><span>Total charges</span><span class="val">${fmt(kpis.totalCharges)}</span></div>
      <div style="margin-top:16px;padding:14px;background:rgba(99,102,241,.06);border-radius:10px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:700;">Résultat net</span>
        <span style="font-size:20px;font-weight:800;color:${resultatColor};">${kpis.resultatNet>=0?'+':''}${fmt(kpis.resultatNet)}</span>
      </div>
    </div>
  </div>
  <div class="card">
    <div class="card-header">Répartition des charges</div>
    <div class="card-body">
      ${Object.entries(chargesParCat).map(([cat,m])=>{
        const pct = totalChargesAff ? Math.round(m/totalChargesAff*100) : 0;
        return `<div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
            <span style="color:#94a3b8;">${catLabels[cat]||esc(cat)}</span>
            <span>${pct}% — ${fmt(m)}</span>
          </div>
          <div style="background:rgba(255,255,255,.06);border-radius:4px;height:6px;">
            <div style="background:#6366f1;width:${pct}%;height:6px;border-radius:4px;"></div>
          </div>
        </div>`;
      }).join('') || '<div style="color:#64748b;font-size:13px;">Aucune charge enregistrée</div>'}
    </div>
  </div>
</div>

<div class="card">
  <div class="card-header">Dernières factures</div>
  <div style="overflow-x:auto;">
    <table>
      <thead><tr><th>N°</th><th>Client</th><th>Montant TTC</th><th>Statut</th><th>Date</th></tr></thead>
      <tbody>
        ${(d.recentInvoices||[]).map(i=>`<tr>
          <td style="font-weight:600;">${esc(i.numero)}</td>
          <td>${esc(i.client?.nom||'—')}</td>
          <td style="color:#a5b4fc;font-weight:700;">${fmt(i.montantTTC)}</td>
          <td>${statusBadge(i.statut)}</td>
          <td style="color:#64748b;">${new Date(i.createdAt).toLocaleDateString('fr-FR')}</td>
        </tr>`).join('')||'<tr><td colspan="5" style="text-align:center;padding:24px;color:#475569;">Aucune facture</td></tr>'}
      </tbody>
    </table>
  </div>
</div>

<div class="card">
  <div class="card-header">Dernières dépenses</div>
  <div style="overflow-x:auto;">
    <table>
      <thead><tr><th>Titre</th><th>Catégorie</th><th>Montant</th><th>Statut</th><th>Date</th></tr></thead>
      <tbody>
        ${(d.recentExpenses||[]).map(e=>{
          const [cls,lbl] = e.statut==='approuvee'?['badge-green','Approuvée']:e.statut==='rejetee'?['badge-red','Rejetée']:['badge-orange','En attente'];
          return `<tr>
            <td>${esc(e.titre)}</td>
            <td style="color:#94a3b8;">${catLabels[e.categorie]||esc(e.categorie)}</td>
            <td style="color:#a5b4fc;font-weight:700;">${fmt(e.montant)}</td>
            <td><span class="badge ${cls}">${lbl}</span></td>
            <td style="color:#64748b;">${new Date(e.date).toLocaleDateString('fr-FR')}</td>
          </tr>`;
        }).join('')||'<tr><td colspan="5" style="text-align:center;padding:24px;color:#475569;">Aucune dépense</td></tr>'}
      </tbody>
    </table>
  </div>
</div>
<div style="text-align:center;font-size:12px;color:#475569;margin-top:24px;padding-bottom:40px;">
  Document généré par Novexa by Nexulys — accès en lecture seule — valide jusqu'au ${new Date(d.expiresAt).toLocaleDateString('fr-FR')}
</div>`;

    show('content');
  } catch(e) { show('error-view'); }
}

function show(id) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = id==='content'?'':'none';
  document.getElementById('error-view').style.display = id==='error-view'?'':'none';
}

load();
