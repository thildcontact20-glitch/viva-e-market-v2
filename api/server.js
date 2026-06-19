const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: [
    'https://viva-e-market-v2.vercel.app',
    'http://localhost:3000',
    /\.vercel\.app$/
  ],
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

/* ─── HEALTHCHECK ─── */
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

/* ─── PORTS DATABASE ─── */
const PORTS = [
  { id: 'CNSHA', port: 'Shanghai', country: 'Chine', lat: 31.2304, lng: 121.4737 },
  { id: 'CNYTN', port: 'Yantian', country: 'Chine', lat: 22.5803, lng: 114.2726 },
  { id: 'NLRTM', port: 'Rotterdam', country: 'Pays-Bas', lat: 51.9072, lng: 4.4669 },
  { id: 'FRLEH', port: 'Le Havre', country: 'France', lat: 49.4938, lng: 0.1077 },
  { id: 'FRMRS', port: 'Marseille', country: 'France', lat: 43.3131, lng: 5.3508 },
  { id: 'ESALG', port: 'Algésiras', country: 'Espagne', lat: 36.1447, lng: -5.4439 },
  { id: 'CIABJ', port: 'Abidjan', country: "Côte d'Ivoire", lat: 5.3000, lng: -4.0167 },
  { id: 'SNDKR', port: 'Dakar', country: 'Sénégal', lat: 14.6728, lng: -17.4317 },
  { id: 'GHTMA', port: 'Tema', country: 'Ghana', lat: 5.6206, lng: -0.0164 },
  { id: 'NGLOS', port: 'Lagos', country: 'Nigeria', lat: 6.4403, lng: 3.3767 },
  { id: 'CMDLA', port: 'Douala', country: 'Cameroun', lat: 4.0340, lng: 9.7016 },
  { id: 'BJCOO', port: 'Cotonou', country: 'Bénin', lat: 6.3667, lng: 2.4167 },
  { id: 'TGLFW', port: 'Lomé', country: 'Togo', lat: 6.1300, lng: 1.2100 },
  { id: 'AOLAD', port: 'Luanda', country: 'Angola', lat: -8.8106, lng: 13.2367 },
  { id: 'ZADUR', port: 'Durban', country: 'Afrique du Sud', lat: -29.8794, lng: 31.0336 }
];

app.get('/api/ports', (req, res) => {
  res.json({ success: true, count: PORTS.length, ports: PORTS });
});

/* ─── SIMULATED SHIPMENTS ─── */
const SHIPMENTS = {
  'MSCU1234567': {
    bl: 'MSCU1234567', vessel: 'MSC AURORA', voyage: '247W',
    origin: { port: 'Shanghai', country: 'Chine', lat: 31.2, lng: 121.5 },
    destination: { port: 'Abidjan', country: "Côte d'Ivoire", lat: 5.3, lng: -4.0 },
    container: "1 × 40' HC", cargo: 'Électronique grand public',
    progress: 67, status: 'in_transit', eta: '2026-07-14',
    position: { lat: 14.7, lng: -17.4, description: 'Océan Atlantique, au large de Dakar' },
    distanceRemaining: '1 850 km',
    steps: [{name:'Documentation',status:'completed',date:'2026-05-20'},{name:'Embarquement',status:'completed',date:'2026-05-25'},{name:'En Transit',status:'active',date:'2026-06-01'},{name:'Arrivée Port',status:'pending',date:null},{name:'Dédouanement',status:'pending',date:null},{name:'Livré',status:'pending',date:null}]
  },
  'MEDU8932154': {
    bl: 'MEDU8932154', vessel: 'MSC DIANA', voyage: '245E',
    origin: { port: 'Rotterdam', country: 'Pays-Bas', lat: 51.9, lng: 4.5 },
    destination: { port: 'Abidjan', country: "Côte d'Ivoire", lat: 5.3, lng: -4.0 },
    container: "2 × 20' ST", cargo: 'Produits laitiers et fromages',
    progress: 42, status: 'in_transit', eta: '2026-07-22',
    position: { lat: 27.2, lng: -16.5, description: 'Océan Atlantique Nord, proche des Canaries' },
    distanceRemaining: '3 200 km',
    steps: [{name:'Documentation',status:'completed',date:'2026-06-15'},{name:'Embarquement',status:'completed',date:'2026-06-20'},{name:'En Transit',status:'active',date:'2026-06-22'},{name:'Arrivée Port',status:'pending',date:null},{name:'Dédouanement',status:'pending',date:null},{name:'Livré',status:'pending',date:null}]
  },
  'FX-AT-2026-001': {
    bl: 'FX-AT-2026-001', vessel: 'FedEx Express FX58', voyage: 'FX58-25JUN',
    origin: { port: 'Paris CDG', country: 'France', lat: 49.0, lng: 2.55 },
    destination: { port: 'Abidjan', country: "Côte d'Ivoire", lat: 5.3, lng: -4.0 },
    container: '1 palette', cargo: 'Pièces détachées automobile',
    progress: 52, status: 'in_transit', eta: '2026-06-27',
    position: { lat: 33.6, lng: -7.6, description: 'Escale à Casablanca (CMN)' },
    distanceRemaining: '3 500 km',
    steps: [{name:'Documentation',status:'completed',date:'2026-06-24'},{name:'Embarquement',status:'completed',date:'2026-06-25'},{name:'En Transit',status:'active',date:'2026-06-25'},{name:'Arrivée Port',status:'pending',date:null},{name:'Dédouanement',status:'pending',date:null},{name:'Livré',status:'pending',date:null}]
  },
  'MSCU9876543': {
    bl: 'MSCU9876543', vessel: 'MSC LEO', voyage: '248W',
    origin: { port: 'Le Havre', country: 'France', lat: 49.5, lng: 0.1 },
    destination: { port: 'Abidjan', country: "Côte d'Ivoire", lat: 5.3, lng: -4.0 },
    container: "1 × 40' RH", cargo: 'Machines industrielles',
    progress: 11, status: 'documentation', eta: '2026-08-08',
    position: { lat: 49.5, lng: 0.1, description: "Port du Havre — Terminal à conteneurs" },
    distanceRemaining: '6 500 km',
    steps: [{name:'Documentation',status:'active',date:'2026-06-19'},{name:'Embarquement',status:'pending',date:null},{name:'En Transit',status:'pending',date:null},{name:'Arrivée Port',status:'pending',date:null},{name:'Dédouanement',status:'pending',date:null},{name:'Livré',status:'pending',date:null}]
  },
  'MEDU5678901': {
    bl: 'MEDU5678901', vessel: 'DHL Air DHL123', voyage: 'DHL123-15MAY',
    origin: { port: 'Marseille', country: 'France', lat: 43.3, lng: 5.35 },
    destination: { port: 'Abidjan', country: "Côte d'Ivoire", lat: 5.3, lng: -4.0 },
    container: '1 palette', cargo: 'Échantillons cosmétiques',
    progress: 100, status: 'delivered', eta: '2026-05-20',
    position: { lat: 5.3, lng: -4.0, description: "Livré — Abidjan" },
    distanceRemaining: '0 km',
    steps: [{name:'Documentation',status:'completed',date:'2026-05-15'},{name:'Embarquement',status:'completed',date:'2026-05-16'},{name:'En Transit',status:'completed',date:'2026-05-16'},{name:'Arrivée Port',status:'completed',date:'2026-05-17'},{name:'Dédouanement',status:'completed',date:'2026-05-18'},{name:'Livré',status:'completed',date:'2026-05-20'}]
  }
};

