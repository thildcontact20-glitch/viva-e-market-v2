/* ═══════════════════════════════════════════
   VIVA E-MARKET — Shared Navigation & Footer
   Injecté dynamiquement sur chaque page
   ═══════════════════════════════════════════ */

(function () {
  'use strict';

  /* ─── Highlight current page in nav ─── */
  function getPageName() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    return path;
  }

  /* ─── Inject Navigation Bar ─── */
  function injectNav() {
    if (document.getElementById('site-nav-injected')) return;
    const page = getPageName();
    const navHTML = `
    <nav class="site-nav" id="site-nav-injected">
      <div class="nav-inner">
        <div class="nav-left">
          <a href="index.html" class="nav-logo">
            <img src="logo/logo-sm.png" alt="VIVALYS" class="nav-logo-img">
            VIVA E-MARKET
          </a>
        </div>
        <button class="hamburger" id="navToggle" aria-label="Menu">
          <i class="fas fa-bars"></i>
        </button>
        <div class="nav-right">
          <div class="nav-links" id="navLinks">
            <a href="index.html" class="${page === 'index.html' ? 'active' : ''}">Accueil</a>
            <a href="vins.html" class="${page === 'vins.html' ? 'active' : ''}">Vins</a>
            <a href="spiritueux.html" class="${page === 'spiritueux.html' ? 'active' : ''}">Spiritueux</a>
            <a href="epicerie.html" class="${page === 'epicerie.html' ? 'active' : ''}">Épicerie</a>
            <a href="menager.html" class="${page === 'menager.html' ? 'active' : ''}">Produits Ménagers</a>
          </div>
          <button class="theme-toggle" id="themeToggle" aria-label="Theme">
            <i class="fas fa-moon"></i>
          </button>
        </div>
      </div>
    </nav>`;
    document.body.insertAdjacentHTML('afterbegin', navHTML);
  }

  /* ─── Inject Footer ─── */
  function injectFooter() {
    if (document.getElementById('site-footer-injected')) return;
    const footerHTML = `
    <footer id="site-footer-injected">
      <div class="footer-grid">
        <div>
          <div class="footer-brand">
            <span class="diamond" style="display:inline-block;width:8px;height:8px;background:var(--gold);transform:rotate(45deg);margin-right:8px;"></span>
            VIVA E-MARKET
          </div>
          <p class="footer-desc">Plateforme B2B de Commerce International Africain. Distribution exclusive des plus grandes marques mondiales. Vivalys Compagny &copy; 2026.</p>
          <div style="margin-top:20px;">
            <p class="footer-contact"><i class="fas fa-map-marker-alt"></i> Abidjan, C&ocirc;te d'Ivoire</p>
            <p class="footer-contact"><i class="fas fa-envelope"></i> contact@vivalys.com</p>
            <p class="footer-contact"><i class="fas fa-phone"></i> +225 01 02 03 04 05</p>
          </div>
        </div>
        <div>
          <div class="footer-title">Liens</div>
          <ul class="footer-links">
            <li><a href="index.html">Accueil</a></li>
            <li><a href="vins.html">Vins</a></li>
            <li><a href="spiritueux.html">Spiritueux</a></li>
            <li><a href="epicerie.html">&Eacute;picerie</a></li>
            <li><a href="menager.html">Produits M&eacute;nagers</a></li>
          </ul>
        </div>
        <div>
          <div class="footer-title">Contact</div>
          <ul class="footer-links">
            <li><a href="mailto:contact@vivalys.com">Email</a></li>
            <li><a href="#">LinkedIn</a></li>
            <li><a href="#">WhatsApp</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>&copy; 2026 Vivalys Compagny &mdash; Tous droits r&eacute;serv&eacute;s</span>
        <div class="footer-socials">
          <a href="#" aria-label="LinkedIn"><i class="fab fa-linkedin-in"></i></a>
          <a href="#" aria-label="Instagram"><i class="fab fa-instagram"></i></a>
          <a href="#" aria-label="Twitter"><i class="fab fa-twitter"></i></a>
          <a href="#" aria-label="WhatsApp"><i class="fab fa-whatsapp"></i></a>
        </div>
      </div>
    </footer>`;
    // Insert before the closing body tag
    const bodyEnd = document.querySelector('body > :last-child');
    if (bodyEnd) {
      bodyEnd.insertAdjacentHTML('afterend', footerHTML);
    } else {
      document.body.insertAdjacentHTML('beforeend', footerHTML);
    }
  }

  /* ─── Theme Toggle ─── */
  function initTheme() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    const html = document.documentElement;
    const icon = toggle.querySelector('i');

    // Set default theme
    const saved = localStorage.getItem('viva-theme') || 'dark';
    html.setAttribute('data-theme', saved);
    icon.className = saved === 'dark' ? 'fas fa-moon' : 'fas fa-sun';

    toggle.addEventListener('click', function () {
      const current = html.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('viva-theme', next);
      icon.className = next === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    });
  }

  /* ─── Mobile Menu Toggle ─── */
  function initMobileMenu() {
    const toggle = document.getElementById('navToggle');
    const links = document.getElementById('navLinks');
    if (!toggle || !links) return;

    toggle.addEventListener('click', function () {
      links.classList.toggle('open');
      const icon = toggle.querySelector('i');
      if (icon) {
        icon.className = links.classList.contains('open')
          ? 'fas fa-times'
          : 'fas fa-bars';
      }
    });

    // Close menu on link click
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        links.classList.remove('open');
        const icon = toggle.querySelector('i');
        if (icon) icon.className = 'fas fa-bars';
      });
    });
  }

  /* ─── Scroll shadow on nav ─── */
  function initScrollShadow() {
    const nav = document.querySelector('.site-nav');
    if (!nav) return;
    window.addEventListener('scroll', function () {
      nav.classList.toggle('scrolled', window.scrollY > 10);
    });
    // Initial check
    if (window.scrollY > 10) nav.classList.add('scrolled');
  }

  /* ─── Init everything when DOM is ready ─── */
  function init() {
    injectNav();
    injectFooter();
    // Delay theme/menu init slightly so DOM elements exist
    requestAnimationFrame(function () {
      initTheme();
      initMobileMenu();
      initScrollShadow();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
