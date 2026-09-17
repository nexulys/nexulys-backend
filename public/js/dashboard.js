// ── Auth guard ──
    // Frontend et backend sont sur des domaines différents (workers.dev / onrender.com),
    // les cookies tiers sont bloqués par les navigateurs → on authentifie via le token
    // dans l'en-tête Authorization (le backend accepte cookie OU Bearer).
    if (!localStorage.getItem('novexa_token')) window.location.href = '/login.html';
    const user = JSON.parse(localStorage.getItem('novexa_user') || '{}');

    const API = 'https://nexulys-backend-1.onrender.com/api';

    // ── Échappement HTML ──
    // Ces pages construisent leur contenu par concaténation puis innerHTML. Toute
    // donnée venant de l'API (noms de clients, intitulés, numéros de facture…) est
    // saisie par un utilisateur et doit passer par esc() avant d'être injectée.
    function esc(v) {
      return String(v === null || v === undefined ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // Pour une valeur interpolée dans un attribut de gestionnaire d'évènement
    // (onclick="fn('…')") : le navigateur décode les entités HTML AVANT d'évaluer le
    // JS, donc esc() seul n'y protège pas. On échappe d'abord pour JS, puis pour HTML.
    function escAttr(v) {
      const js = String(v === null || v === undefined ? '' : v)
        .replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"')
        .replace(/\n/g, '\\n').replace(/\r/g, '\\r');
      return js.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ── API helper ──
    const apiHeaders = () => ({
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + (localStorage.getItem('novexa_token') || '')
    });

    async function apiFetch(path) {
      try {
        const res = await fetch(API + path, { headers: apiHeaders(), credentials: 'include' });
        if (res.status === 401) {
          localStorage.clear();
          window.location.href = '/login.html';
          return null;
        }
        return res.json();
      } catch (err) {
        showToast('Erreur réseau : ' + path);
        return null;
      }
    }

    // ── Toast notifications ──
    function showToast(msg, type) {
      var container = document.getElementById('toast-container');
      var toast = document.createElement('div');
      toast.className = 'toast' + (type === 'success' ? ' success' : '');
      toast.textContent = msg;
      container.appendChild(toast);
      setTimeout(function() {
        toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s';
        setTimeout(function() { toast.remove(); }, 350);
      }, 4000);
    }

    // ── Logout ──
    async function logout() {
      try { await fetch(API + '/auth/logout', { method: 'POST', credentials: 'include' }); } catch (_) {}
      localStorage.clear();
      window.location.href = '/login.html';
    }

    // ── Sidebar toggle ──
    function toggleSidebar() {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('overlay');
      sidebar.classList.toggle('open');
      overlay.classList.toggle('open');
    }

    // ── Section switching ──
    const SECTION_TITLES = {
      dashboard: 'Dashboard', comptabilite: 'Comptabilité', rh: 'Ressources Humaines',
      stocks: 'Stocks', taches: 'Tâches', ia: 'IA Assistant', parametres: 'Paramètres',
      agenda: 'Agenda', crm: 'CRM', projets: 'Projets', support: 'Support & Tickets',
      contratsClients: 'Contrats clients'
    };
    const SECTION_LOADERS = {
      comptabilite: function() { loadAllInvoices(); loadDepenses(); },
      rh: loadRHSection,
      stocks: function() { loadStocksSection(); loadFournisseurs(); loadBonsCommande(); },
      taches: loadKanban,
      ia: loadIASection,
      parametres: loadParametres,
      crm: loadCRM,
      projets: loadProjets,
      agenda: loadAgenda,
      support: loadTickets,
      contratsClients: loadContratsClients
    };

    function switchSection(name) {
      document.querySelectorAll('.section').forEach(function(s) { s.classList.remove('active'); });
      document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
      var el = document.getElementById('section-' + name);
      if (el) el.classList.add('active');
      document.querySelectorAll('.nav-item').forEach(function(btn) {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes("'" + name + "'")) btn.classList.add('active');
      });
      document.querySelector('.page-title').textContent = SECTION_TITLES[name] || name;
      if (window.innerWidth <= 768) { document.getElementById('sidebar').classList.remove('open'); document.getElementById('overlay').classList.remove('open'); }
      if (SECTION_LOADERS[name]) SECTION_LOADERS[name]();
    }

    // ── Copilote IA proactif ──
    async function loadCopilote() {
      var card = document.getElementById('copilote-card');
      var content = document.getElementById('copilote-content');
      if (!card || !content) return;
      card.style.display = '';
      content.textContent = 'Analyse en cours...';
      var res = await apiFetch('/ai/copilote');
      if (res && res.data && res.data.analyse) {
        content.textContent = res.data.analyse;
      } else {
        card.style.display = 'none';
      }
    }

    // ── Score de santé entreprise ──
    async function loadHealthScore() {
      var res = await apiFetch('/dashboard/sante');
      if (!res || !res.data) return;
      var d = res.data;
      var card = document.getElementById('health-card');
      if (!card) return;
      card.style.display = '';
      var color = d.score >= 80 ? '#4ade80' : d.score >= 60 ? '#60a5fa' : d.score >= 40 ? '#fbbf24' : '#f87171';
      var scoreEl = document.getElementById('health-score');
      scoreEl.textContent = d.score;
      scoreEl.style.color = color;
      var nivEl = document.getElementById('health-niveau');
      nivEl.textContent = d.niveau;
      nivEl.style.color = color;
      document.getElementById('health-details').innerHTML = (d.details || []).map(function(x) {
        var ok = (x.impact || 0) === 0;
        var c = ok ? '#4ade80' : '#f87171';
        return '<span style="font-size:11px;padding:4px 10px;border-radius:100px;background:' + (ok ? 'rgba(74,222,128,.1)' : 'rgba(248,113,113,.1)') + ';color:' + esc(c)+ ';border:1px solid ' + (ok ? 'rgba(74,222,128,.25)' : 'rgba(248,113,113,.25)') + ';">'
          + (ok ? '✓ ' : '⚠ ') + esc(x.critere)+ ' : ' + esc(x.statut)+ '</span>';
      }).join('');
    }

    // ── KPI Cards ──
    async function loadKPIs() {
      try {
        var res = await apiFetch('/dashboard/executive');
        if (res && res.success && res.data) {
          var d = res.data;
          var caMois = (d.ca && d.ca.mois) ? d.ca.mois : 0;
          document.getElementById('kpi-ca').textContent = caMois.toLocaleString('fr') + ' €';
          document.getElementById('kpi-ca-sub').textContent = 'CA ce mois';
          if (d.ca && d.ca.variation !== null && d.ca.variation !== undefined) {
            var varEl = document.getElementById('kpi-ca-trend');
            if (varEl) { varEl.textContent = (d.ca.variation > 0 ? '+' : '') + d.ca.variation + '%'; varEl.className = 'kpi-trend ' + (d.ca.variation >= 0 ? 'up' : 'down'); }
          }
          var impayees = (d.factures && d.factures.impayees) ? d.factures.impayees : { count: 0, montant: 0 };
          document.getElementById('kpi-factures').textContent = impayees.count;
          document.getElementById('kpi-factures-sub').textContent = impayees.count === 0 ? 'Aucune en attente' : impayees.montant.toLocaleString('fr') + ' € en attente';
          var nbEmp = (d.rh && d.rh.nbEmployes) ? d.rh.nbEmployes : 0;
          document.getElementById('kpi-employes').textContent = nbEmp;
          document.getElementById('kpi-employes-sub').textContent = nbEmp + ' employé(s) actif(s)';
          var alertes = (d.stock && d.stock.alertes) ? d.stock.alertes : 0;
          document.getElementById('kpi-stock').textContent = alertes;
          document.getElementById('kpi-stock-sub').textContent = alertes === 0 ? 'Tous les stocks OK' : alertes + ' produit(s) en alerte';
          // Nouveaux KPIs
          var conges = (d.rh && d.rh.congesEnAttente) ? d.rh.congesEnAttente : 0;
          var kpiConges = document.getElementById('kpi-conges');
          if (kpiConges) { kpiConges.textContent = conges; document.getElementById('kpi-conges-sub').textContent = conges === 0 ? 'Aucun congé en attente' : conges + ' demande(s) à approuver'; }
          var tickets = (d.support && d.support.urgents) ? d.support.urgents : 0;
          var kpiTickets = document.getElementById('kpi-tickets');
          if (kpiTickets) { kpiTickets.textContent = tickets; document.getElementById('kpi-tickets-sub').textContent = tickets === 0 ? 'Aucun ticket urgent' : tickets + ' ticket(s) urgent(s)'; }
          return;
        }
      } catch(e) {}
      // Fallback : ancienne méthode
      try {
        var [invoicesRes, employeesRes, stockAlertsRes, paidRes] = await Promise.all([
          apiFetch('/comptabilite/factures?statut=envoyee'),
          apiFetch('/rh/employes'),
          apiFetch('/stocks/alertes'),
          apiFetch('/comptabilite/factures?statut=payee')
        ]);
        var ca = (paidRes && paidRes.data ? paidRes.data : []).reduce(function(s,i){return s+(i.montantTTC||0);},0);
        document.getElementById('kpi-ca').textContent = ca.toLocaleString('fr') + ' €';
        document.getElementById('kpi-ca-sub').textContent = 'Factures payées';
        var fc = (invoicesRes && invoicesRes.data) ? invoicesRes.data.length : 0;
        document.getElementById('kpi-factures').textContent = fc;
        document.getElementById('kpi-factures-sub').textContent = fc === 0 ? 'Aucune en attente' : fc + ' en attente de paiement';
        var ec = (employeesRes && employeesRes.count != null) ? employeesRes.count : (employeesRes && employeesRes.data ? employeesRes.data.length : 0);
        document.getElementById('kpi-employes').textContent = ec;
        document.getElementById('kpi-employes-sub').textContent = ec + ' employés enregistrés';
        var ac = (stockAlertsRes && stockAlertsRes.count != null) ? stockAlertsRes.count : (stockAlertsRes && stockAlertsRes.data ? stockAlertsRes.data.length : 0);
        document.getElementById('kpi-stock').textContent = ac;
        document.getElementById('kpi-stock-sub').textContent = ac === 0 ? 'Tous les stocks OK' : ac + ' produit(s) en alerte';
      } catch(e2) {}
    }

    // ── Recent Invoices ──
    async function loadInvoices() {
      const res = await apiFetch('/comptabilite/factures?limit=6');
      const invoices = (res && res.data) ? res.data : [];
      const container = document.getElementById('invoices-container');

      if (invoices.length === 0) {
        container.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:20px 0">Aucune facture</p>';
        return;
      }

      const statusLabel = {
        payee: 'Payée', envoyee: 'Envoyée', brouillon: 'Brouillon',
        en_retard: 'En retard', annulee: 'Annulée'
      };

      container.innerHTML = '<table class="invoices-table"><thead><tr>'
        + '<th>N°</th><th>Client</th><th>Montant TTC</th><th>Statut</th><th>Date</th>'
        + '</tr></thead><tbody>'
        + invoices.map(function(inv) {
          var st = inv.statut || 'brouillon';
          var label = statusLabel[st] || st;
          var clientName = (inv.client && inv.client.nom) ? inv.client.nom : (inv.clientNom || '—');
          var amount = inv.montantTTC != null ? inv.montantTTC.toLocaleString('fr') + ' €' : '—';
          var date = inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('fr') : '—';
          return '<tr>'
            + '<td style="font-weight:600;color:#a5b4fc">' + esc((inv.numero || inv._id || '—'))+ '</td>'
            + '<td>' + esc(clientName)+ '</td>'
            + '<td style="font-weight:600">' + esc(amount)+ '</td>'
            + '<td><span class="invoice-status ' + esc(st)+ '">' + esc(label)+ '</span></td>'
            + '<td style="color:var(--text-dim)">' + esc(date)+ '</td>'
            + '</tr>';
        }).join('')
        + '</tbody></table>';
    }

    // ── Recent Tasks ──
    async function loadTasks() {
      const res = await apiFetch('/taches?limit=5');
      const tasks = (res && res.data) ? res.data : [];
      const container = document.getElementById('tasks-list');

      if (tasks.length === 0) {
        container.innerHTML = '<p style="color:var(--text-dim);text-align:center">Aucune tâche</p>';
        return;
      }

      container.innerHTML = tasks.map(function(t) {
        var badgeClass = t.statut || 'todo';
        var badgeLabel = {
          todo: 'À faire', en_cours: 'En cours', termine: 'Terminé', en_retard: 'En retard'
        }[t.statut] || t.statut;
        var deadline = t.deadline ? new Date(t.deadline).toLocaleDateString('fr') : 'Pas de deadline';
        return '<div class="task-item">'
          + '<div style="flex:1"><div class="task-name">' + esc((t.titre || 'Sans titre'))+ '</div>'
          + '<div class="task-date">' + esc(deadline)+ '</div></div>'
          + '<span class="task-badge ' + esc(badgeClass)+ '">' + esc(badgeLabel)+ '</span>'
          + '</div>';
      }).join('');
    }

    // ── AI Insights ──
    async function loadInsights() {
      const container = document.getElementById('ai-insights');
      try {
        const res = await apiFetch('/ai/dashboard-insights');
        if (res && res.data && res.data.insights) {
          container.innerHTML = '<div style="white-space:pre-wrap;color:#c4b5fd;font-size:14px;line-height:1.6">' + esc(res.data.insights)+ '</div>';
        } else {
          container.innerHTML = '<p style="color:#666;font-size:13px">Insights IA non disponibles pour le moment.</p>';
        }
      } catch (err) {
        container.innerHTML = '<p style="color:#666;font-size:13px">Insights IA non disponibles.</p>';
      }
    }

    // ── Stock Alerts ──
    async function loadStockAlerts() {
      const res = await apiFetch('/stocks/alertes');
      const alertes = (res && res.data) ? res.data : [];
      const container = document.getElementById('stock-alerts');
      if (!container) return;

      if (alertes.length === 0) {
        container.innerHTML = '<p style="color:#10b981;font-size:13px">✓ Tous les stocks sont à niveau</p>';
        return;
      }

      container.innerHTML = alertes.slice(0, 5).map(function(a) {
        var urgenceColor = a.urgence === 'critique' ? '#ef4444' : '#f59e0b';
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04)">'
          + '<div><span style="font-size:13px">' + esc((a.nom || a.name || '—'))+ '</span>'
          + (a.sku ? ' <small style="color:#666">(' + esc(a.sku) + ')</small>' : '') + '</div>'
          + '<span style="color:' + esc(urgenceColor)+ ';font-size:13px;font-weight:600">'
          + esc((a.quantite != null ? a.quantite : '—'))+ esc((a.unite ? ' ' + a.unite : ''))+ '</span>'
          + '</div>';
      }).join('');
    }

    // ── Recent Activity ──
    async function loadActivity() {
      const [invoicesRes, movesRes] = await Promise.all([
        apiFetch('/comptabilite/factures?limit=3'),
        apiFetch('/stocks/mouvements?limit=3')
      ]);

      var items = [];

      if (invoicesRes && invoicesRes.data) {
        invoicesRes.data.forEach(function(inv) {
          var clientName = (inv.client && inv.client.nom) ? inv.client.nom : (inv.clientNom || '');
          items.push({
            label: 'Facture ' + (inv.numero || '') + (clientName ? ' — ' + clientName : ''),
            date: inv.createdAt,
            color: '#6366f1'
          });
        });
      }

      if (movesRes && movesRes.data) {
        movesRes.data.forEach(function(m) {
          var productName = (m.product && m.product.nom) ? m.product.nom : (m.produitNom || '');
          var typeLabel = m.type === 'entree' ? '📦 Entrée stock' : '📤 Sortie stock';
          items.push({
            label: typeLabel + (productName ? ' — ' + productName : ''),
            date: m.createdAt,
            color: '#10b981'
          });
        });
      }

      items.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
      items = items.slice(0, 8);

      var container = document.getElementById('activity-list');
      if (!container) return;

      if (items.length === 0) {
        container.innerHTML = '<p style="color:var(--text-dim)">Aucune activité récente</p>';
        return;
      }

      container.innerHTML = items.map(function(item) {
        var timeStr = item.date ? new Date(item.date).toLocaleString('fr') : '';
        return '<div class="activity-item">'
          + '<div class="activity-dot" style="background:' + esc(item.color)+ '"></div>'
          + '<div class="activity-line">'
          + '<div class="activity-text">' + esc(item.label)+ '</div>'
          + (timeStr ? '<div class="activity-time">' + esc(timeStr) + '</div>' : '')
          + '</div></div>';
      }).join('');
    }

    // ── Modal helpers ──
    function openModal(type) {
      document.getElementById('modal-' + type).classList.add('open');
      if (type === 'stock') loadProductsForModal();
      if (type === 'conge') { loadEmployesForSelect('c-employe'); }
      if (type === 'paie') {
        loadEmployesForSelect('p-employe');
        document.getElementById('p-annee').value = new Date().getFullYear();
        document.getElementById('p-mois').value = new Date().getMonth() + 1;
      }
      if (type === 'recurrence') {
        var tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
        document.getElementById('rec-date').value = tomorrow.toISOString().split('T')[0];
      }
      if (type === 'avance-salaire') {
        loadEmployesForSelect('avs-employe', true);
        document.getElementById('avs-date').value = new Date().toISOString().split('T')[0];
      }
      if (type === 'agenda') {
        var now = new Date();
        now.setMinutes(0, 0, 0);
        document.getElementById('ag-debut').value = now.toISOString().slice(0, 16);
      }
    }
    function closeModal(id) {
      document.getElementById(id).classList.remove('open');
    }
    function closeModalOnOverlay(e, id) {
      if (e.target === e.currentTarget) closeModal(id);
    }
    function modalError(prefix, msg) {
      var el = document.getElementById(prefix + '-error');
      el.textContent = msg;
      el.classList.add('visible');
    }
    function clearModalError(prefix) {
      var el = document.getElementById(prefix + '-error');
      el.textContent = '';
      el.classList.remove('visible');
    }
    function setModalLoading(btnId, loading, label) {
      var btn = document.getElementById(btnId);
      btn.disabled = loading;
      btn.textContent = loading ? 'Chargement...' : label;
    }

    // ── Soumettre Facture ──
    async function submitFacture() {
      clearModalError('f');
      var client = document.getElementById('f-client').value.trim();
      var desc = document.getElementById('f-desc').value.trim();
      var qty = parseFloat(document.getElementById('f-qty').value) || 0;
      var prix = parseFloat(document.getElementById('f-prix').value) || 0;
      var tva = parseFloat(document.getElementById('f-tva').value) || 20;
      if (!client) return modalError('f', 'Le nom du client est requis.');
      if (!desc) return modalError('f', 'La description est requise.');
      if (prix <= 0) return modalError('f', 'Le prix doit être supérieur à 0.');
      var montantHT = qty * prix;
      var montantTVA = montantHT * tva / 100;
      setModalLoading('f-btn', true, 'Créer la facture');
      try {
        var res = await fetch(API + '/comptabilite/factures', {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({
            client: { nom: client, email: document.getElementById('f-email').value.trim() || undefined },
            lignes: [{ description: desc, quantite: qty, prixUnitaire: prix, montantHT }],
            montantHT, tauxTVA: tva, montantTVA, montantTTC: montantHT + montantTVA
          })
        });
        var data = await res.json();
        if (data.success) {
          closeModal('modal-facture');
          showToast('Facture créée avec succès', 'success');
          loadKPIs(); loadInvoices(); loadActivity();
        } else {
          modalError('f', data.message || 'Erreur lors de la création.');
        }
      } catch(e) { modalError('f', 'Erreur réseau.'); }
      setModalLoading('f-btn', false, 'Créer la facture');
    }

    // ── Soumettre Employé ──
    async function submitEmploye() {
      clearModalError('e');
      var prenom = document.getElementById('e-prenom').value.trim();
      var nom = document.getElementById('e-nom').value.trim();
      var email = document.getElementById('e-email').value.trim();
      var poste = document.getElementById('e-poste').value.trim();
      var dept = document.getElementById('e-dept').value.trim();
      var salaire = parseFloat(document.getElementById('e-salaire').value) || 0;
      var date = document.getElementById('e-date').value;
      var iban = (document.getElementById('e-iban')?.value || '').trim().replace(/\s/g, '');
      var pas = parseFloat(document.getElementById('e-pas')?.value) || 0;
      if (!prenom || !nom) return modalError('e', 'Le prénom et le nom sont requis.');
      if (!email) return modalError('e', 'L\'email est requis.');
      if (!poste) return modalError('e', 'Le poste est requis.');
      if (salaire <= 0) return modalError('e', 'Le salaire doit être supérieur à 0.');
      if (!date) return modalError('e', 'La date d\'embauche est requise.');
      setModalLoading('e-btn', true, 'Ajouter l\'employé');
      try {
        var res = await fetch(API + '/rh/employes', {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({ prenom, nom, email, poste, departement: dept, salaireBase: salaire, dateEmbauche: date, iban: iban || undefined, tauxImpot: pas / 100 })
        });
        var data = await res.json();
        if (data.success) {
          closeModal('modal-employe');
          showToast('Employé ajouté avec succès', 'success');
          loadKPIs(); loadActivity();
        } else {
          modalError('e', data.message || (data.errors && data.errors[0] && data.errors[0].message) || 'Erreur.');
        }
      } catch(e) { modalError('e', 'Erreur réseau.'); }
      setModalLoading('e-btn', false, 'Ajouter l\'employé');
    }

    // ── Charger produits pour modal stock ──
    async function loadProductsForModal() {
      var select = document.getElementById('s-product');
      select.innerHTML = '<option value="">Chargement...</option>';
      var res = await apiFetch('/stocks/produits');
      var products = (res && res.data) ? res.data : [];
      if (products.length === 0) {
        select.innerHTML = '<option value="">Aucun produit disponible</option>';
        return;
      }
      select.innerHTML = products.map(function(p) {
        return '<option value="' + esc(p._id)+ '">' + esc(p.nom)+ ' (stock: ' + esc(p.quantite)+ ' ' + esc((p.unite || 'unité'))+ ')</option>';
      }).join('');
    }

    // ── Soumettre Mouvement Stock ──
    async function submitStock() {
      clearModalError('s');
      var productId = document.getElementById('s-product').value;
      var type = document.getElementById('s-type').value;
      var qty = parseInt(document.getElementById('s-qty').value) || 0;
      var motif = document.getElementById('s-motif').value.trim();
      if (!productId) return modalError('s', 'Sélectionnez un produit.');
      if (qty <= 0) return modalError('s', 'La quantité doit être supérieure à 0.');
      setModalLoading('s-btn', true, 'Enregistrer le mouvement');
      try {
        var res = await fetch(API + '/stocks/mouvements', {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({ productId, type, quantite: qty, motif: motif || type })
        });
        var data = await res.json();
        if (data.success) {
          closeModal('modal-stock');
          showToast('Mouvement enregistré' + (data.alerte && data.alerte.active ? ' ⚠️ ' + data.alerte.message : ''), 'success');
          loadKPIs(); loadStockAlerts(); loadActivity();
        } else {
          modalError('s', data.message || 'Erreur.');
        }
      } catch(e) { modalError('s', 'Erreur réseau.'); }
      setModalLoading('s-btn', false, 'Enregistrer le mouvement');
    }

    // ── Soumettre Tâche ──
    async function submitTache() {
      clearModalError('t');
      var titre = document.getElementById('t-titre').value.trim();
      var priorite = document.getElementById('t-priorite').value;
      var deadline = document.getElementById('t-deadline').value;
      if (!titre) return modalError('t', 'Le titre est requis.');
      setModalLoading('t-btn', true, 'Créer la tâche');
      try {
        var body = { titre, priorite };
        if (deadline) body.deadline = deadline;
        var res = await fetch(API + '/taches', {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify(body)
        });
        var data = await res.json();
        if (data.success) {
          closeModal('modal-tache');
          showToast('Tâche créée avec succès', 'success');
          loadTasks(); loadActivity();
        } else {
          modalError('t', data.message || 'Erreur.');
        }
      } catch(e) { modalError('t', 'Erreur réseau.'); }
      setModalLoading('t-btn', false, 'Créer la tâche');
    }

    // ── Comptabilité: All invoices ──
    var currentFactureFilter = null;
    var currentFacturePage = 1;
    var facturePageSize = 15;
    var allInvoicesData = [];

    async function loadAllInvoices(statut) {
      if (statut !== undefined) { currentFactureFilter = statut; currentFacturePage = 1; }
      var url = '/comptabilite/factures?limit=200' + (currentFactureFilter ? '&statut=' + currentFactureFilter : '');
      var res = await apiFetch(url);
      allInvoicesData = (res && res.data) ? res.data : [];
      renderInvoicesPage();
    }

    function renderInvoicesPage() {
      var tbody = document.getElementById('all-invoices-body');
      var pagDiv = document.getElementById('factures-pagination');
      if (!tbody) return;
      if (allInvoicesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">📄</div><div class="empty-state-text">Aucune facture trouvée</div></div></td></tr>';
        if (pagDiv) pagDiv.style.display = 'none';
        return;
      }
      var totalPages = Math.ceil(allInvoicesData.length / facturePageSize);
      var start = (currentFacturePage - 1) * facturePageSize;
      var page = allInvoicesData.slice(start, start + facturePageSize);
      var statusMap = { payee:'badge-green', envoyee:'badge-yellow', brouillon:'badge-gray', en_retard:'badge-red', annulee:'badge-gray' };
      var labelMap = { payee:'Payée', envoyee:'Envoyée', brouillon:'Brouillon', en_retard:'En retard', annulee:'Annulée' };
      tbody.innerHTML = page.map(function(inv) {
        var clientName = (inv.client && inv.client.nom) ? inv.client.nom : '—';
        var statut = inv.statut || 'brouillon';
        var cls = statusMap[statut] || 'badge-gray';
        var label = labelMap[statut] || statut;
        var date = inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('fr') : '—';
        var montant = (inv.montantTTC || 0).toLocaleString('fr') + ' €';
        var tva = (inv.montantTVA || 0).toLocaleString('fr') + ' €';
        var paidBtn = statut !== 'payee' ? '<button class="btn-sm btn-success-sm" onclick="markFacturePaid(\'' + esc(inv._id)+ '\')" style="margin-right:4px;">✓ Payée</button>' : '';
        var relanceBtn = (statut === 'envoyee' || statut === 'en_retard') ? '<button class="btn-sm" onclick="relancerFacture(\'' + esc(inv._id)+ '\')" style="margin-right:4px;">📧 Relancer</button>' : '';
        var invData = JSON.stringify(inv).replace(/'/g,"&#39;").replace(/"/g,"&quot;");
        var pdpBadge = (inv.pdp && inv.pdp.statut && inv.pdp.statut !== 'non_transmise')
          ? '<br><span class="badge badge-gray" title="Statut PDP" style="margin-top:4px;font-size:10px;">🏛️ ' + esc((inv.pdp.statutLabel || inv.pdp.statut))+ '</span>' : '';
        return '<tr>'
          + '<td style="font-weight:600;color:#a5b4fc;">' + esc((inv.numero || '—'))+ '</td>'
          + '<td>' + esc(clientName)+ '</td>'
          + '<td style="font-weight:700;">' + esc(montant)+ '</td>'
          + '<td style="color:var(--text-dim);">' + esc(tva)+ '</td>'
          + '<td><span class="badge ' + esc(cls)+ '">' + esc(label)+ '</span>' + esc(pdpBadge)+ '</td>'
          + '<td style="color:var(--text-dim);">' + esc(date)+ '</td>'
          + '<td>' + paidBtn + relanceBtn + '<button class="btn-sm" onclick="downloadFacturePDF(\'' + inv._id + '\')" style="margin-right:4px;" title="Télécharger PDF">📥 PDF</button><button class="btn-sm" onclick="downloadFacturX(\'' + inv._id + '\')" style="margin-right:4px;" title="Facture électronique (Factur-X)">🇪🇺 XML</button><button class="btn-sm" onclick="transmettrePDP(\'' + inv._id + '\')" style="margin-right:4px;" title="Transmettre via une PDP (facturation électronique)">🏛️ PDP</button><button class="btn-sm" onclick="genererLienPaiement(\'' + inv._id + '\')" style="margin-right:4px;" title="Lien de paiement en ligne">💳</button><button class="btn-sm" onclick="printFacture(\'' + inv._id + '\')" style="margin-right:4px;">🖨</button><button class="btn-sm btn-del-sm" onclick="deleteFacture(\'' + inv._id + '\')">🗑</button></td>'
          + '</tr>';
      }).join('');
      if (pagDiv) {
        if (totalPages <= 1) { pagDiv.style.display = 'none'; return; }
        pagDiv.style.display = 'flex';
        var html = '<button class="page-btn" onclick="goFacturePage(' + esc((currentFacturePage - 1))+ ')" ' + (currentFacturePage === 1 ? 'disabled' : '') + '>← Préc.</button>';
        for (var i = 1; i <= totalPages; i++) {
          if (totalPages > 7 && i > 2 && i < totalPages - 1 && Math.abs(i - currentFacturePage) > 1) { if (i === 3 || i === totalPages - 2) html += '<span class="page-info">…</span>'; continue; }
          html += '<button class="page-btn' + (i === currentFacturePage ? ' active' : '') + '" onclick="goFacturePage(' + i + ')">' + i + '</button>';
        }
        html += '<button class="page-btn" onclick="goFacturePage(' + esc((currentFacturePage + 1))+ ')" ' + (currentFacturePage === totalPages ? 'disabled' : '') + '>Suiv. →</button>';
        html += '<span class="page-info">' + esc(allInvoicesData.length)+ ' factures</span>';
        pagDiv.innerHTML = html;
      }
    }

    function goFacturePage(p) {
      var total = Math.ceil(allInvoicesData.length / facturePageSize);
      if (p < 1 || p > total) return;
      currentFacturePage = p;
      renderInvoicesPage();
    }

    // ── Comptabilité Tabs ──
    function switchComptaTab(tab) {
      ['factures','recurrences','documents','clients','devis','tva','catalogue','avoirs','immos','rapprochement','cashflow','is','bilan','budget','analytique'].forEach(function(t) {
        var tabEl = document.getElementById('compta-tab-' + t);
        var panelEl = document.getElementById('compta-panel-' + t);
        var actionsEl = document.getElementById('compta-actions-' + t);
        if (tabEl) tabEl.classList.toggle('active', t === tab);
        if (panelEl) panelEl.style.display = t === tab ? '' : 'none';
        if (actionsEl) actionsEl.style.display = t === tab ? 'flex' : 'none';
      });
      if (tab === 'documents') loadDocumentsComptables();
      if (tab === 'recurrences') loadRecurrences();
      if (tab === 'clients') loadScoresClients();
      if (tab === 'devis') loadDevis();
      if (tab === 'catalogue') loadCatalogue();
      if (tab === 'tva') { initTVAAnne(); loadDeclarationTVA(); }
      if (tab === 'avoirs') loadAvoirs();
      if (tab === 'immos') loadImmos();
      if (tab === 'rapprochement') loadRapprochements();
      if (tab === 'cashflow') loadCashflow();
      if (tab === 'is') loadCalculIS();
      if (tab === 'bilan') loadBilan();
      if (tab === 'budget') loadBudget();
      if (tab === 'analytique') loadCentresAnalytiques();
    }

    // ── Récurrences ──
    async function loadRecurrences() {
      var res = await apiFetch('/recurrence');
      var list = (res && res.data) ? res.data : [];
      var tbody = document.getElementById('recurrences-body');
      if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-dim);">Aucune récurrence configurée</td></tr>'; return; }
      var freqLabels = { mensuel:'Mensuelle', trimestriel:'Trimestrielle', semestriel:'Semestrielle', annuel:'Annuelle' };
      tbody.innerHTML = list.map(function(r) {
        var montantHT = (r.lignes || []).reduce(function(s,l){ return s + l.montantHT; }, 0);
        var actifBadge = r.actif ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-gray">Inactive</span>';
        return '<tr>'
          + '<td style="font-weight:600;">' + esc(r.clientNom)+ (r.clientEmail ? '<div style="font-size:11px;color:var(--text-dim);">' + esc(r.clientEmail) + '</div>' : '') + '</td>'
          + '<td style="color:#a5b4fc;font-weight:700;">' + montantHT.toLocaleString('fr-FR') + ' €</td>'
          + '<td>' + esc((freqLabels[r.frequence] || r.frequence))+ '</td>'
          + '<td>' + new Date(r.prochainEnvoi).toLocaleDateString('fr-FR') + '</td>'
          + '<td style="text-align:center;">' + esc((r.facturesGenerees || 0))+ '</td>'
          + '<td>' + actifBadge + '</td>'
          + '<td><button onclick="toggleRecurrence(\'' + r._id + '\',' + !r.actif + ')" class="btn-outline" style="font-size:12px;padding:5px 10px;">' + (r.actif ? 'Désactiver' : 'Activer') + '</button> <button onclick="deleteRecurrence(\'' + r._id + '\')" class="btn-del-sm" style="font-size:12px;padding:5px 10px;">Suppr.</button></td>'
          + '</tr>';
      }).join('');
    }

    async function submitRecurrence() {
      var clientNom = document.getElementById('rec-client').value.trim();
      var desc = document.getElementById('rec-desc').value.trim();
      var montant = parseFloat(document.getElementById('rec-montant').value);
      var date = document.getElementById('rec-date').value;
      if (!clientNom || !desc || !montant || !date) { document.getElementById('rec-error').textContent = 'Renseignez tous les champs obligatoires.'; return; }
      setModalLoading('rec-btn', true, 'Création...');
      try {
        var res = await fetch(API + '/recurrence', { method:'POST', headers:apiHeaders(), body:JSON.stringify({
          clientNom, clientEmail: document.getElementById('rec-email').value,
          lignes: [{ description: desc, quantite: 1, prixUnitaire: montant, montantHT: montant }],
          frequence: document.getElementById('rec-frequence').value,
          prochainEnvoi: date
        }) });
        var data = await res.json();
        if (data.success) { closeModal('modal-recurrence'); showToast('Récurrence créée', 'success'); loadRecurrences(); }
        else { document.getElementById('rec-error').textContent = data.message || 'Erreur.'; }
      } catch(e) { document.getElementById('rec-error').textContent = 'Erreur réseau.'; }
      setModalLoading('rec-btn', false, 'Créer la récurrence');
    }

    async function toggleRecurrence(id, actif) {
      await fetch(API + '/recurrence/' + id, { method:'PUT', headers:apiHeaders(), body:JSON.stringify({ actif }) });
      loadRecurrences();
    }
    async function deleteRecurrence(id) {
      if (!confirm('Supprimer cette récurrence ?')) return;
      await fetch(API + '/recurrence/' + id, { method:'DELETE', headers:apiHeaders() });
      showToast('Récurrence supprimée', 'success'); loadRecurrences();
    }
    async function genererRecurrencesDues() {
      var res = await fetch(API + '/recurrence/generer', { method:'POST', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast(data.data.generated + ' facture(s) générée(s)', 'success'); loadRecurrences(); loadAllInvoices(); }
      else showToast(data.message || 'Erreur', 'error');
    }

    // ── Scores clients ──
    async function loadScoresClients() {
      var res = await apiFetch('/comptabilite/scores-clients');
      var scores = (res && res.data) ? res.data : [];
      var tbody = document.getElementById('scores-clients-body');
      if (!scores.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-dim);">Aucune donnée client</td></tr>'; return; }
      var risqueColors = { faible:'#34d399', moyen:'#f59e0b', eleve:'#f87171' };
      var risqueLabels = { faible:'✅ Faible', moyen:'⚠️ Moyen', eleve:'🔴 Élevé' };
      tbody.innerHTML = scores.map(function(c) {
        var col = risqueColors[c.risque] || '#94a3b8';
        var scoreBar = '<div style="display:flex;align-items:center;gap:8px;"><div style="background:rgba(255,255,255,.06);border-radius:4px;height:6px;flex:1;"><div style="background:' + esc(col)+ ';width:' + Math.min(100,c.score) + '%;height:6px;border-radius:4px;"></div></div><span style="font-size:12px;font-weight:700;color:' + esc(col)+ ';white-space:nowrap;">' + esc(c.score)+ '</span></div>';
        return '<tr>'
          + '<td style="font-weight:600;">' + esc(c.nom)+ '</td>'
          + '<td style="min-width:120px;">' + scoreBar + '</td>'
          + '<td><span style="font-weight:600;color:' + esc(col)+ ';">' + esc((risqueLabels[c.risque] || c.risque))+ '</span></td>'
          + '<td>' + esc(c.tauxPaiement)+ '%</td>'
          + '<td>' + esc((c.retardMoyen ? c.retardMoyen + ' j' : '—'))+ '</td>'
          + '<td>' + esc(c.total)+ '</td>'
          + '<td style="color:' + (c.enRetard ? '#f87171' : '#34d399') + ';">' + esc(c.enRetard)+ '</td>'
          + '<td><button onclick="creerPortailPourClient(\'' + escAttr(c.nom) + '\')" class="btn-outline" style="font-size:12px;padding:5px 10px;">🔗 Portail</button></td>'
          + '</tr>';
      }).join('');
    }

    // ── OCR Justificatif ──
    function previewOCR(input) {
      var file = input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(e) {
        document.getElementById('ocr-img').src = e.target.result;
        document.getElementById('ocr-preview').style.display = '';
      };
      reader.readAsDataURL(file);
    }
    async function submitOCR() {
      var file = document.getElementById('ocr-file').files[0];
      if (!file) { document.getElementById('ocr-error').textContent = 'Sélectionnez une image.'; return; }
      var btn = document.getElementById('ocr-btn');
      btn.disabled = true; btn.textContent = 'Analyse en cours...';
      document.getElementById('ocr-error').textContent = '';
      try {
        var reader = new FileReader();
        reader.onload = async function(e) {
          var base64 = e.target.result.split(',')[1];
          var mimeType = file.type || 'image/jpeg';
          var res = await fetch(API + '/ai/ocr-justificatif', { method:'POST', headers:apiHeaders(), body:JSON.stringify({ imageBase64: base64, mimeType }) });
          var data = await res.json();
          if (data.success) {
            var d = data.data;
            var catLabels = { fournitures:'Fournitures', transport:'Transport', restauration:'Restauration', logiciel:'Logiciels', marketing:'Marketing', loyer:'Loyer', salaires:'Salaires', autre:'Autres' };
            document.getElementById('ocr-result').innerHTML = '<div style="background:rgba(52,211,153,.06);border:1px solid rgba(52,211,153,.2);border-radius:12px;padding:16px;">'
              + '<div style="font-size:12px;font-weight:700;color:#34d399;margin-bottom:10px;">✅ Informations extraites</div>'
              + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">'
              + (d.fournisseur ? '<div><div style="font-size:11px;color:var(--text-dim);">Fournisseur</div><div style="font-weight:600;">' + esc(d.fournisseur) + '</div></div>' : '')
              + (d.date ? '<div><div style="font-size:11px;color:var(--text-dim);">Date</div><div style="font-weight:600;">' + esc(d.date) + '</div></div>' : '')
              + (d.montant ? '<div><div style="font-size:11px;color:var(--text-dim);">Montant TTC</div><div style="font-weight:600;color:#a5b4fc;">' + d.montant.toLocaleString('fr-FR') + ' €</div></div>' : '')
              + (d.categorie ? '<div><div style="font-size:11px;color:var(--text-dim);">Catégorie</div><div style="font-weight:600;">' + (catLabels[d.categorie] || d.categorie) + '</div></div>' : '')
              + '</div>'
              + '<button onclick="creerDepenseOCR(' + JSON.stringify(d).replace(/"/g,"'") + ')" class="btn-primary" style="width:100%;margin-top:12px;">Créer la dépense</button>'
              + '</div>';
          } else { document.getElementById('ocr-error').textContent = data.message || 'Erreur d\'analyse.'; }
          btn.disabled = false; btn.textContent = 'Analyser avec l\'IA';
        };
        reader.readAsDataURL(file);
      } catch(e) { document.getElementById('ocr-error').textContent = 'Erreur réseau.'; btn.disabled = false; btn.textContent = 'Analyser avec l\'IA'; }
    }
    async function creerDepenseOCR(d) {
      var titre = d.fournisseur || d.description || 'Dépense scannée';
      var montant = d.montantHT || d.montant || 0;
      var categorie = d.categorie || 'autre';
      var res = await fetch(API + '/comptabilite/depenses', { method:'POST', headers:apiHeaders(), body:JSON.stringify({ titre, montant, categorie, date: d.date || new Date().toISOString() }) });
      var data = await res.json();
      if (data.success) { closeModal('modal-ocr'); showToast('Dépense créée depuis le justificatif', 'success'); loadDepenses(); }
      else showToast(data.message || 'Erreur', 'error');
    }

    // ── Approbation dépenses ──
    async function approuverDepense(id) {
      var res = await fetch(API + '/comptabilite/depenses/' + id + '/approuver', { method:'POST', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Dépense approuvée', 'success'); loadDepenses(); }
      else showToast(data.message || 'Erreur', 'error');
    }
    async function rejeterDepense(id) {
      var res = await fetch(API + '/comptabilite/depenses/' + id + '/rejeter', { method:'POST', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Dépense rejetée', 'success'); loadDepenses(); }
      else showToast(data.message || 'Erreur', 'error');
    }

    // ── Relances ──
    async function relancerFacture(id) {
      var res = await fetch(API + '/comptabilite/factures/' + id + '/relancer', { method:'POST', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast(data.message || 'Relance envoyée', 'success'); loadAllInvoices(); }
      else showToast(data.message || 'Erreur', 'error');
    }

    // ── Rapport mensuel ──
    async function envoyerRapport() {
      var email = document.getElementById('set-rapport-email').value.trim();
      var res = await fetch(API + '/rapport/envoyer', { method:'POST', headers:apiHeaders(), body:JSON.stringify({ email }) });
      var data = await res.json();
      if (data.success) showToast(data.message, 'success');
      else showToast(data.message || 'Erreur', 'error');
    }

    // ── Expert-comptable access ──
    async function loadExpertAccess() {
      var res = await apiFetch('/expert');
      var list = (res && res.data) ? res.data : [];
      var container = document.getElementById('expert-list');
      if (!list.length) { container.innerHTML = '<div style="font-size:13px;color:var(--text-dim);">Aucun accès créé.</div>'; return; }
      container.innerHTML = list.map(function(a) {
        var exp = new Date(a.expiresAt);
        var expired = exp < new Date();
        return '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:10px 14px;display:flex;align-items:center;gap:10px;">'
          + '<div style="flex:1;"><div style="font-size:13px;font-weight:600;">' + esc(a.label)+ '</div>'
          + '<div style="font-size:11px;color:var(--text-dim);">' + (expired ? '❌ Expiré' : 'Expire le ' + exp.toLocaleDateString('fr-FR')) + ' — ' + esc(a.views)+ ' vue(s)</div></div>'
          + '<button onclick="copyToClipboard(\'' + a.url + '\')" class="btn-outline" style="font-size:11px;padding:4px 10px;">Copier lien</button>'
          + '<button onclick="revoquerExpert(\'' + a._id + '\')" class="btn-del-sm" style="font-size:11px;padding:4px 10px;">Révoquer</button>'
          + '</div>';
      }).join('');
    }
    async function creerAccesExpert() {
      var label = document.getElementById('expert-label').value.trim() || 'Expert-comptable';
      var dureeJours = parseInt(document.getElementById('expert-duree').value);
      var res = await fetch(API + '/expert', { method:'POST', headers:apiHeaders(), body:JSON.stringify({ label, dureeJours }) });
      var data = await res.json();
      if (data.success) {
        copyToClipboard(data.data.url);
        showToast('Accès créé — lien copié !', 'success');
        document.getElementById('expert-label').value = '';
        loadExpertAccess();
      } else showToast(data.message || 'Erreur', 'error');
    }
    async function revoquerExpert(id) {
      if (!confirm('Révoquer cet accès ?')) return;
      await fetch(API + '/expert/' + id, { method:'DELETE', headers:apiHeaders() });
      showToast('Accès révoqué', 'success'); loadExpertAccess();
    }

    // ── Portail client ──
    async function loadPortails() {
      var res = await apiFetch('/portail');
      var list = (res && res.data) ? res.data : [];
      var container = document.getElementById('portails-list');
      if (!list.length) { container.innerHTML = '<div style="font-size:13px;color:var(--text-dim);">Aucun portail créé.</div>'; return; }
      container.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px;">' + list.map(function(p) {
        var exp = new Date(p.expiresAt);
        var expired = exp < new Date();
        return '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:10px 14px;display:flex;align-items:center;gap:10px;">'
          + '<div style="flex:1;"><div style="font-size:13px;font-weight:600;">' + esc(p.clientNom)+ '</div>'
          + '<div style="font-size:11px;color:var(--text-dim);">' + (expired ? '❌ Expiré' : 'Expire le ' + exp.toLocaleDateString('fr-FR')) + esc((p.clientEmail ? ' — ' + p.clientEmail : ''))+ '</div></div>'
          + '<button onclick="copyToClipboard(\'' + escAttr(p.url) + '\')" class="btn-outline" style="font-size:11px;padding:4px 10px;">Copier lien</button>'
          + '</div>';
      }).join('') + '</div>';
    }
    async function creerPortailClient() {
      var clientNom = document.getElementById('portail-client-nom').value.trim();
      if (!clientNom) { showToast('Renseignez le nom du client', 'error'); return; }
      var res = await fetch(API + '/portail', { method:'POST', headers:apiHeaders(), body:JSON.stringify({
        clientNom, clientEmail: document.getElementById('portail-client-email').value, dureeJours: parseInt(document.getElementById('portail-duree').value)
      }) });
      var data = await res.json();
      if (data.success) {
        copyToClipboard(data.data.url);
        showToast('Portail créé — lien copié !', 'success');
        document.getElementById('portail-client-nom').value = '';
        document.getElementById('portail-client-email').value = '';
        loadPortails();
      } else showToast(data.message || 'Erreur', 'error');
    }
    async function creerPortailPourClient(nom) {
      switchSection('parametres');
      document.getElementById('portail-client-nom').value = nom;
      showToast('Renseignez les détails et cliquez sur "Générer le lien"', 'info');
    }
    function copyToClipboard(text) {
      navigator.clipboard.writeText(text).then(function() { showToast('Lien copié !', 'success'); }).catch(function() {
        var el = document.createElement('textarea'); el.value = text; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); showToast('Lien copié !', 'success');
      });
    }

    // ── Paramètres entreprise ──
    async function loadCompanySettings() {
      var res = await apiFetch('/comptabilite/settings');
      if (res && res.data) {
        if (res.data.slackWebhookUrl) document.getElementById('set-slack').value = res.data.slackWebhookUrl;
        if (res.data.approvalThreshold) document.getElementById('set-threshold').value = res.data.approvalThreshold;
      }
    }
    async function saveCompanySettings() {
      var res = await fetch(API + '/comptabilite/settings', { method:'PUT', headers:apiHeaders(), body:JSON.stringify({
        slackWebhookUrl: document.getElementById('set-slack').value.trim(),
        approvalThreshold: parseFloat(document.getElementById('set-threshold').value) || 0
      }) });
      var data = await res.json();
      if (data.success) showToast('Paramètres sauvegardés', 'success');
      else showToast(data.message || 'Erreur', 'error');
    }

    // ── Identité entreprise + recherche SIRENE ──
    async function rechercherSirene() {
      var q = document.getElementById('sirene-q').value.trim();
      var box = document.getElementById('sirene-results');
      if (q.length < 3) { showToast('Saisissez au moins 3 caractères', 'error'); return; }
      box.style.display = 'flex';
      box.innerHTML = '<div style="font-size:13px;color:var(--text-dim);">Recherche...</div>';
      var res = await apiFetch('/entreprise/recherche?q=' + encodeURIComponent(q));
      var list = (res && res.data) ? res.data : [];
      if (!list.length) { box.innerHTML = '<div style="font-size:13px;color:var(--text-dim);">Aucun résultat.</div>'; return; }
      box.innerHTML = list.map(function(e, i) {
        return '<div onclick="remplirSirene(' + i + ')" style="cursor:pointer;padding:10px 12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;">'
          + '<div style="font-weight:600;font-size:13px;">' + esc((e.nom || '—'))+ '</div>'
          + '<div style="font-size:11px;color:var(--text-dim);">SIRET ' + esc((e.siret || '—'))+ ' · ' + esc((e.codePostal || ''))+ ' ' + esc((e.ville || ''))+ '</div></div>';
      }).join('');
      window._sireneResults = list;
    }

    function remplirSirene(i) {
      var e = (window._sireneResults || [])[i];
      if (!e) return;
      document.getElementById('co-nom').value = e.nom || '';
      document.getElementById('co-siret').value = e.siret || '';
      document.getElementById('co-ape').value = e.codeApe || '';
      document.getElementById('co-adresse').value = e.adresse || '';
      document.getElementById('co-cp').value = e.codePostal || '';
      document.getElementById('co-ville').value = e.ville || '';
      document.getElementById('sirene-results').style.display = 'none';
      showToast('Informations pré-remplies', 'success');
    }

    async function saveCompanyIdentity() {
      var payload = {
        nom: document.getElementById('co-nom').value.trim(),
        siret: document.getElementById('co-siret').value.trim(),
        codeApe: document.getElementById('co-ape').value.trim(),
        urssaf: document.getElementById('co-urssaf').value.trim(),
        adresse: document.getElementById('co-adresse').value.trim(),
        codePostal: document.getElementById('co-cp').value.trim(),
        ville: document.getElementById('co-ville').value.trim(),
        conventionCollective: document.getElementById('co-convention').value.trim(),
        iban: document.getElementById('co-iban').value.trim().replace(/\s/g, '')
      };
      var res = await fetch(API + '/comptabilite/settings', { method:'PUT', headers:apiHeaders(), body:JSON.stringify(payload) });
      var data = await res.json();
      if (data.success) showToast('Identité entreprise sauvegardée', 'success');
      else showToast(data.message || 'Erreur', 'error');
    }

    async function loadCompanyIdentity() {
      var res = await apiFetch('/comptabilite/settings');
      var c = (res && res.data) ? res.data : {};
      var map = { 'co-nom':'nom','co-siret':'siret','co-ape':'codeApe','co-urssaf':'urssaf','co-adresse':'adresse','co-cp':'codePostal','co-ville':'ville','co-convention':'conventionCollective','co-iban':'iban' };
      Object.keys(map).forEach(function(id) { var el = document.getElementById(id); if (el) el.value = c[map[id]] || ''; });
    }

    function initDocAnnee() {
      var sel = document.getElementById('doc-annee');
      if (!sel || sel.options.length > 0) return;
      var y = new Date().getFullYear();
      for (var i = y; i >= y - 5; i--) {
        var o = document.createElement('option'); o.value = i; o.textContent = i;
        sel.appendChild(o);
      }
    }

    async function loadDocumentsComptables() {
      initDocAnnee();
      var annee = document.getElementById('doc-annee').value || new Date().getFullYear();
      var [bilanRes, resultatRes] = await Promise.all([
        apiFetch('/comptabilite/bilan-comptable?annee=' + annee),
        apiFetch('/comptabilite/compte-resultat?annee=' + annee)
      ]);
      if (bilanRes && bilanRes.success) renderBilan(bilanRes.data);
      if (resultatRes && resultatRes.success) renderCompteResultat(resultatRes.data);
    }

    function fmt(n) { return (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }

    function renderBilan(d) {
      document.getElementById('bilan-annee-label').textContent = d.annee;
      var html = '<div><div style="font-size:13px;font-weight:700;color:var(--purple);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.08);">ACTIF</div>'
        + bilanRow('Stocks & immobilisations', d.actif.stocks)
        + bilanRow('Créances clients', d.actif.creancesClients)
        + bilanRow('Trésorerie (encaissements)', d.actif.tresorerie)
        + bilanTotal('Total Actif', d.actif.total)
        + '</div><div><div style="font-size:13px;font-weight:700;color:#34d399;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.08);">PASSIF</div>'
        + bilanRow('Résultat de l\'exercice', d.passif.resultatExercice)
        + bilanRow('TVA collectée', d.passif.tvaCollectee)
        + bilanRow('Dettes estimées', d.passif.dettesEstimees)
        + bilanTotal('Total Passif', d.passif.total)
        + '</div>';
      document.getElementById('bilan-content').innerHTML = html;
    }

    function bilanRow(label, val) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04);">'
        + '<span style="font-size:13px;color:var(--text-muted);">' + esc(label)+ '</span>'
        + '<span style="font-size:13px;font-weight:600;color:var(--text);">' + fmt(val) + '</span></div>';
    }
    function bilanTotal(label, val) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0 0;margin-top:4px;">'
        + '<span style="font-size:14px;font-weight:700;color:var(--text);">' + esc(label)+ '</span>'
        + '<span style="font-size:14px;font-weight:800;color:var(--purple);">' + fmt(val) + '</span></div>';
    }

    function renderCompteResultat(d) {
      document.getElementById('resultat-annee-label').textContent = d.annee;
      var sign = d.resultat.net >= 0 ? '+' : '';
      var margeColor = d.resultat.net >= 0 ? '#34d399' : '#f87171';
      var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">'
        + '<div><div style="font-size:13px;font-weight:700;color:#34d399;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.08);">PRODUITS</div>'
        + bilanRow('Chiffre d\'affaires HT', d.produits.caHT)
        + bilanRow('TVA collectée', d.produits.tvaCollectee)
        + bilanTotal('Total produits', d.produits.total)
        + '</div><div><div style="font-size:13px;font-weight:700;color:#f87171;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.08);">CHARGES</div>'
        + (d.charges.detail.length ? d.charges.detail.map(function(c) { return bilanRow(c.label, c.montant); }).join('') : '<div style="padding:10px 0;color:var(--text-dim);font-size:13px;">Aucune charge enregistrée</div>')
        + bilanTotal('Total charges', d.charges.total)
        + '</div></div>'
        + '<div style="margin-top:24px;padding:20px;background:rgba(255,255,255,0.03);border-radius:12px;border:1px solid rgba(255,255,255,0.08);">'
        + '<div style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">RÉSULTAT</div>'
        + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;">'
        + resultatKPI('Résultat brut', d.resultat.brut, d.resultat.brut >= 0 ? '#34d399' : '#f87171')
        + resultatKPI('IS estimé (25%)', '-' + fmt(d.resultat.is), '#f59e0b')
        + resultatKPI('Résultat net', sign + fmt(d.resultat.net), margeColor)
        + resultatKPI('Marge nette', sign + d.resultat.marge + ' %', margeColor)
        + '</div></div>';
      document.getElementById('resultat-content').innerHTML = html;
    }

    function resultatKPI(label, val, color) {
      var valStr = typeof val === 'number' ? fmt(val) : val;
      return '<div style="text-align:center;">'
        + '<div style="font-size:11px;color:var(--text-dim);margin-bottom:6px;">' + esc(label)+ '</div>'
        + '<div style="font-size:18px;font-weight:800;color:' + esc(color)+ ';">' + esc(valStr)+ '</div></div>';
    }

    function printBilan() {
      var content = document.getElementById('card-bilan');
      if (!content) return;
      var annee = document.getElementById('bilan-annee-label').textContent;
      var w = window.open('', '_blank', 'width=900,height=700');
      w.document.write('<html><head><title>Bilan Comptable ' + annee + '</title>'
        + '<style>body{font-family:Inter,sans-serif;margin:32px;color:#111;}h1{font-size:20px;margin-bottom:8px;}h2{font-size:15px;color:#6366f1;border-bottom:2px solid #6366f1;padding-bottom:4px;margin-bottom:12px;}'
        + '.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:13px;}.total{display:flex;justify-content:space-between;padding:12px 0;font-weight:800;font-size:14px;}.label{color:#555;}.val{font-weight:600;}.footer{margin-top:24px;font-size:11px;color:#999;}</style></head>'
        + '<body><h1>Bilan Comptable</h1><p style="color:#666;font-size:13px;">Au 31/12/' + esc(annee)+ ' — généré le ' + new Date().toLocaleDateString('fr-FR') + '</p>'
        + '<div class="grid">' + esc(content.querySelector('#bilan-content').innerHTML)+ '</div>'
        + '<div class="footer">Document généré par Novexa — à titre indicatif, non opposable fiscalement.</div>'
        + '</body></html>');
      w.document.close(); w.focus(); setTimeout(function() { w.print(); }, 400);
    }

    function printCompteResultat() {
      var content = document.getElementById('card-resultat');
      if (!content) return;
      var annee = document.getElementById('resultat-annee-label').textContent;
      var w = window.open('', '_blank', 'width=900,height=700');
      w.document.write('<html><head><title>Compte de Résultat ' + annee + '</title>'
        + '<style>body{font-family:Inter,sans-serif;margin:32px;color:#111;}h1{font-size:20px;margin-bottom:8px;}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;}h2{font-size:15px;border-bottom:2px solid #ccc;padding-bottom:4px;margin-bottom:12px;}'
        + '.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:13px;}.total{display:flex;justify-content:space-between;padding:12px 0;font-weight:800;font-size:14px;}'
        + '.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:24px;padding:20px;background:#f9f9f9;border-radius:8px;}.kpi{text-align:center;}.kpi-label{font-size:11px;color:#888;margin-bottom:6px;}.kpi-val{font-size:18px;font-weight:800;}'
        + '.footer{margin-top:24px;font-size:11px;color:#999;}</style></head>'
        + '<body><h1>Compte de Résultat</h1><p style="color:#666;font-size:13px;">Exercice ' + esc(annee)+ ' — généré le ' + new Date().toLocaleDateString('fr-FR') + '</p>'
        + content.querySelector('#resultat-content').innerHTML
        + '<div class="footer">Document généré par Novexa — à titre indicatif, non opposable fiscalement.</div>'
        + '</body></html>');
      w.document.close(); w.focus(); setTimeout(function() { w.print(); }, 400);
    }

    function filterFactures(statut, btn) {
      document.querySelectorAll('.filter-tab').forEach(function(t) { t.classList.remove('active'); });
      if (btn) btn.classList.add('active');
      loadAllInvoices(statut);
    }

    async function markFacturePaid(id) {
      var res = await fetch(API + '/comptabilite/factures/' + id, { method:'PUT', headers:apiHeaders(), body:JSON.stringify({ statut:'payee' }) });
      var data = await res.json();
      if (data.success) { showToast('Facture marquée comme payée', 'success'); loadAllInvoices(currentFactureFilter); loadKPIs(); }
      else showToast(data.message || 'Erreur');
    }

    async function loadDepenses() {
      var res = await apiFetch('/comptabilite/depenses');
      var depenses = (res && res.data) ? res.data : [];
      var tbody = document.getElementById('depenses-body');
      if (!tbody) return;
      if (depenses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">💸</div><div class="empty-state-text">Aucune dépense enregistrée</div></div></td></tr>';
        return;
      }
      var catLabels = { loyer:'Loyer', logiciel:'Logiciel', materiel:'Matériel', restauration:'Restauration', transport:'Transport', marketing:'Marketing', autre:'Autre' };
      var statusMap = { approuvee:'badge-green', en_attente:'badge-yellow', refusee:'badge-red' };
      var labelMap2 = { approuvee:'Approuvée', en_attente:'En attente', refusee:'Refusée' };
      tbody.innerHTML = depenses.map(function(d) {
        var date = d.date ? new Date(d.date).toLocaleDateString('fr') : '—';
        var statut = d.statut || 'en_attente';
        var actions = '';
        if (statut === 'en_attente') {
          actions = '<button class="btn-sm btn-success-sm" onclick="approuverDepense(\'' + esc(d._id)+ '\')">✓ Approuver</button> <button class="btn-sm btn-del-sm" onclick="rejeterDepense(\'' + d._id + '\')">✗ Rejeter</button>';
        } else {
          actions = '<span style="color:var(--text-dim);font-size:12px;">—</span>';
        }
        return '<tr><td style="font-weight:600;">' + esc((d.titre || '—'))+ '</td><td><span class="badge badge-gray">' + esc((catLabels[d.categorie] || d.categorie || '—'))+ '</span></td><td style="font-weight:700;">' + (d.montant || 0).toLocaleString('fr') + ' €</td><td><span class="badge ' + esc((statusMap[statut] || 'badge-gray'))+ '">' + esc((labelMap2[statut] || statut))+ '</span></td><td style="color:var(--text-dim);">' + esc(date)+ '</td><td>' + actions + '</td></tr>';
      }).join('');
    }

    async function submitDepense() {
      clearModalError('d');
      var titre = document.getElementById('d-titre').value.trim();
      var montant = parseFloat(document.getElementById('d-montant').value) || 0;
      var categorie = document.getElementById('d-categorie').value;
      if (!titre) return modalError('d', 'Le titre est requis.');
      if (montant <= 0) return modalError('d', 'Le montant doit être supérieur à 0.');
      setModalLoading('d-btn', true, 'Enregistrer la dépense');
      try {
        var res = await fetch(API + '/comptabilite/depenses', { method:'POST', headers:apiHeaders(), body:JSON.stringify({ titre, montant, categorie, date: new Date().toISOString() }) });
        var data = await res.json();
        if (data.success) { closeModal('modal-depense'); showToast('Dépense enregistrée', 'success'); loadDepenses(); }
        else modalError('d', data.message || 'Erreur.');
      } catch(e) { modalError('d', 'Erreur réseau.'); }
      setModalLoading('d-btn', false, 'Enregistrer la dépense');
    }

    // ── RH: Employees (delegated to loadRHSection/switchRHTab) ──

    // ── Stocks section ──
    async function loadStocksSection() {
      var res = await apiFetch('/stocks/produits');
      var produits = (res && res.data) ? res.data : [];
      var tbody = document.getElementById('produits-body');
      if (!tbody) return;
      if (produits.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">Aucun produit en stock</div></div></td></tr>';
        return;
      }
      tbody.innerHTML = produits.map(function(p) {
        var pct = p.seuilAlerte > 0 ? Math.min(100, Math.round(p.quantite / (p.seuilAlerte * 3) * 100)) : (p.quantite > 0 ? 80 : 0);
        var barClass = p.quantite === 0 ? 'crit' : (p.alerteActive ? 'warn' : 'ok');
        var badge = p.quantite === 0 ? '<span class="badge badge-red">Rupture</span>' : (p.alerteActive ? '<span class="badge badge-yellow">Stock bas</span>' : '<span class="badge badge-green">OK</span>');
        return '<tr><td style="font-weight:600;">' + esc((p.nom || '—'))+ '</td><td style="color:var(--text-dim);font-size:12px;font-family:monospace;">' + esc((p.sku || '—'))+ '</td><td>' + esc((p.categorie || '—'))+ '</td><td style="font-weight:700;">' + esc((p.quantite || 0))+ ' ' + esc((p.unite || ''))+ '</td><td><div class="stock-bar-wrap"><div class="stock-bar-bg"><div class="stock-bar-fill ' + esc(barClass)+ '" style="width:' + esc(pct)+ '%"></div></div><span style="font-size:11px;color:var(--text-dim);min-width:30px;">' + esc(pct)+ '%</span></div></td><td>' + (p.prixAchat || 0).toLocaleString('fr') + ' €</td><td>' + (p.prixVente || 0).toLocaleString('fr') + ' €</td><td>' + badge + '</td><td><button class="action-btn action-btn-del" onclick="deleteProduit(\'' + p._id + '\')">🗑</button></td></tr>';
      }).join('');
    }

    // ── Tâches Kanban ──
    async function loadKanban() {
      var res = await apiFetch('/taches');
      var taches = (res && res.data) ? res.data : [];
      var cols = { todo:[], en_cours:[], termine:[] };
      taches.forEach(function(t) {
        if (cols[t.statut]) cols[t.statut].push(t);
        else if (t.statut === 'en_revue') cols['en_cours'].push(t);
      });
      var prioClass = { urgente:'prio-urgente', haute:'prio-haute', normale:'prio-normale', basse:'prio-basse' };
      var prioBadge = { urgente:'badge-red', haute:'badge-yellow', normale:'badge-blue', basse:'badge-gray' };
      function renderCards(arr) {
        if (!arr.length) return '<div style="color:var(--text-dim);font-size:12px;text-align:center;padding:20px 0;">Aucune tâche</div>';
        return arr.map(function(t) {
          var deadline = t.deadline ? new Date(t.deadline).toLocaleDateString('fr') : null;
          var advLabel = { todo:'▶ Démarrer', en_cours:'✓ Terminer', en_revue:'✓ Terminer' };
          var advBtn = advLabel[t.statut] ? '<button class="action-btn action-btn-adv" onclick="advanceTask(\'' + esc(t._id)+ '\',\'' + esc(t.statut)+ '\')">' + esc(advLabel[t.statut])+ '</button>' : '';
          var tData = JSON.stringify({id:t._id,titre:t.titre,priorite:t.priorite,statut:t.statut,deadline:t.deadline||''}).replace(/'/g,'&#39;');
          return '<div class="kanban-card ' + esc((prioClass[t.priorite] || ''))+ '"><div class="kanban-card-title">' + esc(t.titre)+ '</div><div class="kanban-card-meta"><span class="badge ' + esc((prioBadge[t.priorite] || 'badge-gray'))+ '" style="font-size:10px;">' + esc((t.priorite || 'normale'))+ '</span>' + (deadline ? '<span style="font-size:11px;color:var(--text-dim);">📅 ' + esc(deadline) + '</span>' : '') + '</div><div class="card-actions" style="margin-top:10px;">' + advBtn + '<button class="action-btn action-btn-edit" onclick=\'openEditTache(' + tData + ')\'>✏️</button><button class="action-btn action-btn-del" onclick="deleteTache(\'' + t._id + '\')">🗑</button></div></div>';
        }).join('');
      }
      ['todo','en_cours','termine'].forEach(function(key) {
        var el = document.getElementById('kanban-' + key);
        if (el) el.innerHTML = renderCards(cols[key]);
        var cnt = document.getElementById('count-' + key);
        if (cnt) cnt.textContent = cols[key].length;
      });
    }

    // ── IA Section ──
    async function loadIASection() {
      var depensesRes = await apiFetch('/ai/analyse-depenses');
      var reapproRes = await apiFetch('/ai/prevoir-reapprovisionnement');
      var depEl = document.getElementById('ia-depenses');
      var reapEl = document.getElementById('ia-reappro');
      if (depEl) depEl.textContent = (depensesRes && depensesRes.data && depensesRes.data.analyse) ? depensesRes.data.analyse : (depensesRes && depensesRes.message) || 'Configurer OpenAI API pour activer cette analyse.';
      if (reapEl) reapEl.textContent = (reapproRes && reapproRes.data && reapproRes.data.recommandations) ? JSON.stringify(reapproRes.data.recommandations).slice(0,200) : (reapproRes && reapproRes.message) || 'Configurer OpenAI API pour activer cette prévision.';
    }

    // ── AI Chat ──
    async function sendChat() {
      var input = document.getElementById('chat-input');
      var msg = input.value.trim();
      if (!msg) return;
      input.value = '';
      var btn = document.getElementById('chat-send-btn');
      btn.disabled = true;
      addChatMsg('user', msg);
      try {
        var res = await fetch(API + '/ai/rh-assistant', { method:'POST', headers:apiHeaders(), body:JSON.stringify({ question: msg }) });
        var data = await res.json();
        var reply = (data.data && data.data.reponse) ? data.data.reponse : (data.message) || 'Je ne peux pas répondre pour le moment. Vérifiez la configuration OpenAI.';
        addChatMsg('bot', reply);
      } catch(e) { addChatMsg('bot', 'Erreur de connexion au service IA.'); }
      btn.disabled = false;
    }
    function addChatMsg(role, text) {
      var msgs = document.getElementById('chat-messages');
      var div = document.createElement('div');
      div.className = 'chat-msg ' + role;
      div.innerHTML = (role === 'bot' ? '<div class="chat-avatar-bot">🤖</div>' : '') + '<div class="chat-bubble">' + text.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>';
      msgs.appendChild(div);
      msgs.scrollTop = msgs.scrollHeight;
    }

    // ── IA Tabs ──
    function switchIATab(tab) {
      ['chat','compta','rh'].forEach(function(t) {
        document.getElementById('ia-tab-' + t).classList.toggle('active', t === tab);
        document.getElementById('ia-panel-' + t).style.display = t === tab ? '' : 'none';
      });
    }

    // ── Comptabilité IA ──
    async function runAnomalies() {
      var btn = document.getElementById('btn-anomalies');
      var res_div = document.getElementById('anomalies-result');
      btn.disabled = true; btn.textContent = 'Analyse en cours...';
      res_div.innerHTML = '<div style="color:var(--text-dim);font-size:13px;">Analyse en cours, cela peut prendre quelques secondes...</div>';
      try {
        var res = await apiFetch('/ai/anomalies-comptables');
        if (res && res.success) {
          var d = res.data;
          var anomalies = d.anomalies || [];
          if (!anomalies.length) {
            res_div.innerHTML = '<div style="padding:20px;text-align:center;color:#34d399;font-size:14px;font-weight:600;">✅ Aucune anomalie détectée sur les 6 derniers mois.</div>';
          } else {
            var sevColors = { haute: '#f87171', moyenne: '#f59e0b', faible: '#34d399' };
            var html = anomalies.map(function(a) {
              var col = sevColors[a.severite] || '#a5b4fc';
              return '<div style="padding:14px;margin-bottom:10px;background:rgba(255,255,255,0.03);border-left:3px solid ' + esc(col)+ ';border-radius:0 10px 10px 0;">'
                + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">'
                + '<span style="font-size:11px;font-weight:700;color:' + esc(col)+ ';text-transform:uppercase;letter-spacing:0.06em;">' + esc((a.severite || 'info'))+ '</span>'
                + '<span style="font-size:13px;font-weight:600;color:var(--text);">' + esc((a.type || 'Anomalie'))+ '</span></div>'
                + '<div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">' + esc((a.description || ''))+ '</div>'
                + (a.recommandation ? '<div style="font-size:12px;color:var(--text-dim);">→ ' + esc(a.recommandation) + '</div>' : '')
                + '</div>';
            }).join('');
            if (d.resume) html += '<div style="margin-top:16px;padding:14px;background:rgba(99,102,241,0.08);border-radius:10px;font-size:13px;color:var(--text-muted);border:1px solid rgba(99,102,241,0.2);">' + esc(d.resume)+ '</div>';
            res_div.innerHTML = html;
          }
        } else { res_div.innerHTML = '<div style="color:#f87171;font-size:13px;">Erreur lors de l\'analyse. Vérifiez la configuration OPENAI_API_KEY.</div>'; }
      } catch(e) { res_div.innerHTML = '<div style="color:#f87171;font-size:13px;">Erreur réseau.</div>'; }
      btn.disabled = false; btn.textContent = 'Analyser';
    }

    async function runTresorerie() {
      var btn = document.getElementById('btn-tresorerie');
      var res_div = document.getElementById('tresorerie-result');
      btn.disabled = true; btn.textContent = 'Calcul en cours...';
      res_div.innerHTML = '<div style="color:var(--text-dim);font-size:13px;">Génération de la prévision, veuillez patienter...</div>';
      try {
        var res = await apiFetch('/ai/prevision-tresorerie');
        if (res && res.success) {
          var d = res.data;
          var fmtE = function(n) { return (n||0).toLocaleString('fr-FR', {minimumFractionDigits:0}) + ' €'; };
          var histHtml = '<div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">Historique (6 derniers mois)</div>'
            + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">'
            + '<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08);">'
            + '<th style="text-align:left;padding:8px 6px;color:var(--text-dim);">Mois</th>'
            + '<th style="text-align:right;padding:8px 6px;color:#34d399;">Encaissements</th>'
            + '<th style="text-align:right;padding:8px 6px;color:#f87171;">Charges</th>'
            + '<th style="text-align:right;padding:8px 6px;color:var(--text-muted);">Solde</th>'
            + '</tr></thead><tbody>'
            + (d.historique || []).map(function(h) {
              var sc = h.solde >= 0 ? '#34d399' : '#f87171';
              return '<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">'
                + '<td style="padding:8px 6px;color:var(--text);">' + esc(h.mois)+ '</td>'
                + '<td style="text-align:right;padding:8px 6px;color:#34d399;">' + esc(fmtE(h.encaissements))+ '</td>'
                + '<td style="text-align:right;padding:8px 6px;color:#f87171;">' + esc(fmtE(h.charges))+ '</td>'
                + '<td style="text-align:right;padding:8px 6px;font-weight:700;color:' + esc(sc)+ ';">' + esc(fmtE(h.solde))+ '</td>'
                + '</tr>';
            }).join('') + '</tbody></table></div>';

          var prevHtml = '';
          if (d.previsions && d.previsions.length) {
            prevHtml = '<div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin:20px 0 10px;">Prévisions IA (6 prochains mois)</div>'
              + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">'
              + '<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08);">'
              + '<th style="text-align:left;padding:8px 6px;color:var(--text-dim);">Mois</th>'
              + '<th style="text-align:right;padding:8px 6px;color:#34d399;">Encaissements</th>'
              + '<th style="text-align:right;padding:8px 6px;color:#f87171;">Charges</th>'
              + '<th style="text-align:right;padding:8px 6px;color:var(--text-muted);">Solde</th>'
              + '<th style="text-align:left;padding:8px 6px;color:var(--text-dim);">Commentaire</th>'
              + '</tr></thead><tbody>'
              + d.previsions.map(function(p) {
                var sc = (p.solde||0) >= 0 ? '#34d399' : '#f87171';
                return '<tr style="border-bottom:1px solid rgba(255,255,255,0.04);background:rgba(99,102,241,0.04);">'
                  + '<td style="padding:8px 6px;color:var(--text);font-weight:600;">' + esc(p.mois)+ '</td>'
                  + '<td style="text-align:right;padding:8px 6px;color:#34d399;">' + esc(fmtE(p.encaissements))+ '</td>'
                  + '<td style="text-align:right;padding:8px 6px;color:#f87171;">' + esc(fmtE(p.charges))+ '</td>'
                  + '<td style="text-align:right;padding:8px 6px;font-weight:700;color:' + esc(sc)+ ';">' + esc(fmtE(p.solde))+ '</td>'
                  + '<td style="padding:8px 6px;color:var(--text-dim);font-size:12px;">' + esc((p.commentaire || ''))+ '</td>'
                  + '</tr>';
              }).join('') + '</tbody></table></div>';
          }

          var alertHtml = '';
          if (d.alerte) alertHtml = '<div style="margin-top:14px;padding:12px 16px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:10px;font-size:13px;color:#f87171;">⚠️ ' + esc(d.alerte)+ '</div>';
          var tendanceHtml = d.tendance ? '<div style="margin-top:14px;padding:12px 16px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:10px;font-size:13px;color:var(--text-muted);">' + esc(d.tendance)+ '</div>' : '';

          res_div.innerHTML = histHtml + prevHtml + alertHtml + tendanceHtml;
        } else { res_div.innerHTML = '<div style="color:#f87171;font-size:13px;">Erreur lors de la prévision.</div>'; }
      } catch(e) { res_div.innerHTML = '<div style="color:#f87171;font-size:13px;">Erreur réseau.</div>'; }
      btn.disabled = false; btn.textContent = 'Prévoir';
    }

    async function runAnalyserFacture() {
      var texte = document.getElementById('facture-texte').value.trim();
      if (!texte) { showToast('Collez le texte de la facture', 'error'); return; }
      var btn = document.getElementById('btn-analyser-facture');
      var res_div = document.getElementById('facture-result');
      btn.disabled = true; btn.textContent = 'Analyse...';
      res_div.innerHTML = '<div style="color:var(--text-dim);font-size:13px;">Analyse en cours...</div>';
      try {
        var res = await fetch(API + '/ai/analyser-facture', { method:'POST', headers:apiHeaders(), body:JSON.stringify({ texte }) });
        var data = await res.json();
        if (data.success) {
          var d = data.data;
          var catLabels = { fournitures:'Fournitures & matières', transport:'Transport', restauration:'Restauration', logiciel:'Logiciels', marketing:'Marketing', loyer:'Loyer', salaires:'Salaires', autre:'Autres' };
          var fiabiliteColor = (d.fiabilite||0) >= 80 ? '#34d399' : (d.fiabilite||0) >= 50 ? '#f59e0b' : '#f87171';
          res_div.innerHTML = '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;">'
            + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:16px;">'
            + iaInfoRow('Fournisseur', d.fournisseur || '—')
            + iaInfoRow('Date', d.date || '—')
            + iaInfoRow('Montant HT', d.montantHT ? (d.montantHT.toLocaleString('fr-FR') + ' €') : '—')
            + iaInfoRow('TVA', d.tva ? d.tva + ' %' : '—')
            + iaInfoRow('Montant TTC', d.montantTTC ? (d.montantTTC.toLocaleString('fr-FR') + ' €') : '—')
            + iaInfoRow('Catégorie', catLabels[d.categorie] || d.categorie || '—')
            + iaInfoRow('Compte comptable', d.compteComptable || '—')
            + '<div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:10px;"><div style="font-size:11px;color:var(--text-dim);margin-bottom:4px;">Fiabilité IA</div><div style="font-size:16px;font-weight:800;color:' + esc(fiabiliteColor)+ ';">' + esc((d.fiabilite||0))+ ' %</div></div>'
            + '</div>'
            + (d.description ? '<div style="font-size:13px;color:var(--text-muted);margin-bottom:10px;"><strong style="color:var(--text);">Description :</strong> ' + esc(d.description) + '</div>' : '')
            + (d.anomalies && d.anomalies.length ? '<div style="padding:10px 14px;background:rgba(248,113,113,0.08);border-radius:8px;font-size:13px;color:#f87171;">⚠️ Anomalies : ' + d.anomalies.join(' — ') + '</div>' : '')
            + '</div>';
        } else { res_div.innerHTML = '<div style="color:#f87171;font-size:13px;">' + esc((data.message || 'Erreur'))+ '</div>'; }
      } catch(e) { res_div.innerHTML = '<div style="color:#f87171;font-size:13px;">Erreur réseau.</div>'; }
      btn.disabled = false; btn.textContent = 'Analyser la facture';
    }
    function iaInfoRow(label, val) {
      return '<div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:10px;"><div style="font-size:11px;color:var(--text-dim);margin-bottom:4px;">' + esc(label)+ '</div><div style="font-size:13px;font-weight:600;color:var(--text);">' + esc(val)+ '</div></div>';
    }

    // ── RH IA ──
    async function runScorerCV() {
      var cvTexte = document.getElementById('cv-texte').value.trim();
      var poste = document.getElementById('cv-poste').value.trim();
      var competences = document.getElementById('cv-competences').value.trim();
      if (!cvTexte || !poste) { showToast('Renseignez le poste et le CV', 'error'); return; }
      var btn = document.getElementById('btn-scorer-cv');
      var res_div = document.getElementById('cv-result');
      btn.disabled = true; btn.textContent = 'Analyse en cours...';
      res_div.innerHTML = '<div style="color:var(--text-dim);font-size:13px;">Scoring du candidat...</div>';
      try {
        var res = await fetch(API + '/ai/scorer-cv', { method:'POST', headers:apiHeaders(), body:JSON.stringify({ cvTexte, poste, competencesRequises: competences }) });
        var data = await res.json();
        if (data.success) {
          var d = data.data;
          var score = d.score || 0;
          var scoreColor = score >= 75 ? '#34d399' : score >= 50 ? '#f59e0b' : '#f87171';
          var recoColors = { embaucher:'#34d399', entretien:'#f59e0b', rejeter:'#f87171' };
          var recoLabels = { embaucher:'✅ À embaucher', entretien:'🔄 2ème entretien recommandé', rejeter:'❌ Non retenu' };
          var recoCol = recoColors[d.recommandation] || '#a5b4fc';

          var html = '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;">'
            + '<div style="display:flex;align-items:center;gap:20px;margin-bottom:20px;flex-wrap:wrap;">'
            + '<div style="text-align:center;"><div style="font-size:42px;font-weight:900;color:' + esc(scoreColor)+ ';line-height:1;">' + esc(score)+ '</div><div style="font-size:11px;color:var(--text-dim);margin-top:2px;">/ 100</div></div>'
            + '<div><div style="font-size:16px;font-weight:700;color:' + esc(recoCol)+ ';margin-bottom:4px;">' + esc((recoLabels[d.recommandation] || d.recommandation))+ '</div>'
            + '<div style="font-size:13px;color:var(--text-muted);">Niveau : <strong style="color:var(--text);">' + esc((d.niveau || '—'))+ '</strong></div></div>'
            + '</div>';

          if (d.resume) html += '<div style="font-size:13px;color:var(--text-muted);margin-bottom:16px;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;">' + esc(d.resume)+ '</div>';

          if (d.points_forts && d.points_forts.length) html += '<div style="margin-bottom:12px;"><div style="font-size:12px;font-weight:700;color:#34d399;margin-bottom:6px;">POINTS FORTS</div>' + d.points_forts.map(function(p) { return '<div style="font-size:13px;color:var(--text-muted);margin-bottom:3px;">✓ ' + p + '</div>'; }).join('') + '</div>';
          if (d.points_faibles && d.points_faibles.length) html += '<div style="margin-bottom:12px;"><div style="font-size:12px;font-weight:700;color:#f87171;margin-bottom:6px;">POINTS FAIBLES</div>' + d.points_faibles.map(function(p) { return '<div style="font-size:13px;color:var(--text-muted);margin-bottom:3px;">✗ ' + p + '</div>'; }).join('') + '</div>';

          if (d.competences && d.competences.length) {
            html += '<div style="margin-bottom:12px;"><div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px;">COMPÉTENCES ÉVALUÉES</div><div style="display:flex;flex-wrap:wrap;gap:8px;">'
              + d.competences.map(function(c) {
                var note = c.note || 0; var col = note >= 4 ? '#34d399' : note >= 3 ? '#f59e0b' : '#f87171';
                return '<div style="background:rgba(255,255,255,0.05);border-radius:6px;padding:6px 10px;font-size:12px;"><span style="color:var(--text);">' + esc(c.nom)+ '</span> <span style="color:' + esc(col)+ ';font-weight:700;">' + esc(note)+ '/5</span></div>';
              }).join('') + '</div></div>';
          }

          if (d.questions_entretien && d.questions_entretien.length) {
            html += '<div><div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:6px;">QUESTIONS D\'ENTRETIEN SUGGÉRÉES</div>'
              + d.questions_entretien.map(function(q, i) { return '<div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;padding:8px;background:rgba(255,255,255,0.03);border-radius:6px;">' + (i+1) + '. ' + q + '</div>'; }).join('') + '</div>';
          }

          html += '</div>';
          res_div.innerHTML = html;
        } else { res_div.innerHTML = '<div style="color:#f87171;font-size:13px;">' + esc((data.message || 'Erreur'))+ '</div>'; }
      } catch(e) { res_div.innerHTML = '<div style="color:#f87171;font-size:13px;">Erreur réseau.</div>'; }
      btn.disabled = false; btn.textContent = 'Scorer le candidat';
    }

    async function runGenererOffre() {
      var titre = document.getElementById('offre-titre').value.trim();
      if (!titre) { showToast('Le titre du poste est requis', 'error'); return; }
      var btn = document.getElementById('btn-generer-offre');
      var res_div = document.getElementById('offre-result');
      btn.disabled = true; btn.textContent = 'Génération en cours...';
      res_div.innerHTML = '<div style="color:var(--text-dim);font-size:13px;">Rédaction de l\'offre...</div>';
      try {
        var body = {
          titre,
          competences: document.getElementById('offre-competences').value,
          experience: document.getElementById('offre-experience').value,
          description: document.getElementById('offre-description').value,
          contrat: document.getElementById('offre-contrat').value,
          lieu: document.getElementById('offre-lieu').value
        };
        var res = await fetch(API + '/ai/generer-offre', { method:'POST', headers:apiHeaders(), body:JSON.stringify(body) });
        var data = await res.json();
        if (data.success) {
          var offre = data.data.offre;
          res_div.innerHTML = '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
            + '<div style="font-size:14px;font-weight:700;color:var(--text);">Offre générée</div>'
            + '<button onclick="copyOffre()" style="background:rgba(99,102,241,0.15);border:none;color:#a5b4fc;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;">Copier</button>'
            + '</div>'
            + '<pre id="offre-texte" style="white-space:pre-wrap;font-family:inherit;font-size:13px;color:var(--text-muted);line-height:1.7;margin:0;">' + offre.replace(/</g,'&lt;') + '</pre>'
            + '</div>';
        } else { res_div.innerHTML = '<div style="color:#f87171;font-size:13px;">' + esc((data.message || 'Erreur'))+ '</div>'; }
      } catch(e) { res_div.innerHTML = '<div style="color:#f87171;font-size:13px;">Erreur réseau.</div>'; }
      btn.disabled = false; btn.textContent = 'Générer l\'offre';
    }
    function copyOffre() {
      var el = document.getElementById('offre-texte');
      if (!el) return;
      navigator.clipboard.writeText(el.textContent).then(function() { showToast('Offre copiée dans le presse-papiers', 'success'); });
    }

    async function runResumerEntretien() {
      var notes = document.getElementById('entretien-notes').value.trim();
      if (!notes) { showToast('Renseignez vos notes d\'entretien', 'error'); return; }
      var btn = document.getElementById('btn-resumer-entretien');
      var res_div = document.getElementById('entretien-result');
      btn.disabled = true; btn.textContent = 'Analyse en cours...';
      res_div.innerHTML = '<div style="color:var(--text-dim);font-size:13px;">Analyse de l\'entretien...</div>';
      try {
        var res = await fetch(API + '/ai/resumer-entretien', { method:'POST', headers:apiHeaders(), body:JSON.stringify({
          notes,
          candidat: document.getElementById('entretien-candidat').value,
          poste: document.getElementById('entretien-poste').value
        }) });
        var data = await res.json();
        if (data.success) {
          var d = data.data;
          var recoColors = { embaucher:'#34d399', deuxieme_entretien:'#f59e0b', rejeter:'#f87171' };
          var recoLabels = { embaucher:'✅ À embaucher', deuxieme_entretien:'🔄 2ème entretien', rejeter:'❌ Non retenu' };
          var recoCol = recoColors[d.recommandation] || '#a5b4fc';

          var html = '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;">'
            + '<div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;flex-wrap:wrap;">'
            + '<div style="font-size:24px;font-weight:900;color:' + esc(recoCol)+ ';">' + esc((recoLabels[d.recommandation] || d.recommandation))+ '</div>'
            + (d.motivation ? '<div style="font-size:13px;color:var(--text-muted);">Motivation : <strong style="color:#a5b4fc;">' + esc(d.motivation) + '/5</strong></div>' : '')
            + '</div>';

          if (d.profil) html += '<div style="font-size:13px;color:var(--text-muted);margin-bottom:16px;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;">' + esc(d.profil)+ '</div>';

          if (d.points_forts && d.points_forts.length) html += '<div style="margin-bottom:12px;"><div style="font-size:12px;font-weight:700;color:#34d399;margin-bottom:6px;">POINTS FORTS</div>' + d.points_forts.map(function(p) { return '<div style="font-size:13px;color:var(--text-muted);margin-bottom:3px;">✓ ' + p + '</div>'; }).join('') + '</div>';
          if (d.points_faibles && d.points_faibles.length) html += '<div style="margin-bottom:12px;"><div style="font-size:12px;font-weight:700;color:#f87171;margin-bottom:6px;">POINTS FAIBLES</div>' + d.points_faibles.map(function(p) { return '<div style="font-size:13px;color:var(--text-muted);margin-bottom:3px;">✗ ' + p + '</div>'; }).join('') + '</div>';

          var skills = (d.competences_techniques || []).concat(d.competences_comportementales || []);
          if (skills.length) {
            html += '<div style="margin-bottom:12px;"><div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px;">ÉVALUATION</div><div style="display:flex;flex-wrap:wrap;gap:8px;">'
              + skills.map(function(c) {
                var note = c.note || 0; var col = note >= 4 ? '#34d399' : note >= 3 ? '#f59e0b' : '#f87171';
                return '<div style="background:rgba(255,255,255,0.05);border-radius:6px;padding:6px 10px;font-size:12px;"><span style="color:var(--text);">' + esc(c.nom)+ '</span> <span style="color:' + esc(col)+ ';font-weight:700;">' + esc(note)+ '/5</span></div>';
              }).join('') + '</div></div>';
          }

          if (d.justification) html += '<div style="font-size:13px;color:var(--text-dim);margin-bottom:12px;">Justification : ' + esc(d.justification)+ '</div>';

          if (d.prochaines_etapes && d.prochaines_etapes.length) {
            html += '<div><div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:6px;">PROCHAINES ÉTAPES</div>'
              + d.prochaines_etapes.map(function(e) { return '<div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">→ ' + e + '</div>'; }).join('') + '</div>';
          }

          html += '</div>';
          res_div.innerHTML = html;
        } else { res_div.innerHTML = '<div style="color:#f87171;font-size:13px;">' + esc((data.message || 'Erreur'))+ '</div>'; }
      } catch(e) { res_div.innerHTML = '<div style="color:#f87171;font-size:13px;">Erreur réseau.</div>'; }
      btn.disabled = false; btn.textContent = 'Analyser l\'entretien';
    }

    // ── Paramètres ──
    function loadParametres() {
      document.getElementById('set-prenom').value = user.prenom || '';
      document.getElementById('set-nom').value = user.nom || '';
      document.getElementById('set-email').value = user.email || '';
      loadCompanySettings();
      loadCompanyIdentity();
      loadExpertAccess();
      loadPortails();
      loadEquipe();
      loadAbonnement();
      loadAuditLog();
    }

    var NOVEXA_PLANS = [];
    var selectedPlanId = 'business';
    async function ensurePlans() {
      if (NOVEXA_PLANS.length) return;
      var r = await apiFetch('/abonnement/plans');
      NOVEXA_PLANS = (r && r.data && r.data.plans) ? r.data.plans : [];
    }
    function planById(id) { return NOVEXA_PLANS.find(function(p){ return p.id === id; }) || NOVEXA_PLANS[1] || NOVEXA_PLANS[0]; }

    async function loadAbonnement() {
      await ensurePlans();
      var res = await apiFetch('/abonnement');
      var loading = document.getElementById('sub-loading');
      var actif = document.getElementById('sub-actif');
      var inactif = document.getElementById('sub-inactif');
      var badge = document.getElementById('sub-badge');
      if (loading) loading.style.display = 'none';

      // Choix de plan (bloc inactif) — toujours (re)construit
      var choiceEl = document.getElementById('sub-plan-choice');
      if (choiceEl) {
        choiceEl.innerHTML = NOVEXA_PLANS.map(function(p) {
          return '<button class="btn-outline" onclick="choisirPlan(\'' + esc(p.id)+ '\')" id="planbtn-' + esc(p.id)+ '" style="flex:1;min-width:120px;">' + esc(p.nom)+ ' — ' + esc(p.prix)+ ' €' + (p.populaire ? ' ★' : '') + '</button>';
        }).join('');
      }

      if (!res || !res.success || !res.data) {
        if (inactif) inactif.style.display = '';
        if (badge) badge.innerHTML = '<span class="badge badge-gray">Inactif</span>';
        choisirPlan(selectedPlanId);
        return;
      }
      var sub = res.data;
      var plan = planById(sub.plan);
      // En-tête + montant dynamiques
      if (document.getElementById('sub-title')) document.getElementById('sub-title').textContent = '💳 Abonnement ' + (plan ? plan.nom : '');
      if (document.getElementById('sub-subtitle')) document.getElementById('sub-subtitle').textContent = (plan ? plan.prix + ' € / mois' : '') + ' — prélevé le 5 de chaque mois';
      if (document.getElementById('sub-amount')) document.getElementById('sub-amount').textContent = (sub.priceMonthly != null ? sub.priceMonthly : (plan ? plan.prix : 0)) + ' €';
      var badgePlan = document.getElementById('set-plan-badge');
      if (badgePlan) badgePlan.textContent = plan ? plan.nom : '—';
      selectedPlanId = sub.plan || 'business';
      choisirPlan(selectedPlanId);
      var statut = sub.statut;
      var isActif = statut === 'actif' || statut === 'active';
      var isEssai = statut === 'essai' || statut === 'trial';
      if (isActif || isEssai) {
        if (actif) actif.style.display = '';
        if (inactif) inactif.style.display = 'none';
        if (badge) badge.innerHTML = isActif
          ? '<span class="badge badge-green">Actif</span>'
          : '<span class="badge badge-yellow">Période d\'essai</span>';
        var nextDate = sub.nextBillingDate ? new Date(sub.nextBillingDate).toLocaleDateString('fr-FR', {day:'2-digit',month:'long',year:'numeric'}) : '—';
        var startDate = (sub.startDate || sub.dateDebut) ? new Date(sub.startDate || sub.dateDebut).toLocaleDateString('fr-FR', {day:'2-digit',month:'short',year:'numeric'}) : '—';
        if (document.getElementById('sub-next-date')) document.getElementById('sub-next-date').textContent = nextDate;
        if (document.getElementById('sub-start-date')) document.getElementById('sub-start-date').textContent = startDate;
        var history = sub.billingHistory || [];
        var histBody = document.getElementById('sub-history-body');
        if (histBody) {
          if (!history.length) {
            histBody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:16px;color:var(--text-dim);">Aucun paiement enregistré</td></tr>';
          } else {
            histBody.innerHTML = history.slice().reverse().map(function(h) {
              return '<tr><td>' + new Date(h.date).toLocaleDateString('fr-FR') + '</td><td style="font-weight:700;color:#a5b4fc;">' + (h.montant||0).toLocaleString('fr-FR') + ' €</td><td><span class="badge badge-green">' + esc((h.statut||'payé'))+ '</span></td></tr>';
            }).join('');
          }
        }
      } else {
        if (actif) actif.style.display = 'none';
        if (inactif) inactif.style.display = '';
        if (badge) badge.innerHTML = statut === 'annule'
          ? '<span class="badge badge-red">Annulé</span>'
          : '<span class="badge badge-gray">Inactif</span>';
      }
    }

    function choisirPlan(id) {
      selectedPlanId = id;
      var plan = planById(id);
      // met en évidence le bouton sélectionné
      NOVEXA_PLANS.forEach(function(p) {
        var b = document.getElementById('planbtn-' + p.id);
        if (b) b.className = (p.id === id) ? 'btn-primary' : 'btn-outline';
      });
      if (plan) {
        var nameEl = document.getElementById('sub-offer-name');
        if (nameEl) nameEl.textContent = plan.nom + ' — ' + plan.prix + ' € / mois';
        var featEl = document.getElementById('sub-offer-features');
        if (featEl) featEl.innerHTML = (plan.fonctionnalites || []).map(function(f){ return '<li>' + esc(f) + '</li>'; }).join('');
      }
    }

    async function activerAbonnement() {
      var email = document.getElementById('sub-email')?.value.trim();
      var errEl = document.getElementById('sub-error');
      var btn = document.getElementById('sub-activate-btn');
      if (errEl) errEl.textContent = '';
      if (!email) { if (errEl) errEl.textContent = 'Renseignez un email de facturation.'; return; }
      if (btn) { btn.disabled = true; btn.textContent = 'Activation...'; }
      try {
        var res = await fetch(API + '/abonnement/activer', {
          method: 'POST', headers: apiHeaders(),
          body: JSON.stringify({ emailFacturation: email, planId: selectedPlanId })
        });
        var data = await res.json();
        // L'abonnement n'est actif qu'une fois le paiement encaissé : on redirige vers
        // la page de paiement Stripe plutôt que d'annoncer une activation prématurée.
        if (data.success && data.data && data.data.checkoutUrl) {
          showToast('Redirection vers le paiement sécurisé...', 'success');
          window.location.href = data.data.checkoutUrl;
          return;
        }
        if (errEl) errEl.textContent = data.message || 'Erreur lors de l\'activation.';
      } catch(e) {
        if (errEl) errEl.textContent = 'Erreur réseau.';
      }
      if (btn) { btn.disabled = false; btn.textContent = '✅ Activer l\'abonnement'; }
    }

    async function annulerAbonnement() {
      if (!confirm('Confirmer l\'annulation de votre abonnement ?')) return;
      var res = await fetch(API + '/abonnement/annuler', { method: 'POST', headers: apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Abonnement annulé', 'success'); loadAbonnement(); }
      else showToast(data.message || 'Erreur', 'error');
    }
    async function saveProfile() {
      var prenom = document.getElementById('set-prenom').value.trim();
      var nom = document.getElementById('set-nom').value.trim();
      var email = document.getElementById('set-email').value.trim();
      var res = await fetch(API + '/auth/me', { method:'PUT', headers:apiHeaders(), body:JSON.stringify({ prenom, nom, email }) });
      var data = await res.json();
      if (data.success) {
        showToast('Profil mis à jour', 'success');
        var u = JSON.parse(localStorage.getItem('novexa_user') || '{}');
        Object.assign(u, { prenom, nom, email });
        localStorage.setItem('novexa_user', JSON.stringify(u));
      } else showToast(data.message || 'Erreur');
    }

    // ── Chart CA ──
    var caChart = null;
    async function loadChart() {
      var res = await apiFetch('/comptabilite/factures?statut=payee');
      var invoices = (res && res.data) ? res.data : [];
      var now = new Date();
      var months = [];
      for (var i = 5; i >= 0; i--) {
        var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ label: d.toLocaleString('fr', { month: 'short', year: '2-digit' }), year: d.getFullYear(), month: d.getMonth(), total: 0 });
      }
      invoices.forEach(function(inv) {
        if (!inv.createdAt) return;
        var d = new Date(inv.createdAt);
        var m = months.find(function(x) { return x.year === d.getFullYear() && x.month === d.getMonth(); });
        if (m) m.total += (inv.montantTTC || 0);
      });
      var ctx = document.getElementById('chart-ca');
      if (!ctx) return;
      if (caChart) caChart.destroy();
      caChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: months.map(function(m) { return m.label; }),
          datasets: [{
            label: 'CA (€)',
            data: months.map(function(m) { return m.total; }),
            backgroundColor: 'rgba(99,102,241,0.3)',
            borderColor: '#6366f1',
            borderWidth: 2,
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(c) { return c.raw.toLocaleString('fr') + ' €'; } } } },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { size: 11 } } },
            y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { size: 11 }, callback: function(v) { return v.toLocaleString('fr') + ' €'; } }, beginAtZero: true }
          }
        }
      });
    }

    // ── Notifications ──
    function toggleNotifications(e) {
      e.stopPropagation();
      var dd = document.getElementById('notif-dropdown');
      dd.classList.toggle('open');
    }
    document.addEventListener('click', function() {
      var dd = document.getElementById('notif-dropdown');
      if (dd) dd.classList.remove('open');
    });
    async function loadNotifications() {
      var [alertsRes, tasksRes] = await Promise.all([apiFetch('/stocks/alertes'), apiFetch('/taches')]);
      var items = [];
      if (alertsRes && alertsRes.data) alertsRes.data.forEach(function(a) { items.push({ title: '⚠️ Stock bas : ' + a.nom, text: a.quantite + ' ' + (a.unite || 'unité') + ' restant(s)' }); });
      if (tasksRes && tasksRes.data) {
        var late = tasksRes.data.filter(function(t) { return t.deadline && new Date(t.deadline) < new Date() && t.statut !== 'termine'; });
        late.forEach(function(t) { items.push({ title: '📅 Tâche en retard', text: t.titre }); });
      }
      var list = document.getElementById('notif-list');
      var cnt = document.getElementById('notif-count');
      var dot = document.getElementById('notif-dot');
      if (list) list.innerHTML = items.length ? items.map(function(i) { return '<div class="notif-item"><strong>' + esc(i.title) + '</strong>' + esc(i.text) + '</div>'; }).join('') : '<div class="notif-item">Tout est en ordre ✓</div>';
      if (cnt) cnt.textContent = items.length + ' nouvelle' + (items.length > 1 ? 's' : '');
      if (dot) dot.style.display = items.length ? 'block' : 'none';
    }

    // ── Search ──
    function handleSearch(query) {
      var q = query.toLowerCase().trim();
      if (!q) return;
      var rows = document.querySelectorAll('.section.active .data-table tbody tr, .section.active .kanban-card, .section.active .emp-card');
      rows.forEach(function(el) {
        var text = el.textContent.toLowerCase();
        el.style.display = text.includes(q) ? '' : 'none';
      });
    }

    // ── Create Product ──
    async function submitNouveauProduit() {
      clearModalError('np');
      var nom = document.getElementById('np-nom').value.trim();
      var sku = document.getElementById('np-sku').value.trim();
      if (!nom || !sku) return modalError('np', 'Nom et SKU sont requis.');
      setModalLoading('np-btn', true, 'Créer le produit');
      try {
        var res = await fetch(API + '/stocks/produits', { method:'POST', headers:apiHeaders(), body:JSON.stringify({
          nom, sku,
          categorie: document.getElementById('np-cat').value.trim(),
          unite: document.getElementById('np-unite').value.trim() || 'pièce',
          quantite: parseInt(document.getElementById('np-qty').value) || 0,
          seuilAlerte: parseInt(document.getElementById('np-seuil').value) || 5,
          prixAchat: parseFloat(document.getElementById('np-achat').value) || 0,
          prixVente: parseFloat(document.getElementById('np-vente').value) || 0
        }) });
        var data = await res.json();
        if (data.success) { closeModal('modal-nouveau-produit'); showToast('Produit créé', 'success'); loadStocksSection(); loadProductsForModal(); }
        else modalError('np', data.message || 'Erreur.');
      } catch(e) { modalError('np', 'Erreur réseau.'); }
      setModalLoading('np-btn', false, 'Créer le produit');
    }

    // ── Delete Product ──
    async function deleteProduit(id) {
      if (!confirm('Désactiver ce produit ?')) return;
      var res = await fetch(API + '/stocks/produits/' + id, { method:'DELETE', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Produit désactivé', 'success'); loadStocksSection(); }
      else showToast(data.message || 'Erreur');
    }

    // ── Fournisseurs ──
    async function loadFournisseurs() {
      var res = await apiFetch('/stocks/fournisseurs');
      var fournisseurs = (res && res.data) ? res.data : [];
      var tbody = document.getElementById('fournisseurs-body');
      if (!tbody) return;
      if (!fournisseurs.length) {
        tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="empty-state-icon">🏭</div><div class="empty-state-text">Aucun fournisseur</div></div></td></tr>';
        return;
      }
      tbody.innerHTML = fournisseurs.map(function(f) {
        return '<tr><td style="font-weight:600;">' + esc((f.nom||'—'))+ '</td><td style="color:var(--text-dim);">' + esc((f.email||'—'))+ '</td><td>' + esc((f.telephone||'—'))+ '</td><td><span class="badge badge-blue">' + esc((f.delaiLivraison||'?'))+ 'j</span></td><td><button class="btn-sm btn-del-sm" onclick="deleteFournisseur(\'' + f._id + '\')">🗑</button></td></tr>';
      }).join('');
    }
    async function deleteFournisseur(id) {
      if (!confirm('Supprimer ce fournisseur ?')) return;
      var res = await fetch(API + '/stocks/fournisseurs/' + id, { method:'DELETE', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Fournisseur supprimé', 'success'); loadFournisseurs(); }
      else showToast(data.message || 'Erreur', 'error');
    }
    async function submitFournisseur() {
      clearModalError('fo');
      var nom = document.getElementById('fo-nom').value.trim();
      if (!nom) return modalError('fo', 'Le nom est requis.');
      setModalLoading('fo-btn', true, 'Ajouter');
      try {
        var res = await fetch(API + '/stocks/fournisseurs', { method:'POST', headers:apiHeaders(), body:JSON.stringify({
          nom, email: document.getElementById('fo-email').value.trim(),
          telephone: document.getElementById('fo-tel').value.trim(),
          delaiLivraison: parseInt(document.getElementById('fo-delai').value) || 5
        }) });
        var data = await res.json();
        if (data.success) { closeModal('modal-fournisseur'); showToast('Fournisseur ajouté', 'success'); loadFournisseurs(); }
        else modalError('fo', data.message || 'Erreur.');
      } catch(e) { modalError('fo', 'Erreur réseau.'); }
      setModalLoading('fo-btn', false, 'Ajouter le fournisseur');
    }

    // ── Edit Task ──
    function openEditTache(t) {
      document.getElementById('et-id').value = t.id;
      document.getElementById('et-titre').value = t.titre;
      document.getElementById('et-priorite').value = t.priorite || 'normale';
      document.getElementById('et-statut').value = t.statut || 'todo';
      document.getElementById('et-deadline').value = t.deadline ? t.deadline.slice(0,10) : '';
      openModal('edit-tache');
    }
    async function submitEditTache() {
      clearModalError('et');
      var id = document.getElementById('et-id').value;
      var titre = document.getElementById('et-titre').value.trim();
      if (!titre) return modalError('et', 'Le titre est requis.');
      setModalLoading('et-btn', true, 'Sauvegarder');
      try {
        var res = await fetch(API + '/taches/' + id, { method:'PUT', headers:apiHeaders(), body:JSON.stringify({
          titre, priorite: document.getElementById('et-priorite').value,
          statut: document.getElementById('et-statut').value,
          deadline: document.getElementById('et-deadline').value || undefined
        }) });
        var data = await res.json();
        if (data.success) { closeModal('modal-edit-tache'); showToast('Tâche mise à jour', 'success'); loadKanban(); loadTasks(); }
        else modalError('et', data.message || 'Erreur.');
      } catch(e) { modalError('et', 'Erreur réseau.'); }
      setModalLoading('et-btn', false, 'Sauvegarder');
    }
    async function advanceTask(id, currentStatus) {
      var next = { todo: 'en_cours', en_cours: 'termine', en_revue: 'termine' };
      var nextStatus = next[currentStatus];
      if (!nextStatus) return;
      var res = await fetch(API + '/taches/' + id, { method:'PUT', headers:apiHeaders(), body:JSON.stringify({ statut: nextStatus }) });
      var data = await res.json();
      if (data.success) { showToast('Statut mis à jour', 'success'); loadKanban(); loadTasks(); }
      else showToast(data.message || 'Erreur');
    }
    async function deleteTache(id) {
      if (!confirm('Supprimer cette tâche ?')) return;
      var res = await fetch(API + '/taches/' + id, { method:'DELETE', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Tâche supprimée', 'success'); loadKanban(); loadTasks(); }
      else showToast(data.message || 'Erreur');
    }

    // ── Edit Employee ──
    function openEditEmploye(e) {
      document.getElementById('ee-id').value = e.id;
      document.getElementById('ee-prenom').value = e.prenom || '';
      document.getElementById('ee-nom').value = e.nom || '';
      document.getElementById('ee-poste').value = e.poste || '';
      document.getElementById('ee-dept').value = e.dept || '';
      document.getElementById('ee-salaire').value = e.salaire || '';
      document.getElementById('ee-statut').value = e.statut || 'actif';
      if (document.getElementById('ee-iban')) document.getElementById('ee-iban').value = e.iban || '';
      if (document.getElementById('ee-pas')) document.getElementById('ee-pas').value = ((e.tauxImpot || 0) * 100).toFixed(1).replace(/\.0$/, '');
      openModal('edit-employe');
    }
    async function submitEditEmploye() {
      clearModalError('ee');
      var id = document.getElementById('ee-id').value;
      var iban = (document.getElementById('ee-iban')?.value || '').trim().replace(/\s/g, '');
      setModalLoading('ee-btn', true, 'Sauvegarder');
      try {
        var res = await fetch(API + '/rh/employes/' + id, { method:'PUT', headers:apiHeaders(), body:JSON.stringify({
          prenom: document.getElementById('ee-prenom').value.trim(),
          nom: document.getElementById('ee-nom').value.trim(),
          poste: document.getElementById('ee-poste').value.trim(),
          departement: document.getElementById('ee-dept').value.trim(),
          salaireBase: parseFloat(document.getElementById('ee-salaire').value) || 0,
          statut: document.getElementById('ee-statut').value,
          iban: iban || undefined,
          tauxImpot: (parseFloat(document.getElementById('ee-pas')?.value) || 0) / 100
        }) });
        var data = await res.json();
        if (data.success) { closeModal('modal-edit-employe'); showToast('Employé mis à jour', 'success'); loadEmployes(); }
        else modalError('ee', data.message || 'Erreur.');
      } catch(e) { modalError('ee', 'Erreur réseau.'); }
      setModalLoading('ee-btn', false, 'Sauvegarder');
    }
    async function deleteEmploye(id) {
      if (!confirm('Désactiver cet employé ?')) return;
      var res = await fetch(API + '/rh/employes/' + id, { method:'DELETE', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Employé désactivé', 'success'); loadEmployes(); loadKPIs(); }
      else showToast(data.message || 'Erreur');
    }

    // ── Delete & Print Invoice ──
    async function deleteFacture(id) {
      if (!confirm('Supprimer cette facture définitivement ?')) return;
      var res = await fetch(API + '/comptabilite/factures/' + id, { method:'DELETE', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Facture supprimée', 'success'); loadAllInvoices(); loadKPIs(); }
      else showToast(data.message || 'Erreur');
    }

    async function printFacture(id) {
      var inv = allInvoicesData.find(function(i) { return i._id === id; });
      if (!inv) return;
      var clientName = (inv.client && inv.client.nom) ? inv.client.nom : '—';
      var clientEmail = (inv.client && inv.client.email) ? inv.client.email : '';
      var date = inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('fr') : '—';
      var lignes = (inv.lignes || []).map(function(l) {
        return '<tr><td>' + esc((l.description||'—'))+ '</td><td style="text-align:right">' + esc((l.quantite||1))+ '</td><td style="text-align:right">' + (l.prixUnitaire||0).toLocaleString('fr') + ' €</td><td style="text-align:right">' + (l.montantHT||0).toLocaleString('fr') + ' €</td></tr>';
      }).join('');
      var w = window.open('', '_blank', 'width=800,height=900');
      w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Facture ' + (inv.numero||'') + '</title><style>body{font-family:Arial,sans-serif;color:#111;padding:40px;max-width:700px;margin:auto}h1{color:#6366f1}table{width:100%;border-collapse:collapse;margin:20px 0}th{background:#f5f5f5;padding:10px;text-align:left}td{padding:10px;border-bottom:1px solid #eee}.total-row{font-weight:bold;font-size:16px}.footer{margin-top:40px;font-size:12px;color:#888}@media print{button{display:none}}</style></head><body>'
        + '<h1>Novexa by Nexulys</h1><hr>'
        + '<h2>FACTURE N° ' + esc((inv.numero||'—'))+ '</h2>'
        + '<p><strong>Client :</strong> ' + esc(clientName)+ esc((clientEmail ? ' &lt;' + clientEmail + '&gt;' : ''))+ '</p>'
        + '<p><strong>Date :</strong> ' + esc(date)+ '</p>'
        + '<table><thead><tr><th>Description</th><th style="text-align:right">Qté</th><th style="text-align:right">Prix unit.</th><th style="text-align:right">Montant HT</th></tr></thead><tbody>' + esc(lignes)+ '</tbody></table>'
        + '<table><tr><td><strong>Montant HT</strong></td><td style="text-align:right">' + (inv.montantHT||0).toLocaleString('fr') + ' €</td></tr>'
        + '<tr><td>TVA (' + esc((inv.tauxTVA||20))+ '%)</td><td style="text-align:right">' + (inv.montantTVA||0).toLocaleString('fr') + ' €</td></tr>'
        + '<tr class="total-row"><td><strong>TOTAL TTC</strong></td><td style="text-align:right"><strong>' + (inv.montantTTC||0).toLocaleString('fr') + ' €</strong></td></tr></table>'
        + '<div class="footer"><p>Novexa by Nexulys — Plateforme de gestion d\'entreprise</p></div>'
        + '<br><button onclick="window.print()" style="padding:10px 20px;background:#6366f1;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px">Imprimer</button>'
        + '</body></html>');
      w.document.close();
    }

    async function downloadFacturePDF(id) {
      showToast('Génération du PDF...', 'info');
      try {
        var response = await fetch(API + '/pdf/facture/' + id, { headers: apiHeaders() });
        if (!response.ok) { var d = await response.json(); showToast(d.message || 'Erreur PDF', 'error'); return; }
        var blob = await response.blob();
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a'); a.href = url; a.download = 'facture.pdf'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      } catch(e) { showToast('Erreur téléchargement PDF', 'error'); }
    }

    // ── Facture électronique (Factur-X XML) ──
    async function downloadFacturX(id) {
      showToast('Génération Factur-X...', 'info');
      try {
        var response = await fetch(API + '/pdf/facture/' + id + '/factur-x', { headers: apiHeaders() });
        if (!response.ok) { var d = await response.json(); showToast(d.message || 'Erreur Factur-X', 'error'); return; }
        var blob = await response.blob();
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a'); a.href = url; a.download = 'factur-x.xml'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      } catch(e) { showToast('Erreur Factur-X', 'error'); }
    }

    // ── Transmission via une PDP (facturation électronique) ──
    async function transmettrePDP(id) {
      if (!confirm('Transmettre cette facture via votre PDP (Plateforme de Dématérialisation Partenaire) ?')) return;
      showToast('Transmission en cours...', 'info');
      try {
        var res = await fetch(API + '/pdp/facture/' + id + '/transmettre', { method:'POST', headers: apiHeaders() });
        var data = await res.json();
        if (res.status === 503) {
          showToast('Aucune PDP configurée. Ajoutez PDP_BASE_URL et PDP_API_KEY côté serveur.', 'error');
          return;
        }
        if (!data.success) { showToast(data.message || 'Transmission refusée par la PDP', 'error'); return; }
        showToast('✅ Facture transmise — statut : ' + (data.data && data.data.statutLabel || 'déposée'), 'success');
        if (typeof loadAllInvoices === 'function') loadAllInvoices();
      } catch(e) { showToast('Erreur réseau lors de la transmission', 'error'); }
    }

    // ── Lien de paiement en ligne (Stripe) ──
    async function genererLienPaiement(id) {
      showToast('Création du lien de paiement...', 'info');
      var res = await fetch(API + '/comptabilite/factures/' + id + '/lien-paiement', { method:'POST', headers:apiHeaders() });
      var data = await res.json();
      if (data.success && data.data && data.data.url) {
        try { await navigator.clipboard.writeText(data.data.url); } catch(e) {}
        showToast('Lien de paiement copié dans le presse-papier', 'success');
        window.open(data.data.url, '_blank');
      } else {
        showToast(data.message || 'Paiement en ligne indisponible', 'error');
      }
    }

    // ── CSV Export ──
    function downloadCSV(content, filename) {
      var blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename; a.style.display = 'none';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    }

    function exportFacturesCSV() {
      if (!allInvoicesData.length) return showToast('Aucune facture à exporter');
      var labels = { payee:'Payée', envoyee:'Envoyée', brouillon:'Brouillon', en_retard:'En retard', annulee:'Annulée' };
      var rows = [['N° Facture','Client','Montant HT','TVA','Montant TTC','Statut','Date']];
      allInvoicesData.forEach(function(inv) {
        rows.push([
          inv.numero || '',
          (inv.client && inv.client.nom) ? inv.client.nom : '',
          inv.montantHT || 0, inv.montantTVA || 0, inv.montantTTC || 0,
          labels[inv.statut] || inv.statut || '',
          inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('fr') : ''
        ].map(function(c) { return '"' + String(c).replace(/"/g,'""') + '"'; }));
      });
      downloadCSV(rows.map(function(r) { return r.join(';'); }).join('\n'), 'factures.csv');
      showToast('Export CSV téléchargé', 'success');
    }

    var employesData = [];
    function exportEmployesCSV() {
      if (!employesData.length) return showToast('Aucun employé à exporter');
      var labels = { actif:'Actif', inactif:'Inactif', conge:'En congé', suspendu:'Suspendu' };
      var rows = [['Prénom','Nom','Email','Poste','Département','Salaire','Date embauche','Statut']];
      employesData.forEach(function(e) {
        rows.push([
          e.prenom||'', e.nom||'', e.email||'', e.poste||'', e.departement||'',
          e.salaireBase||0,
          e.dateEmbauche ? new Date(e.dateEmbauche).toLocaleDateString('fr') : '',
          labels[e.statut] || e.statut || ''
        ].map(function(c) { return '"' + String(c).replace(/"/g,'""') + '"'; }));
      });
      downloadCSV(rows.map(function(r) { return r.join(';'); }).join('\n'), 'employes.csv');
      showToast('Export CSV téléchargé', 'success');
    }

    // ── RH Section ──
    var currentRHTab = 'employes';

    function loadRHSection() {
      switchRHTab(currentRHTab);
    }

    function switchRHTab(tab) {
      currentRHTab = tab;
      ['employes','conges','paie','virements','avances','notes','contrats','planning'].forEach(function(t) {
        var panel = document.getElementById('rh-panel-' + t);
        var tabBtn = document.getElementById('rh-tab-' + t);
        var actions = document.getElementById('rh-actions-' + t);
        if (panel) panel.style.display = t === tab ? '' : 'none';
        if (tabBtn) tabBtn.classList.toggle('active', t === tab);
        if (actions) actions.style.display = t === tab ? 'flex' : 'none';
      });
      if (tab === 'employes') loadEmployes();
      else if (tab === 'conges') { loadConges(); loadEmployesForSelect('c-employe'); }
      else if (tab === 'paie') { loadPayslipsAll(); loadEmployesForSelect('p-employe', true); loadEmployesForSelect('paie-filter-employe', true, true); }
      else if (tab === 'virements') { initVirementPeriode(); loadVirements(); }
      else if (tab === 'avances') { loadAvances(); loadEmployesForSelect('avs-employe', true); }
      else if (tab === 'notes') loadNotesFrais();
      else if (tab === 'contrats') loadContrats();
      else if (tab === 'planning') initPlanning();
    }

    // Store employees in module-level var (overrides local)
    var _origLoadEmployes = loadEmployes;
    async function loadEmployes() {
      var res = await apiFetch('/rh/employes');
      employesData = (res && res.data) ? res.data : [];
      var grid = document.getElementById('employes-grid');
      if (!grid) return;
      if (employesData.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">👥</div><div class="empty-state-text">Aucun employé enregistré</div></div>';
        return;
      }
      var statutBadge = { actif:'badge-green', conge:'badge-yellow', inactif:'badge-red' };
      var statutLabel = { actif:'Actif', conge:'En congé', inactif:'Inactif' };
      grid.innerHTML = employesData.map(function(e) {
        var initials = ((e.prenom ? e.prenom[0] : '') + (e.nom ? e.nom[0] : '')).toUpperCase() || '?';
        var statut = e.statut || 'actif';
        var dateEmb = e.dateEmbauche ? new Date(e.dateEmbauche).toLocaleDateString('fr') : '—';
        var eData = JSON.stringify({id:e._id,prenom:e.prenom,nom:e.nom,poste:e.poste||'',dept:e.departement||'',salaire:e.salaireBase||0,statut,iban:e.iban||'',tauxImpot:e.tauxImpot||0}).replace(/'/g,'&#39;');
        return '<div class="emp-card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;"><div class="emp-avatar">' + esc(initials)+ '</div><span class="badge ' + esc((statutBadge[statut] || 'badge-gray'))+ '">' + esc((statutLabel[statut] || statut))+ '</span></div><div class="emp-name">' + esc(e.prenom)+ ' ' + esc(e.nom)+ '</div><div class="emp-role">' + esc((e.poste || '—'))+ '</div><div class="emp-meta"><div class="emp-meta-row"><span class="emp-meta-label">Département</span><span class="emp-meta-val">' + esc((e.departement || '—'))+ '</span></div><div class="emp-meta-row"><span class="emp-meta-label">Salaire</span><span class="emp-meta-val">' + (e.salaireBase || 0).toLocaleString('fr') + ' €</span></div><div class="emp-meta-row"><span class="emp-meta-label">Depuis</span><span class="emp-meta-val">' + esc(dateEmb)+ '</span></div></div><div class="card-actions"><button class="action-btn action-btn-edit" onclick=\'openEditEmploye(' + eData + ')\'>✏️ Modifier</button><button class="action-btn action-btn-del" onclick="deleteEmploye(\'' + e._id + '\')">🗑 Désactiver</button></div></div>';
      }).join('');
    }

    async function loadEmployesForSelect(selectId, withEmpty, withAll) {
      var select = document.getElementById(selectId);
      if (!select) return;
      var res = employesData.length ? { data: employesData } : await apiFetch('/rh/employes');
      var employes = (res && res.data) ? res.data : [];
      if (withAll) select.innerHTML = '<option value="">Tous les employés</option>';
      else if (withEmpty) select.innerHTML = '<option value="">Sélectionner un employé</option>';
      else select.innerHTML = '';
      employes.forEach(function(e) {
        esc(select.innerHTML)+= '<option value="' + esc(e._id)+ '">' + esc(e.prenom)+ ' ' + esc(e.nom)+ '</option>';
      });
    }

    // ── Congés ──
    async function loadConges() {
      var res = await apiFetch('/rh/conges');
      var leaves = (res && res.data) ? res.data : [];
      var tbody = document.getElementById('conges-body');
      if (!tbody) return;
      if (!leaves.length) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">🏖</div><div class="empty-state-text">Aucune demande de congé</div></div></td></tr>';
        return;
      }
      var typeLabels = { conge_paye:'Congé payé', rtt:'RTT', maladie:'Maladie', sans_solde:'Sans solde', maternite:'Maternité', paternite:'Paternité', autre:'Autre' };
      var statusMap = { en_attente:'badge-yellow', approuve:'badge-green', rejete:'badge-red', annule:'badge-gray' };
      var statusLabels = { en_attente:'En attente', approuve:'Approuvé', rejete:'Rejeté', annule:'Annulé' };
      tbody.innerHTML = leaves.map(function(l) {
        var empName = l.employee ? (l.employee.prenom + ' ' + l.employee.nom) : '—';
        var debut = l.dateDebut ? new Date(l.dateDebut).toLocaleDateString('fr') : '—';
        var fin = l.dateFin ? new Date(l.dateFin).toLocaleDateString('fr') : '—';
        var statut = l.statut || 'en_attente';
        var actions = statut === 'en_attente'
          ? '<button class="btn-sm btn-success-sm" onclick="updateLeave(\'' + esc(l._id)+ '\',\'approuve\')">✓</button> <button class="btn-sm btn-del-sm" onclick="updateLeave(\'' + l._id + '\',\'rejete\')">✗</button>'
          : '<span style="color:var(--text-dim);font-size:12px;">—</span>';
        return '<tr><td style="font-weight:600;">' + esc(empName)+ '</td><td>' + esc((typeLabels[l.type] || l.type || '—'))+ '</td><td>' + esc(debut)+ '</td><td>' + esc(fin)+ '</td><td style="text-align:center;font-weight:600;">' + esc((l.nombreJours || '—'))+ '</td><td><span class="badge ' + esc((statusMap[statut] || 'badge-gray'))+ '">' + esc((statusLabels[statut] || statut))+ '</span></td><td>' + actions + '</td></tr>';
      }).join('');
    }

    async function submitConge() {
      clearModalError('c');
      var employeeId = document.getElementById('c-employe').value;
      var type = document.getElementById('c-type').value;
      var debut = document.getElementById('c-debut').value;
      var fin = document.getElementById('c-fin').value;
      if (!employeeId) return modalError('c', 'Sélectionnez un employé.');
      if (!debut || !fin) return modalError('c', 'Les dates sont requises.');
      if (new Date(fin) < new Date(debut)) return modalError('c', 'La date de fin doit être après le début.');
      var nombreJours = Math.round((new Date(fin) - new Date(debut)) / (1000 * 60 * 60 * 24)) + 1;
      setModalLoading('c-btn', true, 'Soumettre la demande');
      try {
        var res = await fetch(API + '/rh/conges', { method:'POST', headers:apiHeaders(), body:JSON.stringify({
          employee: employeeId, type, dateDebut: debut, dateFin: fin, nombreJours,
          motif: document.getElementById('c-motif').value.trim() || undefined
        }) });
        var data = await res.json();
        if (data.success) { closeModal('modal-conge'); showToast('Demande de congé soumise', 'success'); loadConges(); }
        else modalError('c', data.message || 'Erreur.');
      } catch(e) { modalError('c', 'Erreur réseau.'); }
      setModalLoading('c-btn', false, 'Soumettre la demande');
    }

    async function updateLeave(id, statut) {
      var res = await fetch(API + '/rh/conges/' + id + '/statut', { method:'PUT', headers:apiHeaders(), body:JSON.stringify({ statut }) });
      var data = await res.json();
      if (data.success) { showToast(statut === 'approuve' ? 'Congé approuvé' : 'Congé rejeté', 'success'); loadConges(); }
      else showToast(data.message || 'Erreur');
    }

    // ── Fiches de paie ──
    async function loadPayslipsAll() {
      var employeeId = document.getElementById('paie-filter-employe') ? document.getElementById('paie-filter-employe').value : '';
      var url = employeeId ? '/rh/paie/' + employeeId : '/rh/paie/all';
      var res = await apiFetch(url);
      var tbody = document.getElementById('payslips-body');
      if (!tbody) return;
      if (!res || !res.data || !res.data.length) {
        tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">💰</div><div class="empty-state-text">Aucune fiche de paie générée</div></div></td></tr>';
        return;
      }
      var moisLabels = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
      var statMap = { brouillon:'badge-gray', valide:'badge-blue', paye:'badge-green' };
      var statLabels = { brouillon:'Brouillon', valide:'Validée', paye:'Payée' };
      tbody.innerHTML = res.data.map(function(p) {
        var empName = p.employee ? (typeof p.employee === 'object' ? p.employee.prenom + ' ' + p.employee.nom : '—') : '—';
        var statut = p.statut || 'brouillon';
        var actionBtn = statut === 'brouillon'
          ? '<button class="btn-sm" onclick="validerFiche(\'' + esc(p._id)+ '\')" style="background:rgba(99,102,241,.15);color:#a5b4fc;border:1px solid rgba(99,102,241,.3);padding:4px 10px;border-radius:6px;font-size:12px;cursor:pointer;">✅ Valider</button>'
          : (statut === 'valide' ? '<span style="font-size:12px;color:#34d399;">Prête au virement</span>' : '<span style="font-size:12px;color:#64748b;">Payée</span>');
        var printBtn = '<button class="btn-sm" onclick="downloadPayslipPDF(\'' + esc(p._id)+ '\')" title="Télécharger PDF" style="margin-left:4px;">📥 PDF</button><button class="btn-sm" onclick="printPayslip(\'' + p._id + '\')" title="Imprimer" style="margin-left:4px;">🖨</button>';
        return '<tr data-payslip-id="' + esc(p._id)+ '"><td style="font-weight:600;">' + esc(empName)+ '</td><td>' + esc((moisLabels[p.mois] || p.mois))+ ' ' + esc((p.annee || ''))+ '</td><td style="font-weight:700;">' + (p.salaireBrut || 0).toLocaleString('fr') + ' €</td><td style="font-weight:700;color:var(--green);">' + (p.salaireNet || 0).toLocaleString('fr') + ' €</td><td><span class="badge ' + esc((statMap[statut] || 'badge-gray'))+ '">' + esc((statLabels[statut] || statut))+ '</span></td><td>' + actionBtn + printBtn + '</td></tr>';
      }).join('');
    }

    async function validerFiche(id) {
      var res = await fetch(API + '/rh/paie/' + id + '/valider', { method: 'PUT', headers: apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Fiche validée — prête au virement', 'success'); loadPayslipsAll(); }
      else showToast(data.message || 'Erreur', 'error');
    }

    // ── Virements de salaire ──
    var _virReadyData = [];

    function initVirementPeriode() {
      var moisEl = document.getElementById('vir-mois');
      var anneeEl = document.getElementById('vir-annee');
      if (!moisEl || !anneeEl) return;
      var now = new Date();
      if (!moisEl.value) moisEl.value = now.getMonth() + 1;
      if (!anneeEl.value) anneeEl.value = now.getFullYear();
    }

    async function loadVirementsReady() {
      var mois = document.getElementById('vir-mois')?.value;
      var annee = document.getElementById('vir-annee')?.value;
      var tbody = document.getElementById('virements-ready-body');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-dim);">Chargement...</td></tr>';
      var res = await apiFetch('/rh/paie/virements/ready?mois=' + mois + '&annee=' + annee);
      _virReadyData = (res && res.data) ? res.data : [];
      var moisLabels = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
      if (!_virReadyData.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-dim);">Aucune fiche validée pour cette période.<br><small style="color:#475569;">Générez et validez des fiches de paie depuis l\'onglet Fiches de paie.</small></td></tr>';
        document.getElementById('vir-summary').style.display = 'none';
        return;
      }
      tbody.innerHTML = _virReadyData.map(function(p) {
        var empName = p.employee ? (p.employee.prenom + ' ' + p.employee.nom) : '—';
        var iban = p.employee?.iban;
        var ibanDisplay = iban
          ? '<span style="font-family:monospace;font-size:12px;">' + esc(iban.replace(/(.{4})/g, '$1 ').trim())+ '</span>'
          : '<span style="color:#f87171;font-size:12px;">⚠️ IBAN manquant</span>';
        return '<tr>'
          + '<td><input type="checkbox" class="vir-check" data-id="' + esc(p._id)+ '" onchange="updateVirSummary()" ' + (iban ? 'checked' : '') + ' /></td>'
          + '<td style="font-weight:600;">' + esc(empName)+ '</td>'
          + '<td>' + esc(ibanDisplay)+ '</td>'
          + '<td>' + esc((moisLabels[p.mois]||p.mois))+ ' ' + esc(p.annee)+ '</td>'
          + '<td style="font-weight:700;color:#34d399;">' + (p.salaireNet||0).toLocaleString('fr-FR',{minimumFractionDigits:2}) + ' €</td>'
          + '<td><span class="badge badge-blue">Validée</span></td>'
          + '</tr>';
      }).join('');
      updateVirSummary();
    }

    function toggleAllVirements(checked) {
      document.querySelectorAll('.vir-check').forEach(function(cb) { cb.checked = checked; });
      updateVirSummary();
    }

    function updateVirSummary() {
      var checked = Array.from(document.querySelectorAll('.vir-check:checked'));
      var summary = document.getElementById('vir-summary');
      var text = document.getElementById('vir-summary-text');
      if (!summary || !text) return;
      if (!checked.length) { summary.style.display = 'none'; return; }
      var ids = checked.map(function(cb) { return cb.getAttribute('data-id'); });
      var total = _virReadyData.filter(function(p) { return ids.includes(p._id); })
        .reduce(function(s,p) { return s + (p.salaireNet||0); }, 0);
      text.textContent = checked.length + ' salarié(s) sélectionné(s) — Total : ' + total.toLocaleString('fr-FR',{minimumFractionDigits:2}) + ' €';
      summary.style.display = 'flex';
    }

    async function effectuerVirements() {
      var checked = Array.from(document.querySelectorAll('.vir-check:checked'));
      if (!checked.length) { showToast('Aucune fiche sélectionnée', 'error'); return; }
      var payslipIds = checked.map(function(cb) { return cb.getAttribute('data-id'); });
      var mois = parseInt(document.getElementById('vir-mois')?.value);
      var annee = parseInt(document.getElementById('vir-annee')?.value);
      var btn = document.getElementById('vir-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'Traitement...'; }
      try {
        var res = await fetch(API + '/rh/paie/virements', {
          method: 'POST', headers: apiHeaders(),
          body: JSON.stringify({ payslipIds, mois, annee })
        });
        var data = await res.json();
        if (data.success) {
          showToast(data.message || 'Virements effectués', 'success');
          loadVirementsReady();
          loadVirements();
        } else {
          showToast(data.message || 'Erreur', 'error');
        }
      } catch(e) { showToast('Erreur réseau', 'error'); }
      if (btn) { btn.disabled = false; btn.textContent = '💸 Lancer les virements'; }
    }

    async function loadVirements() {
      var res = await apiFetch('/rh/paie/virements');
      var list = (res && res.data) ? res.data : [];
      var tbody = document.getElementById('virements-history-body');
      if (!tbody) return;
      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-dim);">Aucun virement effectué</td></tr>';
        return;
      }
      tbody.innerHTML = list.map(function(v) {
        var statut = v.statut === 'effectue' ? '<span class="badge badge-green">Effectué</span>' : '<span class="badge badge-yellow">Partiel</span>';
        var date = new Date(v.effectueLe).toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
        var lignesSansIban = (v.lignes||[]).filter(function(l){ return l.statut==='sans_iban'; });
        var detail = lignesSansIban.length
          ? '<span style="color:#f59e0b;font-size:12px;">⚠️ ' + esc(lignesSansIban.length)+ ' sans IBAN</span>'
          : '<span style="color:#34d399;font-size:12px;">✓ Complet</span>';
        return '<tr>'
          + '<td style="font-weight:600;">' + esc((v.periode||'—'))+ '</td>'
          + '<td style="text-align:center;">' + esc((v.nbEmployes||0))+ '</td>'
          + '<td style="font-weight:700;color:#a5b4fc;">' + (v.montantTotal||0).toLocaleString('fr-FR',{minimumFractionDigits:2}) + ' €</td>'
          + '<td>' + statut + '</td>'
          + '<td style="color:var(--text-muted);font-size:12px;">' + esc(date)+ '</td>'
          + '<td>' + esc(detail)+ '</td>'
          + '</tr>';
      }).join('');
    }

    // ── Autres éléments de paie (dynamique) ──
    function addPaieElement(libelle, montant) {
      var container = document.getElementById('p-elements');
      var row = document.createElement('div');
      row.className = 'paie-element-row';
      row.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;align-items:center;';
      row.innerHTML =
        '<input class="modal-input p-el-lib" type="text" placeholder="Libellé" value="' + (libelle || '').replace(/"/g, '&quot;') + '" style="flex:1;" />' +
        '<input class="modal-input p-el-mnt" type="number" step="0.01" placeholder="€" value="' + esc((montant || ''))+ '" style="width:90px;" />' +
        '<button type="button" onclick="this.parentNode.remove()" style="background:rgba(239,68,68,.15);color:#f87171;border:none;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:16px;">✕</button>';
      container.appendChild(row);
    }

    function collectPaieElements() {
      var rows = document.querySelectorAll('#p-elements .paie-element-row');
      var out = [];
      rows.forEach(function(r) {
        var lib = r.querySelector('.p-el-lib').value.trim();
        var mnt = parseFloat(r.querySelector('.p-el-mnt').value);
        if (lib && !isNaN(mnt)) out.push({ libelle: lib, montant: mnt });
      });
      return out;
    }

    async function submitPaie() {
      clearModalError('p');
      var employeeId = document.getElementById('p-employe').value;
      var mois = parseInt(document.getElementById('p-mois').value);
      var annee = parseInt(document.getElementById('p-annee').value);
      if (!employeeId) return modalError('p', 'Sélectionnez un employé.');
      if (!annee || annee < 2020) return modalError('p', 'Année invalide.');
      setModalLoading('p-btn', true, 'Générer la fiche');
      try {
        var res = await fetch(API + '/rh/paie/generer', { method:'POST', headers:apiHeaders(), body:JSON.stringify({
          employeeId, mois, annee,
          heuresSup: parseFloat(document.getElementById('p-heures').value) || 0,
          primes: parseFloat(document.getElementById('p-primes').value) || 0,
          autresElements: collectPaieElements()
        }) });
        var data = await res.json();
        if (data.success) {
          closeModal('modal-paie');
          document.getElementById('p-elements').innerHTML = '';
          document.getElementById('p-heures').value = '0';
          document.getElementById('p-primes').value = '0';
          showToast('Fiche de paie générée — Net: ' + (data.data.salaireNet || 0).toLocaleString('fr') + ' €', 'success');
          loadPayslipsAll();
        } else modalError('p', data.message || 'Erreur.');
      } catch(e) { modalError('p', 'Erreur réseau.'); }
      setModalLoading('p-btn', false, 'Générer la fiche');
    }

    // ── Alertes proactives ──
    async function loadAlertesProactives() {
      var res = await apiFetch('/comptabilite/alertes-proactives');
      var alertes = (res && res.data) ? res.data : [];
      var container = document.getElementById('alertes-container');
      if (!alertes.length || !container) return;
      var colMap = { danger: '#f87171', warning: '#f59e0b', info: '#a5b4fc' };
      var bgMap = { danger: 'rgba(248,113,113,.08)', warning: 'rgba(245,158,11,.08)', info: 'rgba(99,102,241,.08)' };
      container.innerHTML = alertes.map(function(a) {
        return '<div onclick="switchSection(\'' + esc((a.action||'dashboard'))+ '\')" style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:' + esc(bgMap[a.type])+ ';border:1px solid ' + esc(colMap[a.type])+ '33;border-radius:10px;margin-bottom:8px;cursor:pointer;">'
          + '<span style="font-size:20px;">' + esc(a.icon)+ '</span>'
          + '<div><div style="font-size:13px;font-weight:600;color:' + esc(colMap[a.type])+ ';">' + esc(a.titre)+ '</div><div style="font-size:12px;color:var(--text-muted);">' + esc(a.message)+ '</div></div>'
          + '</div>';
      }).join('');
      container.style.display = '';
    }

    // ── SECTION_LOADERS updates ──
    // (handled inside SECTION_LOADERS object below — this replaces the existing one)

    // ── Devis ──
    async function loadDevis() {
      var res = await apiFetch('/devis');
      var list = (res && res.data) ? res.data : [];
      var tbody = document.getElementById('devis-body');
      if (!tbody) return;
      var statMap = { brouillon:'badge-gray', envoye:'badge-yellow', accepte:'badge-green', refuse:'badge-red', expire:'badge-gray' };
      var statLabel = { brouillon:'Brouillon', envoye:'Envoyé', accepte:'Accepté', refuse:'Refusé', expire:'Expiré' };
      var devises = { EUR:'€', USD:'$', GBP:'£', CHF:'CHF' };
      if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-dim);">Aucun devis</td></tr>'; return; }
      tbody.innerHTML = list.map(function(d) {
        var exp = d.dateValidite ? new Date(d.dateValidite).toLocaleDateString('fr') : '—';
        var symb = devises[d.devise] || '€';
        var canConvert = d.statut === 'accepte' && !d.factureId;
        var actions = '<button class="btn-sm" onclick="envoyerDevis(\'' + esc(d._id)+ '\')" style="margin-right:4px;" title="Envoyer par email">📧</button>'
          + (canConvert ? '<button class="btn-sm btn-success-sm" onclick="convertirDevis(\'' + d._id + '\')" style="margin-right:4px;" title="Convertir en facture">↗ Facture</button>' : '')
          + '<button class="btn-sm btn-del-sm" onclick="deleteDevis(\'' + d._id + '\')">🗑</button>';
        return '<tr><td style="font-weight:600;color:#a5b4fc;">' + esc(d.numero)+ '</td><td>' + esc((d.client?.nom||'—'))+ '</td><td style="font-weight:700;">' + (d.montantTTC||0).toLocaleString('fr') + ' ' + esc(symb)+ '</td><td>' + esc((d.devise||'EUR'))+ '</td><td><span class="badge ' + esc((statMap[d.statut]||'badge-gray'))+ '">' + esc((statLabel[d.statut]||d.statut))+ '</span></td><td style="color:var(--text-dim);">' + esc(exp)+ '</td><td>' + actions + '</td></tr>';
      }).join('');
    }
    async function submitDevis() {
      clearModalError('dv');
      var client = document.getElementById('dv-client').value.trim();
      var prix = parseFloat(document.getElementById('dv-prix').value) || 0;
      var desc = document.getElementById('dv-desc').value.trim();
      if (!client) return modalError('dv', 'Le nom du client est requis.');
      if (!desc || prix <= 0) return modalError('dv', 'Description et prix requis.');
      var qty = parseFloat(document.getElementById('dv-qty').value) || 1;
      var tva = parseFloat(document.getElementById('dv-tva').value) || 20;
      var montantHT = qty * prix;
      var validite = parseInt(document.getElementById('dv-validite').value) || 30;
      var dateValidite = new Date(Date.now() + validite * 86400000).toISOString();
      setModalLoading('dv-btn', true, 'Créer le devis');
      try {
        var res = await fetch(API + '/devis', { method:'POST', headers:apiHeaders(), body:JSON.stringify({
          client: { nom: client, email: document.getElementById('dv-email').value.trim() },
          lignes: [{ description: desc, quantite: qty, prixUnitaire: prix, tva, montantHT }],
          notes: document.getElementById('dv-notes').value.trim(),
          devise: document.getElementById('dv-devise').value,
          dateValidite
        }) });
        var data = await res.json();
        if (data.success) { closeModal('modal-devis'); showToast('Devis créé', 'success'); loadDevis(); }
        else modalError('dv', data.message || 'Erreur.');
      } catch(e) { modalError('dv', 'Erreur réseau.'); }
      setModalLoading('dv-btn', false, 'Créer le devis');
    }
    async function envoyerDevis(id) {
      var res = await fetch(API + '/devis/' + id + '/envoyer', { method:'POST', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) {
        showToast('Devis envoyé par email', 'success');
        if (data.data?.url) copyToClipboard(data.data.url);
        loadDevis();
      } else showToast(data.message || 'Erreur', 'error');
    }
    async function convertirDevis(id) {
      if (!confirm('Convertir ce devis en facture ?')) return;
      var res = await fetch(API + '/devis/' + id + '/convertir', { method:'POST', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Facture créée depuis le devis', 'success'); loadDevis(); loadAllInvoices(); }
      else showToast(data.message || 'Erreur', 'error');
    }
    async function deleteDevis(id) {
      if (!confirm('Supprimer ce devis ?')) return;
      var res = await fetch(API + '/devis/' + id, { method:'DELETE', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Devis supprimé', 'success'); loadDevis(); }
      else showToast(data.message || 'Erreur', 'error');
    }

    // ── Déclaration TVA & FEC ──
    function initTVAAnne() {
      var sel = document.getElementById('tva-annee');
      if (!sel || sel.options.length > 1) return;
      var y = new Date().getFullYear();
      for (var i = y; i >= y - 4; i--) { var o = document.createElement('option'); o.value = i; o.textContent = i; sel.appendChild(o); }
    }
    async function loadDeclarationTVA() {
      var annee = document.getElementById('tva-annee')?.value || new Date().getFullYear();
      var mois = document.getElementById('tva-mois')?.value || '';
      var url = '/comptabilite/declaration-tva?annee=' + annee + (mois ? '&mois=' + mois : '');
      var res = await apiFetch(url);
      var el = document.getElementById('tva-result');
      if (!res || !res.success || !el) return;
      var d = res.data;
      var soldeColor = d.soldeTVA >= 0 ? '#f87171' : '#34d399';
      var soldeLabel = d.aRembourser ? 'TVA à récupérer' : 'TVA à reverser';
      el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:20px;">'
        + kpiCard('CA HT', d.caHT.toLocaleString('fr') + ' €', '#a5b4fc')
        + kpiCard('TVA collectée', d.tvaCollectee.toLocaleString('fr') + ' €', '#f87171')
        + kpiCard('TVA déductible', d.tvaDeductible.toLocaleString('fr') + ' €', '#34d399')
        + kpiCard(soldeLabel, Math.abs(d.soldeTVA).toLocaleString('fr') + ' €', soldeColor)
        + '</div>'
        + '<div style="padding:16px;background:rgba(255,255,255,.03);border-radius:10px;font-size:13px;color:var(--text-muted);">Période : <strong style="color:var(--text);">' + esc(d.periode)+ '</strong> — ' + esc(d.nbFactures)+ ' factures analysées</div>';
    }
    function kpiCard(label, val, color) {
      return '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:16px;text-align:center;"><div style="font-size:20px;font-weight:800;color:' + esc(color)+ ';">' + esc(val)+ '</div><div style="font-size:12px;color:var(--text-dim);margin-top:4px;">' + esc(label)+ '</div></div>';
    }
    async function exportFEC() {
      var annee = document.getElementById('tva-annee')?.value || new Date().getFullYear();
      window.open(API + '/comptabilite/export-fec?annee=' + annee, '_blank');
    }

    // ── Catalogue ──
    async function loadCatalogue() {
      var res = await apiFetch('/catalogue');
      var list = (res && res.data) ? res.data : [];
      var tbody = document.getElementById('catalogue-body');
      if (!tbody) return;
      if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-dim);">Aucun article dans le catalogue</td></tr>'; return; }
      var catLabel = { service:'Service', produit:'Produit', abonnement:'Abonnement', autre:'Autre' };
      tbody.innerHTML = list.map(function(c) {
        return '<tr><td style="font-weight:600;">' + esc(c.nom)+ '</td><td style="color:var(--text-dim);">' + esc((c.reference||'—'))+ '</td><td style="font-weight:700;color:#a5b4fc;">' + (c.prixUnitaire||0).toLocaleString('fr') + ' €</td><td>' + esc((c.tva||20))+ ' %</td><td>' + esc((c.unite||'unité'))+ '</td><td><span class="badge badge-gray">' + esc((catLabel[c.categorie]||c.categorie))+ '</span></td><td><button class="btn-sm btn-del-sm" onclick="deleteCatalogueItem(\'' + c._id + '\')">🗑</button></td></tr>';
      }).join('');
    }
    async function submitCatalogueItem() {
      clearModalError('cat');
      var nom = document.getElementById('cat-nom').value.trim();
      var prix = parseFloat(document.getElementById('cat-prix').value);
      if (!nom) return modalError('cat', 'Le nom est requis.');
      if (isNaN(prix)) return modalError('cat', 'Le prix est requis.');
      setModalLoading('cat-btn', true, 'Ajouter');
      try {
        var res = await fetch(API + '/catalogue', { method:'POST', headers:apiHeaders(), body:JSON.stringify({
          nom, prixUnitaire: prix,
          reference: document.getElementById('cat-ref').value.trim(),
          tva: parseFloat(document.getElementById('cat-tva').value) || 20,
          unite: document.getElementById('cat-unite').value.trim() || 'unité',
          categorie: document.getElementById('cat-categorie').value,
          description: document.getElementById('cat-desc').value.trim()
        }) });
        var data = await res.json();
        if (data.success) { closeModal('modal-catalogue'); showToast('Article ajouté', 'success'); loadCatalogue(); }
        else modalError('cat', data.message || 'Erreur.');
      } catch(e) { modalError('cat', 'Erreur réseau.'); }
      setModalLoading('cat-btn', false, 'Ajouter au catalogue');
    }
    async function deleteCatalogueItem(id) {
      if (!confirm('Supprimer cet article ?')) return;
      var res = await fetch(API + '/catalogue/' + id, { method:'DELETE', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Article supprimé', 'success'); loadCatalogue(); }
    }

    // ── CRM ──
    async function loadCRM() {
      var [prosRes, kpiRes] = await Promise.all([apiFetch('/crm'), apiFetch('/crm/kpis')]);
      var prospects = (prosRes && prosRes.data) ? prosRes.data : [];
      var pipeline = (prosRes && prosRes.pipeline) ? prosRes.pipeline : [];
      var kpis = (kpiRes && kpiRes.data) ? kpiRes.data : {};
      var kpiEl = document.getElementById('crm-kpis');
      if (kpiEl) kpiEl.innerHTML = [
        ['Prospects total', kpis.total || 0, '#a5b4fc'],
        ['Deals gagnés', kpis.gagnes || 0, '#34d399'],
        ['Taux de conversion', (kpis.tauxConversion || 0) + ' %', '#f59e0b'],
        ['Valeur pipeline', (kpis.valeurPipeline || 0).toLocaleString('fr') + ' €', '#6366f1']
      ].map(function(k) { return kpiCard(k[0], k[1], k[2]); }).join('');
      var statLabels = { prospect:'🔵 Prospect', contact:'📞 Contact', negociation:'🤝 Négo.', gagne:'✅ Gagné', perdu:'❌ Perdu' };
      var pipelineEl = document.getElementById('crm-pipeline');
      if (pipelineEl) {
        pipelineEl.innerHTML = pipeline.map(function(col) {
          var cards = prospects.filter(function(p) { return p.statut === col.statut; });
          return '<div style="background:rgba(255,255,255,.02);border-radius:10px;padding:12px;">'
            + '<div style="font-size:11px;font-weight:700;color:var(--text-dim);text-transform:uppercase;margin-bottom:10px;">' + esc((statLabels[col.statut]||col.statut))+ ' <span style="color:var(--text-muted);">(' + esc(col.count)+ ')</span></div>'
            + cards.map(function(p) { return '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:10px;margin-bottom:8px;cursor:pointer;" title="Cliquer pour faire avancer le prospect" onclick="updateProspectStatut(\'' + p._id + '\',\'' + p.statut + '\')">'
              + '<div style="font-size:13px;font-weight:600;margin-bottom:2px;">' + esc(p.nom)+ '</div>'
              + '<div style="font-size:11px;color:var(--text-dim);">' + esc((p.entreprise||''))+ '</div>'
              + (p.valeurEstimee ? '<div style="font-size:12px;color:#a5b4fc;margin-top:4px;font-weight:600;">' + esc(p.valeurEstimee.toLocaleString('fr')) + ' €</div>' : '')
              + '</div>'; }).join('')
            + '</div>';
        }).join('');
      }
      var tbody = document.getElementById('crm-body');
      if (!tbody) return;
      var badgeMap = { prospect:'badge-blue', contact:'badge-yellow', negociation:'badge-orange', gagne:'badge-green', perdu:'badge-red' };
      var srcLabel = { inbound:'Inbound', referral:'Référence', cold:'Cold', reseaux:'Réseaux', autre:'Autre' };
      if (!prospects.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-dim);">Aucun prospect</td></tr>'; return; }
      tbody.innerHTML = prospects.map(function(p) {
        return '<tr><td style="font-weight:600;">' + esc(p.nom)+ '</td><td style="color:var(--text-dim);">' + esc((p.entreprise||'—'))+ '</td>'
          + '<td><span class="badge ' + esc((badgeMap[p.statut]||'badge-gray'))+ '">' + esc((statLabels[p.statut]||p.statut))+ '</span></td>'
          + '<td style="font-weight:700;color:#a5b4fc;">' + (p.valeurEstimee||0).toLocaleString('fr') + ' €</td>'
          + '<td><div style="display:flex;align-items:center;gap:8px;"><div style="flex:1;background:rgba(255,255,255,.06);border-radius:4px;height:6px;"><div style="background:#6366f1;width:' + esc((p.probabilite||0))+ '%;height:6px;border-radius:4px;"></div></div><span style="font-size:12px;color:var(--text-dim);">' + esc((p.probabilite||0))+ '%</span></div></td>'
          + '<td style="color:var(--text-dim);">' + esc((srcLabel[p.source]||p.source||'—'))+ '</td>'
          + '<td><select class="btn-sm" style="background:rgba(255,255,255,.06);border:none;color:var(--text);font-size:12px;padding:4px 8px;border-radius:6px;cursor:pointer;" onchange="updateProspectStatutDirect(\'' + p._id + '\',this.value)">'
          + ['prospect','contact','negociation','gagne','perdu'].map(function(s) { return '<option value="' + s + '"' + (p.statut===s?' selected':'') + '>' + (statLabels[s]||s) + '</option>'; }).join('')
          + '</select> <button class="btn-sm btn-del-sm" onclick="deleteProspect(\'' + p._id + '\')">🗑</button></td></tr>';
      }).join('');
    }
    async function submitProspect() {
      clearModalError('pr');
      var nom = document.getElementById('pr-nom').value.trim();
      if (!nom) return modalError('pr', 'Le nom est requis.');
      setModalLoading('pr-btn', true, 'Ajouter');
      try {
        var res = await fetch(API + '/crm', { method:'POST', headers:apiHeaders(), body:JSON.stringify({
          nom, entreprise: document.getElementById('pr-entreprise').value.trim(),
          email: document.getElementById('pr-email').value.trim(),
          telephone: document.getElementById('pr-tel').value.trim(),
          valeurEstimee: parseFloat(document.getElementById('pr-valeur').value) || 0,
          probabilite: parseInt(document.getElementById('pr-proba').value) || 50,
          statut: document.getElementById('pr-statut').value,
          source: document.getElementById('pr-source').value,
          notes: document.getElementById('pr-notes').value.trim()
        }) });
        var data = await res.json();
        if (data.success) { closeModal('modal-prospect'); showToast('Prospect ajouté', 'success'); loadCRM(); }
        else modalError('pr', data.message || 'Erreur.');
      } catch(e) { modalError('pr', 'Erreur réseau.'); }
      setModalLoading('pr-btn', false, 'Ajouter le prospect');
    }
    async function updateProspectStatutDirect(id, statut) {
      var res = await fetch(API + '/crm/' + id, { method:'PUT', headers:apiHeaders(), body:JSON.stringify({ statut }) });
      var data = await res.json();
      if (data.success) { showToast('Statut mis à jour', 'success'); loadCRM(); }
    }
    // Clic sur une carte prospect → avance au stade suivant du pipeline
    async function updateProspectStatut(id, current) {
      var ordre = ['prospect', 'contact', 'negociation', 'gagne'];
      var i = ordre.indexOf(current);
      var next = (i >= 0 && i < ordre.length - 1) ? ordre[i + 1] : 'prospect';
      await updateProspectStatutDirect(id, next);
    }
    async function deleteProspect(id) {
      if (!confirm('Supprimer ce prospect ?')) return;
      var res = await fetch(API + '/crm/' + id, { method:'DELETE', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Prospect supprimé', 'success'); loadCRM(); }
    }

    // ── Projets & Temps ──
    async function loadProjets() {
      var res = await apiFetch('/projets');
      var list = (res && res.data) ? res.data : [];
      var el = document.getElementById('projets-list');
      var statutColors = { en_cours:'#a5b4fc', en_pause:'#f59e0b', termine:'#34d399', annule:'#94a3b8' };
      var statutLabels = { en_cours:'En cours', en_pause:'En pause', termine:'Terminé', annule:'Annulé' };
      if (!list.length) { if(el) el.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:40px;grid-column:1/-1;">Aucun projet — créez votre premier projet</div>'; return; }
      if (el) el.innerHTML = list.map(function(p) {
        var rentColor = p.rentabilite ? (p.rentabilite >= 80 ? '#34d399' : p.rentabilite >= 50 ? '#f59e0b' : '#f87171') : 'var(--text-dim)';
        return '<div class="card" style="padding:0;">'
          + '<div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">'
          + '<span style="font-weight:700;">' + esc(p.nom)+ '</span>'
          + '<span style="font-size:11px;font-weight:600;color:' + esc((statutColors[p.statut]||'#94a3b8'))+ ';">' + esc((statutLabels[p.statut]||p.statut))+ '</span>'
          + '</div><div class="card-body" style="padding:16px;">'
          + (p.client ? '<div style="font-size:12px;color:var(--text-dim);margin-bottom:10px;">Client : ' + esc(p.client) + '</div>' : '')
          + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px;">'
          + '<div><div style="color:var(--text-dim);font-size:11px;">Budget</div><div style="font-weight:700;color:#a5b4fc;">' + (p.budget||0).toLocaleString('fr') + ' €</div></div>'
          + '<div><div style="color:var(--text-dim);font-size:11px;">Heures saisies</div><div style="font-weight:700;">' + esc((p.totalHeures||0))+ ' h</div></div>'
          + '<div><div style="color:var(--text-dim);font-size:11px;">Valeur facturée</div><div style="font-weight:700;color:#34d399;">' + (p.valeurFacturee||0).toLocaleString('fr') + ' €</div></div>'
          + '<div><div style="color:var(--text-dim);font-size:11px;">Rentabilité</div><div style="font-weight:700;color:' + esc(rentColor)+ ';">' + esc((p.rentabilite !== null ? p.rentabilite + ' %' : '—'))+ '</div></div>'
          + '</div>'
          + '<button class="btn-sm btn-del-sm" onclick="deleteProjet(\'' + p._id + '\')" style="margin-top:12px;">🗑 Supprimer</button>'
          + '</div></div>';
      }).join('');
      await loadTimeEntries();
    }
    async function loadTimeEntries() {
      var res = await apiFetch('/projets/temps');
      var list = (res && res.data) ? res.data : [];
      var tbody = document.getElementById('temps-body');
      if (!tbody) return;
      if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-dim);">Aucune saisie de temps</td></tr>'; return; }
      tbody.innerHTML = list.map(function(e) {
        return '<tr><td style="font-weight:600;">' + esc((e.projet?.nom || e.projet || '—'))+ '</td><td>' + esc((e.employeNom||'—'))+ '</td><td style="color:var(--text-dim);">' + new Date(e.date).toLocaleDateString('fr') + '</td><td style="font-weight:700;color:#a5b4fc;">' + esc(e.heures)+ ' h</td><td style="color:var(--text-dim);">' + esc((e.description||'—'))+ '</td><td><span class="badge ' + (e.facturable?'badge-green':'badge-gray') + '">' + (e.facturable?'Oui':'Non') + '</span></td><td><button class="btn-sm btn-del-sm" onclick="deleteTemps(\'' + e._id + '\')">🗑</button></td></tr>';
      }).join('');
    }
    async function submitProjet() {
      clearModalError('pj');
      var nom = document.getElementById('pj-nom').value.trim();
      if (!nom) return modalError('pj', 'Le nom est requis.');
      setModalLoading('pj-btn', true, 'Créer');
      try {
        var res = await fetch(API + '/projets', { method:'POST', headers:apiHeaders(), body:JSON.stringify({
          nom, client: document.getElementById('pj-client').value.trim(),
          budget: parseFloat(document.getElementById('pj-budget').value) || 0,
          tjm: parseFloat(document.getElementById('pj-tjm').value) || 0,
          dateDebut: document.getElementById('pj-debut').value,
          dateFin: document.getElementById('pj-fin').value,
          description: document.getElementById('pj-desc').value.trim()
        }) });
        var data = await res.json();
        if (data.success) { closeModal('modal-projet'); showToast('Projet créé', 'success'); loadProjets(); }
        else modalError('pj', data.message || 'Erreur.');
      } catch(e) { modalError('pj', 'Erreur réseau.'); }
      setModalLoading('pj-btn', false, 'Créer le projet');
    }
    async function submitTemps() {
      clearModalError('te');
      var projetId = document.getElementById('te-projet')?.value;
      var heures = parseFloat(document.getElementById('te-heures').value);
      if (!projetId) return modalError('te', 'Choisissez un projet.');
      if (!heures || heures <= 0) return modalError('te', 'Nombre d\'heures requis.');
      setModalLoading('te-btn', true, 'Enregistrer');
      try {
        var res = await fetch(API + '/projets/temps', { method:'POST', headers:apiHeaders(), body:JSON.stringify({
          projetId, heures,
          description: document.getElementById('te-desc').value.trim(),
          date: document.getElementById('te-date').value,
          employeNom: document.getElementById('te-employe').value.trim(),
          facturable: document.getElementById('te-facturable').checked
        }) });
        var data = await res.json();
        if (data.success) { closeModal('modal-temps'); showToast('Temps enregistré', 'success'); loadProjets(); }
        else modalError('te', data.message || 'Erreur.');
      } catch(e) { modalError('te', 'Erreur réseau.'); }
      setModalLoading('te-btn', false, 'Enregistrer');
    }
    async function deleteProjet(id) {
      if (!confirm('Supprimer ce projet et ses saisies de temps ?')) return;
      var res = await fetch(API + '/projets/' + id, { method:'DELETE', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Projet supprimé', 'success'); loadProjets(); }
    }
    async function deleteTemps(id) {
      var res = await fetch(API + '/projets/temps/' + id, { method:'DELETE', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Entrée supprimée', 'success'); loadProjets(); }
    }
    async function loadProjetsForSelect() {
      var res = await apiFetch('/projets');
      var list = (res && res.data) ? res.data : [];
      var sel = document.getElementById('te-projet');
      if (!sel) return;
      sel.innerHTML = list.map(function(p) { return '<option value="' + esc(p._id) + '">' + esc(p.nom) + '</option>'; }).join('');
    }

    // ── Notes de frais ──
    async function loadNotesFrais() {
      var res = await apiFetch('/notes-frais');
      var list = (res && res.data) ? res.data : [];
      var tbody = document.getElementById('notes-frais-body');
      if (!tbody) return;
      var statMap = { en_attente:'badge-yellow', approuvee:'badge-green', rejetee:'badge-red', remboursee:'badge-blue' };
      var statLabel = { en_attente:'En attente', approuvee:'Approuvée', rejetee:'Rejetée', remboursee:'Remboursée' };
      var catLabel = { transport:'Transport', restauration:'Restauration', hebergement:'Hébergement', fournitures:'Fournitures', autre:'Autre' };
      if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-dim);">Aucune note de frais</td></tr>'; return; }
      tbody.innerHTML = list.map(function(n) {
        var actions = '';
        if (n.statut === 'en_attente') actions = '<button class="btn-sm btn-success-sm" onclick="approuverNoteFrais(\'' + esc(n._id)+ '\')" style="margin-right:4px;">✓</button><button class="btn-sm btn-del-sm" onclick="rejeterNoteFrais(\'' + n._id + '\')">✗</button>';
        else if (n.statut === 'approuvee') actions = '<button class="btn-sm" onclick="rembourserNoteFrais(\'' + esc(n._id)+ '\')">💸 Rembourser</button>';
        return '<tr><td style="font-weight:600;">' + esc((n.employeNom||'—'))+ '</td><td>' + esc(n.titre)+ '</td><td style="color:var(--text-dim);">' + esc((catLabel[n.categorie]||n.categorie))+ '</td><td style="font-weight:700;color:#a5b4fc;">' + (n.montant||0).toLocaleString('fr') + ' €</td><td style="color:var(--text-dim);">' + new Date(n.date||n.createdAt).toLocaleDateString('fr') + '</td><td><span class="badge ' + esc((statMap[n.statut]||'badge-gray'))+ '">' + esc((statLabel[n.statut]||n.statut))+ '</span></td><td>' + actions + '</td></tr>';
      }).join('');
    }
    async function submitNoteFrais() {
      clearModalError('nf');
      var employe = document.getElementById('nf-employe').value.trim();
      var titre = document.getElementById('nf-titre').value.trim();
      var montant = parseFloat(document.getElementById('nf-montant').value);
      if (!employe || !titre) return modalError('nf', 'Employé et titre requis.');
      if (!montant || montant <= 0) return modalError('nf', 'Montant invalide.');
      setModalLoading('nf-btn', true, 'Soumettre');
      try {
        var res = await fetch(API + '/notes-frais', { method:'POST', headers:apiHeaders(), body:JSON.stringify({
          employeNom: employe, titre, montant,
          categorie: document.getElementById('nf-categorie').value,
          date: document.getElementById('nf-date').value
        }) });
        var data = await res.json();
        if (data.success) { closeModal('modal-note-frais'); showToast('Note de frais soumise', 'success'); loadNotesFrais(); }
        else modalError('nf', data.message || 'Erreur.');
      } catch(e) { modalError('nf', 'Erreur réseau.'); }
      setModalLoading('nf-btn', false, 'Soumettre la note');
    }
    async function approuverNoteFrais(id) {
      var res = await fetch(API + '/notes-frais/' + id + '/approuver', { method:'POST', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Note approuvée', 'success'); loadNotesFrais(); }
    }
    async function rejeterNoteFrais(id) {
      var res = await fetch(API + '/notes-frais/' + id + '/rejeter', { method:'POST', headers:apiHeaders(), body:JSON.stringify({ commentaire: 'Rejeté' }) });
      var data = await res.json();
      if (data.success) { showToast('Note rejetée', 'success'); loadNotesFrais(); }
    }
    async function rembourserNoteFrais(id) {
      var res = await fetch(API + '/notes-frais/' + id + '/rembourser', { method:'POST', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Note marquée remboursée', 'success'); loadNotesFrais(); }
    }

    // ── Export CSV générique ──
    function exportCSVTable(tbodyId, headers, filename) {
      var tbody = document.getElementById(tbodyId);
      if (!tbody) return;
      var rows = [headers.join(';')];
      Array.from(tbody.querySelectorAll('tr')).forEach(function(tr) {
        var cells = Array.from(tr.querySelectorAll('td')).map(function(td) {
          return '"' + (td.innerText || td.textContent || '').replace(/"/g, '""').trim() + '"';
        });
        if (cells.length) rows.push(cells.join(';'));
      });
      var blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename + '_' + new Date().toISOString().split('T')[0] + '.csv';
      a.click();
    }

    // ── Relance automatique des impayés ──
    async function relancerImpayes() {
      if (!confirm('Envoyer une relance à tous les clients ayant une facture impayée échue ?')) return;
      showToast('Envoi des relances en cours...', 'success');
      var res = await fetch(API + '/comptabilite/relances/auto', { method:'POST', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) {
        var n = (data.data && data.data.relancees) || 0;
        showToast(n === 0 ? 'Aucune facture à relancer' : n + ' relance(s) envoyée(s)', 'success');
        loadAllInvoices(); loadKPIs();
      } else showToast(data.message || 'Erreur', 'error');
    }

    // ── Export CSV fiches de paie ──
    function exportCSVPayslips() {
      exportCSVTable('payslips-body', ['Employé','Période','Salaire brut','Salaire net','Statut'], 'fiches-paie');
    }

    // ── Export DSN simplifié ──
    async function exportDSN() {
      var now = new Date();
      var mois = now.getMonth() + 1;
      var annee = now.getFullYear();
      var res = await apiFetch('/comptabilite/dsn?mois=' + mois + '&annee=' + annee);
      if (!res || !res.data) { showToast('Erreur chargement DSN', 'error'); return; }
      var d = res.data;
      var moisLabels = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
      var lines = [
        'DSN MENSUELLE SIMPLIFIÉE — ' + (moisLabels[mois]||mois) + ' ' + annee,
        '',
        'MASSE SALARIALE BRUTE;' + (d.massesSalarialeBrute||0).toFixed(2) + ' €',
        'NB SALARIÉS;' + (d.nbEmployes||0),
        'COTISATIONS PATRONALES (~42%);' + (d.cotisationsPatronales||0).toFixed(2) + ' €',
        'COTISATIONS SALARIALES (~22%);' + (d.cotisationsSalariales||0).toFixed(2) + ' €',
        'NET À PAYER TOTAL;' + (d.netTotal||0).toFixed(2) + ' €',
        '',
        'DÉTAIL PAR SALARIÉ',
        'Prénom;Nom;Salaire brut;Salaire net'
      ];
      (d.payslips || []).forEach(function(p) {
        var emp = p.employee || {};
        lines.push([emp.prenom||'', emp.nom||'', (p.salaireBrut||0).toFixed(2), (p.salaireNet||0).toFixed(2)].join(';'));
      });
      var blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'DSN_' + (moisLabels[mois]||mois) + '_' + annee + '.csv';
      a.click();
      showToast('DSN exporté', 'success');
    }

    // ── Impression fiche de paie ──
    function printPayslip(id) {
      var row = document.querySelector('[data-payslip-id="' + id + '"]');
      if (!row) return;
      var cells = row.querySelectorAll('td');
      var html = '<html><head><meta charset="utf-8"><title>Fiche de paie</title><style>body{font-family:Arial,sans-serif;padding:40px;max-width:700px;margin:0 auto;}h1{border-bottom:2px solid #333;padding-bottom:10px;}table{width:100%;border-collapse:collapse;margin-top:20px;}td,th{border:1px solid #ddd;padding:10px 14px;}th{background:#f5f5f5;font-weight:600;}@media print{button{display:none!important;}}</style></head><body>'
        + '<h1>Fiche de paie</h1>'
        + '<table><tr><th>Employé</th><td>' + esc((cells[0]&&cells[0].innerText||'—'))+ '</td></tr>'
        + '<tr><th>Période</th><td>' + esc((cells[1]&&cells[1].innerText||'—'))+ '</td></tr>'
        + '<tr><th>Salaire brut</th><td>' + esc((cells[2]&&cells[2].innerText||'—'))+ '</td></tr>'
        + '<tr><th>Salaire net</th><td style="font-size:1.2em;font-weight:bold;">' + esc((cells[3]&&cells[3].innerText||'—'))+ '</td></tr>'
        + '<tr><th>Statut</th><td>' + esc((cells[4]&&cells[4].innerText||'—'))+ '</td></tr></table>'
        + '<p style="margin-top:40px;font-size:12px;color:#888;">Document généré par Novexa · ' + new Date().toLocaleDateString('fr') + '</p>'
        + '<button onclick="window.print()">Imprimer</button>'
        + '</body></html>';
      var w = window.open('', '_blank');
      w.document.write(html);
      w.document.close();
    }

    async function downloadPayslipPDF(id) {
      showToast('Génération du PDF...', 'info');
      try {
        var response = await fetch(API + '/pdf/fiche-paie/' + id, { headers: apiHeaders() });
        if (!response.ok) { var d = await response.json(); showToast(d.message || 'Erreur PDF', 'error'); return; }
        var blob = await response.blob();
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a'); a.href = url; a.download = 'fiche_de_paie.pdf'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      } catch(e) { showToast('Erreur téléchargement PDF', 'error'); }
    }

    // ── OCR dépense via IA ──
    function ocrDepense() {
      var area = document.getElementById('d-ocr-area');
      area.style.display = area.style.display === 'none' ? '' : 'none';
    }
    async function runOCR() {
      var text = document.getElementById('d-ocr-text').value.trim();
      if (!text) { showToast('Collez le texte de la facture d\'abord', 'error'); return; }
      showToast('Analyse en cours...', 'success');
      try {
        var res = await fetch(API + '/ai/analyse', { method:'POST', headers:apiHeaders(), body:JSON.stringify({
          type: 'ocr_depense',
          prompt: 'Analyse ce texte de facture fournisseur et extrait : le montant total TTC, la catégorie (loyer/logiciel/materiel/restauration/transport/marketing/autre), et le nom du fournisseur. Réponds en JSON strict : {"titre":"...","montant":0,"categorie":"..."}',
          content: text
        }) });
        var data = await res.json();
        var txt = (data && (data.response || data.content || data.result || ''));
        var jsonMatch = txt.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          var parsed = JSON.parse(jsonMatch[0]);
          if (parsed.titre) document.getElementById('d-titre').value = parsed.titre;
          if (parsed.montant) document.getElementById('d-montant').value = parsed.montant;
          if (parsed.categorie) document.getElementById('d-categorie').value = parsed.categorie;
          document.getElementById('d-ocr-area').style.display = 'none';
          showToast('Données extraites', 'success');
        } else { showToast('IA n\'a pas pu extraire les données', 'error'); }
      } catch(e) { showToast('Erreur OCR', 'error'); }
    }

    // ── Signature électronique ──
    (function initSignature() {
      var canvas, ctx, drawing = false;
      document.addEventListener('DOMContentLoaded', function() {
        canvas = document.getElementById('signature-canvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#a5b4fc';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        function getPos(e) {
          var r = canvas.getBoundingClientRect();
          var scaleX = canvas.width / r.width;
          var scaleY = canvas.height / r.height;
          if (e.touches) return { x: (e.touches[0].clientX - r.left) * scaleX, y: (e.touches[0].clientY - r.top) * scaleY };
          return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
        }
        canvas.addEventListener('mousedown', function(e) { drawing = true; var p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); });
        canvas.addEventListener('mousemove', function(e) { if (!drawing) return; var p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); });
        canvas.addEventListener('mouseup', function() { drawing = false; });
        canvas.addEventListener('touchstart', function(e) { e.preventDefault(); drawing = true; var p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }, { passive: false });
        canvas.addEventListener('touchmove', function(e) { e.preventDefault(); if (!drawing) return; var p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); }, { passive: false });
        canvas.addEventListener('touchend', function() { drawing = false; });
      });
    })();
    function clearSignature() {
      var canvas = document.getElementById('signature-canvas');
      if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    }

    // ── Impression Bilan ──
    function printBilan() {
      var kpis = document.getElementById('bilan-kpis');
      var prod = document.getElementById('bilan-produits-body');
      var charges = document.getElementById('bilan-charges-body');
      var annee = document.getElementById('bilan-annee') ? document.getElementById('bilan-annee').value : new Date().getFullYear();
      var html = '<html><head><meta charset="utf-8"><title>Bilan ' + esc(annee)+ '</title><style>body{font-family:Arial,sans-serif;padding:40px;}h1{border-bottom:2px solid #333;padding-bottom:10px;}table{width:100%;border-collapse:collapse;margin-top:16px;}td,th{border:1px solid #ddd;padding:8px 12px;}th{background:#f5f5f5;}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;}.kpis{display:flex;gap:20px;flex-wrap:wrap;margin:16px 0;}.kpi{background:#f9f9f9;border:1px solid #ddd;border-radius:6px;padding:12px;text-align:center;min-width:120px;}.kpi-label{font-size:11px;color:#666;}.kpi-val{font-size:18px;font-weight:bold;margin-top:4px;}@media print{button{display:none!important;}}</style></head><body>'
        + '<h1>Bilan & Compte de résultat — ' + esc(annee)+ '</h1>'
        + '<div class="kpis">' + esc((kpis ? kpis.innerHTML : ''))+ '</div>'
        + '<div class="grid"><div><h3 style="color:green;">Produits</h3><table><thead><tr><th>Poste</th><th>Montant</th></tr></thead><tbody>' + esc((prod ? prod.innerHTML : ''))+ '</tbody></table></div>'
        + '<div><h3 style="color:red;">Charges</h3><table><thead><tr><th>Poste</th><th>Montant</th></tr></thead><tbody>' + esc((charges ? charges.innerHTML : ''))+ '</tbody></table></div></div>'
        + '<p style="margin-top:40px;font-size:11px;color:#888;">Document généré par Novexa · ' + new Date().toLocaleDateString('fr') + '</p>'
        + '<button onclick="window.print()">Imprimer</button>'
        + '</body></html>';
      var w = window.open('', '_blank');
      w.document.write(html);
      w.document.close();
    }

    // ── Bilan comptable ──
    async function loadBilan() {
      var sel = document.getElementById('bilan-annee');
      if (sel && !sel.options.length) {
        var y = new Date().getFullYear();
        for (var i = y; i >= y - 4; i--) sel.innerHTML += '<option value="' + i + '">' + i + '</option>';
      }
      var annee = sel ? sel.value : new Date().getFullYear();
      var res = await apiFetch('/comptabilite/bilan?annee=' + annee);
      if (!res || !res.data) return;
      var d = res.data;
      var fmt = function(v){ return (v||0).toLocaleString('fr-FR',{minimumFractionDigits:2}) + ' €'; };
      var kpis = document.getElementById('bilan-kpis');
      var rNet = d.resultatNet || 0;
      var rColor = rNet >= 0 ? '#4ade80' : '#f87171';
      kpis.innerHTML = [
        { label:'Chiffre d\'affaires', val: fmt(d.produits), color:'#4ade80' },
        { label:'Total charges', val: fmt((d.charges||0)+(d.salaires||0)), color:'#f87171' },
        { label:'Résultat brut', val: fmt(d.resultatBrut), color:'#a5b4fc' },
        { label:'IS estimé', val: fmt(d.is), color:'#f59e0b' },
        { label:'Résultat net', val: fmt(rNet), color: rColor }
      ].map(function(k){ return '<div style="background:rgba(255,255,255,.04);border-radius:12px;padding:16px;text-align:center;"><div style="font-size:11px;color:var(--text-dim);margin-bottom:4px;">' + k.label + '</div><div style="font-size:18px;font-weight:800;color:' + k.color + ';">' + k.val + '</div></div>'; }).join('');
      document.getElementById('bilan-produits-body').innerHTML =
        '<tr><td>Chiffre d\'affaires (factures)</td><td style="font-weight:700;color:#4ade80;">' + fmt(d.produits) + '</td></tr>';
      document.getElementById('bilan-charges-body').innerHTML =
        '<tr><td>Charges d\'exploitation</td><td style="color:#f87171;">' + fmt(d.charges) + '</td></tr>'
        + '<tr><td>Masse salariale</td><td style="color:#f87171;">' + fmt(d.salaires) + '</td></tr>'
        + '<tr><td style="font-weight:700;">IS estimé</td><td style="font-weight:700;color:#f59e0b;">' + fmt(d.is) + '</td></tr>'
        + '<tr style="border-top:2px solid rgba(255,255,255,.1);"><td style="font-weight:700;">Résultat net</td><td style="font-weight:800;color:' + esc(rColor)+ ';">' + fmt(rNet) + '</td></tr>';
    }

    // ── Budget prévisionnel ──
    async function loadBudget() {
      var sel = document.getElementById('budget-annee');
      if (sel && !sel.options.length) {
        var y = new Date().getFullYear();
        for (var i = y; i >= y - 2; i--) sel.innerHTML += '<option value="' + i + '">' + i + '</option>';
      }
      var annee = sel ? sel.value : new Date().getFullYear();
      var res = await apiFetch('/budget?annee=' + annee);
      var list = (res && res.data) ? res.data : [];
      var tbody = document.getElementById('budget-body');
      if (!tbody) return;
      var moisLabels = ['','Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
      if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-dim);">Aucune ligne de budget. Cliquez sur "+ Ligne" pour commencer.</td></tr>'; return; }
      tbody.innerHTML = list.map(function(b) {
        var ecart = (b.montantReel||0) - (b.montantPrevu||0);
        var ecartColor = b.type === 'recette' ? (ecart >= 0 ? '#4ade80' : '#f87171') : (ecart <= 0 ? '#4ade80' : '#f87171');
        return '<tr>'
          + '<td style="font-weight:600;">' + esc((b.categorie||'—'))+ '</td>'
          + '<td><span class="badge ' + (b.type==='recette'?'badge-green':'badge-red') + '">' + (b.type==='recette'?'Recette':'Charge') + '</span></td>'
          + '<td>' + esc((moisLabels[b.mois]||b.mois))+ '</td>'
          + '<td>' + (b.montantPrevu||0).toLocaleString('fr-FR',{minimumFractionDigits:2}) + ' €</td>'
          + '<td>' + (b.montantReel||0).toLocaleString('fr-FR',{minimumFractionDigits:2}) + ' €</td>'
          + '<td style="font-weight:700;color:' + esc(ecartColor)+ ';">' + (ecart >= 0 ? '+' : '') + ecart.toLocaleString('fr-FR',{minimumFractionDigits:2}) + ' €</td>'
          + '<td><button class="btn-sm btn-del-sm" onclick="deleteBudgetLigne(\'' + b._id + '\')">🗑</button></td>'
          + '</tr>';
      }).join('');
    }
    async function submitBudgetLigne() {
      clearModalError('bud');
      var categorie = document.getElementById('bud-categorie').value.trim();
      var montant = parseFloat(document.getElementById('bud-montant').value) || 0;
      if (!categorie || montant <= 0) return modalError('bud', 'Catégorie et montant requis.');
      var annee = parseInt(document.getElementById('budget-annee') ? document.getElementById('budget-annee').value : new Date().getFullYear());
      setModalLoading('bud-btn', true, 'Enregistrer');
      try {
        var res = await fetch(API + '/budget', { method:'POST', headers:apiHeaders(), body:JSON.stringify({
          categorie, type: document.getElementById('bud-type').value,
          mois: parseInt(document.getElementById('bud-mois').value), annee,
          montantPrevu: montant, notes: document.getElementById('bud-notes').value.trim()
        }) });
        var data = await res.json();
        if (data.success) { closeModal('modal-budget-ligne'); showToast('Ligne ajoutée', 'success'); loadBudget(); }
        else modalError('bud', data.message || 'Erreur.');
      } catch(e) { modalError('bud', 'Erreur réseau.'); }
      setModalLoading('bud-btn', false, 'Enregistrer');
    }
    async function deleteBudgetLigne(id) {
      if (!confirm('Supprimer cette ligne ?')) return;
      var res = await fetch(API + '/budget/' + id, { method:'DELETE', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Supprimée', 'success'); loadBudget(); }
    }

    // ── Centres analytiques ──
    async function loadCentresAnalytiques() {
      var res = await apiFetch('/centres-analytiques');
      var list = (res && res.data) ? res.data : [];
      var tbody = document.getElementById('centres-body');
      if (!tbody) return;
      if (!list.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-dim);">Aucun centre analytique</td></tr>'; return; }
      tbody.innerHTML = list.map(function(c) {
        return '<tr>'
          + '<td style="font-family:monospace;font-weight:700;color:#a5b4fc;">' + esc((c.code||'—'))+ '</td>'
          + '<td style="font-weight:600;">' + esc((c.nom||'—'))+ '</td>'
          + '<td>' + (c.budgetAnnuel||0).toLocaleString('fr-FR',{minimumFractionDigits:2}) + ' €</td>'
          + '<td><span style="width:18px;height:18px;border-radius:50%;background:' + esc((c.couleur||'#6366f1'))+ ';display:inline-block;"></span></td>'
          + '<td><span class="badge ' + (c.actif?'badge-green':'badge-gray') + '">' + (c.actif?'Actif':'Inactif') + '</span></td>'
          + '<td><button class="btn-sm btn-del-sm" onclick="deleteCentreAnalytique(\'' + c._id + '\')">🗑</button></td>'
          + '</tr>';
      }).join('');
    }
    async function submitCentreAnalytique() {
      clearModalError('ca');
      var nom = document.getElementById('ca-nom').value.trim();
      if (!nom) return modalError('ca', 'Le nom est requis.');
      setModalLoading('ca-btn', true, 'Créer');
      try {
        var res = await fetch(API + '/centres-analytiques', { method:'POST', headers:apiHeaders(), body:JSON.stringify({
          nom, code: document.getElementById('ca-code').value.trim(),
          budgetAnnuel: parseFloat(document.getElementById('ca-budget').value) || 0,
          couleur: document.getElementById('ca-couleur').value,
          description: document.getElementById('ca-desc').value.trim()
        }) });
        var data = await res.json();
        if (data.success) { closeModal('modal-centre-analytique'); showToast('Centre créé', 'success'); loadCentresAnalytiques(); }
        else modalError('ca', data.message || 'Erreur.');
      } catch(e) { modalError('ca', 'Erreur réseau.'); }
      setModalLoading('ca-btn', false, 'Créer');
    }
    async function deleteCentreAnalytique(id) {
      if (!confirm('Supprimer ce centre analytique ?')) return;
      var res = await fetch(API + '/centres-analytiques/' + id, { method:'DELETE', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Supprimé', 'success'); loadCentresAnalytiques(); }
    }

    // ── Contrats RH ──
    async function loadContrats() {
      var res = await apiFetch('/rh/contrats');
      var list = (res && res.data) ? res.data : [];
      var tbody = document.getElementById('contrats-body');
      if (!tbody) return;
      if (!list.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-dim);">Aucun contrat enregistré</td></tr>'; return; }
      var typeLabels = { cdi:'CDI', cdd:'CDD', apprentissage:'Apprentissage', stage:'Stage', interim:'Intérim', freelance:'Freelance' };
      var statMap = { actif:'badge-green', expire:'badge-red', resilie:'badge-red', suspendu:'badge-yellow' };
      tbody.innerHTML = list.map(function(c) {
        var emp = c.employee ? (c.employee.prenom + ' ' + c.employee.nom) : '—';
        var debut = c.dateDebut ? new Date(c.dateDebut).toLocaleDateString('fr') : '—';
        var fin = c.dateFin ? new Date(c.dateFin).toLocaleDateString('fr') : 'Indéterminé';
        return '<tr>'
          + '<td style="font-weight:600;">' + esc(emp)+ '</td>'
          + '<td>' + esc((typeLabels[c.type]||c.type||'—'))+ '</td>'
          + '<td>' + esc(debut)+ '</td><td>' + esc(fin)+ '</td>'
          + '<td style="font-weight:700;">' + (c.salaireBase||0).toLocaleString('fr-FR',{minimumFractionDigits:2}) + ' €</td>'
          + '<td><span class="badge ' + esc((statMap[c.statut]||'badge-gray'))+ '">' + esc((c.statut||'—'))+ '</span></td>'
          + '</tr>';
      }).join('');
    }

    // ── Planning des absences ──
    var _planningLeaves = [];
    var _planningEmployes = [];
    async function initPlanning() {
      var now = new Date();
      var moisSel = document.getElementById('planning-mois');
      var anneeSel = document.getElementById('planning-annee');
      if (moisSel) moisSel.value = now.getMonth();
      if (anneeSel) {
        if (!anneeSel.options.length) {
          var y = now.getFullYear();
          for (var i = y - 1; i <= y + 1; i++) anneeSel.innerHTML += '<option value="' + i + '" ' + (i===y?'selected':'') + '>' + i + '</option>';
        }
      }
      var [resLeaves, resEmp] = await Promise.all([apiFetch('/rh/conges?statut=approuve'), apiFetch('/rh/employes')]);
      _planningLeaves = (resLeaves && resLeaves.data) ? resLeaves.data : [];
      _planningEmployes = (resEmp && resEmp.data) ? resEmp.data : [];
      renderPlanning();
    }
    function renderPlanning() {
      var moisSel = document.getElementById('planning-mois');
      var anneeSel = document.getElementById('planning-annee');
      var mois = moisSel ? parseInt(moisSel.value) : new Date().getMonth();
      var annee = anneeSel ? parseInt(anneeSel.value) : new Date().getFullYear();
      var grid = document.getElementById('planning-grid');
      if (!grid) return;
      var daysInMonth = new Date(annee, mois + 1, 0).getDate();
      var typeColors = { conge_paye:'#4ade80', rtt:'#f59e0b', maladie:'#f87171', sans_solde:'#a78bfa', maternite:'#f472b6', paternite:'#60a5fa', autre:'#a5b4fc' };
      var html = '<div style="display:grid;grid-template-columns:140px repeat(' + esc(daysInMonth)+ ',24px);gap:1px;min-width:' + esc((140+daysInMonth*25))+ 'px;">';
      html += '<div style="font-size:11px;color:var(--text-dim);padding:4px 0;">Employé</div>';
      for (var d = 1; d <= daysInMonth; d++) {
        var isWE = [0,6].includes(new Date(annee, mois, d).getDay());
        html += '<div style="text-align:center;font-size:10px;color:' + (isWE?'#6b7280':'var(--text-dim)') + ';padding:2px 0;">' + esc(d)+ '</div>';
      }
      _planningEmployes.filter(function(e){ return e.statut !== 'inactif'; }).forEach(function(emp) {
        html += '<div style="font-size:11px;padding:4px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:136px;" title="' + esc(emp.prenom)+ ' ' + esc(emp.nom)+ '">' + esc(emp.prenom)+ ' ' + esc((emp.nom||'').charAt(0))+ '.</div>';
        for (var d = 1; d <= daysInMonth; d++) {
          var dateD = new Date(annee, mois, d);
          var leave = _planningLeaves.find(function(l) {
            if (!l.employee || l.employee._id !== emp._id) return false;
            var start = new Date(l.dateDebut); start.setHours(0,0,0,0);
            var end = new Date(l.dateFin); end.setHours(23,59,59,999);
            return dateD >= start && dateD <= end;
          });
          var isWE = [0,6].includes(dateD.getDay());
          var bg = isWE ? 'rgba(255,255,255,.03)' : (leave ? (typeColors[leave.type]||'#a5b4fc') : 'rgba(255,255,255,.04)');
          html += '<div style="height:22px;background:' + esc(bg)+ ';border-radius:2px;" title="' + esc((leave?leave.type:''))+ '"></div>';
        }
      });
      html += '</div>';
      grid.innerHTML = html;
    }

    // ── Support / Tickets ──
    async function loadTickets() {
      var res = await apiFetch('/tickets');
      var list = (res && res.data) ? res.data : [];
      var cols = { ouvert:[], en_cours:[], resolu:[], ferme:[] };
      list.forEach(function(t) { if (cols[t.statut]) cols[t.statut].push(t); });
      var prioColors = { basse:'#6b7280', normale:'#6366f1', haute:'#f59e0b', urgente:'#f87171' };
      var catIcons = { technique:'⚙️', rh:'👥', comptabilite:'📊', autre:'💬' };
      Object.keys(cols).forEach(function(statut) {
        var el = document.getElementById('tickets-col-' + statut);
        if (!el) return;
        if (!cols[statut].length) { el.innerHTML = '<div style="font-size:12px;color:var(--text-dim);text-align:center;padding:16px;">Aucun ticket</div>'; return; }
        el.innerHTML = cols[statut].map(function(t) {
          var nextStatuts = { ouvert:'en_cours', en_cours:'resolu', resolu:'ferme' };
          var nextLabel = { ouvert:'▶ Prendre en charge', en_cours:'✓ Résoudre', resolu:'⬛ Fermer' };
          var actionBtn = nextStatuts[t.statut] ? '<button class="btn-sm btn-success-sm" onclick="updateTicketStatut(\'' + esc(t._id)+ '\',\'' + esc(nextStatuts[t.statut])+ '\')" style="font-size:11px;padding:3px 8px;margin-top:6px;">' + esc((nextLabel[t.statut]||'→'))+ '</button>' : '';
          return '<div style="background:rgba(255,255,255,.05);border-radius:8px;padding:12px;border-left:3px solid ' + esc((prioColors[t.priorite]||'#6b7280'))+ ';">'
            + '<div style="font-size:12px;font-weight:600;">' + esc((catIcons[t.categorie]||'💬'))+ ' ' + esc((t.titre||'—'))+ '</div>'
            + '<div style="font-size:11px;color:var(--text-dim);margin-top:4px;">Par ' + esc((t.rapporteurNom||'—'))+ '</div>'
            + '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;">'
            + '<span style="font-size:11px;color:' + esc((prioColors[t.priorite]||'#6b7280'))+ ';font-weight:600;">' + esc((t.priorite||''))+ '</span>'
            + '<button class="btn-sm btn-del-sm" onclick="deleteTicket(\'' + t._id + '\')" style="font-size:11px;padding:2px 6px;">🗑</button>'
            + '</div>' + actionBtn + '</div>';
        }).join('');
      });
      var total = list.length;
      var ouverts = cols.ouvert.length + cols.en_cours.length;
      var kpis = document.getElementById('tickets-kpis');
      if (kpis) kpis.innerHTML = [
        { label:'Total', val: total, color:'#a5b4fc' },
        { label:'En cours', val: ouverts, color:'#f59e0b' },
        { label:'Résolus', val: cols.resolu.length, color:'#4ade80' },
        { label:'Fermés', val: cols.ferme.length, color:'#6b7280' }
      ].map(function(k){ return '<div style="background:rgba(255,255,255,.04);border-radius:10px;padding:14px;text-align:center;"><div style="font-size:11px;color:var(--text-dim);">' + k.label + '</div><div style="font-size:22px;font-weight:800;color:' + k.color + ';">' + k.val + '</div></div>'; }).join('');
    }
    async function submitTicket() {
      clearModalError('tkt');
      var titre = document.getElementById('tkt-titre').value.trim();
      if (!titre) return modalError('tkt', 'Le titre est requis.');
      setModalLoading('tkt-btn', true, 'Créer le ticket');
      try {
        var res = await fetch(API + '/tickets', { method:'POST', headers:apiHeaders(), body:JSON.stringify({
          titre, categorie: document.getElementById('tkt-categorie').value,
          priorite: document.getElementById('tkt-priorite').value,
          description: document.getElementById('tkt-desc').value.trim()
        }) });
        var data = await res.json();
        if (data.success) { closeModal('modal-ticket'); showToast('Ticket créé', 'success'); loadTickets(); }
        else modalError('tkt', data.message || 'Erreur.');
      } catch(e) { modalError('tkt', 'Erreur réseau.'); }
      setModalLoading('tkt-btn', false, 'Créer le ticket');
    }
    async function updateTicketStatut(id, statut) {
      var res = await fetch(API + '/tickets/' + id + '/statut', { method:'PUT', headers:apiHeaders(), body:JSON.stringify({ statut }) });
      var data = await res.json();
      if (data.success) { showToast('Ticket mis à jour', 'success'); loadTickets(); }
    }
    async function deleteTicket(id) {
      if (!confirm('Supprimer ce ticket ?')) return;
      var res = await fetch(API + '/tickets/' + id, { method:'DELETE', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Ticket supprimé', 'success'); loadTickets(); }
    }

    // ── Avoirs ──
    async function loadAvoirs() {
      var res = await apiFetch('/avoirs');
      var list = (res && res.data) ? res.data : [];
      var tbody = document.getElementById('avoirs-body');
      if (!tbody) return;
      if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-dim);">Aucun avoir</td></tr>'; return; }
      var statMap = { brouillon:'badge-gray', valide:'badge-green', annule:'badge-red' };
      var statLabel = { brouillon:'Brouillon', valide:'Validé', annule:'Annulé' };
      tbody.innerHTML = list.map(function(a) {
        return '<tr>'
          + '<td style="font-weight:700;color:#a5b4fc;">' + esc((a.numero||'—'))+ '</td>'
          + '<td>' + esc((a.clientNom||'—'))+ '</td>'
          + '<td style="color:var(--text-dim);font-size:12px;">' + esc((a.factureNumero||'—'))+ '</td>'
          + '<td>' + esc((a.motif||'—'))+ '</td>'
          + '<td style="font-weight:700;">' + (a.montantTTC||0).toLocaleString('fr-FR',{minimumFractionDigits:2}) + ' €</td>'
          + '<td><span class="badge ' + esc((statMap[a.statut]||'badge-gray'))+ '">' + esc((statLabel[a.statut]||a.statut))+ '</span></td>'
          + '<td><button class="btn-sm btn-del-sm" onclick="deleteAvoir(\'' + a._id + '\')">🗑</button></td>'
          + '</tr>';
      }).join('');
    }
    async function submitAvoir() {
      clearModalError('av');
      var clientNom = document.getElementById('av-client').value.trim();
      var motif = document.getElementById('av-motif').value.trim();
      var desc = document.getElementById('av-desc').value.trim();
      var montant = parseFloat(document.getElementById('av-montant').value) || 0;
      if (!clientNom || !motif || !desc || montant <= 0) return modalError('av', 'Renseignez tous les champs obligatoires.');
      var tva = parseFloat(document.getElementById('av-tva').value) || 20;
      var qty = parseFloat(document.getElementById('av-qty').value) || 1;
      setModalLoading('av-btn', true, "Créer l'avoir");
      try {
        var res = await fetch(API + '/avoirs', { method:'POST', headers:apiHeaders(), body:JSON.stringify({
          clientNom, factureNumero: document.getElementById('av-facture-num').value.trim(),
          motif, lignes: [{ description: desc, quantite: qty, prixUnitaire: montant, tva, montantHT: qty * montant }]
        }) });
        var data = await res.json();
        if (data.success) { closeModal('modal-avoir'); showToast('Avoir créé', 'success'); loadAvoirs(); }
        else modalError('av', data.message || 'Erreur.');
      } catch(e) { modalError('av', 'Erreur réseau.'); }
      setModalLoading('av-btn', false, "Créer l'avoir");
    }
    async function deleteAvoir(id) {
      if (!confirm('Supprimer cet avoir ?')) return;
      var res = await fetch(API + '/avoirs/' + id, { method:'DELETE', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Avoir supprimé', 'success'); loadAvoirs(); }
    }

    // ── Immobilisations ──
    async function loadImmos() {
      var res = await apiFetch('/immobilisations');
      var list = (res && res.data) ? res.data : [];
      var tbody = document.getElementById('immos-body');
      if (!tbody) return;
      if (!list.length) { tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-dim);">Aucune immobilisation</td></tr>'; return; }
      var catLabels = { materiel:'Matériel', vehicule:'Véhicule', logiciel:'Logiciel', mobilier:'Mobilier', immeuble:'Immeuble', autre:'Autre' };
      var statMap = { actif:'badge-green', amorti:'badge-gray', cede:'badge-red' };
      tbody.innerHTML = list.map(function(i) {
        var acq = i.dateAcquisition ? new Date(i.dateAcquisition).toLocaleDateString('fr') : '—';
        return '<tr>'
          + '<td style="font-weight:600;">' + esc((i.nom||'—'))+ '</td>'
          + '<td>' + esc((catLabels[i.categorie]||i.categorie||'—'))+ '</td>'
          + '<td>' + esc(acq)+ '</td>'
          + '<td style="font-weight:700;">' + (i.valeurAchat||0).toLocaleString('fr-FR',{minimumFractionDigits:2}) + ' €</td>'
          + '<td style="text-align:center;">' + esc((i.dureeAmortissement||'—'))+ ' ans</td>'
          + '<td>' + (i.annuiteAmortissement||0).toLocaleString('fr-FR',{minimumFractionDigits:2}) + ' €</td>'
          + '<td style="font-weight:700;color:#a5b4fc;">' + (i.valeurNetteComptable||0).toLocaleString('fr-FR',{minimumFractionDigits:2}) + ' €</td>'
          + '<td><span class="badge ' + esc((statMap[i.statut]||'badge-gray'))+ '">' + esc((i.statut||'actif'))+ '</span></td>'
          + '<td><button class="btn-sm btn-del-sm" onclick="deleteImmobilisation(\'' + i._id + '\')">🗑</button></td>'
          + '</tr>';
      }).join('');
    }
    async function submitImmobilisation() {
      clearModalError('immo');
      var nom = document.getElementById('immo-nom').value.trim();
      var valeur = parseFloat(document.getElementById('immo-valeur').value) || 0;
      var duree = parseInt(document.getElementById('immo-duree').value) || 0;
      var date = document.getElementById('immo-date').value;
      if (!nom || valeur <= 0 || duree <= 0 || !date) return modalError('immo', 'Renseignez tous les champs obligatoires.');
      setModalLoading('immo-btn', true, 'Enregistrer');
      try {
        var res = await fetch(API + '/immobilisations', { method:'POST', headers:apiHeaders(), body:JSON.stringify({
          nom, categorie: document.getElementById('immo-categorie').value,
          fournisseur: document.getElementById('immo-fournisseur').value.trim(),
          dateAcquisition: date, valeurAchat: valeur, dureeAmortissement: duree,
          methodeAmortissement: document.getElementById('immo-methode').value,
          notes: document.getElementById('immo-notes').value.trim()
        }) });
        var data = await res.json();
        if (data.success) { closeModal('modal-immobilisation'); showToast('Immobilisation ajoutée', 'success'); loadImmos(); }
        else modalError('immo', data.message || 'Erreur.');
      } catch(e) { modalError('immo', 'Erreur réseau.'); }
      setModalLoading('immo-btn', false, 'Enregistrer');
    }
    async function deleteImmobilisation(id) {
      if (!confirm('Supprimer cette immobilisation ?')) return;
      var res = await fetch(API + '/immobilisations/' + id, { method:'DELETE', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Supprimée', 'success'); loadImmos(); }
    }

    // ── Rapprochement bancaire ──
    var _currentReleveId = null;
    async function loadRapprochements() {
      var res = await apiFetch('/rapprochement');
      var list = (res && res.data) ? res.data : [];
      var container = document.getElementById('rapprochements-list');
      if (!container) return;
      if (!list.length) { container.innerHTML = '<div style="font-size:13px;color:var(--text-dim);padding:20px;text-align:center;">Aucun relevé importé. Cliquez sur "Importer relevé" pour commencer.</div>'; return; }
      var statMap = { en_cours:'badge-yellow', valide:'badge-green' };
      container.innerHTML = list.map(function(r) {
        var nb = (r.transactions||[]).length;
        var rapp = (r.transactions||[]).filter(function(t){ return t.rapproche; }).length;
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(255,255,255,.04);border-radius:8px;margin-bottom:8px;cursor:pointer;" onclick="openReleve(\'' + esc(r._id)+ '\')">'
          + '<div><div style="font-weight:600;font-size:13px;">' + esc((r.banque||'—'))+ ' — ' + esc((r.periode||'—'))+ '</div>'
          + '<div style="font-size:12px;color:var(--text-dim);">' + esc(rapp)+ '/' + esc(nb)+ ' transactions rapprochées</div></div>'
          + '<div style="display:flex;align-items:center;gap:10px;">'
          + '<span class="badge ' + esc((statMap[r.statut]||'badge-gray'))+ '">' + esc((r.statut||'—'))+ '</span>'
          + '<button class="btn-sm btn-del-sm" onclick="event.stopPropagation();deleteReleve(\'' + r._id + '\')">🗑</button></div>'
          + '</div>';
      }).join('');
    }
    async function openReleve(id) {
      _currentReleveId = id;
      var res = await apiFetch('/rapprochement/' + id);
      var r = res && res.data;
      if (!r) return;
      document.getElementById('rapprochement-detail-title').textContent = (r.banque||'—') + ' — ' + (r.periode||'—');
      var tbody = document.getElementById('rapprochement-transactions-body');
      var txs = r.transactions || [];
      if (!txs.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-dim);">Aucune transaction</td></tr>'; }
      else tbody.innerHTML = txs.map(function(t, idx) {
        var montant = (t.montant||0).toLocaleString('fr-FR',{minimumFractionDigits:2});
        var sign = t.montant >= 0 ? '+' : '';
        var color = t.montant >= 0 ? '#4ade80' : '#f87171';
        var statut = t.rapproche ? '<span class="badge badge-green">Rapproché</span>' : '<span class="badge badge-gray">Non rapproché</span>';
        var action = t.rapproche ? '' : '<button class="btn-sm btn-success-sm" onclick="rapprochierTransaction(\'' + esc(id)+ '\',' + esc(idx)+ ')">✓ Rapprocher</button>';
        return '<tr><td>' + (t.date ? new Date(t.date).toLocaleDateString('fr') : '—') + '</td><td>' + esc((t.libelle||'—'))+ '</td>'
          + '<td style="font-weight:700;color:' + esc(color)+ ';">' + esc(sign)+ esc(montant)+ ' €</td>'
          + '<td>' + statut + '</td><td style="font-size:12px;color:var(--text-dim);">' + esc((t.rapprochePar||'—'))+ '</td>'
          + '<td>' + action + '</td></tr>';
      }).join('');
      document.getElementById('rapprochement-detail').style.display = '';
    }
    async function rapprochierTransaction(releveId, idx) {
      var res = await fetch(API + '/rapprochement/' + releveId + '/rapprocher/' + idx, { method:'PUT', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Transaction rapprochée', 'success'); openReleve(releveId); }
      else showToast(data.message || 'Erreur', 'error');
    }
    async function validerRapprochement() {
      if (!_currentReleveId) return;
      if (!confirm('Valider ce relevé bancaire ?')) return;
      var res = await fetch(API + '/rapprochement/' + _currentReleveId + '/valider', { method:'PUT', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Relevé validé', 'success'); loadRapprochements(); document.getElementById('rapprochement-detail').style.display = 'none'; }
    }
    async function submitRapprochement() {
      clearModalError('rap');
      var banque = document.getElementById('rap-banque').value.trim();
      var periode = document.getElementById('rap-periode').value.trim();
      var csv = document.getElementById('rap-csv').value.trim();
      if (!banque || !periode || !csv) return modalError('rap', 'Renseignez tous les champs obligatoires.');
      var transactions = csv.split('\n').filter(function(l){ return l.trim(); }).map(function(line) {
        var parts = line.split(';');
        return { date: parts[0]&&parts[0].trim(), libelle: parts[1]&&parts[1].trim(), montant: parseFloat(parts[2]) || 0 };
      });
      setModalLoading('rap-btn', true, 'Importer');
      try {
        var res = await fetch(API + '/rapprochement', { method:'POST', headers:apiHeaders(), body:JSON.stringify({
          banque, periode,
          soldeOuverture: parseFloat(document.getElementById('rap-solde-ouv').value) || 0,
          soldeCloture: parseFloat(document.getElementById('rap-solde-clo').value) || 0,
          transactions
        }) });
        var data = await res.json();
        if (data.success) { closeModal('modal-rapprochement'); showToast('Relevé importé', 'success'); loadRapprochements(); }
        else modalError('rap', data.message || 'Erreur.');
      } catch(e) { modalError('rap', 'Erreur réseau.'); }
      setModalLoading('rap-btn', false, 'Importer');
    }
    async function deleteReleve(id) {
      if (!confirm('Supprimer ce relevé ?')) return;
      var res = await fetch(API + '/rapprochement/' + id, { method:'DELETE', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Relevé supprimé', 'success'); loadRapprochements(); document.getElementById('rapprochement-detail').style.display = 'none'; }
    }

    // ── Cash Flow ──
    async function loadCashflow() {
      var res = await apiFetch('/comptabilite/cashflow');
      if (!res || !res.data) return;
      var d = res.data;
      var kpis = document.getElementById('cashflow-kpis');
      var fmt = function(v){ return (v||0).toLocaleString('fr-FR',{minimumFractionDigits:2}) + ' €'; };
      kpis.innerHTML = [
        { label:'Solde actuel', val: fmt(d.soldeActuel), color:'#a5b4fc' },
        { label:'Entrées (3 mois)', val: fmt(d.totalEntrees), color:'#4ade80' },
        { label:'Sorties (3 mois)', val: fmt(d.totalSorties), color:'#f87171' }
      ].map(function(k){ return '<div style="background:rgba(255,255,255,.04);border-radius:12px;padding:18px;text-align:center;"><div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;">' + k.label + '</div><div style="font-size:20px;font-weight:800;color:' + k.color + ';">' + k.val + '</div></div>'; }).join('');
      var moisLabels = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
      var histBody = document.getElementById('cashflow-historique-body');
      var hist = d.historique || [];
      histBody.innerHTML = hist.length ? hist.map(function(m){
        var solde = (m.entrees||0) - (m.sorties||0);
        var sc = solde >= 0 ? '#4ade80' : '#f87171';
        return '<tr><td>' + esc((moisLabels[m.mois]||m.mois))+ ' ' + esc(m.annee)+ '</td><td style="color:#4ade80;">' + fmt(m.entrees) + '</td><td style="color:#f87171;">' + fmt(m.sorties) + '</td><td style="font-weight:700;color:' + esc(sc)+ ';">' + fmt(solde) + '</td></tr>';
      }).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--text-dim);">Aucune donnée</td></tr>';
      var prevBody = document.getElementById('cashflow-previsions-body');
      var prev = d.previsions || [];
      prevBody.innerHTML = prev.length ? prev.map(function(m){
        var solde = (m.entreesPrevues||0) - (m.sortiesPrevues||0);
        var sc = solde >= 0 ? '#4ade80' : '#f87171';
        return '<tr><td>' + esc((moisLabels[m.mois]||m.mois))+ ' ' + esc(m.annee)+ '</td><td style="color:#4ade80;">' + fmt(m.entreesPrevues) + '</td><td style="color:#f87171;">' + fmt(m.sortiesPrevues) + '</td><td style="font-weight:700;color:' + esc(sc)+ ';">' + fmt(solde) + '</td></tr>';
      }).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--text-dim);">Aucune prévision</td></tr>';
    }

    // ── IS (Impôt sur les Sociétés) ──
    async function loadCalculIS() {
      var res = await apiFetch('/comptabilite/calcul-is');
      if (!res || !res.data) return;
      var d = res.data;
      var fmt = function(v){ return (v||0).toLocaleString('fr-FR',{minimumFractionDigits:2}) + ' €'; };
      var kpis = document.getElementById('is-kpis');
      kpis.innerHTML = [
        { label:'Résultat fiscal estimé', val: fmt(d.resultatFiscal), color:'#a5b4fc' },
        { label:'IS estimé', val: fmt(d.isEstime), color:'#f87171' },
        { label:'Taux effectif', val: (d.tauxEffectif||0).toFixed(1) + '%', color:'#fbbf24' }
      ].map(function(k){ return '<div style="background:rgba(255,255,255,.04);border-radius:12px;padding:18px;text-align:center;"><div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;">' + k.label + '</div><div style="font-size:20px;font-weight:800;color:' + k.color + ';">' + k.val + '</div></div>'; }).join('');
      var tbody = document.getElementById('is-acomptes-body');
      var acomptes = d.acomptes || [];
      var statMap = { a_verser:'badge-yellow', paye:'badge-green', na:'badge-gray' };
      tbody.innerHTML = acomptes.length ? acomptes.map(function(a){
        var dt = a.echeance ? new Date(a.echeance).toLocaleDateString('fr') : '—';
        return '<tr><td>' + esc(dt)+ '</td><td style="font-weight:700;">' + fmt(a.montant) + '</td><td><span class="badge ' + esc((statMap[a.statut]||'badge-gray'))+ '">' + esc((a.statut==='a_verser'?'À verser':a.statut==='paye'?'Payé':'N/A'))+ '</span></td></tr>';
      }).join('') : '<tr><td colspan="3" style="text-align:center;color:var(--text-dim);">Aucun acompte</td></tr>';
    }

    // ── Bons de commande ──
    async function loadBonsCommande() {
      var res = await apiFetch('/bon-commandes');
      var list = (res && res.data) ? res.data : [];
      var tbody = document.getElementById('bons-commande-body');
      if (!tbody) return;
      if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-dim);">Aucun bon de commande</td></tr>'; return; }
      var statMap = { brouillon:'badge-gray', envoye:'badge-yellow', confirme:'badge-green', livre:'badge-green', annule:'badge-red' };
      var statLabel = { brouillon:'Brouillon', envoye:'Envoyé', confirme:'Confirmé', livre:'Livré', annule:'Annulé' };
      tbody.innerHTML = list.map(function(b) {
        var dateCmd = b.dateCommande ? new Date(b.dateCommande).toLocaleDateString('fr') : '—';
        var dateLiv = b.dateLivraisonPrevue ? new Date(b.dateLivraisonPrevue).toLocaleDateString('fr') : '—';
        var actions = '<button class="btn-sm" onclick="recevoirBonCommande(\'' + esc(b._id)+ '\')" title="Marquer livré" style="margin-right:4px;">✅ Reçu</button>'
          + '<button class="btn-sm btn-del-sm" onclick="deleteBonCommande(\'' + b._id + '\')">🗑</button>';
        return '<tr><td style="font-weight:700;color:#a5b4fc;">' + esc((b.numero||'—'))+ '</td>'
          + '<td>' + esc((b.fournisseurNom||'—'))+ '</td>'
          + '<td style="font-weight:700;">' + (b.montantTTC||0).toLocaleString('fr-FR',{minimumFractionDigits:2}) + ' €</td>'
          + '<td>' + esc(dateCmd)+ '</td><td>' + esc(dateLiv)+ '</td>'
          + '<td><span class="badge ' + esc((statMap[b.statut]||'badge-gray'))+ '">' + esc((statLabel[b.statut]||b.statut))+ '</span></td>'
          + '<td>' + actions + '</td></tr>';
      }).join('');
    }
    async function submitBonCommande() {
      clearModalError('bc');
      var fournisseur = document.getElementById('bc-fournisseur').value.trim();
      var desc = document.getElementById('bc-desc').value.trim();
      var prix = parseFloat(document.getElementById('bc-prix').value) || 0;
      if (!fournisseur || !desc || prix <= 0) return modalError('bc', 'Renseignez tous les champs obligatoires.');
      var qty = parseFloat(document.getElementById('bc-qty').value) || 1;
      setModalLoading('bc-btn', true, 'Créer le bon');
      try {
        var res = await fetch(API + '/bon-commandes', { method:'POST', headers:apiHeaders(), body:JSON.stringify({
          fournisseurNom: fournisseur, fournisseurEmail: document.getElementById('bc-email').value.trim(),
          lignes: [{ description: desc, quantite: qty, prixUnitaire: prix, montantHT: qty * prix }],
          dateLivraisonPrevue: document.getElementById('bc-livraison').value || null,
          notes: document.getElementById('bc-notes').value.trim()
        }) });
        var data = await res.json();
        if (data.success) { closeModal('modal-bon-commande'); showToast('Bon de commande créé', 'success'); loadBonsCommande(); }
        else modalError('bc', data.message || 'Erreur.');
      } catch(e) { modalError('bc', 'Erreur réseau.'); }
      setModalLoading('bc-btn', false, 'Créer le bon');
    }
    async function recevoirBonCommande(id) {
      var res = await fetch(API + '/bon-commandes/' + id + '/recevoir', { method:'PUT', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Bon marqué livré', 'success'); loadBonsCommande(); }
    }
    async function deleteBonCommande(id) {
      if (!confirm('Supprimer ce bon de commande ?')) return;
      var res = await fetch(API + '/bon-commandes/' + id, { method:'DELETE', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Supprimé', 'success'); loadBonsCommande(); }
    }

    // ── Avances sur salaire ──
    async function loadAvances() {
      var res = await apiFetch('/rh/avances');
      var list = (res && res.data) ? res.data : [];
      var tbody = document.getElementById('avances-body');
      if (!tbody) return;
      if (!list.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-dim);">Aucune avance</td></tr>'; return; }
      var statMap = { en_attente:'badge-yellow', approuvee:'badge-green', rejetee:'badge-red', remboursee:'badge-gray' };
      var statLabel = { en_attente:'En attente', approuvee:'Approuvée', rejetee:'Rejetée', remboursee:'Remboursée' };
      tbody.innerHTML = list.map(function(a) {
        var empName = a.employee ? (a.employee.prenom + ' ' + a.employee.nom) : (a.employeeNom||'—');
        var date = a.dateAvance ? new Date(a.dateAvance).toLocaleDateString('fr') : '—';
        var actions = '';
        if (a.statut === 'en_attente') {
          actions = '<button class="btn-sm btn-success-sm" onclick="approuverAvanceSalaire(\'' + esc(a._id)+ '\')" style="margin-right:4px;">✓</button>'
            + '<button class="btn-sm btn-del-sm" onclick="rejeterAvanceSalaire(\'' + a._id + '\')">✗</button>';
        } else if (a.statut === 'approuvee') {
          actions = '<button class="btn-sm btn-outline" onclick="rembourserAvanceSalaire(\'' + esc(a._id)+ '\')" style="font-size:11px;padding:4px 8px;">Remboursé</button>';
        }
        return '<tr><td style="font-weight:600;">' + esc(empName)+ '</td>'
          + '<td style="font-weight:700;">' + (a.montant||0).toLocaleString('fr-FR',{minimumFractionDigits:2}) + ' €</td>'
          + '<td>' + esc((a.motif||'—'))+ '</td><td>' + esc(date)+ '</td>'
          + '<td><span class="badge ' + esc((statMap[a.statut]||'badge-gray'))+ '">' + esc((statLabel[a.statut]||a.statut))+ '</span></td>'
          + '<td>' + actions + '</td></tr>';
      }).join('');
    }
    async function submitAvanceSalaire() {
      clearModalError('avs');
      var employee = document.getElementById('avs-employe').value;
      var montant = parseFloat(document.getElementById('avs-montant').value) || 0;
      if (!employee || montant <= 0) return modalError('avs', 'Sélectionnez un employé et saisissez un montant.');
      setModalLoading('avs-btn', true, 'Enregistrer');
      try {
        var res = await fetch(API + '/rh/avances', { method:'POST', headers:apiHeaders(), body:JSON.stringify({
          employee, montant,
          motif: document.getElementById('avs-motif').value.trim(),
          dateAvance: document.getElementById('avs-date').value
        }) });
        var data = await res.json();
        if (data.success) { closeModal('modal-avance-salaire'); showToast('Demande enregistrée', 'success'); loadAvances(); }
        else modalError('avs', data.message || 'Erreur.');
      } catch(e) { modalError('avs', 'Erreur réseau.'); }
      setModalLoading('avs-btn', false, 'Enregistrer');
    }
    async function approuverAvanceSalaire(id) {
      var res = await fetch(API + '/rh/avances/' + id + '/approuver', { method:'PUT', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Avance approuvée', 'success'); loadAvances(); }
    }
    async function rejeterAvanceSalaire(id) {
      var res = await fetch(API + '/rh/avances/' + id + '/rejeter', { method:'PUT', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Avance rejetée', 'success'); loadAvances(); }
    }
    async function rembourserAvanceSalaire(id) {
      var res = await fetch(API + '/rh/avances/' + id + '/rembourser', { method:'PUT', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Marquée remboursée', 'success'); loadAvances(); }
    }

    // ── Agenda ──
    async function loadAgenda() {
      var res = await apiFetch('/agenda');
      var list = (res && res.data) ? res.data : [];
      var container = document.getElementById('agenda-list');
      if (!container) return;
      if (!list.length) { container.innerHTML = '<div style="font-size:13px;color:var(--text-dim);padding:20px;text-align:center;">Aucun événement à venir. Créez-en un !</div>'; return; }
      var typeColors = { reunion:'#6366f1', echeance:'#f59e0b', fiscal:'#ef4444', rappel:'#8b5cf6', autre:'#6b7280' };
      var typeIcons = { reunion:'👥', echeance:'⏰', fiscal:'🏛', rappel:'🔔', autre:'📅' };
      container.innerHTML = list.map(function(e) {
        var dt = e.dateDebut ? new Date(e.dateDebut) : null;
        var dateStr = dt ? dt.toLocaleDateString('fr', { weekday:'short', day:'numeric', month:'short' }) : '—';
        var timeStr = dt ? dt.toLocaleTimeString('fr', { hour:'2-digit', minute:'2-digit' }) : '';
        var color = typeColors[e.type] || '#6b7280';
        var icon = typeIcons[e.type] || '📅';
        return '<div style="display:flex;align-items:flex-start;gap:12px;padding:12px;background:rgba(255,255,255,.04);border-left:3px solid ' + esc(color)+ ';border-radius:8px;">'
          + '<div style="font-size:18px;">' + esc(icon)+ '</div>'
          + '<div style="flex:1;">'
          + '<div style="font-weight:600;font-size:13px;">' + esc((e.titre||'—'))+ '</div>'
          + '<div style="font-size:12px;color:var(--text-dim);margin-top:2px;">' + esc(dateStr)+ esc((timeStr ? ' — ' + timeStr : ''))+ esc((e.lieu ? ' · ' + e.lieu : ''))+ '</div>'
          + '</div>'
          + '<button class="btn-sm btn-del-sm" onclick="deleteEvenement(\'' + e._id + '\')">🗑</button>'
          + '</div>';
      }).join('');
    }
    async function loadEcheancesFiscales() {
      var res = await apiFetch('/agenda/echeances-fiscales');
      var list = (res && res.data) ? res.data : [];
      var container = document.getElementById('echeances-fiscales-list');
      if (!container) return;
      if (!list.length) { container.innerHTML = '<div style="font-size:13px;color:var(--text-dim);padding:20px;text-align:center;">Aucune échéance calculée</div>'; return; }
      container.innerHTML = list.map(function(e) {
        var dt = e.date ? new Date(e.date) : null;
        var dateStr = dt ? dt.toLocaleDateString('fr', { day:'numeric', month:'long', year:'numeric' }) : '—';
        var ecart = dt ? Math.ceil((dt - Date.now()) / 86400000) : null;
        var urgColor = ecart !== null ? (ecart <= 7 ? '#f87171' : ecart <= 30 ? '#fbbf24' : '#4ade80') : '#6b7280';
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(255,255,255,.04);border-left:3px solid ' + esc(urgColor)+ ';border-radius:8px;">'
          + '<div><div style="font-weight:600;font-size:13px;">' + esc((e.titre||'—'))+ '</div>'
          + '<div style="font-size:12px;color:var(--text-dim);">' + esc(dateStr)+ '</div></div>'
          + (ecart !== null ? '<div style="font-size:12px;font-weight:700;color:' + urgColor + ';">' + (ecart <= 0 ? 'Expiré' : 'J-' + ecart) + '</div>' : '')
          + '</div>';
      }).join('');
    }
    async function submitAgenda() {
      clearModalError('ag');
      var titre = document.getElementById('ag-titre').value.trim();
      var debut = document.getElementById('ag-debut').value;
      if (!titre || !debut) return modalError('ag', 'Titre et date de début requis.');
      setModalLoading('ag-btn', true, "Créer l'événement");
      try {
        var res = await fetch(API + '/agenda', { method:'POST', headers:apiHeaders(), body:JSON.stringify({
          titre, type: document.getElementById('ag-type').value,
          lieu: document.getElementById('ag-lieu').value.trim(),
          dateDebut: debut, dateFin: document.getElementById('ag-fin').value || null,
          description: document.getElementById('ag-desc').value.trim()
        }) });
        var data = await res.json();
        if (data.success) { closeModal('modal-agenda'); showToast('Événement créé', 'success'); loadAgenda(); }
        else modalError('ag', data.message || 'Erreur.');
      } catch(e) { modalError('ag', 'Erreur réseau.'); }
      setModalLoading('ag-btn', false, "Créer l'événement");
    }
    async function deleteEvenement(id) {
      if (!confirm('Supprimer cet événement ?')) return;
      var res = await fetch(API + '/agenda/' + id, { method:'DELETE', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Événement supprimé', 'success'); loadAgenda(); }
    }

    // ── Équipe & Accès ──
    async function loadEquipe() {
      var res = await apiFetch('/equipe');
      var list = (res && res.data) ? res.data : [];
      var tbody = document.getElementById('equipe-body');
      if (!tbody) return;
      if (!list.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-dim);">Aucun membre</td></tr>'; return; }
      var roleLabels = { superAdmin:'Super Admin', admin:'Admin', comptable:'Comptable', manager:'Manager', employe:'Employé', lecture:'Lecture seule' };
      var roleBadges = { superAdmin:'badge-red', admin:'badge-yellow', comptable:'badge-green', manager:'badge-green', employe:'badge-gray', lecture:'badge-gray' };
      tbody.innerHTML = list.map(function(m) {
        return '<tr>'
          + '<td style="font-weight:600;">' + esc((m.prenom||''))+ ' ' + esc((m.nom||''))+ '</td>'
          + '<td>' + esc((m.email||'—'))+ '</td>'
          + '<td><span class="badge ' + esc((roleBadges[m.role]||'badge-gray'))+ '">' + esc((roleLabels[m.role]||m.role||'—'))+ '</span></td>'
          + '<td><span class="badge badge-green">Actif</span></td>'
          + '<td><button class="btn-sm btn-del-sm" onclick="supprimerMembre(\'' + m._id + '\')">🗑</button></td>'
          + '</tr>';
      }).join('');
    }
    async function submitInviteMembre() {
      clearModalError('inv');
      var prenom = document.getElementById('inv-prenom').value.trim();
      var nom = document.getElementById('inv-nom').value.trim();
      var email = document.getElementById('inv-email').value.trim();
      var mdp = document.getElementById('inv-mdp').value;
      if (!prenom || !nom || !email || !mdp) return modalError('inv', 'Tous les champs sont requis.');
      if (mdp.length < 8) return modalError('inv', 'Le mot de passe doit faire au moins 8 caractères.');
      setModalLoading('inv-btn', true, 'Créer le compte');
      try {
        var res = await fetch(API + '/equipe', { method:'POST', headers:apiHeaders(), body:JSON.stringify({
          prenom, nom, email, password: mdp, role: document.getElementById('inv-role').value
        }) });
        var data = await res.json();
        if (data.success) { closeModal('modal-invite-membre'); showToast('Membre invité', 'success'); loadEquipe(); }
        else modalError('inv', data.message || 'Erreur.');
      } catch(e) { modalError('inv', 'Erreur réseau.'); }
      setModalLoading('inv-btn', false, 'Créer le compte');
    }
    async function supprimerMembre(id) {
      if (!confirm('Supprimer ce membre ? Cette action est irréversible.')) return;
      var res = await fetch(API + '/equipe/' + id, { method:'DELETE', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Membre supprimé', 'success'); loadEquipe(); }
      else showToast(data.message || 'Erreur', 'error');
    }

    // ── Init ──
    document.addEventListener('DOMContentLoaded', function() {
      // Show user info
      var displayName = ((user.prenom || '') + ' ' + (user.nom || '')).trim() || 'Admin';
      var initials = ((user.prenom ? user.prenom[0] : '') + (user.nom ? user.nom[0] : '')).toUpperCase() || 'AD';

      document.getElementById('user-name').textContent = displayName;
      document.getElementById('user-avatar').textContent = initials;
      document.getElementById('topbar-avatar').textContent = initials;

      // Lien Administration : visible uniquement pour le propriétaire de la
      // plateforme (email = ADMIN_EMAIL côté serveur). Le panel reste protégé
      // par son propre mot de passe (ADMIN_SECRET).
      fetch(API + '/auth/me', { headers: apiHeaders() })
        .then(function(r){ return r.json(); })
        .then(function(d){
          if (d.success && d.data && d.data.isPlatformAdmin) {
            document.getElementById('nav-admin').style.display = '';
          }
        })
        .catch(function(){});

      // Load all data
      loadKPIs();
      loadHealthScore();
      loadCopilote();
      loadInvoices();
      loadTasks();
      loadInsights();
      loadStockAlerts();
      loadActivity();
      loadChart();
      loadNotifications();

      checkOnboarding();

      // Keepalive ping every 14 min to prevent Render free tier sleep
      setInterval(function() {
        fetch('https://nexulys-backend-1.onrender.com/api/health/live').catch(function() {});
      }, 14 * 60 * 1000);

      // Register service worker for PWA
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(function() {});
      }
    });
    // ── Contrats Clients ──
    async function loadContratsClients() {
      var res = await apiFetch('/contrats-clients');
      var list = (res && res.data) ? res.data : [];
      var tbody = document.getElementById('contrats-clients-body');
      if (!tbody) return;
      var statutMap = { actif:'badge-green', expire:'badge-red', resilie:'badge-gray', en_negociation:'badge-yellow', renouvellement_prevu:'badge-blue' };
      var statutLabel = { actif:'Actif', expire:'Expiré', resilie:'Résilié', en_negociation:'En négociation', renouvellement_prevu:'Renouvellement' };
      if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-dim);">Aucun contrat client</td></tr>'; return; }
      tbody.innerHTML = list.map(function(c) {
        var fin = c.dateFin ? new Date(c.dateFin).toLocaleDateString('fr') : '—';
        var alerte = '';
        if (c.dateFin && c.statut === 'actif') {
          var jours = Math.ceil((new Date(c.dateFin) - new Date()) / 86400000);
          if (jours <= 30 && jours > 0) alerte = ' <span style="color:#f59e0b;font-size:11px;">⚠️ ' + esc(jours)+ 'j</span>';
          else if (jours <= 0) alerte = ' <span style="color:#f87171;font-size:11px;">⚠️ Expiré</span>';
        }
        return '<tr>'
          + '<td style="font-weight:600;color:#a5b4fc;">' + esc((c.reference || '—'))+ '</td>'
          + '<td>' + esc((c.client && c.client.nom ? c.client.nom : '—'))+ '</td>'
          + '<td>' + esc((c.titre || '—'))+ '</td>'
          + '<td style="color:var(--text-muted);">' + esc((c.type || '—'))+ '</td>'
          + '<td>' + esc(fin)+ esc(alerte)+ '</td>'
          + '<td style="font-weight:700;">' + (c.valeur || 0).toLocaleString('fr') + ' €</td>'
          + '<td><span class="badge ' + esc((statutMap[c.statut] || 'badge-gray'))+ '">' + esc((statutLabel[c.statut] || c.statut))+ '</span>' + (c.signe ? ' <span class="badge badge-green" title="Signé le ' + (c.signedAt ? new Date(c.signedAt).toLocaleDateString('fr') : '') + '">✍️ signé</span>' : '') + '</td>'
          + '<td>' + (c.signe ? '' : '<button class="btn-sm" onclick="envoyerContratSignature(\'' + c._id + '\')" title="Envoyer pour signature">✍️</button> ') + '<button class="btn-sm btn-del-sm" onclick="deleteContratClient(\'' + c._id + '\')">🗑</button></td>'
          + '</tr>';
      }).join('');
    }

    async function submitContratClient() {
      var nom = document.getElementById('cc-client-nom').value.trim();
      var titre = document.getElementById('cc-titre').value.trim();
      var debut = document.getElementById('cc-debut').value;
      if (!nom || !titre || !debut) { document.getElementById('cc-error').textContent = 'Client, titre et date de début requis.'; document.getElementById('cc-error').style.display=''; return; }
      setModalLoading('cc-btn', true, 'Créer le contrat');
      try {
        var res = await fetch(API + '/contrats-clients', { method:'POST', headers:apiHeaders(), body:JSON.stringify({
          client: { nom: nom, email: document.getElementById('cc-client-email').value.trim() },
          titre: titre,
          type: document.getElementById('cc-type').value,
          dateDebut: debut,
          dateFin: document.getElementById('cc-fin').value || undefined,
          valeur: parseFloat(document.getElementById('cc-valeur').value) || 0,
          periodicite: document.getElementById('cc-periodicite').value,
          notes: document.getElementById('cc-notes').value.trim()
        }) });
        var data = await res.json();
        if (data.success) { closeModal('modal-contrat-client'); showToast('Contrat créé', 'success'); loadContratsClients(); }
        else { document.getElementById('cc-error').textContent = data.message || 'Erreur.'; document.getElementById('cc-error').style.display=''; }
      } catch(e) { document.getElementById('cc-error').textContent = 'Erreur réseau.'; document.getElementById('cc-error').style.display=''; }
      setModalLoading('cc-btn', false, 'Créer le contrat');
    }

    async function envoyerContratSignature(id) {
      var res = await fetch(API + '/contrats-clients/' + id + '/envoyer-signature', { method:'POST', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) {
        var url = data.data && data.data.url;
        if (url) { try { await navigator.clipboard.writeText(url); } catch(e) {} }
        showToast(data.message + (url ? ' — lien copié' : ''), 'success');
        loadContratsClients();
      } else showToast(data.message || 'Erreur', 'error');
    }

    async function deleteContratClient(id) {
      if (!confirm('Supprimer ce contrat ?')) return;
      var res = await fetch(API + '/contrats-clients/' + id, { method:'DELETE', headers:apiHeaders() });
      var data = await res.json();
      if (data.success) { showToast('Contrat supprimé', 'success'); loadContratsClients(); }
      else showToast(data.message || 'Erreur', 'error');
    }

    // ── Import CSV ──
    var CSV_TEMPLATES = {
      clients: { label: 'Clients / Prospects', headers: 'nom,email,telephone,entreprise', exemple: 'Dupont SA,contact@dupont.fr,0600000000,Dupont SA' },
      produits: { label: 'Produits', headers: 'nom,reference,categorie,prixUnitaire,quantite,seuilAlerte,unite', exemple: 'Ordinateur,REF-001,materiel,800,10,2,unité' },
      employes: { label: 'Employés', headers: 'nom,prenom,email,poste,departement,salaireBase,dateEmbauche', exemple: 'Dupont,Jean,jean@societe.fr,Développeur,IT,3000,2024-01-15' }
    };

    function openImportModal(type) {
      document.getElementById('import-type-select').value = type || 'clients';
      document.getElementById('import-result').style.display = 'none';
      document.getElementById('import-error').style.display = 'none';
      document.getElementById('import-file').value = '';
      updateImportTemplate();
      openModal('import-csv');
    }

    function updateImportTemplate() {
      var type = document.getElementById('import-type-select').value;
      var t = CSV_TEMPLATES[type];
      if (!t) return;
      document.getElementById('import-template-info').innerHTML = '<b>Format attendu (1ère ligne = en-tête) :</b><br><code style="font-family:monospace;">' + esc(t.headers)+ '</code><br><br><b>Exemple :</b><br><code style="font-family:monospace;">' + esc(t.exemple)+ '</code>';
    }

    function exportCSVTemplate() {
      var type = document.getElementById('import-type-select').value;
      var t = CSV_TEMPLATES[type];
      if (!t) return;
      var blob = new Blob([t.headers + '\n' + t.exemple], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.download = 'modele_' + type + '.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    }

    async function submitImport() {
      var type = document.getElementById('import-type-select').value;
      var file = document.getElementById('import-file').files[0];
      if (!file) { document.getElementById('import-error').textContent = 'Veuillez sélectionner un fichier CSV.'; document.getElementById('import-error').style.display = ''; return; }
      document.getElementById('import-error').style.display = 'none';
      document.getElementById('import-result').style.display = 'none';
      setModalLoading('import-btn', true, 'Importer');
      try {
        var formData = new FormData();
        formData.append('file', file);
        var res = await fetch(API + '/import/' + type, { method: 'POST', credentials: 'include', headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('novexa_token') || '') }, body: formData });
        var data = await res.json();
        if (data.success) {
          var resultEl = document.getElementById('import-result');
          resultEl.style.display = '';
          resultEl.style.background = data.data && data.data.errors && data.data.errors.length > 0 ? 'rgba(245,158,11,.12)' : 'rgba(74,222,128,.12)';
          resultEl.style.color = data.data && data.data.errors && data.data.errors.length > 0 ? '#fbbf24' : '#4ade80';
          resultEl.textContent = data.message;
        } else { document.getElementById('import-error').textContent = data.message || 'Erreur import.'; document.getElementById('import-error').style.display = ''; }
      } catch(e) { document.getElementById('import-error').textContent = 'Erreur réseau.'; document.getElementById('import-error').style.display = ''; }
      setModalLoading('import-btn', false, 'Importer');
    }

    // ── RGPD & Audit Log ──
    async function exportRGPDData() {
      showToast('Préparation de l\'export...', 'info');
      try {
        var response = await fetch(API + '/auth/rgpd/export', { headers: apiHeaders() });
        if (!response.ok) { showToast('Erreur export RGPD', 'error'); return; }
        var blob = await response.blob();
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a'); a.href = url; a.download = 'mes_donnees_novexa.json'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        showToast('Export téléchargé', 'success');
      } catch(e) { showToast('Erreur réseau', 'error'); }
    }

    async function requestAccountDeletion() {
      var motif = prompt('Motif de la demande de suppression (optionnel) :');
      if (motif === null) return;
      if (!confirm('Êtes-vous sûr ? Votre demande sera traitée sous 30 jours.')) return;
      var res = await fetch(API + '/auth/rgpd/supprimer', { method:'POST', headers:apiHeaders(), body:JSON.stringify({ motif: motif }) });
      var data = await res.json();
      if (data.success) showToast(data.message || 'Demande enregistrée', 'success');
      else showToast(data.message || 'Erreur', 'error');
    }

    async function loadAuditLog() {
      var res = await apiFetch('/audit?limit=20');
      var logs = (res && res.data) ? res.data : [];
      var container = document.getElementById('audit-log-container');
      if (!container) return;
      if (!logs.length) { container.innerHTML = '<div style="font-size:13px;color:var(--text-dim);">Aucune activité enregistrée</div>'; return; }
      container.innerHTML = logs.map(function(l) {
        var date = new Date(l.createdAt).toLocaleDateString('fr') + ' ' + new Date(l.createdAt).toLocaleTimeString('fr', {hour:'2-digit',minute:'2-digit'});
        return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:12px;">'
          + '<div><span style="color:#a5b4fc;font-weight:600;">' + esc((l.userNom || 'Système'))+ '</span> — ' + esc((l.details || l.action))+ '</div>'
          + '<div style="color:var(--text-dim);white-space:nowrap;margin-left:8px;">' + esc(date)+ '</div>'
          + '</div>';
      }).join('');
    }

    // ── Onboarding ──
    function checkOnboarding() {
      if (!localStorage.getItem('novexa_onboarded')) {
        document.getElementById('modal-onboarding').style.display = 'flex';
      }
    }

    function goOnboardingStep(section) {
      dismissOnboarding();
      switchSection(section);
    }

    function dismissOnboarding() {
      localStorage.setItem('novexa_onboarded', '1');
      document.getElementById('modal-onboarding').style.display = 'none';
    }
