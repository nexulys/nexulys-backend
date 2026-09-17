// Fade-in on scroll using IntersectionObserver
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

    // Navbar scroll effect
    const nav = document.querySelector('nav');
    window.addEventListener('scroll', () => {
      if (window.scrollY > 60) {
        nav.style.background = 'rgba(10,10,15,0.95)';
        nav.style.boxShadow = '0 4px 30px rgba(0,0,0,0.4)';
      } else {
        nav.style.background = 'rgba(10,10,15,0.8)';
        nav.style.boxShadow = 'none';
      }
    });

    // ── Switch de facturation mensuel / annuel (2 mois offerts) ──
    function setBilling(mode) {
      var annuel = mode === 'annuel';
      document.getElementById('bt-mensuel').classList.toggle('active', !annuel);
      document.getElementById('bt-annuel').classList.toggle('active', annuel);
      document.querySelectorAll('.price-value').forEach(function(el) {
        var m = parseInt(el.getAttribute('data-monthly'), 10);
        // annuel : 10 mois payés pour 12 (2 offerts) -> mensualité équivalente
        var affiche = annuel ? Math.round(m * 0.85) : m;
        el.textContent = affiche + ' €';
      });
      document.querySelectorAll('.price-annual-note').forEach(function(el) {
        var m = parseInt(el.getAttribute('data-monthly'), 10);
        el.textContent = annuel ? ('Facturé ' + Math.round(m * 12 * 0.85) + ' €/an · 15 % offerts') : '';
      });
    }
