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

const paid = new URLSearchParams(location.search).get('paid');

function showToast(msg, type) {
  var t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show ' + type;
  setTimeout(() => t.classList.remove('show'), 4000);
}
function fmt(n) { return (n||0).toLocaleString('fr-FR', {minimumFractionDigits:2,maximumFractionDigits:2}) + ' €'; }
// Échappement obligatoire : ces données (numéro de facture, statut) sont saisies
// côté entreprise et rendues ici dans le navigateur d'un tiers.
function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function statusBadge(s) {
  const m = { payee:['badge-green','Payée'], envoyee:['badge-orange','Envoyée'], en_retard:['badge-red','En retard'], brouillon:['badge-gray','Brouillon'], annulee:['badge-gray','Annulée'] };
  const [cls, label] = m[s] || ['badge-gray', esc(s)];
  return `<span class="badge ${cls}">${label}</span>`;
}

async function load() {
  if (!token) { show('error-view'); return; }
  try {
    const res = await fetch('https://nexulys-backend-1.onrender.com/api/portail/acces', { headers: authHeaders() });
    const data = await res.json();
    if (!data.success) { show('error-view'); return; }
    const d = data.data;

    document.getElementById('company-name').textContent = d.company?.nom || '';
    document.getElementById('client-nom').textContent = d.clientNom;
    document.title = `Portail — ${d.clientNom}`;

    const exp = new Date(d.expiresAt);
    const jours = Math.floor((exp - new Date()) / 86400000);
    if (jours <= 7) {
      const n = document.getElementById('exp-notice');
      n.style.display = '';
      n.textContent = jours <= 0 ? 'Ce lien a expiré.' : `Ce lien expire dans ${jours} jour${jours > 1 ? 's' : ''}. Demandez un renouvellement.`;
    }

    const invoices = d.invoices || [];
    const total = invoices.reduce((s,i) => s + i.montantTTC, 0);
    const payees = invoices.filter(i => i.statut === 'payee');
    const impayees = invoices.filter(i => i.statut !== 'payee' && i.statut !== 'annulee');
    const montantDu = impayees.reduce((s,i) => s + i.montantTTC, 0);

    document.getElementById('summary-grid').innerHTML = [
      ['Total facturé', fmt(total)],
      ['Déjà réglé', fmt(payees.reduce((s,i)=>s+i.montantTTC,0))],
      ['En attente de paiement', fmt(montantDu)],
      ['Nombre de factures', invoices.length]
    ].map(([l,v]) => `<div class="kpi"><div class="kpi-val">${v}</div><div class="kpi-label">${l}</div></div>`).join('');

    const tbody = document.getElementById('invoices-body');
    if (!invoices.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:48px;color:#475569;">Aucune facture</td></tr>';
    } else {
      tbody.innerHTML = invoices.map(inv => {
        const canPay = inv.statut !== 'payee' && inv.statut !== 'annulee';
        return `<tr>
          <td style="font-weight:600;">${esc(inv.numero)}</td>
          <td style="font-weight:700;color:#a5b4fc;">${fmt(inv.montantTTC)}</td>
          <td>${statusBadge(inv.statut)}</td>
          <td style="color:#94a3b8;">${inv.dateEcheance ? new Date(inv.dateEcheance).toLocaleDateString('fr-FR') : '—'}</td>
          <td>${canPay ? `<button class="btn-pay" onclick="payer('${esc(inv._id)}',this)">💳 Payer en ligne</button>` : '<span style="color:#34d399;font-size:13px;">✓ Réglée</span>'}</td>
        </tr>`;
      }).join('');
    }

    show('content');
    if (paid) showToast('Paiement reçu — merci !', 'success');
  } catch(e) { show('error-view'); }
}

async function payer(invoiceId, btn) {
  btn.disabled = true; btn.textContent = 'Redirection...';
  try {
    const res = await fetch(`https://nexulys-backend-1.onrender.com/api/portail/acces/payer/${invoiceId}`, { method:'POST', headers: authHeaders() });
    const data = await res.json();
    if (data.success && data.data?.url) { window.location.href = data.data.url; }
    else { showToast(data.message || 'Erreur de paiement', 'error'); btn.disabled = false; btn.textContent = '💳 Payer en ligne'; }
  } catch(e) { showToast('Erreur réseau', 'error'); btn.disabled = false; btn.textContent = '💳 Payer en ligne'; }
}

function show(id) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = id === 'content' ? '' : 'none';
  document.getElementById('error-view').style.display = id === 'error-view' ? '' : 'none';
}

load();
