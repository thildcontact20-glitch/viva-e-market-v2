/**
 * VIVA E-MARKET — TRACKING PROXY SERVER
 * =======================================
 * Express.js backend déployé sur Render.
 * Endpoints :
 *   GET /api/track?bl=MSCU1234567 — tracking d'une cargaison
 *   GET /api/ports               — liste des ports avec coordonnées
 *   GET /api/status               — healthcheck
 *
 * Architecture :
 *   Le proxy tente d'abord d'interroger des vraies APIs (DHL, FedEx).
 *   En cas d'échec (pas de clé API, timeout, erreur), il génère une
 *   réponse simulée mais structurée comme si l'API avait répondu.
 *
 *   Le frontend tracking.html appelle d'abord ce backend, et si le
 *   backend est injoignable (CORS, down), il utilise les données
 *   simulées intégrées dans la page comme fallback.
 */

'use strict';

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;

/* ─── CORS ACTIVÉ pour le frontend Vercel ─── */
app.use(cors({
  origin: [
    'https://viva-e-market.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    /\.vercel\.app$/
  ],
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

/* ════════════════════════════════════════════════════════════════
   ENDPOINT 1 : GET /api/status — Healthcheck
   ════════════════════════════════════════════════════════════════ */
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    service: 'viva-tracking-proxy',
    version: '1.0.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/* ════════════════════════════════════════════════════════════════
   ENDPOINT 2 : GET /api/ports — Liste des ports
   ════════════════════════════════════════════════════════════════ */
const PORTS_DATABASE = [
  { id: 'CNSHA', port: 'Shanghai', country: 'Chine', lat: 31.2304, lng: 121.4737, code: 'CNSHA' },
  { id: 'CNYTN', port: 'Yantian', country: 'Chine', lat: 22.5803, lng: 114.2726, code: 'CNYTN' },
  { id: 'NLRTM', port: 'Rotterdam', country: 'Pays-Bas', lat: 51.9072, lng: 4.4669, code: 'NLRTM' },
  { id: 'FRLEH', port: 'Le Havre', country: 'France', lat: 49.4938, lng: 0.1077, code: 'FRLEH' },
  { id: 'FRMRS', port: 'Marseille', country: 'France', lat: 43.3131, lng: 5.3508, code: 'FRMRS' },
  { id: 'ESBIO', port: 'Bilbao', country: 'Espagne', lat: 43.3390, lng: -3.0080, code: 'ESBIO' },
  { id: 'ESALG', port: 'Algésiras', country: 'Espagne', lat: 36.1447, lng: -5.4439, code: 'ESALG' },
  { id: 'CIVIL', port: 'Abidjan', country: "Côte d'Ivoire", lat: 5.3000, lng: -4.0167, code: 'CIABJ' },
  { id: 'SNRUF', port: 'Dakar', country: 'Sénégal', lat: 14.6728, lng: -17.4317, code: 'SNDKR' },
  { id: 'GHCPS', port: 'Tema', country: 'Ghana', lat: 5.6206, lng: -0.0164, code: 'GHTMA' },
  { id: 'NGAPP', port: 'Apapa (Lagos)', country: 'Nigeria', lat: 6.4403, lng: 3.3767, code: 'NGLOS' },
  { id: 'CMKBI', port: 'Douala', country: 'Cameroun', lat: 4.0340, lng: 9.7016, code: 'CMDLA' },
  { id: 'BJCOT', port: 'Cotonou', country: 'Bénin', lat: 6.3667, lng: 2.4167, code: 'BJCOO' },
  { id: 'TGELW', port: 'Lomé', country: 'Togo', lat: 6.1300, lng: 1.2100, code: 'TGLFW' },
  { id: 'CDMAT', port: 'Matadi', country: 'République Démocratique du Congo', lat: -5.8167, lng: 13.4667, code: 'CDMAT' },
  { id: 'AOLAD', port: 'Luanda', country: 'Angola', lat: -8.8106, lng: 13.2367, code: 'AOLAD' },
  { id: 'CDPNR', port: 'Pointe-Noire', country: 'République du Congo', lat: -4.7842, lng: 11.8528, code: 'CGPNR' },
  { id: 'ZADUR', port: 'Durban', country: 'Afrique du Sud', lat: -29.8794, lng: 31.0336, code: 'ZADUR' },
  { id: 'KEMBA', port: 'Mombasa', country: 'Kenya', lat: -4.0436, lng: 39.6819, code: 'KEMBA' },
  { id: 'TZDAR', port: 'Dar es Salam', country: 'Tanzanie', lat: -6.8178, lng: 39.2864, code: 'TZDAR' }
];

app.get('/api/ports', (req, res) => {
  res.json({
    success: true,
    count: PORTS_DATABASE.length,
    ports: PORTS_DATABASE
  });
});

/* ════════════════════════════════════════════════════════════════
   ENDPOINT 3 : GET /api/track?bl=XXXXX — Tracking
   ════════════════════════════════════════════════════════════════ */

/* ─── DONNÉES SIMULÉES (utilisées comme fallback) ─── */
const SIMULATED_SHIPMENTS = {
  'MSCU1234567': {
    bl: 'MSCU1234567',
    vessel: 'MSC AURORA',
    voyage: '247W',
    origin: { port: 'Shanghai', country: 'Chine', lat: 31.2, lng: 121.5 },
    destination: { port: 'Abidjan', country: "Côte d'Ivoire", lat: 5.3, lng: -4.0 },
    container: '1 × 40\' HC',
    cargo: 'Électronique grand public',
    progress: 67,
    status: 'in_transit',
    eta: '2026-07-14',
    lastUpdate: new Date().toISOString(),
    position: { lat: 14.7, lng: -17.4, description: 'Océan Atlantique, au large de Dakar' },
    distanceRemaining: '1 850 km',
    steps: [
      { name: 'Documentation', status: 'completed', date: '2026-05-20' },
      { name: 'Embarquement', status: 'completed', date: '2026-05-25' },
      { name: 'En Transit', status: 'active', date: '2026-06-01' },
      { name: 'Arrivée Port', status: 'pending', date: null },
      { name: 'Dédouanement', status: 'pending', date: null },
      { name: 'Livré', status: 'pending', date: null }
    ]
  },
  'MEDU8932154': {
    bl: 'MEDU8932154',
    vessel: 'MSC DIANA',
    voyage: '245E',
    origin: { port: 'Rotterdam', country: 'Pays-Bas', lat: 51.9, lng: 4.5 },
    destination: { port: 'Abidjan', country: "Côte d'Ivoire", lat: 5.3, lng: -4.0 },
    container: '2 × 20\' ST',
    cargo: 'Produits laitiers et fromages',
    progress: 42,
    status: 'in_transit',
    eta: '2026-07-22',
    lastUpdate: new Date().toISOString(),
    position: { lat: 27.2, lng: -16.5, description: 'Océan Atlantique Nord, proche des Canaries' },
    distanceRemaining: '3 200 km',
    steps: [
      { name: 'Documentation', status: 'completed', date: '2026-06-15' },
      { name: 'Embarquement', status: 'completed', date: '2026-06-20' },
      { name: 'En Transit', status: 'active', date: '2026-06-22' },
      { name: 'Arrivée Port', status: 'pending', date: null },
      { name: 'Dédouanement', status: 'pending', date: null },
      { name: 'Livré', status: 'pending', date: null }
    ]
  },
  'FX-AT-2026-001': {
    bl: 'FX-AT-2026-001',
    vessel: 'FedEx Express — Vol FX58',
    voyage: 'FX58-25JUN',
    origin: { port: 'Paris CDG', country: 'France', lat: 49.0, lng: 2.55 },
    destination: { port: 'Abidjan', country: "Côte d'Ivoire", lat: 5.3, lng: -4.0 },
    container: '1 palette',
    cargo: 'Pièces détachées automobile',
    progress: 52,
    status: 'in_transit',
    eta: '2026-06-27',
    lastUpdate: new Date().toISOString(),
    position: { lat: 33.6, lng: -7.6, description: 'Escale à Casablanca (CMN)' },
    distanceRemaining: '3 500 km',
    steps: [
      { name: 'Documentation', status: 'completed', date: '2026-06-24' },
      { name: 'Embarquement', status: 'completed', date: '2026-06-25' },
      { name: 'En Transit', status: 'active', date: '2026-06-25' },
      { name: 'Arrivée Port', status: 'pending', date: null },
      { name: 'Dédouanement', status: 'pending', date: null },
      { name: 'Livré', status: 'pending', date: null }
    ]
  },
  'MSCU9876543': {
    bl: 'MSCU9876543',
    vessel: 'MSC LEO',
    voyage: '248W',
    origin: { port: 'Le Havre', country: 'France', lat: 49.5, lng: 0.1 },
    destination: { port: 'Abidjan', country: "Côte d'Ivoire", lat: 5.3, lng: -4.0 },
    container: '1 × 40\' RH',
    cargo: 'Machines industrielles',
    progress: 11,
    status: 'documentation',
    eta: '2026-08-08',
    lastUpdate: new Date().toISOString(),
    position: { lat: 49.5, lng: 0.1, description: 'Port du Havre — Terminal à conteneurs' },
    distanceRemaining: '6 500 km',
    steps: [
      { name: 'Documentation', status: 'active', date: '2026-06-19' },
      { name: 'Embarquement', status: 'pending', date: null },
      { name: 'En Transit', status: 'pending', date: null },
      { name: 'Arrivée Port', status: 'pending', date: null },
      { name: 'Dédouanement', status: 'pending', date: null },
      { name: 'Livré', status: 'pending', date: null }
    ]
  },
  'MEDU5678901': {
    bl: 'MEDU5678901',
    vessel: 'DHL Air — Vol DHL123',
    voyage: 'DHL123-15MAY',
    origin: { port: 'Marseille', country: 'France', lat: 43.3, lng: 5.35 },
    destination: { port: 'Abidjan', country: "Côte d'Ivoire", lat: 5.3, lng: -4.0 },
    container: '1 palette',
    cargo: 'Échantillons cosmétiques',
    progress: 100,
    status: 'delivered',
    eta: '2026-05-20',
    lastUpdate: new Date().toISOString(),
    position: { lat: 5.3, lng: -4.0, description: 'Livré — Abidjan, Côte d\'Ivoire' },
    distanceRemaining: '0 km',
    steps: [
      { name: 'Documentation', status: 'completed', date: '2026-05-15' },
      { name: 'Embarquement', status: 'completed', date: '2026-05-16' },
      { name: 'En Transit', status: 'completed', date: '2026-05-16' },
      { name: 'Arrivée Port', status: 'completed', date: '2026-05-17' },
      { name: 'Dédouanement', status: 'completed', date: '2026-05-18' },
      { name: 'Livré', status: 'completed', date: '2026-05-20' }
    ]
  }
};

/* ─── CONFIGURATION API (à remplir avec les vraies clés) ─── */
const API_CONFIG = {
  dhl: {
    enabled: process.env.DHL_API_KEY ? true : false,
    apiKey: process.env.DHL_API_KEY || '',
    baseUrl: 'https://api-eu.dhl.com/track/shipments'
  },
  fedex: {
    enabled: process.env.FEDEX_API_KEY ? true : false,
    apiKey: process.env.FEDEX_API_KEY || '',
    baseUrl: 'https://apis.fedex.com/track/v1/trackingnumbers'
  }
};

/**
 * Tentative d'interrogation de l'API DHL.
 * Fonctionne uniquement si DHL_API_KEY est définie dans les variables d'environnement.
 */
async function fetchFromDHL(blNumber) {
  if (!API_CONFIG.dhl.enabled) {
    throw new Error('DHL API key not configured');
  }

  const url = `${API_CONFIG.dhl.baseUrl}?trackingNumber=${encodeURIComponent(blNumber)}`;

  const response = await fetch(url, {
    headers: {
      'DHL-API-Key': API_CONFIG.dhl.apiKey,
      'Content-Type': 'application/json'
    },
    timeout: 10000
  });

  if (!response.ok) {
    throw new Error(`DHL API error: ${response.status}`);
  }

  const data = await response.json();
  return mapDHLResponse(data, blNumber);
}

/**
 * Mappe la réponse brute de DHL vers notre format standardisé.
 */
function mapDHLResponse(dhlData, blNumber) {
  // Exemple de mapping — à adapter selon la vraie structure de l'API DHL
  const shipment = dhlData.shipments?.[0] || dhlData;
  const status = shipment.status?.toLowerCase() || 'in_transit';

  return {
    bl: blNumber,
    vessel: shipment.service || 'DHL Express',
    voyage: '',
    origin: { port: shipment.origin?.address?.addressLocality || 'Origine inconnue', country: shipment.origin?.address?.countryCode || '', lat: 0, lng: 0 },
    destination: { port: shipment.destination?.address?.addressLocality || 'Destination inconnue', country: shipment.destination?.address?.countryCode || '', lat: 0, lng: 0 },
    container: '',
    cargo: shipment.description || '',
    progress: estimateProgress(status),
    status: normalizeStatus(status),
    eta: shipment.estimatedTimeOfDelivery || null,
    lastUpdate: new Date().toISOString(),
    position: { lat: 0, lng: 0, description: shipment.location?.address?.addressLocality || 'En transit' },
    distanceRemaining: '',
    steps: generateSteps(shipment.events || [])
  };
}

/**
 * Tentative d'interrogation de l'API FedEx.
 * Fonctionne uniquement si FEDEX_API_KEY est définie.
 */
async function fetchFromFedEx(blNumber) {
  if (!API_CONFIG.fedex.enabled) {
    throw new Error('FedEx API key not configured');
  }

  const response = await fetch(API_CONFIG.fedex.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_CONFIG.fedex.apiKey}`
    },
    body: JSON.stringify({
      trackingNumberInfo: { trackingNumber: blNumber },
      includeDetailedScans: true
    }),
    timeout: 10000
  });

  if (!response.ok) {
    throw new Error(`FedEx API error: ${response.status}`);
  }

  const data = await response.json();
  return mapFedExResponse(data, blNumber);
}

function mapFedExResponse(fedExData, blNumber) {
  const trackResult = fedExData.output?.completeTrackResults?.[0]?.trackResults?.[0] || {};
  const latestStatus = trackResult.latestStatusDetail?.code?.toLowerCase() || 'in_transit';

  return {
    bl: blNumber,
    vessel: trackResult.service?.description || 'FedEx Express',
    voyage: '',
    origin: { port: trackResult.originLocation?.locationId || 'Origine inconnue', country: '', lat: 0, lng: 0 },
    destination: { port: trackResult.destinationLocation?.locationId || 'Destination inconnue', country: '', lat: 0, lng: 0 },
    container: '',
    cargo: '',
    progress: estimateProgress(latestStatus),
    status: normalizeStatus(latestStatus),
    eta: trackResult.estimatedDeliveryTimestamp || null,
    lastUpdate: new Date().toISOString(),
    position: { lat: 0, lng: 0, description: trackResult.latestStatusDetail?.scanLocation || 'En transit' },
    distanceRemaining: '',
    steps: generateSteps(trackResult.dateAndTimes || [])
  };
}

/* ─── HELPERS ─── */

function normalizeStatus(s) {
  if (!s) return 'in_transit';
  const lower = s.toLowerCase();
  if (lower.includes('delivered') || lower.includes('livr')) return 'delivered';
  if (lower.includes('transit') || lower.includes('in_transit')) return 'in_transit';
  if (lower.includes('pending') || lower.includes('document')) return 'documentation';
  return 'in_transit';
}

function estimateProgress(status) {
  const s = normalizeStatus(status);
  if (s === 'delivered') return 100;
  if (s === 'in_transit') return Math.floor(Math.random() * 40) + 30; // 30-70%
  return Math.floor(Math.random() * 20) + 5; // 5-25%
}

function generateSteps(events) {
  const steps = [
    { name: 'Documentation', status: 'pending', date: null },
    { name: 'Embarquement', status: 'pending', date: null },
    { name: 'En Transit', status: 'pending', date: null },
    { name: 'Arrivée Port', status: 'pending', date: null },
    { name: 'Dédouanement', status: 'pending', date: null },
    { name: 'Livré', status: 'pending', date: null }
  ];

  if (!events || events.length === 0) return steps;

  // Map real events to our 6-step timeline
  events.forEach((event, i) => {
    if (i < steps.length) {
      steps[i].status = 'completed';
      steps[i].date = event.timestamp || event.date || null;
    }
  });

  // Mark the next after the last completed as 'active'
  const completedCount = Math.min(events.length, steps.length);
  if (completedCount < steps.length) {
    steps[completedCount].status = 'active';
  }

  return steps;
}

/**
 * Détermine la source à utiliser pour une cargaison :
 * 1. Si une vraie API est configurée, tente de l'interroger
 * 2. Sinon, utilise les données simulées
 */
async function resolveTracking(blNumber) {
  const bl = blNumber.toUpperCase().trim();

  // Essayer d'abord les vraies APIs si configurées
  if (API_CONFIG.dhl.enabled) {
    try {
      const data = await fetchFromDHL(bl);
      return { source: 'dhl', data };
    } catch (err) {
      console.warn(`[DHL] API error for ${bl}:`, err.message);
      // Fall through to next provider
    }
  }

  if (API_CONFIG.fedex.enabled) {
    try {
      const data = await fetchFromFedEx(bl);
      return { source: 'fedex', data };
    } catch (err) {
      console.warn(`[FedEx] API error for ${bl}:`, err.message);
      // Fall through to simulated
    }
  }

  // Fallback : données simulées
  const simulated = SIMULATED_SHIPMENTS[bl];
  if (simulated) {
    // Refresh lastUpdate timestamp
    simulated.lastUpdate = new Date().toISOString();
    return { source: 'simulated', data: simulated };
  }

  // BL inconnu même en simulation
  return null;
}

app.get('/api/track', async (req, res) => {
  const bl = req.query.bl;

  if (!bl) {
    return res.status(400).json({
      success: false,
      error: 'Paramètre "bl" requis. Utilisation : /api/track?bl=MSCU1234567'
    });
  }

  try {
    const result = await resolveTracking(bl);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: `Aucune cargaison trouvée avec le BL "${bl}". Vérifiez le numéro.`,
        data: null
      });
    }

    return res.json({
      success: true,
      source: result.source,
      data: result.data
    });

  } catch (err) {
    console.error(`[track] Error for ${bl}:`, err);
    return res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur de tracking',
      data: null
    });
  }
});

/* ════════════════════════════════════════════════════════════════
   DÉMARRAGE
   ════════════════════════════════════════════════════════════════ */
app.listen(PORT, () => {
  console.log(`🚢 VIVA Tracking Proxy running on port ${PORT}`);
  console.log(`   DHL API:    ${API_CONFIG.dhl.enabled ? '✅ Configurée' : '❌ Non configurée (fallback simulation)'}`);
  console.log(`   FedEx API:  ${API_CONFIG.fedex.enabled ? '✅ Configurée' : '❌ Non configurée (fallback simulation)'}`);
  console.log(`   Simulation: ✅ Active pour ${Object.keys(SIMULATED_SHIPMENTS).length} BLs`);
});
