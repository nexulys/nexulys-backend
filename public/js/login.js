const API = 'https://nexulys-backend-1.onrender.com/api';

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
    }
    function showError(msg) { showBanner(msg, 'error'); }
    function showSuccess(msg) { showBanner(msg, 'success'); }
    function hideBanner() {
      const el = document.getElementById('message-banner');
      el.className = 'message-banner';
    }

    // ── Loading state helpers ──
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
      } else {
        const spinner = document.getElementById('spinner-' + btnId);
        if (spinner) spinner.remove();
        label.textContent = labelText;
      }
    }

    // ── Login ──
    async function login(email, password) {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('novexa_token', data.data.token);
        localStorage.setItem('novexa_user', JSON.stringify(data.data.utilisateur));
        window.location.href = '/dashboard.html';
      } else {
        showError(data.message || (data.errors && data.errors[0] && data.errors[0].message) || 'Erreur de connexion');
      }
    }

    async function handleLogin(e) {
      e.preventDefault();
      hideBanner();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      setLoading('btn-login', 'btn-login-label', true, 'Se connecter');
      try {
        await login(email, password);
      } catch (err) {
        showError('Erreur réseau. Veuillez réessayer.');
      } finally {
        setLoading('btn-login', 'btn-login-label', false, 'Se connecter');
      }
    }

    // ── Register ──
    async function register(formData) {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('novexa_token', data.data.token);
        localStorage.setItem('novexa_user', JSON.stringify(data.data.utilisateur));
        showSuccess(data.message || 'Compte créé avec succès ! Redirection...');
        setTimeout(() => { window.location.href = '/dashboard.html'; }, 1500);
      } else {
        showError(data.message || (data.errors && data.errors[0] && data.errors[0].message) || 'Erreur d\'inscription');
      }
    }

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
      try {
        await register(formData);
      } catch (err) {
        showError('Erreur réseau. Veuillez réessayer.');
      } finally {
        setLoading('btn-register', 'btn-register-label', false, 'Créer mon compte');
      }
    }

    // ── Forgot password ──
    async function handleForgot(e) {
      e.preventDefault();
      hideBanner();
      const email = document.getElementById('forgot-email').value.trim();
      setLoading('btn-forgot', 'btn-forgot-label', true, 'Envoyer le lien');
      try {
        const res = await fetch(`${API}/auth/forgot-password`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess(data.message);
          document.getElementById('form-forgot').reset();
        } else {
          showError(data.message || 'Erreur');
        }
      } catch (err) { showError('Erreur réseau. Veuillez réessayer.'); }
      finally { setLoading('btn-forgot', 'btn-forgot-label', false, 'Envoyer le lien'); }
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
      try {
        const res = await fetch(`${API}/auth/reset-password`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess(data.message + ' Redirection...');
          setTimeout(function() { switchTab('login'); }, 2000);
        } else {
          showError(data.message || 'Lien invalide ou expiré.');
        }
      } catch (err) { showError('Erreur réseau.'); }
      finally { setLoading('btn-reset', 'btn-reset-label', false, 'Réinitialiser'); }
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
      try {
        var res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pwd })
        });
        var data = await res.json();
        if (data.success) {
          sessionStorage.setItem('novexa_admin_token', data.token);
          window.location.href = '/admin.html';
        } else {
          errEl.textContent = data.message || 'Mot de passe incorrect.';
          btn.disabled = false;
          btn.textContent = 'Accéder';
        }
      } catch (err) {
        errEl.textContent = 'Erreur réseau.';
        btn.disabled = false;
        btn.textContent = 'Accéder';
      }
    }

    // ── Redirect if already logged in ──
    (function() {
      if (localStorage.getItem('novexa_token')) window.location.href = '/dashboard.html';
      // Check for reset token in URL
      const params = new URLSearchParams(window.location.search);
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
