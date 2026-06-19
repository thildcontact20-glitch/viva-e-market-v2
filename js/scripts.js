/* ═══════════════════════════════════════════════════════════════════════════════
   VIVA E-MARKET — Scripts Complets
   ───────────────────────────────────────────────────────────────────────────────
   1. THREE.JS GLOBE  → Globe terrestre 3D avec ports, routes, particules
   2. SPA NAVIGATION   → Système de navigation sans framework (afficher/masquer)
   3. TRACKING TIMELINE → Timeline animée au scroll (GSAP + IntersectionObserver)
   ═══════════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════════════════════
     1️⃣  THREE.JS GLOBE — Carte mondiale interactive
         Charge Three.js r128 depuis CDN ; crée un globe avec texture, ports
         lumineux, routes courbes animées entre ports, rotation automatique.
         ─── Données intégrées (pas de fetch) ───
         Ports : Abidjan, Shanghai, Rotterdam, Le Havre, Marseille,
                 New York, Dubai, Lagos, Douala, Dakar
         Routes : chaque port → Abidjan (hub central)
     ═══════════════════════════════════════════════════════════════════════════ */

  // ─── Ports du réseau Viva Import Export ───
  const PORTS = [
    { name: 'Abidjan',   lat:  5.32,  lng: -4.02,  country: "Côte d'Ivoire",  desc: 'Hub Principal' },
    { name: 'Shanghai',  lat: 31.23,  lng: 121.47, country: 'Chine',           desc: 'Port Asie' },
    { name: 'Rotterdam', lat: 51.92,  lng:   4.48, country: 'Pays-Bas',        desc: 'Port Europe Nord' },
    { name: 'Le Havre',  lat: 49.49,  lng:   0.11, country: 'France',          desc: 'Port Europe Ouest' },
    { name: 'Marseille', lat: 43.30,  lng:   5.37, country: 'France',          desc: 'Port Méditerranée' },
    { name: 'New York',  lat: 40.64,  lng: -74.04, country: 'États-Unis',      desc: 'Port Amérique' },
    { name: 'Dubaï',     lat: 25.20,  lng:  55.27, country: 'EAU',             desc: 'Port Moyen-Orient' },
    { name: 'Lagos',     lat:  6.45,  lng:   3.39, country: 'Nigeria',         desc: 'Port Afrique Ouest' },
    { name: 'Douala',    lat:  4.05,  lng:   9.70, country: 'Cameroun',        desc: 'Port Afrique Centrale' },
    { name: 'Dakar',     lat: 14.69,  lng: -17.44, country: 'Sénégal',         desc: 'Port Afrique Nord-Ouest' },
  ];

  // ─── Routes : chaque port → Abidjan ───
  const ROUTES = PORTS
    .filter(function (p) { return p.name !== 'Abidjan'; })
    .map(function (p) {
      return { from: p, to: PORTS[0] }; // tous vers Abidjan
    });

  // ─── Variables du globe ───
  var VivaGlobe = {
    scene: null,
    camera: null,
    renderer: null,
    globe: null,
    glow: null,
    clock: null,
    flowParticles: [],
    cityDots: [],
    arcLines: [],
    mouseX: 0,
    mouseY: 0,
    targetRotY: 0,
    container: null,
    tooltip: null,
    raycaster: null,
    pointer: null,
    cities: PORTS,
    routes: ROUTES,
    isRunning: false,
    animationId: null,
  };

  /**
   * Convertit latitude/longitude en Vector3 Three.js
   * @param {number} lat  — Latitude en degrés
   * @param {number} lng  — Longitude en degrés
   * @param {number} r    — Rayon de la sphère
   * @returns {THREE.Vector3}
   */
  function latLngToVec3(lat, lng, r) {
    var phi   = (90 - lat) * Math.PI / 180;
    var theta = lng * Math.PI / 180;
    return new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * r,
      Math.cos(phi) * r,
      Math.sin(phi) * Math.sin(theta) * r
    );
  }

  /**
   * Initialise le globe 3D complet
   * @param {string|HTMLElement} containerSelector — Sélecteur ou élément DOM
   */
  window.VivaGlobeInit = function (containerSelector) {
    var container = (typeof containerSelector === 'string')
      ? document.querySelector(containerSelector)
      : containerSelector;

    if (!container) {
      console.warn('[VivaGlobe] Container introuvable :', containerSelector);
      return;
    }

    // Éviter double initialisation
    if (VivaGlobe.isRunning) return;
    VivaGlobe.container = container;

    var w = container.clientWidth  || 600;
    var h = container.clientHeight || 400;

    /* ─── Scene ─── */
    VivaGlobe.scene = new THREE.Scene();

    /* ─── Camera ─── */
    VivaGlobe.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    VivaGlobe.camera.position.z = 3.5;

    /* ─── Renderer ─── */
    VivaGlobe.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    VivaGlobe.renderer.setSize(w, h);
    VivaGlobe.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    VivaGlobe.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(VivaGlobe.renderer.domElement);

    /* ─── Stars (toile de fond) ─── */
    var starCount = 1500;
    var starPos   = new Float32Array(starCount * 3);
    var starSizes = new Float32Array(starCount);
    for (var i = 0; i < starCount; i++) {
      var r2 = 10 + Math.random() * 40;
      starPos[i * 3]     = (Math.random() - 0.5) * r2 * 2;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * r2 * 2;
      starPos[i * 3 + 2] = (Math.random() - 0.5) * r2 * 2 - 10;
      starSizes[i] = 0.02 + Math.random() * 0.08;
    }
    var starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    starGeo.setAttribute('size', new THREE.Float32BufferAttribute(starSizes, 1));
    var starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.015,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
    });
    VivaGlobe.scene.add(new THREE.Points(starGeo, starMat));

    /* ─── Globe principal ─── */
    var geo = new THREE.SphereGeometry(1, 96, 96);
    var mat = new THREE.MeshPhongMaterial({
      color: 0x0f1d3d,
      emissive: 0x050e1f,
      emissiveIntensity: 0.4,
      specular: 0x1a2a4a,
      shininess: 15,
      transparent: true,
      opacity: 0.92,
    });
    VivaGlobe.globe = new THREE.Mesh(geo, mat);
    VivaGlobe.scene.add(VivaGlobe.globe);

    /* ─── Fil de fer subtil ─── */
    var wireGeo = new THREE.EdgesGeometry(new THREE.SphereGeometry(1.003, 48, 36));
    var wireMat = new THREE.LineBasicMaterial({
      color: 0x4a8abf,
      transparent: true,
      opacity: 0.08,
    });
    VivaGlobe.scene.add(new THREE.LineSegments(wireGeo, wireMat));

    /* ─── Anneaux de latitude ─── */
    for (var lat = -60; lat <= 60; lat += 30) {
      if (lat === 0) continue;
      var ringPts = [];
      for (var a = 0; a <= 64; a++) {
        var theta = (a / 64) * Math.PI * 2;
        var v = latLngToVec3(lat, theta * 180 / Math.PI, 1.002);
        ringPts.push(v.x, v.y, v.z);
      }
      var ringGeo = new THREE.BufferGeometry();
      ringGeo.setAttribute('position', new THREE.Float32BufferAttribute(ringPts, 3));
      var ringMat = new THREE.LineBasicMaterial({
        color: 0x4a8abf,
        transparent: true,
        opacity: 0.05,
      });
      VivaGlobe.scene.add(new THREE.Line(ringGeo, ringMat));
    }

    /* ─── Atmosphère (lueur) ─── */
    var atmGeo = new THREE.SphereGeometry(1.12, 48, 48);
    var atmMat = new THREE.ShaderMaterial({
      vertexShader:
        'varying vec3 vNormal; void main() { vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader:
        'varying vec3 vNormal; void main() { float i = pow(0.65 - dot(vNormal, vec3(0,0,1.0)), 2.0); gl_FragColor = vec4(0.3, 0.6, 1.0, i * 0.6); }',
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    VivaGlobe.glow = new THREE.Mesh(atmGeo, atmMat);
    VivaGlobe.scene.add(VivaGlobe.glow);

    /* ─── Lumières ─── */
    var ambient = new THREE.AmbientLight(0x1a1a3a, 0.5);
    VivaGlobe.scene.add(ambient);
    var dir1 = new THREE.DirectionalLight(0xffeedd, 1.0);
    dir1.position.set(5, 3, 5);
    VivaGlobe.scene.add(dir1);
    var dir2 = new THREE.DirectionalLight(0x4488ff, 0.5);
    dir2.position.set(-3, -1, 4);
    VivaGlobe.scene.add(dir2);

    /* ─── Position Abidjan (hub central) ─── */
    var abidjan = PORTS[0];
    var abidPos = latLngToVec3(abidjan.lat, abidjan.lng, 1);

    /* ─── Ports : points lumineux + halos + routes ─── */
    var dotPositions = [];
    var clock = new THREE.Clock();
    VivaGlobe.clock = clock;

    PORTS.forEach(function (city, idx) {
      var pos = latLngToVec3(city.lat, city.lng, 1.008);
      dotPositions.push(pos.x, pos.y, pos.z);

      /* ─── Halo pulsant autour du port ─── */
      var ringGeo2 = new THREE.RingGeometry(0.008, 0.025, 16);
      var ringMat2 = new THREE.MeshBasicMaterial({
        color: 0xD4AF37,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      var ring = new THREE.Mesh(ringGeo2, ringMat2);
      ring.position.copy(pos);
      ring.lookAt(new THREE.Vector3(0, 0, 0));
      VivaGlobe.scene.add(ring);
      VivaGlobe.cityDots.push({
        mesh: ring,
        baseScale: 1,
        phase: idx * 0.8,
      });

      /* ─── Route courbe ←→ Abidjan ─── */
      if (city.name !== 'Abidjan') {
        // Calcul du point milieu surélevé pour la courbe
        var mid = pos.clone().add(abidPos).multiplyScalar(0.5);
        var len = pos.distanceTo(abidPos);
        var height = 0.3 + len * 0.35;
        mid.normalize().multiplyScalar(1 + height);

        // Création de la courbe de Bézier quadratique
        var curve = new THREE.QuadraticBezierCurve3(pos, mid, abidPos);
        var curvePts = curve.getPoints(40);

        // Ligne de la route (fixe, semi-transparente)
        var arcGeo2 = new THREE.BufferGeometry().setFromPoints(curvePts);
        var arcMat2 = new THREE.LineBasicMaterial({
          color: 0x4a8aff,
          transparent: true,
          opacity: 0.08 + Math.random() * 0.08,
          blending: THREE.AdditiveBlending,
        });
        var line = new THREE.Line(arcGeo2, arcMat2);
        VivaGlobe.scene.add(line);
        VivaGlobe.arcLines.push(line);

        // Particules qui circulent sur la route
        var particleCount = 6;
        for (var p = 0; p < particleCount; p++) {
          var pGeo = new THREE.SphereGeometry(0.008, 4, 4);
          var pMat = new THREE.MeshBasicMaterial({
            color: 0xD4AF37,
            transparent: true,
            opacity: 0.7,
          });
          var particle = new THREE.Mesh(pGeo, pMat);
          particle.userData = {
            curve: curve,
            progress: (p / particleCount) + Math.random() * 0.1,
            speed: 0.002 + Math.random() * 0.003,
          };
          VivaGlobe.scene.add(particle);
          VivaGlobe.flowParticles.push(particle);
        }
      }
    });

    /* ─── Nuage de points (ports) ─── */
    var dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute('position', new THREE.Float32BufferAttribute(dotPositions, 3));
    var dotMat = new THREE.PointsMaterial({
      color: 0xD4AF37,
      size: 0.035,
      transparent: true,
      opacity: 0.95,
      sizeAttenuation: true,
    });
    var dots = new THREE.Points(dotGeo, dotMat);
    VivaGlobe.scene.add(dots);

    /* ─── Tooltip de survol ─── */
    var tooltipEl = document.createElement('div');
    tooltipEl.style.cssText =
      'position:fixed;background:rgba(5,10,30,0.92);color:#fff;' +
      'padding:10px 14px;border-radius:8px;border:1px solid rgba(212,175,55,0.4);' +
      'font-size:13px;pointer-events:none;opacity:0;transition:opacity 0.3s;' +
      'z-index:9999;backdrop-filter:blur(8px);' +
      'font-family:Inter, sans-serif;line-height:1.4;max-width:240px;';
    document.body.appendChild(tooltipEl);
    VivaGlobe.tooltip = tooltipEl;

    /* ─── Raycaster + Pointer ─── */
    VivaGlobe.raycaster = new THREE.Raycaster();
    VivaGlobe.pointer   = new THREE.Vector2();

    /* ─── Événements souris ─── */
    container.addEventListener('mousemove', function (e) {
      var rect = container.getBoundingClientRect();
      VivaGlobe.mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      VivaGlobe.mouseY = ((e.clientY - rect.top) / rect.height) * 2 - 1;

      // Tooltip au survol des ports
      VivaGlobe.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      VivaGlobe.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      VivaGlobe.raycaster.setFromCamera(VivaGlobe.pointer, VivaGlobe.camera);
      var intersects = VivaGlobe.raycaster.intersectObject(VivaGlobe.globe, true);
      if (intersects.length > 0) {
        var pt = intersects[0].point;
        var minDist = 0.15;
        var nearest = null;
        PORTS.forEach(function (c) {
          var pos = latLngToVec3(c.lat, c.lng, 1);
          var d = pt.distanceTo(pos);
          if (d < minDist) { minDist = d; nearest = c; }
        });
        if (nearest) {
          tooltipEl.textContent = '📍 ' + nearest.name + ', ' + nearest.country + ' · ' + nearest.desc;
          tooltipEl.style.opacity = '1';
          if (VivaGlobe.pointer.x > 0.6) {
            tooltipEl.style.left = (e.clientX - 180) + 'px';
          } else {
            tooltipEl.style.left = (e.clientX + 15) + 'px';
          }
          tooltipEl.style.top = (e.clientY - 30) + 'px';
        } else {
          tooltipEl.style.opacity = '0';
        }
      } else {
        tooltipEl.style.opacity = '0';
      }
    });

    container.addEventListener('mouseleave', function () {
      tooltipEl.style.opacity = '0';
    });

    /* ─── Redimensionnement ─── */
    function resizeGlobe() {
      if (!container || !VivaGlobe.renderer) return;
      var cw = container.clientWidth  || 600;
      var ch = container.clientHeight || 400;
      VivaGlobe.camera.aspect = cw / ch;
      VivaGlobe.camera.updateProjectionMatrix();
      VivaGlobe.renderer.setSize(cw, ch);
    }
    window.addEventListener('resize', resizeGlobe);

    /* ─── Boucle d'animation ─── */
    VivaGlobe.isRunning = true;

    function animateGlobe() {
      if (!VivaGlobe.isRunning) return;
      if (!VivaGlobe.globe) return;

      var t = clock.getElapsedTime();

      // Rotation automatique lente + suivi souris
      VivaGlobe.targetRotY += 0.0015;
      var targetY = VivaGlobe.targetRotY + VivaGlobe.mouseX * 0.2;
      var targetX = VivaGlobe.mouseY * 0.15;
      VivaGlobe.globe.rotation.y += (targetY - VivaGlobe.globe.rotation.y) * 0.03;
      VivaGlobe.globe.rotation.x += (targetX - VivaGlobe.globe.rotation.x) * 0.03;

      // Atmosphère suit le globe
      if (VivaGlobe.glow) {
        VivaGlobe.glow.rotation.y = VivaGlobe.globe.rotation.y;
        VivaGlobe.glow.rotation.x = VivaGlobe.globe.rotation.x;
      }

      // Routes suivent le globe
      VivaGlobe.arcLines.forEach(function (line) {
        line.rotation.y = VivaGlobe.globe.rotation.y;
        line.rotation.x = VivaGlobe.globe.rotation.x;
      });

      // Particules circulant le long des routes
      VivaGlobe.flowParticles.forEach(function (p) {
        var data = p.userData;
        data.progress += data.speed;
        if (data.progress > 1) data.progress = 0;
        var pos = data.curve.getPoint(data.progress);
        p.position.copy(pos);
        p.rotation.y = VivaGlobe.globe.rotation.y;
        p.rotation.x = VivaGlobe.globe.rotation.x;
        var pulse = 0.5 + 0.5 * Math.sin(t * 3 + data.progress * 10);
        p.material.opacity = pulse * 0.8;
      });

      // Halos pulsants des ports
      VivaGlobe.cityDots.forEach(function (d) {
        var s = 1 + 0.3 * Math.sin(t * 1.5 + d.phase);
        d.mesh.scale.set(s, s, s);
        d.mesh.material.opacity = 0.3 + 0.3 * Math.sin(t * 1.5 + d.phase);
      });

      VivaGlobe.renderer.render(VivaGlobe.scene, VivaGlobe.camera);
      VivaGlobe.animationId = requestAnimationFrame(animateGlobe);
    }

    animateGlobe();
    console.log('[VivaGlobe] 🌍 Globe 3D initialisé —', PORTS.length, 'ports,', ROUTES.length, 'routes');
  };

  /**
   * Arrête le globe et nettoie les ressources
   */
  window.VivaGlobeStop = function () {
    VivaGlobe.isRunning = false;
    if (VivaGlobe.animationId) {
      cancelAnimationFrame(VivaGlobe.animationId);
      VivaGlobe.animationId = null;
    }
    if (VivaGlobe.renderer && VivaGlobe.container) {
      VivaGlobe.container.removeChild(VivaGlobe.renderer.domElement);
    }
    if (VivaGlobe.tooltip) {
      VivaGlobe.tooltip.remove();
    }
  };


  /* ═══════════════════════════════════════════════════════════════════════════
     2️⃣  SPA-NAVIGATION — Système de navigation SPA sans framework
         Gère le clic sur les liens de navigation pour afficher/masquer
         des sections de contenu. Supporte :
         - Liens avec href="#section-id"
         - Hash initial au chargement
         - Animation de transition
     ═══════════════════════════════════════════════════════════════════════════ */

  /**
   * Initialise la navigation SPA
   * @param {Object} options
   * @param {string} options.navSelector     — Sélecteur des liens de navigation
   * @param {string} options.sectionSelector — Sélecteur des sections de contenu
   * @param {string} options.activeClass    — Classe pour la section active
   * @param {string} [options.defaultSection] — Section à afficher par défaut
   */
  window.VivaSpaNav = function (options) {
    options = options || {};
    var navSelector     = options.navSelector     || '.spa-nav a';
    var sectionSelector = options.sectionSelector || '.spa-section';
    var activeClass     = options.activeClass     || 'active';
    var defaultSection  = options.defaultSection  || null;

    var navLinks    = document.querySelectorAll(navSelector);
    var sections    = document.querySelectorAll(sectionSelector);
    var sectionMap  = {};

    // Construire la map : id → élément section
    sections.forEach(function (sec) {
      var id = sec.getAttribute('id');
      if (id) sectionMap[id] = sec;
    });

    /**
     * Affiche une section et masque les autres
     * @param {string} sectionId
     */
    function showSection(sectionId) {
      if (!sectionId || !sectionMap[sectionId]) return;

      // Masquer toutes les sections
      sections.forEach(function (sec) {
        sec.classList.remove(activeClass);
        sec.style.display = 'none';
      });

      // Afficher la section cible
      var target = sectionMap[sectionId];
      target.style.display = 'block';
      // Forcer le reflow pour que l'animation CSS démarre
      void target.offsetWidth;
      target.classList.add(activeClass);

      // Mettre à jour la classe active des liens
      navLinks.forEach(function (link) {
        link.classList.remove(activeClass);
        var href = link.getAttribute('href');
        if (href === '#' + sectionId) {
          link.classList.add(activeClass);
        }
      });

      // Mettre à jour le hash sans scroller
      if (window.location.hash !== '#' + sectionId) {
        history.pushState(null, '', '#' + sectionId);
      }
    }

    // Clic sur les liens de navigation
    navLinks.forEach(function (link) {
      link.addEventListener('click', function (e) {
        var href = link.getAttribute('href');
        if (href && href.charAt(0) === '#') {
          e.preventDefault();
          var sectionId = href.substring(1);
          showSection(sectionId);
        }
      });
    });

    // Gestion du hash au chargement et au popstate
    function handleHash() {
      var hash = window.location.hash.substring(1);
      if (hash && sectionMap[hash]) {
        showSection(hash);
      } else if (defaultSection && sectionMap[defaultSection]) {
        showSection(defaultSection);
      } else if (sections.length > 0) {
        // Afficher la première section par défaut
        var firstId = sections[0].getAttribute('id');
        if (firstId) showSection(firstId);
      }
    }

    window.addEventListener('popstate', handleHash);

    // Initialiser
    handleHash();

    console.log('[VivaSpaNav] 🧭 Navigation SPA initialisée —', sections.length, 'sections');
    return { showSection: showSection };
  };


  /* ═══════════════════════════════════════════════════════════════════════════
     3️⃣  TRACKING TIMELINE — Timeline animée au scroll
         Les étapes de tracking se remplissent progressivement au fur et à
         mesure que l'utilisateur scrolle. Utilise GSAP (si dispo) pour les
         animations fluides, sinon IntersectionObserver.
         Compatible avec le HTML de tracking existant dans index.html
     ═══════════════════════════════════════════════════════════════════════════ */

  /**
   * Initialise la timeline de tracking animée au scroll
   * @param {Object} options
   * @param {string} options.timelineSelector — Sélecteur de la timeline
   * @param {string} options.stepSelector     — Sélecteur des étapes
   * @param {string} options.progressSelector — Sélecteur de la barre de progression
   * @param {boolean} options.useGsap         — Utiliser GSAP si disponible
   */
  window.VivaTrackingTimeline = function (options) {
    options = options || {};
    var timelineSelector  = options.timelineSelector || '#trkTimeline';
    var stepSelector      = options.stepSelector     || '.timeline-step';
    var progressSelector  = options.progressSelector || '#trkProgressFill';
    var useGsap           = (options.useGsap !== undefined) ? options.useGsap : true;

    var timelineEl  = document.querySelector(timelineSelector);
    if (!timelineEl) {
      console.warn('[VivaTracking] Timeline introuvable :', timelineSelector);
      return;
    }

    var steps     = timelineEl.querySelectorAll(stepSelector);
    var progress  = document.querySelector(progressSelector);
    var hasGsap   = (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined');

    if (steps.length === 0) return;

    /**
     * Remplit visuellement les étapes une par une
     * @param {number} count — Nombre d'étapes à remplir
     */
    function fillSteps(count) {
      var maxSteps = Math.min(count, steps.length);

      steps.forEach(function (step, i) {
        var shouldBeDone = i < maxSteps;
        var isDone = step.classList.contains('completed');
        var isActive = step.classList.contains('active');

        if (shouldBeDone && !isDone && !isActive) {
          step.classList.remove('active');
          step.classList.add('completed');

          // Petite animation sur l'icône
          var icon = step.querySelector('.timeline-step-icon');
          if (icon) {
            icon.style.transform = 'scale(1.15)';
            setTimeout(function () {
              icon.style.transform = 'scale(1)';
            }, 400);
          }
        }
      });

      // Mettre l'étape suivante en "active"
      if (maxSteps < steps.length) {
        var nextStep = steps[maxSteps];
        if (nextStep) {
          nextStep.classList.add('active');
        }
      }

      // Mettre à jour la barre de progression
      if (progress) {
        var pct = (maxSteps / steps.length) * 100;
        progress.style.width = Math.min(pct, 100) + '%';
      }

      // Mettre à jour la variable CSS --progress pour le connecteur
      var connectorPct = ((maxSteps) / (steps.length - 1)) * 100;
      timelineEl.style.setProperty('--progress', Math.min(connectorPct, 100) + '%');
    }

    /* ─── Avec GSAP + ScrollTrigger ─── */
    if (useGsap && hasGsap) {
      // GSAP est chargé : animation fluide au scroll
      // Chaque étape apparaît avec un décalage
      steps.forEach(function (step, i) {
        gsap.fromTo(step,
          { opacity: 0, y: 30, scale: 0.95 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.6,
            delay: i * 0.15,
            scrollTrigger: {
              trigger: step,
              start: 'top 85%',
              toggleActions: 'play none none none',
            },
          }
        );
      });

      // Barre de progression animée
      if (progress) {
        gsap.fromTo(progress,
          { width: '0%' },
          {
            width: progress.style.width || '60%',
            duration: 1.2,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: timelineEl,
              start: 'top 80%',
              toggleActions: 'play none none none',
            },
          }
        );
      }

      console.log('[VivaTracking] 📜 Timeline avec GSAP activée —', steps.length, 'étapes');
    } else {
      /* ─── Fallback avec IntersectionObserver ─── */
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            // Compter les étapes déjà completed/active
            var done = 0;
            steps.forEach(function (s) {
              if (s.classList.contains('completed') || s.classList.contains('active')) {
                done++;
              }
            });

            // Ajouter une étape à chaque intersection (effet progressif)
            if (done < steps.length) {
              fillSteps(done + 1);
            }
          }
        });
      }, { threshold: 0.3 });

      // Observer chaque étape individuellement
      steps.forEach(function (step) {
        observer.observe(step);
      });

      // Observer aussi la timeline pour la progression initiale
      var progressObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            // Compter les étapes initialement marquées dans le HTML
            var initialCompleted = timelineEl.querySelectorAll('.timeline-step.completed').length;
            var initialActive    = timelineEl.querySelectorAll('.timeline-step.active').length;
            fillSteps(initialCompleted + (initialActive > 0 ? 1 : 0));
          }
        });
      }, { threshold: 0.1 });
      progressObserver.observe(timelineEl);

      console.log('[VivaTracking] 📜 Timeline avec IntersectionObserver —', steps.length, 'étapes');
    }

    // API publique
    return {
      fillSteps: fillSteps,
      steps: steps,
      progress: progress,
    };
  };


  /* ═══════════════════════════════════════════════════════════════════════════
     INITIALISATION AUTOMATIQUE
     ─── Détection des éléments dans le DOM pour lancer les composants ───
     ═══════════════════════════════════════════════════════════════════════════ */

  function autoInit() {
    // 1️⃣ Globe 3D — si #globe-container existe et THREE est chargé
    var globeContainer = document.getElementById('globe-container');
    if (globeContainer && typeof THREE !== 'undefined') {
      var threeCheck = 0;
      function tryInitGlobe() {
        if (typeof THREE !== 'undefined') {
          try {
            window.VivaGlobeInit('#globe-container');
          } catch (e) {
            console.warn('[VivaGlobe] Échec d\'initialisation :', e);
            globeContainer.innerHTML =
              '<div style="display:flex;align-items:center;justify-content:center;height:100%;' +
              'color:var(--gold);opacity:0.4;font-size:3rem;">' +
              '<i class="fas fa-globe-africa"></i></div>';
          }
        } else if (threeCheck < 50) {
          threeCheck++;
          setTimeout(tryInitGlobe, 100);
        } else {
          console.warn('[VivaGlobe] Three.js non chargé après 5s');
        }
      }
      tryInitGlobe();
    }

    // 2️⃣ Tracking Timeline — si les éléments de tracking existent
    var trackingTimeline = document.getElementById('trkTimeline');
    if (trackingTimeline) {
      // Attendre que GSAP soit chargé si présent
      var gsapCheck = 0;
      function tryInitTracking() {
        var hasGsap = (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined');
        window.VivaTrackingTimeline({
          timelineSelector: '#trkTimeline',
          stepSelector: '.timeline-step',
          progressSelector: '#trkProgressFill',
          useGsap: hasGsap,
        });
      }
      // Délai court pour laisser le DOM se stabiliser
      setTimeout(tryInitTracking, 200);
    }

    // 3️⃣ SPA Navigation — si des sections spa sont détectées
    var spaSections = document.querySelectorAll('.spa-section');
    if (spaSections.length > 0) {
      window.VivaSpaNav({
        navSelector: '.spa-nav a',
        sectionSelector: '.spa-section',
        activeClass: 'active',
      });
    }

    console.log('[VivaScripts] ✅ Initialisation automatique terminée');
  }

  /* ─── Lancer au DOM ready ─── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

})();
