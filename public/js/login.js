const API = 'https://nexulys-backend-1.onrender.com/api';

    // L'hébergement du backend met l'instance en veille après une période d'inactivité :
    // la première requête réveille le service et peut mettre près d'une minute. Sans
    // délai maximum explicite, `fetch` attend indéfiniment et l'utilisateur voit une
    // page qui ne réagit pas — le symptôme « rien ne se passe ». On borne l'attente et
    // on dit ce qui se passe pendant.
    const DELAI_MAX_MS = 45000;
    const DELAI_REVEIL_MS = 3500;

    // ── Appel API : ne lève jamais, classe la panne ──
    // Chaque mode de défaillance a sa cause et son remède. Les confondre sous un
    // « Erreur réseau » générique rend le problème indiagnosticable pour l'utilisateur
    // comme pour le support.
    async function appelApi(chemin, options) {
      const opts = options || {};
      const controleur = new AbortController();
      const minuterie = setTimeout(function() { controleur.abort(); }, DELAI_MAX_MS);

      if (navigator.onLine === false) {
        clearTimeout(minuterie);
        return { ok: false, raison: 'hors_ligne' };
      }

      let reponse;
      try {
        reponse = await fetch(API + chemin, {
          method: opts.method || 'GET',
          headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {}),
          credentials: 'include',
          signal: controleur.signal,
          body: opts.body ? JSON.stringify(opts.body) : undefined
        });
      } catch (err) {
        clearTimeout(minuterie);
        if (err && err.name === 'AbortError') return { ok: false, raison: 'delai' };
        // `fetch` rejette avec un TypeError indifférencié pour l'hôte injoignable, le
        // certificat refusé et le blocage CORS : le navigateur ne nous dit pas lequel.
        return { ok: false, raison: 'injoignable', detail: err && err.message };
      }
      clearTimeout(minuterie);

      // Un intermédiaire en panne (502, 503, 504) répond en HTML : `res.json()` lèverait
      // une SyntaxError qu'on aurait prise pour une panne réseau.
      const brut = await reponse.text().catch(function() { return ''; });
      let data = null;
      if (brut) {
        try { data = JSON.parse(brut); } catch (_) { data = null; }
      }
      if (data === null) {
        return { ok: false, raison: 'reponse_invalide', statut: reponse.status, extrait: brut.slice(0, 120) };
      }
      return { ok: reponse.ok && data.success !== false, statut: reponse.status, data: data };
    }

    // ── Message d'erreur : la cause, puis le remède ──
    function messageErreur(r, contexte) {
      if (r.raison === 'hors_ligne')  return 'Vous semblez hors ligne. Vérifiez votre connexion internet.';
      if (r.raison === 'delai')       return 'Le serveur n’a pas répondu en 45 secondes. Il était probablement en veille : réessayez, la seconde tentative est généralement immédiate.';
      if (r.raison === 'injoignable') return 'Impossible de joindre le serveur (' + API.replace('/api', '') + '). Soit le service est arrêté, soit ce site n’est pas autorisé à l’appeler. La page /diagnostic.html indique lequel des deux.';
      if (r.raison === 'reponse_invalide') {
        if (r.statut === 502 || r.statut === 503 || r.statut === 504) {
          return 'Le serveur est momentanément indisponible (erreur ' + r.statut + '). Réessayez dans une minute.';
        }
        return 'Réponse inattendue du serveur (HTTP ' + r.statut + '). Détail : ' + (r.extrait || 'corps vide');
      }
      if (r.statut === 429) return 'Trop de tentatives. Patientez quelques minutes avant de réessayer.';
      if (r.statut === 403 && r.data && r.data.message) return r.data.message;
      const d = r.data || {};
      return d.message
        || (d.errors && d.errors[0] && d.errors[0].message)
        || (contexte || 'La demande a échoué.');
    }

    // ── Tab switcher ──
    function switchTab(tab) {
      ['login','register','forgot','reset'].forEach(function(p) {
        document.getElementById('panel-' + p).classList.toggle('active', p === tab);
      });
      document.getElementById('tab-login').classList.toggle('active', tab === 'login');
      document.getElementById('tab-register').classList.toggle('active', tab === 'register');
      hideBanner();
    }

    // ── Banner helpers ──
    function showBanner(msg, type) {
      const el = document.getElementById('message-banner');
      el.textContent = msg;
      el.className = 'message-banner visible ' + type;
      el.setAttribute('role', type === 'error' ? 'alert' : 'status');
      // Sur mobile, clavier ouvert et page défilée, la bannière apparaît hors écran :
      // l'utilisateur conclut que le bouton ne fait rien.
      if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    function showError(msg) { showBanner(msg, 'error'); }
    function showSuccess(msg) { showBanner(msg, 'success'); }
    function hideBanner() {
      const el = document.getElementById('message-banner');
      el.className = 'message-banner';
      el.removeAttribute('role');
    }

    // ── Loading state helpers ──
    let minuterieReveil = null;
    function setLoading(btnId, labelId, loading, labelText) {
      const btn = document.getElementById(btnId);
      const label = document.getElementById(labelId);
      btn.disabled = loading;
      if (loading) {
        label.textContent = '';
        const spinner = document.createElement('span');
        spinner.className = 'spinner';
        spinner.id = 'spinner-' + btnId;
        label.parentNode.insertBefore(spinner, label);
        // Une attente muette de quarante secondes est indistinguable d'une panne.
        minuterieReveil = setTimeout(function() {
          showBanner('Le serveur sort de veille, cela peut prendre jusqu’à une minute. Ne fermez pas la page.', 'success');
        }, DELAI_REVEIL_MS);
      } else {
        clearTimeout(minuterieReveil);
        minuterieReveil = null;
        const spinner = document.getElementById('spinner-' + btnId);
        if (spinner) spinner.remove();
        label.textContent = labelText;
      }
    }

    function ouvrirSession(data) {
      localStorage.setItem('novexa_token', data.token);
      localStorage.setItem('novexa_user', JSON.stringify(data.utilisateur));
      window.location.href = '/dashboard.html';
    }

    // ── Login ──
    async function handleLogin(e) {
      e.preventDefault();
      hideBanner();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      if (!email || !password) return showError('Renseignez votre e-mail et votre mot de passe.');

      setLoading('btn-login', 'btn-login-label', true, 'Se connecter');
      const r = await appelApi('/auth/login', { method: 'POST', body: { email: email, password: password } });
      setLoading('btn-login', 'btn-login-label', false, 'Se connecter');

      if (r.ok && r.data && r.data.data && r.data.data.token) return ouvrirSession(r.data.data);
      if (r.ok) return showError('Le serveur a accepté la connexion sans renvoyer de jeton. Signalez-le au support.');
      showError(messageErreur(r, 'Connexion refusée.'));
    }

    // ── Register ──
    async function handleRegister(e) {
      e.preventDefault();
      hideBanner();
      const formData = {
        prenom: document.getElementById('reg-prenom').value.trim(),
        nom: document.getElementById('reg-nom').value.trim(),
        email: document.getElementById('reg-email').value.trim(),
        password: document.getElementById('reg-password').value,
        nomEntreprise: document.getElementById('reg-entreprise').value.trim()
      };
      setLoading('btn-register', 'btn-register-label', true, 'Créer mon compte');
      const r = await appelApi('/auth/register', { method: 'POST', body: formData });
      setLoading('btn-register', 'btn-register-label', false, 'Créer mon compte');

      if (r.ok && r.data && r.data.data && r.data.data.token) {
        localStorage.setItem('novexa_token', r.data.data.token);
        localStorage.setItem('novexa_user', JSON.stringify(r.data.data.utilisateur));
        showSuccess(r.data.message || 'Compte créé avec succès ! Redirection...');
        return setTimeout(function() { window.location.href = '/dashboard.html'; }, 1500);
      }
      showError(messageErreur(r, 'Inscription refusée.'));
    }

    // ── Forgot password ──
    async function handleForgot(e) {
      e.preventDefault();
      hideBanner();
      const email = document.getElementById('forgot-email').value.trim();
      setLoading('btn-forgot', 'btn-forgot-label', true, 'Envoyer le lien');
      const r = await appelApi('/auth/forgot-password', { method: 'POST', body: { email: email } });
      setLoading('btn-forgot', 'btn-forgot-label', false, 'Envoyer le lien');

      if (r.ok) {
        showSuccess((r.data && r.data.message) || 'Si un compte existe pour cette adresse, un lien vient d’être envoyé.');
        document.getElementById('form-forgot').reset();
        return;
      }
      showError(messageErreur(r, 'Envoi impossible.'));
    }

    // ── Reset password ──
    async function handleReset(e) {
      e.preventDefault();
      hideBanner();
      const password = document.getElementById('reset-password').value;
      const password2 = document.getElementById('reset-password2').value;
      if (password !== password2) return showError('Les mots de passe ne correspondent pas.');
      const token = document.getElementById('reset-token').value;

      setLoading('btn-reset', 'btn-reset-label', true, 'Réinitialiser');
      const r = await appelApi('/auth/reset-password', { method: 'POST', body: { token: token, password: password } });
      setLoading('btn-reset', 'btn-reset-label', false, 'Réinitialiser');

      if (r.ok) {
        showSuccess(((r.data && r.data.message) || 'Mot de passe réinitialisé.') + ' Redirection...');
        return setTimeout(function() { switchTab('login'); }, 2000);
      }
      showError(messageErreur(r, 'Lien invalide ou expiré.'));
    }

    // ── Admin modal ──
    function openAdminModal() {
      document.getElementById('admin-modal-overlay').classList.add('open');
      document.getElementById('admin-modal-error').textContent = '';
      document.getElementById('admin-modal-btn').disabled = false;
      document.getElementById('admin-modal-btn').textContent = 'Accéder';
      setTimeout(function() { document.getElementById('admin-pwd').focus(); }, 80);
    }
    function closeAdminModal() {
      document.getElementById('admin-modal-overlay').classList.remove('open');
      document.getElementById('admin-pwd').value = '';
      document.getElementById('admin-modal-error').textContent = '';
    }
    function handleOverlayClick(e) {
      if (e.target === document.getElementById('admin-modal-overlay')) closeAdminModal();
    }
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeAdminModal();
    });
    document.getElementById('admin-pwd').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') doAdminLogin();
    });
    async function doAdminLogin() {
      var pwd = document.getElementById('admin-pwd').value.trim();
      var errEl = document.getElementById('admin-modal-error');
      var btn = document.getElementById('admin-modal-btn');
      if (!pwd) { errEl.textContent = 'Entrez le mot de passe.'; return; }
      btn.disabled = true;
      btn.textContent = '...';
      errEl.textContent = '';
      // Chemin absolu : le frontend et l'API sont sur des domaines distincts, un
      // chemin relatif viserait l'hébergeur des pages, qui n'a pas de route /api.
      var r = await appelApi('/admin/login', { method: 'POST', body: { password: pwd } });
      if (r.ok && r.data && r.data.token) {
        sessionStorage.setItem('novexa_admin_token', r.data.token);
        window.location.href = '/admin.html';
        return;
      }
      errEl.textContent = messageErreur(r, 'Mot de passe incorrect.');
      btn.disabled = false;
      btn.textContent = 'Accéder';
    }

    // ── État d'arrivée sur la page ──
    (function() {
      const params = new URLSearchParams(window.location.search);

      // Le tableau de bord renvoie ici avec ?expire=1 quand l'API a rejeté le jeton.
      // Sans ce message, l'utilisateur voit la page de connexion réapparaître sans
      // explication et conclut que « rien ne se passe ».
      if (params.get('expire')) {
        showError('Votre session a expiré. Reconnectez-vous.');
      } else if (localStorage.getItem('novexa_token')) {
        window.location.href = '/dashboard.html';
        return;
      }

      const resetToken = params.get('reset');
      if (resetToken) {
        document.getElementById('reset-token').value = resetToken;
        switchTab('reset');
      }
    })();

    // ── PWA : enregistrement du service worker ──
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(function() {});
    }
