// Échappement HTML de toute donnée injectée via innerHTML (noms de clients,
  // SIRET, emails… saisis par les utilisateurs et rendus dans le back-office).
  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const API = 'https://nexulys-backend-1.onrender.com/api/admin';
  let adminToken = sessionStorage.getItem('novexa_admin_token');
  let mrrChart = null, donutChart = null;

  // ── Auto-login if token exists ──
  if (adminToken) showApp();

  // ── Login ──
  document.getElementById('admin-password').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('admin-code').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doLogin();
  });

  // Le champ du second facteur n'apparaît que si le serveur l'exige.
  fetch(API + '/login-config')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d && d.data && d.data.mfaRequis) {
        document.getElementById('mfa-field').style.display = 'block';
      }
    })
    .catch(function() {});

  async function doLogin() {
    var pwd = document.getElementById('admin-password').value;
    var code = document.getElementById('admin-code').value;
    var btn = document.getElementById('login-btn');
    var errEl = document.getElementById('login-error');
    errEl.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span>Vérification...';
    try {
      var res = await fetch(API + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd, code: code })
      });
      var data = await res.json();
      if (data.success) {
        adminToken = data.token;
        sessionStorage.setItem('novexa_admin_token', adminToken);
        showApp();
      } else {
        errEl.textContent = data.message || 'Mot de passe incorrect.';
        errEl.style.display = 'block';
      }
    } catch (e) {
      errEl.textContent = 'Erreur réseau.';
      errEl.style.display = 'block';
    }
    btn.disabled = false;
    btn.textContent = 'Accéder au panel';
  }

  function doLogout() {
    sessionStorage.removeItem('novexa_admin_token');
    adminToken = null;
    window.location.href = '/login.html';
  }

  function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-app').style.display = 'block';
    loadAll();
  }

  // ── API helper ──
  async function adminFetch(path) {
    try {
      var res = await fetch(API + path, { headers: { 'Authorization': 'Bearer ' + adminToken } });
      if (res.status === 401) { doLogout(); return null; }
      return res.json();
    } catch { toast('Erreur réseau'); return null; }
  }

  // ── Load all data ──
  async function loadAll() {
    document.getElementById('last-refresh').textContent = 'Actualisation...';
    await Promise.all([loadOverview(), loadClients(), loadPayments(), loadMRRChart()]);
    var now = new Date();
    document.getElementById('last-refresh').textContent = 'Mis à jour à ' + now.toLocaleTimeString('fr');
  }

  // ── Overview ──
  async function loadOverview() {
    var res = await adminFetch('/overview');
    if (!res || !res.success) return;
    var d = res.data;
    var fmt = function(n) { return (n || 0).toLocaleString('fr') + ' €'; };

    document.getElementById('kpi-mrr').textContent = fmt(d.mrr);
    document.getElementById('kpi-mrr-sub').textContent = d.subscriptions.active + ' abonné(s) × 2 500 €';
    document.getElementById('kpi-arr').textContent = fmt(d.arr);
    document.getElementById('kpi-active').textContent = d.subscriptions.active;
    document.getElementById('kpi-active-sub').textContent = 'sur ' + d.subscriptions.total + ' total';
    document.getElementById('kpi-trial').textContent = d.subscriptions.trial;
    document.getElementById('kpi-suspended').textContent = d.subscriptions.suspended + d.subscriptions.cancelled;
    document.getElementById('kpi-cancelled-sub').textContent = d.subscriptions.cancelled + ' annulés, ' + d.subscriptions.suspended + ' suspendus';
    document.getElementById('kpi-total-pay').textContent = fmt(d.totalPaye);
    document.getElementById('kpi-users').textContent = d.totalUsers;
    document.getElementById('kpi-failed').textContent = d.paymentsEchoues;
  }

  // ── Clients ──
  async function loadClients() {
    var res = await adminFetch('/clients');
    if (!res || !res.success) return;
    var clients = res.data || [];
    document.getElementById('clients-count').textContent = clients.length;

    var statusMap = {
      actif:'b-green', active:'b-green', essai:'b-yellow', trial:'b-yellow',
      suspendu:'b-orange', annule:'b-red', cancelled:'b-red', inactif:'b-gray'
    };
    var statusLabels = {
      actif:'Actif', active:'Actif', essai:'Essai', trial:'Essai',
      suspendu:'Suspendu', annule:'Annulé', cancelled:'Annulé', inactif:'Inactif'
    };

    var tbody = document.getElementById('clients-tbody');
    if (!clients.length) { tbody.innerHTML = '<tr><td colspan="10" class="empty">Aucun client</td></tr>'; return; }

    tbody.innerHTML = clients.map(function(c) {
      var sub = c.subscription || {};
      var statut = sub.statut || 'inconnu';
      var badgeCls = statusMap[statut] || 'b-gray';
      var badgeLbl = statusLabels[statut] || statut;
      var mrr = sub.mrr > 0 ? '<span style="color:#4ade80;font-weight:700;">' + sub.mrr.toLocaleString('fr') + ' €</span>' : '<span style="color:var(--dim);">—</span>';
      var trialDate = sub.trialEndsAt ? new Date(sub.trialEndsAt).toLocaleDateString('fr') : '—';
      var createdAt = c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr') : '—';
      return '<tr>'
        + '<td style="font-weight:700;">' + esc(escH(c.nom))+ '</td>'
        + '<td>' + esc(escH(c.adminNom))+ '</td>'
        + '<td style="color:var(--muted);font-size:12px;">' + esc(escH(c.adminEmail))+ '</td>'
        + '<td style="color:var(--dim);">' + esc(escH(c.secteur))+ '</td>'
        + '<td><span class="badge ' + esc(badgeCls)+ '">' + esc(badgeLbl)+ '</span></td>'
        + '<td>' + mrr + '</td>'
        + '<td style="text-align:center;">' + esc((c.employes || 0))+ '</td>'
        + '<td style="text-align:center;">' + esc((c.factures || 0))+ '</td>'
        + '<td style="color:var(--dim);font-size:12px;">' + esc(trialDate)+ '</td>'
        + '<td style="color:var(--dim);font-size:12px;">' + esc(createdAt)+ '</td>'
        + '</tr>';
    }).join('');

    // Update donut chart
    renderDonut(clients);
  }

  // ── Payments ──
  async function loadPayments() {
    var res = await adminFetch('/payments');
    if (!res || !res.success) return;
    var payments = res.data || [];
    document.getElementById('payments-count').textContent = payments.length;

    var tbody = document.getElementById('payments-tbody');
    if (!payments.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">Aucun paiement enregistré</td></tr>'; return; }

    tbody.innerHTML = payments.map(function(p) {
      var isSuccess = ['payé','succeeded','success','paye'].includes(p.statut);
      var isFailed = ['échoué','failed','echec'].includes(p.statut);
      var badgeCls = isSuccess ? 'b-green' : isFailed ? 'b-red' : 'b-gray';
      var badgeLbl = isSuccess ? '✓ Réussi' : isFailed ? '✗ Échoué' : p.statut;
      var date = p.date ? new Date(p.date).toLocaleString('fr') : '—';
      var stripe = p.stripeCustomerId ? '<span style="font-family:monospace;font-size:11px;color:var(--dim);">' + esc(p.stripeCustomerId)+ '</span>' : '<span style="color:var(--dim);">—</span>';
      return '<tr>'
        + '<td style="color:var(--muted);font-size:12px;">' + esc(date)+ '</td>'
        + '<td style="font-weight:600;">' + esc(escH(p.companyNom))+ '</td>'
        + '<td style="font-weight:700;color:' + esc((isSuccess ? '#4ade80' : isFailed ? '#f87171' : 'var(--text)'))+ ';">' + (p.montant || 0).toLocaleString('fr') + ' €</td>'
        + '<td><span class="badge ' + esc(badgeCls)+ '">' + esc(badgeLbl)+ '</span></td>'
        + '<td>' + stripe + '</td>'
        + '</tr>';
    }).join('');
  }

  // ── MRR Chart ──
  async function loadMRRChart() {
    var res = await adminFetch('/mrr-chart');
    if (!res || !res.success) return;
    var months = res.data || [];

    var ctx = document.getElementById('mrr-chart');
    if (!ctx) return;
    if (mrrChart) mrrChart.destroy();
    mrrChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months.map(function(m) { return m.label; }),
        datasets: [
          {
            label: 'Paiements (€)',
            data: months.map(function(m) { return m.paiements; }),
            backgroundColor: 'rgba(74,222,128,0.25)',
            borderColor: '#4ade80',
            borderWidth: 2, borderRadius: 6, borderSkipped: false,
            yAxisID: 'y'
          },
          {
            label: 'Nouveaux clients',
            data: months.map(function(m) { return m.nouveauxClients; }),
            type: 'line',
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99,102,241,0.1)',
            borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#6366f1',
            tension: 0.3, fill: true,
            yAxisID: 'y2'
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#64748b', font: { size: 11 }, usePointStyle: true } },
          tooltip: { callbacks: {
            label: function(c) {
              return c.datasetIndex === 0 ? c.raw.toLocaleString('fr') + ' €' : c.raw + ' client(s)';
            }
          }}
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { size: 11 } } },
          y: { position: 'left', grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { size: 11 }, callback: function(v) { return v.toLocaleString('fr') + ' €'; } }, beginAtZero: true },
          y2: { position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#64748b', font: { size: 11 }, stepSize: 1 }, beginAtZero: true }
        }
      }
    });
  }

  // ── Donut Chart (subscription status) ──
  function renderDonut(clients) {
    var counts = { actif: 0, essai: 0, suspendu: 0, annule: 0 };
    clients.forEach(function(c) {
      var s = c.subscription ? c.subscription.statut : 'inconnu';
      if (['actif','active'].includes(s)) counts.actif++;
      else if (['essai','trial'].includes(s)) counts.essai++;
      else if (s === 'suspendu') counts.suspendu++;
      else counts.annule++;
    });

    var ctx = document.getElementById('donut-chart');
    if (!ctx) return;
    if (donutChart) donutChart.destroy();
    donutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Actifs','Essai','Suspendus','Annulés'],
        datasets: [{ data: [counts.actif, counts.essai, counts.suspendu, counts.annule], backgroundColor: ['rgba(74,222,128,0.8)','rgba(251,191,36,0.8)','rgba(251,146,60,0.8)','rgba(248,113,113,0.8)'], borderColor: 'transparent', borderWidth: 0, hoverOffset: 4 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '68%' }
    });

    document.getElementById('donut-legend').innerHTML = [
      { label: 'Actifs', val: counts.actif, color: '#4ade80' },
      { label: 'Essai', val: counts.essai, color: '#fbbf24' },
      { label: 'Suspendus', val: counts.suspendu, color: '#fb923c' },
      { label: 'Annulés', val: counts.annule, color: '#f87171' }
    ].map(function(i) {
      return '<div class="legend-item"><div class="legend-dot" style="background:' + esc(i.color)+ '"></div><span class="legend-label">' + esc(i.label)+ '</span><span class="legend-val" style="color:' + esc(i.color)+ '">' + esc(i.val)+ '</span></div>';
    }).join('');
  }

  // ── Table search filter ──
  function filterTable(tbodyId, query) {
    var q = query.toLowerCase().trim();
    var rows = document.getElementById(tbodyId).querySelectorAll('tr');
    rows.forEach(function(r) {
      r.style.display = !q || r.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  }

  // ── Helpers ──
  function escH(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(function() { el.classList.remove('show'); }, 3500);
  }

  // ── Auto-refresh every 5 minutes ──
  setInterval(loadAll, 5 * 60 * 1000);
