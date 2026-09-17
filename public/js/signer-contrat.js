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
const PERIOD = { unique:'Paiement unique', mensuel:'Mensuel', trimestriel:'Trimestriel', annuel:'Annuel' };
const dstr = d => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

async function load() {
  if (!token) { show('error-view'); return; }
  try {
    const res = await fetch(API + '/contrats-clients/view/' + token);
    const data = await res.json();
    if (!data.success) { show('error-view'); return; }
    const c = data.data;
    if (c.signe) { show('signed-view'); return; }

    document.getElementById('content').innerHTML = `
<div class="card">
  <div class="card-header"><span>Contrat ${esc(c.reference || '')}</span><span style="font-size:12px;color:#64748b;">${esc(c.type || '')}</span></div>
  <div class="card-body">
    <div class="info-row"><span class="lbl">Intitulé</span><span style="font-weight:600;">${esc(c.titre||'—')}</span></div>
    <div class="info-row"><span class="lbl">Client</span><span>${esc(c.client?.nom||'—')}${esc(c.client?.entreprise?(' · '+c.client.entreprise):'')}</span></div>
    <div class="info-row"><span class="lbl">Valeur</span><span style="font-weight:600;color:#34d399;">${fmt(c.valeur)} €</span></div>
    <div class="info-row"><span class="lbl">Périodicité</span><span>${esc(PERIOD[c.periodicite]||c.periodicite||'—')}</span></div>
    <div class="info-row"><span class="lbl">Début</span><span>${dstr(c.dateDebut)}</span></div>
    <div class="info-row"><span class="lbl">Fin</span><span>${dstr(c.dateFin)}</span></div>
    ${c.notes ? `<div class="info-row"><span class="lbl">Conditions</span><span style="color:#94a3b8;max-width:60%;text-align:right;">${esc(c.notes)}</span></div>` : ''}
  </div>
</div>

<div class="sign-box">
  <h3 style="font-size:15px;font-weight:700;margin-bottom:16px;">Signature électronique</h3>
  <label class="field-label">Nom et prénom du signataire</label>
  <input class="field-input" id="signataire" placeholder="${esc(c.client?.nom||'Votre nom')}" value="${esc(c.client?.nom||'')}" />
  <label class="checkbox-row">
    <input type="checkbox" id="chk1" onchange="checkSign()"/>
    <span style="font-size:13px;color:#94a3b8;">J'ai lu et j'accepte l'ensemble des conditions décrites dans ce contrat.</span>
  </label>
  <label class="checkbox-row">
    <input type="checkbox" id="chk2" onchange="checkSign()"/>
    <span style="font-size:13px;color:#94a3b8;">Je confirme être habilité(e) à signer ce contrat.</span>
  </label>
  <div id="sign-error" style="color:#f87171;font-size:13px;margin-bottom:12px;display:none;"></div>
  <button class="btn" id="sign-btn" onclick="signer()">✍️ Signer le contrat</button>
  <p style="font-size:11px;color:#475569;text-align:center;margin-top:12px;">Signature électronique horodatée — votre adresse IP sera enregistrée.</p>
</div>`;
    show('content');
  } catch(e) { show('error-view'); }
}

function checkSign(){ document.getElementById('sign-error').style.display='none'; }

async function signer() {
  const nom = (document.getElementById('signataire').value||'').trim();
  const c1 = document.getElementById('chk1')?.checked;
  const c2 = document.getElementById('chk2')?.checked;
  const err = document.getElementById('sign-error');
  if (!nom) { err.textContent='Veuillez saisir le nom du signataire.'; err.style.display=''; return; }
  if (!c1 || !c2) { err.textContent='Veuillez cocher les deux cases pour confirmer votre accord.'; err.style.display=''; return; }
  const btn = document.getElementById('sign-btn');
  btn.disabled = true; btn.textContent = 'Enregistrement...';
  try {
    const res = await fetch(API + '/contrats-clients/signer/' + token, {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ signataire: nom })
    });
    const data = await res.json();
    if (data.success) { show('signed-view'); }
    else { btn.disabled=false; btn.textContent='✍️ Signer le contrat'; err.textContent=data.message||'Erreur'; err.style.display=''; }
  } catch(e) { btn.disabled=false; btn.textContent='✍️ Signer le contrat'; err.textContent='Erreur réseau'; err.style.display=''; }
}

function show(id){ ['loading','content','signed-view','error-view'].forEach(i => document.getElementById(i).style.display = i===id ? '' : 'none'); }
load();
