// Échappement HTML : ces pages sont ouvertes par un tiers (client final) et
  // affichent des données saisies côté entreprise.
  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

const token = new URLSearchParams(location.search).get('token');
const API = 'https://nexulys-backend-1.onrender.com/api';
const fmt = n => (n||0).toLocaleString('fr-FR', {minimumFractionDigits:2,maximumFractionDigits:2});
const DEVISES = { EUR: '€', USD: '$', GBP: '£', CHF: 'CHF' };

async function load() {
  if (!token) { show('error-view'); return; }
  try {
    const res = await fetch(API + '/devis/view/' + token);
    const data = await res.json();
    if (!data.success) { show('error-view'); return; }
    const d = data.data;
    const symbole = DEVISES[d.devise] || '€';
    const exp = new Date(d.dateValidite);
    const dejaSign = !!d.signedAt;

    if (dejaSign) { show('signed-view'); return; }

    document.getElementById('content').innerHTML = `
<div class="card">
  <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
    <span>Devis ${esc(d.numero)}</span>
    <span class="${exp < new Date() ? 'badge-exp' : 'badge-green'}">${exp < new Date() ? 'Expiré' : 'Valide jusqu\'au ' + exp.toLocaleDateString('fr-FR')}</span>
  </div>
  <div class="card-body">
    <div class="info-row"><span class="lbl">Client</span><span style="font-weight:600;">${esc(d.client?.nom||'—')}</span></div>
    <div class="info-row"><span class="lbl">Référence</span><span>${esc(d.numero)}</span></div>
    <div class="info-row"><span class="lbl">Date</span><span>${new Date(d.createdAt).toLocaleDateString('fr-FR')}</span></div>
    ${d.notes ? `<div class="info-row"><span class="lbl">Notes</span><span style="color:#94a3b8;">${esc(d.notes)}</span></div>` : ''}
  </div>
</div>

<div class="card">
  <div class="card-header">Détail des prestations</div>
  <div style="overflow-x:auto;">
    <table>
      <thead><tr><th>Description</th><th>Qté</th><th>PU HT</th><th>TVA</th><th>Total HT</th></tr></thead>
      <tbody>
        ${(d.lignes||[]).map(l => `<tr>
          <td>${esc(l.description)}</td>
          <td>${esc(l.quantite)}</td>
          <td>${fmt(l.prixUnitaire)} ${esc(symbole)}</td>
          <td>${esc(l.tva||20)} %</td>
          <td style="font-weight:600;">${fmt(l.montantHT)} ${esc(symbole)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
</div>

<div class="kpi-grid">
  <div class="kpi"><div class="kpi-val">${fmt(d.montantHT)} ${esc(symbole)}</div><div class="kpi-label">Total HT</div></div>
  <div class="kpi"><div class="kpi-val">${fmt(d.montantTVA)} ${esc(symbole)}</div><div class="kpi-label">TVA</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#34d399;">${fmt(d.montantTTC)} ${esc(symbole)}</div><div class="kpi-label">Total TTC</div></div>
</div>

${exp >= new Date() ? `
<div class="sign-box">
  <h3 style="font-size:15px;font-weight:700;margin-bottom:16px;">Signature électronique</h3>
  <label class="checkbox-row">
    <input type="checkbox" id="chk1" onchange="checkSign()"/>
    <span style="font-size:13px;color:#94a3b8;">J'ai lu et j'accepte l'ensemble des prestations et conditions décrites dans ce devis.</span>
  </label>
  <label class="checkbox-row">
    <input type="checkbox" id="chk2" onchange="checkSign()"/>
    <span style="font-size:13px;color:#94a3b8;">Je confirme être habilité(e) à signer ce devis au nom de ${esc(d.client?.nom||'mon organisation')}.</span>
  </label>
  <div id="sign-error" style="color:#f87171;font-size:13px;margin-bottom:12px;display:none;">Veuillez cocher les deux cases pour confirmer votre accord.</div>
  <button class="btn" id="sign-btn" onclick="signer()">✍️ Signer ce devis</button>
  <p style="font-size:11px;color:#475569;text-align:center;margin-top:12px;">Signature électronique conforme au règlement eIDAS — votre adresse IP sera enregistrée.</p>
</div>` : `<div style="text-align:center;padding:24px;background:rgba(248,113,113,.06);border:1px solid rgba(248,113,113,.2);border-radius:12px;color:#f87171;font-size:13px;">Ce devis a expiré le ${exp.toLocaleDateString('fr-FR')}. Contactez votre prestataire pour un renouvellement.</div>`}
`;
    show('content');
  } catch(e) { show('error-view'); }
}

function checkSign() {
  document.getElementById('sign-error').style.display = 'none';
}

async function signer() {
  const c1 = document.getElementById('chk1')?.checked;
  const c2 = document.getElementById('chk2')?.checked;
  if (!c1 || !c2) { document.getElementById('sign-error').style.display = ''; return; }
  const btn = document.getElementById('sign-btn');
  btn.disabled = true; btn.textContent = 'Enregistrement...';
  try {
    const res = await fetch(API + '/devis/signer/' + token, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const data = await res.json();
    if (data.success) { show('signed-view'); }
    else { btn.disabled = false; btn.textContent = '✍️ Signer ce devis'; alert(data.message); }
  } catch(e) { btn.disabled = false; btn.textContent = '✍️ Signer ce devis'; alert('Erreur réseau'); }
}

function show(id) {
  ['loading','content','signed-view','error-view'].forEach(i => document.getElementById(i).style.display = i === id ? '' : 'none');
}

load();