/* ─── DHL API (si clé configurée) ─── */
async function fetchDHL(bl) {
  const key = process.env.DHL_API_KEY;
  if (!key) throw new Error('No DHL key');
  const res = await fetch(`https://api-eu.dhl.com/track/shipments?trackingNumber=${encodeURIComponent(bl)}`, {
    headers: { 'DHL-API-Key': key },
    timeout: 8000
  });
  if (!res.ok) throw new Error(`DHL ${res.status}`);
  return res.json();
}

/* ─── TRACKING ─── */
app.get('/api/track', async (req, res) => {
  const bl = (req.query.bl || '').toUpperCase().trim();
  if (!bl) return res.status(400).json({ success: false, error: 'Paramètre "bl" requis' });

  try {
    // Étape 1 : DHL API (si clé présente)
    if (process.env.DHL_API_KEY) {
      try {
        const dhlData = await fetchDHL(bl);
        const s = dhlData.shipments?.[0] || {};
        return res.json({
          success: true, source: 'dhl',
          data: {
            bl, vessel: s.service || 'DHL', voyage: '',
            origin: { port: s.origin?.address?.addressLocality || '', country: s.origin?.address?.countryCode || '', lat: 0, lng: 0 },
            destination: { port: s.destination?.address?.addressLocality || '', country: s.destination?.address?.countryCode || '', lat: 0, lng: 0 },
            container: '', cargo: s.description || '', progress: s.status?.statusCode === 'delivered' ? 100 : 50,
            status: s.status?.statusCode || 'in_transit', eta: s.estimatedTimeOfDelivery || null,
            position: { lat: 0, lng: 0, description: s.status?.location?.address?.addressLocality || '' },
            distanceRemaining: '', steps: []
          }
        });
      } catch(e) { console.warn(`[DHL] ${bl}: ${e.message}`); }
    }

    // Étape 2 : Simulation
    const sim = SHIPMENTS[bl];
    if (!sim) return res.status(404).json({ success: false, error: `BL "${bl}" introuvable`, data: null });

    sim.lastUpdate = new Date().toISOString();
    return res.json({ success: true, source: 'simulated', data: sim });

  } catch(err) {
    console.error(`[track] ${bl}:`, err);
    res.status(500).json({ success: false, error: 'Erreur interne', data: null });
  }
});

app.listen(PORT, () => {
  console.log(`🚢 VIVA Tracking Proxy running on port ${PORT}`);
  console.log(`   DHL: ${process.env.DHL_API_KEY ? '✅' : '❌ (fallback simulation)'}`);
});
