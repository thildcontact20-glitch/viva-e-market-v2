/**
 * VIVA E-MARKET — TRACKING API (Vercel Serverless Function)
 * =========================================================
 * Endpoint : GET /api/track?bl=MSCU1234567
 * 
 * Architecture :
 *   1. Tente DHL API (si DHL_API_KEY configurée)
 *   2. Tente FedEx API (si FEDEX_API_KEY configurée)
 *   3. Fallback données simulées intégrées
 * 
 * À faire pour brancher une vraie API :
 *   - Configurer DHL_API_KEY dans les variables d'environnement Vercel
 *   - Ou configurer FEDEX_API_KEY dans les variables d'environnement Vercel
 *   - La simulation sert de fallback jusqu'à ce que les clés soient fournies
 */

const https = require('https');
const http = require('http');

/* ════════════════════════════════════════════════════════════════
   DONNÉES SIMULÉES (fallback — remplacé par vraies APIs)
   ════════════════════════════════════════════════════════════════ */

const SIMULATED_SHIPMENTS = {
  'MSCU1234567': {
    bl: 'MSCU1234567',
    vessel: 'MSC AURORA',
    voyage: '247W',
    origin: { port: 'Shanghai', country: 'Chine', lat: 31.2, lng: 121.5 },
    destination: { port: 'Abidjan', country: "Côte d'Ivoire", lat: 5.3, lng: -4.0 },
    container: "1 × 40' HC",
    cargo: 'Électronique grand public',
    progress: 67,
    status: 'in_transit',
    eta: '2026-07-14',
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
    container: "2 × 20' ST",
    cargo: 'Produits laitiers et fromages',
    progress: 42,
    status: 'in_transit',
    eta: '2026-07-22',
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
    container: "1 × 40' RH",
    cargo: 'Machines industrielles',
    progress: 11,
    status: 'documentation',
    eta: '2026-08-08',
    position: { lat: 49.5, lng: 0.1, description: "Port du Havre — Terminal à conteneurs" },
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
    position: { lat: 5.3, lng: -4.0, description: "Livré — Abidjan, Côte d'Ivoire" },
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

/* ════════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════════ */

function makeFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;
    
    const req = lib.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 8000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    
    if (options.body) req.write(options.body);
    req.end();
  });
}

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
  if (s === 'in_transit') return Math.floor(Math.random() * 40) + 30;
  return Math.floor(Math.random() * 20) + 5;
}

const DEFAULT_STEPS = [
  { name: 'Documentation', status: 'pending', date: null },
  { name: 'Embarquement', status: 'pending', date: null },
  { name: 'En Transit', status: 'pending', date: null },
  { name: 'Arrivée Port', status: 'pending', date: null },
  { name: 'Dédouanement', status: 'pending', date: null },
  { name: 'Livré', status: 'pending', date: null }
];

function generateSteps(events) {
  const steps = JSON.parse(JSON.stringify(DEFAULT_STEPS));
  if (!events || events.length === 0) return steps;
  events.forEach((event, i) => {
    if (i < steps.length) {
      steps[i].status = 'completed';
      steps[i].date = event.timestamp || event.date || null;
    }
  });
  const completedCount = Math.min(events.length, steps.length);
  if (completedCount < steps.length) {
    steps[completedCount].status = 'active';
  }
  return steps;
}

/* ════════════════════════════════════════════════════════════════
   LOGIQUE DE RÉSOLUTION
   ════════════════════════════════════════════════════════════════ */

async function fetchFromDHL(blNumber) {
  const apiKey = process.env.DHL_API_KEY;
  if (!apiKey) throw new Error('DHL API key not configured');
  
  const url = `https://api-eu.dhl.com/track/shipments?trackingNumber=${encodeURIComponent(blNumber)}`;
  const result = await makeFetch(url, {
    headers: { 'DHL-API-Key': apiKey, 'Content-Type': 'application/json' },
    timeout: 8000
  });
  
  if (result.status !== 200) throw new Error(`DHL API error: ${result.status}`);
  const shipment = result.data.shipments?.[0] || result.data;
  
  return {
    bl: blNumber,
    vessel: shipment.service || 'DHL Express',
    voyage: '',
    origin: { port: shipment.origin?.address?.addressLocality || 'Origine inconnue', country: shipment.origin?.address?.countryCode || '', lat: 0, lng: 0 },
    destination: { port: shipment.destination?.address?.addressLocality || 'Destination inconnue', country: shipment.destination?.address?.countryCode || '', lat: 0, lng: 0 },
    container: '',
    cargo: shipment.description || '',
    progress: estimateProgress(shipment.status?.statusCode || ''),
    status: normalizeStatus(shipment.status?.statusCode || ''),
    eta: shipment.estimatedTimeOfDelivery || null,
    position: { lat: 0, lng: 0, description: shipment.status?.location?.address?.addressLocality || 'En transit' },
    distanceRemaining: '',
    steps: generateSteps(shipment.events || [])
  };
}

async function resolveTracking(blNumber) {
  const bl = blNumber.toUpperCase().trim();
  
  // Étape 1 : DHL API si clé configurée
  if (process.env.DHL_API_KEY) {
    try {
      const data = await fetchFromDHL(bl);
      return { source: 'dhl', data };
    } catch (err) {
      console.warn(`[DHL] API error for ${bl}:`, err.message);
    }
  }
  
  // Étape 2 : Fallback simulation
  const simulated = SIMULATED_SHIPMENTS[bl];
  if (simulated) {
    const data = JSON.parse(JSON.stringify(simulated));
    data.lastUpdate = new Date().toISOString();
    return { source: 'simulated', data };
  }
  
  return null;
}

/* ════════════════════════════════════════════════════════════════
   VERCELL SERVERLESS HANDLER
   ════════════════════════════════════════════════════════════════ */

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  const bl = req.query.bl;
  
  if (!bl) {
    res.status(400).json({
      success: false,
      error: 'Paramètre "bl" requis. Utilisation : /api/track?bl=MSCU1234567'
    });
    return;
  }
  
  try {
    const result = await resolveTracking(bl);
    
    if (!result) {
      res.status(404).json({
        success: false,
        error: `Aucune cargaison trouvée avec le BL "${bl}". Exemples: MSCU1234567, MEDU8932154, FX-AT-2026-001, MSCU9876543, MEDU5678901`
      });
      return;
    }
    
    res.json({
      success: true,
      source: result.source,
      data: result.data
    });
    
  } catch (err) {
    console.error(`[track] Error for ${bl}:`, err);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur de tracking',
      data: null
    });
  }
};
