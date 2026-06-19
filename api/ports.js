/**
 * VIVA E-MARKET — PORTS API (Vercel Serverless Function)
 * Endpoint : GET /api/ports
 * Retourne la liste des ports avec coordonnées
 */
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  res.json({
    success: true,
    count: 20,
    ports: [
      { id: 'CNSHA', port: 'Shanghai', country: 'Chine', lat: 31.2304, lng: 121.4737, code: 'CNSHA' },
      { id: 'CNYTN', port: 'Yantian', country: 'Chine', lat: 22.5803, lng: 114.2726, code: 'CNYTN' },
      { id: 'NLRTM', port: 'Rotterdam', country: 'Pays-Bas', lat: 51.9072, lng: 4.4669, code: 'NLRTM' },
      { id: 'FRLEH', port: 'Le Havre', country: 'France', lat: 49.4938, lng: 0.1077, code: 'FRLEH' },
      { id: 'FRMRS', port: 'Marseille', country: 'France', lat: 43.3131, lng: 5.3508, code: 'FRMRS' },
      { id: 'ESBIO', port: 'Bilbao', country: 'Espagne', lat: 43.3390, lng: -3.0080, code: 'ESBIO' },
      { id: 'ESALG', port: 'Algésiras', country: 'Espagne', lat: 36.1447, lng: -5.4439, code: 'ESALG' },
      { id: 'CIABJ', port: 'Abidjan', country: "Côte d'Ivoire", lat: 5.3000, lng: -4.0167, code: 'CIABJ' },
      { id: 'SNDKR', port: 'Dakar', country: 'Sénégal', lat: 14.6728, lng: -17.4317, code: 'SNDKR' },
      { id: 'GHTMA', port: 'Tema', country: 'Ghana', lat: 5.6206, lng: -0.0164, code: 'GHTMA' },
      { id: 'NGLOS', port: 'Apapa (Lagos)', country: 'Nigeria', lat: 6.4403, lng: 3.3767, code: 'NGLOS' },
      { id: 'CMDLA', port: 'Douala', country: 'Cameroun', lat: 4.0340, lng: 9.7016, code: 'CMDLA' },
      { id: 'BJCOO', port: 'Cotonou', country: 'Bénin', lat: 6.3667, lng: 2.4167, code: 'BJCOO' },
      { id: 'TGLFW', port: 'Lomé', country: 'Togo', lat: 6.1300, lng: 1.2100, code: 'TGLFW' },
      { id: 'CDMAT', port: 'Matadi', country: 'République Démocratique du Congo', lat: -5.8167, lng: 13.4667, code: 'CDMAT' },
      { id: 'AOLAD', port: 'Luanda', country: 'Angola', lat: -8.8106, lng: 13.2367, code: 'AOLAD' },
      { id: 'CGPNR', port: 'Pointe-Noire', country: 'République du Congo', lat: -4.7842, lng: 11.8528, code: 'CGPNR' },
      { id: 'ZADUR', port: 'Durban', country: 'Afrique du Sud', lat: -29.8794, lng: 31.0336, code: 'ZADUR' },
      { id: 'KEMBA', port: 'Mombasa', country: 'Kenya', lat: -4.0436, lng: 39.6819, code: 'KEMBA' },
      { id: 'TZDAR', port: 'Dar es Salam', country: 'Tanzanie', lat: -6.8178, lng: 39.2864, code: 'TZDAR' }
    ]
  });
};
