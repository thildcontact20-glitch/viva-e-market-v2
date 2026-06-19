/**
 * admin-bridge.js — Pont JavaScript côté client pour les images gérées via l'admin
 *
 * Permet aux pages HTML statiques (vins.html, epicerie.html, spiritueux.html)
 * de charger et d'afficher les images assignées via le backend admin.
 *
 * Usage dans les pages :
 *   1. Ajouter <script src="js/admin-bridge.js"></script> DANS LE <head>
 *      (le chargement est asynchrone, ne bloque pas le rendu)
 *   2. Après avoir défini le tableau de produits, appeler :
 *        if (window.__adminBridge) {
 *          window.__adminBridge.patchProducts(wines, 'vins');
 *        }
 *   3. Ensuite lancer le rendu normal (renderWines(), renderProducts(), etc.)
 *
 * L'objet window.__adminBridge est garanti d'exister dès que le script est chargé.
 *
 * @author VIVA E-MARKET Admin Bridge
 * @version 1.0.0
 */

(function () {
  'use strict';

  // ════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ════════════════════════════════════════════════════════════════

  /**
   * URL de base de l'API admin.
   * Surchargeable via window.ADMIN_API_URL avant le chargement de ce script.
   * @type {string}
   */
  var ADMIN_API = window.ADMIN_API_URL || 'http://localhost:8001';

  /**
   * Timeout en millisecondes pour la requête fetch().
   * @type {number}
   */
  var FETCH_TIMEOUT = 3000;

  /**
   * Endpoint complet de l'API.
   * @type {string}
   */
  var API_ENDPOINT = ADMIN_API + '/api/products/images';

  // ════════════════════════════════════════════════════════════════
  // STATE INTERNE
  // ════════════════════════════════════════════════════════════════

  /**
   * Données de l'admin, normalisées au format :
   *   { pageName: { productId: imageUrl, ... }, ... }
   * @type {Object|null}
   */
  var adminData = null;

  /**
   * Indique si la connexion au backend admin a réussi.
   * @type {boolean}
   */
  var connected = false;

  /**
   * Indique si une requête est en cours.
   * @type {boolean}
   */
  var loading = false;

  /**
   * Promise du chargement en cours (pour éviter les doublons).
   * @type {Promise|null}
   */
  var loadPromise = null;

  // ════════════════════════════════════════════════════════════════
  // FONCTIONS INTERNES
  // ════════════════════════════════════════════════════════════════

  /**
   * Ajoute un timestamp à une URL pour éviter le cache navigateur.
   * @param {string} url - L'URL originale
   * @returns {string} L'URL avec ?t=timestamp
   */
  function cacheBust(url) {
    if (!url) return url;
    var separator = url.indexOf('?') !== -1 ? '&' : '?';
    return url + separator + 't=' + Date.now();
  }

  /**
   * fetch() avec timeout.
   * @param {string} url - L'URL à appeler
   * @param {number} timeout - Timeout en ms
   * @returns {Promise<Response>}
   */
  function fetchWithTimeout(url, timeout) {
    return Promise.race([
      fetch(url, { method: 'GET', mode: 'cors' }),
      new Promise(function (_, reject) {
        setTimeout(function () {
          reject(new Error('Timeout après ' + timeout + 'ms'));
        }, timeout);
      })
    ]);
  }

  /**
   * Normalise le format de données retourné par l'API pour le stockage interne.
   *
   * Formats acceptés :
   *   - Groupé par page :  { "vins": { "product-1": "url", ... }, ... }
   *   - Flat :             { "product-1": "url", ... }
   *   - Tableau :          [{ productId, page, imageUrl }, ...]
   *
   * @param {*} data - Données brutes de l'API
   * @returns {Object|null} Données normalisées { page: { productId: url } }
   */
  function normalizeAdminData(data) {
    // Si null/undefined/string, retourner null
    if (!data || typeof data !== 'object') return null;

    // Cas 1 : tableau [{ productId, page, imageUrl }]
    if (Array.isArray(data)) {
      var grouped = {};
      for (var i = 0; i < data.length; i++) {
        var item = data[i];
        if (!item || !item.productId) continue;
        var page = item.page || 'default';
        if (!grouped[page]) grouped[page] = {};
        grouped[page][item.productId] = item.imageUrl || item.url || item.image || '';
      }
      return Object.keys(grouped).length > 0 ? grouped : null;
    }

    // Cas 2 : objet
    var keys = Object.keys(data);
    if (keys.length === 0) return {}; // objet vide valide

    var firstKey = keys[0];
    var firstVal = data[firstKey];

    // Si la première valeur est une chaîne → format flat { productId: url }
    if (typeof firstVal === 'string') {
      return { default: data };
    }

    // Si la première valeur est un objet → format groupé par page { page: { productId: url } }
    if (firstVal && typeof firstVal === 'object' && !Array.isArray(firstVal)) {
      return data;
    }

    // Sinon, on ne sait pas interpréter
    return null;
  }

  /**
   * Charge les assignations d'images depuis l'API admin.
   * Utilise un cache de promise pour éviter les appels concurrents.
   *
   * @returns {Promise<Object|null>} Les données normalisées, ou null en cas d'échec
   */
  function loadAdminImages() {
    // Si déjà en cours de chargement, retourner la promise existante
    if (loadPromise) return loadPromise;

    loading = true;

    loadPromise = fetchWithTimeout(API_ENDPOINT, FETCH_TIMEOUT)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status + ' ' + response.statusText);
        }
        return response.json();
      })
      .then(function (data) {
        adminData = normalizeAdminData(data);
        connected = true;
        loading = false;
        return adminData;
      })
      .catch(function (err) {
        console.warn('[AdminBridge] ⚠ Backend admin inaccessible :', err.message);
        adminData = null;
        connected = false;
        loading = false;
        loadPromise = null; // Permettre une nouvelle tentative
        return null;
      });

    return loadPromise;
  }

  // ════════════════════════════════════════════════════════════════
  // API PUBLIQUE (exposée via window.__adminBridge)
  // ════════════════════════════════════════════════════════════════

  /**
   * Retourne l'URL de l'image admin pour un produit et une page donnés,
   * ou null si aucune image n'est assignée.
   *
   * @param {string} productId - L'identifiant du produit (ex: 'trianon-2020')
   * @param {string} [page] - Le nom de la page (ex: 'vins', 'epicerie', 'spiritueux')
   * @returns {string|null} L'URL de l'image (avec cache-busting) ou null
   */
  function getAdminImage(productId, page) {
    if (!adminData || !productId) return null;

    page = page || 'default';

    // Chercher d'abord dans la page spécifiée, puis avec .html, puis dans 'default'
    var pageData = adminData[page] || adminData[page + '.html'] || adminData['default'];
    if (!pageData) return null;

    var url = pageData[productId];
    return url ? cacheBust(url) : null;
  }

  /**
   * Retourne toutes les assignations d'images sous forme d'un objet plat.
   * { productId: url, ... }
   *
   * @returns {Object} Toutes les assignations, toutes pages confondues
   */
  function getAllAdminImages() {
    if (!adminData) return {};

    var flat = {};
    var pages = Object.keys(adminData);

    for (var p = 0; p < pages.length; p++) {
      var pageData = adminData[pages[p]];
      if (!pageData || typeof pageData !== 'object') continue;
      var ids = Object.keys(pageData);
      for (var i = 0; i < ids.length; i++) {
        flat[ids[i]] = pageData[ids[i]];
      }
    }

    return flat;
  }

  /**
   * Retourne le statut de la connexion au backend admin.
   *
   * @returns {{ connected: boolean, count: number }}
   */
  function getAdminStatus() {
    var count = 0;
    if (adminData) {
      var pages = Object.keys(adminData);
      for (var p = 0; p < pages.length; p++) {
        var pageData = adminData[pages[p]];
        if (pageData && typeof pageData === 'object') {
          count += Object.keys(pageData).length;
        }
      }
    }
    return { connected: connected, count: count };
  }

  /**
   * Recharge les assignations depuis l'API admin.
   * Utile après une mise à jour dans l'admin.
   *
   * @returns {Promise<Object|null>}
   */
  function refreshAdminImages() {
    loadPromise = null; // Réinitialiser pour forcer un nouveau fetch
    return loadAdminImages();
  }

  /**
   * Patche un tableau de produits EXISTANT en place.
   *
   * Pour chaque produit du tableau, si une image admin est assignée
   * (via product.id + pageName), le champ `image` du produit est remplacé
   * par l'URL admin (avec cache-busting).
   *
   * Les produits sans assignation admin conservent leur image d'origine
   * (ou leur icône placeholder si pas d'image du tout).
   *
   * @param {Array} products - Le tableau de produits à patcher (muté en place)
   * @param {string} pageName - Le nom de la page (ex: 'vins', 'epicerie', 'spiritueux')
   * @returns {Array} Le même tableau (muté en place), pour chaînage
   */
  function patchProducts(products, pageName) {
    if (!products || !Array.isArray(products) || products.length === 0) {
      return products;
    }

    // Si pas encore de données admin, on ne patche pas
    if (!adminData) {
      return products;
    }

    // Chercher les assignations pour cette page (ou fallback 'default')
    // Try exact match first, then with .html suffix (API returns filenames like 'vins.html')
    var pageData = adminData[pageName] || adminData[pageName + '.html'] || adminData['default'];
    if (!pageData || Object.keys(pageData).length === 0) {
      return products;
    }

    for (var i = 0; i < products.length; i++) {
      var product = products[i];
      if (product && product.id && pageData[product.id]) {
        product.image = cacheBust(pageData[product.id]);
      }
    }

    return products;
  }

  // ════════════════════════════════════════════════════════════════
  // INITIALISATION AUTOMATIQUE
  // ════════════════════════════════════════════════════════════════

  // Démarre le chargement des images admin immédiatement (non bloquant).
  // Le rendu des pages se fait normalement ; si les données arrivent après
  // le rendu initial, la page devra rappeler patchProducts() + render().
  loadAdminImages();

  // ════════════════════════════════════════════════════════════════
  // EXPOSER L'INTERFACE PUBLIQUE
  // ════════════════════════════════════════════════════════════════

  window.__adminBridge = {
    /** @type {Function} */
    getAdminImage: getAdminImage,
    /** @type {Function} */
    getAllAdminImages: getAllAdminImages,
    /** @type {Function} */
    getAdminStatus: getAdminStatus,
    /** @type {Function} */
    refreshAdminImages: refreshAdminImages,
    /** @type {Function} */
    patchProducts: patchProducts
  };

})();
