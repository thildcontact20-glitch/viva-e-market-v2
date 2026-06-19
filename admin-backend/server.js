const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = '/tmp/produits.json';

app.use(session({
  secret: process.env.SESSION_SECRET || 'vivalys-secret',
  resave: false,
  saveUninitialized: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

function requireAuth(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  if (req.path.startsWith('/api/login')) return next();
  if (req.path.startsWith('/api/produits') && req.method === 'GET') return next();
  if (req.path === '/admin/login' || req.path === '/login.html') return next();
  res.redirect('/admin/login');
}

app.get('/', (req, res) => res.redirect('/admin/login'));
app.get('/admin/login', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get('/admin', (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/admin/login');
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

app.post('/api/login', (req, res) => {
  if (req.body.password === 'Mystiko2026!') {
    req.session.loggedIn = true;
    return res.json({ success: true });
  }
  res.status(401).json({ error: 'Mot de passe incorrect' });
});

app.get('/api/produits', (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const def = getDefaultProduits();
      fs.writeFileSync(DATA_FILE, JSON.stringify(def));
      return res.json(def);
    }
    res.json(JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/produits', (req, res) => {
  if (!req.session.loggedIn) return res.status(401).json({ error: 'Non autorisé' });
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2));
    res.json({ success: true, count: req.body.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', produits: fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE,'utf-8')).length : 0 }));

function getDefaultProduits() {
  return [
    {id:1,nom:"Château Margaux 2015",categorie:"Vins",prix:450000,image:"/img/vins/margaux.jpg",stock:12},
    {id:2,nom:"Dom Pérignon 2012",categorie:"Champagnes",prix:350000,image:"/img/champagnes/dom-perignon.jpg",stock:8},
    {id:3,nom:"Cognac Hennessy XO",categorie:"Spiritueux",prix:180000,image:"/img/spiritueux/hennessy-xo.jpg",stock:15},
    {id:4,nom:"Johnnie Walker Blue Label",categorie:"Whisky",prix:250000,image:"/img/whisky/jw-blue.jpg",stock:10},
    {id:5,nom:"Grey Goose Vodka",categorie:"Spiritueux",prix:75000,image:"/img/spiritueux/grey-goose.jpg",stock:20},
    {id:6,nom:"Macallan 18 ans",categorie:"Whisky",prix:350000,image:"/img/whisky/macallan-18.jpg",stock:6},
    {id:7,nom:"Moët & Chandon Impérial",categorie:"Champagnes",prix:55000,image:"/img/champagnes/moet-imperial.jpg",stock:25},
    {id:8,nom:"Château d'Yquem 2015",categorie:"Vins",prix:380000,image:"/img/vins/yquem.jpg",stock:5},
    {id:9,nom:"Remy Martin Louis XIII",categorie:"Cognac",prix:2800000,image:"/img/cognac/louis-xiii.jpg",stock:2},
    {id:10,nom:"Bollinger R.D. 2007",categorie:"Champagnes",prix:220000,image:"/img/champagnes/bollinger-rd.jpg",stock:7},
    {id:11,nom:"Hennessy Paradis",categorie:"Cognac",prix:950000,image:"/img/cognac/hennessy-paradis.jpg",stock:3},
    {id:12,nom:"Jamón Ibérico Bellota",categorie:"Épicerie Fine",prix:85000,image:"/img/epicerie/jamon-iberico.jpg",stock:10},
    {id:13,nom:"Truffes Noires du Périgord",categorie:"Épicerie Fine",prix:120000,image:"/img/epicerie/truffes.jpg",stock:8},
    {id:14,nom:"Caviar Beluga",categorie:"Épicerie Fine",prix:250000,image:"/img/epicerie/caviar-beluga.jpg",stock:5},
    {id:15,nom:"Osetra Caviar",categorie:"Épicerie Fine",prix:180000,image:"/img/epicerie/osetr a-caviar.jpg",stock:6},
    {id:16,nom:"Château Lafite 2016",categorie:"Vins",prix:520000,image:"/img/vins/lafite.jpg",stock:4},
    {id:17,nom:"Sauternes Château Climens",categorie:"Vins",prix:95000,image:"/img/vins/climens.jpg",stock:9},
    {id:18,nom:"Veuve Clicquot La Grande Dame",categorie:"Champagnes",prix:190000,image:"/img/champagnes/veuve-grande-dame.jpg",stock:11},
    {id:19,nom:"Glenfiddich 21 ans",categorie:"Whisky",prix:160000,image:"/img/whisky/glenfiddich-21.jpg",stock:8},
    {id:20,nom:"Absolut Elyx",categorie:"Spiritueux",prix:65000,image:"/img/spiritueux/absolut-elyx.jpg",stock:14},
    {id:21,nom:"Martell Cohiba",categorie:"Cognac",prix:420000,image:"/img/cognac/martell-cohiba.jpg",stock:4},
    {id:22,nom:"Huile d'Olive Extra Vierge",categorie:"Épicerie Fine",prix:25000,image:"/img/epicerie/huile-olive.jpg",stock:30},
    {id:23,nom:"Krug Grande Cuvée",categorie:"Champagnes",prix:280000,image:"/img/champagnes/krug-grande-cuvee.jpg",stock:6},
    {id:24,nom:"Château Haut-Brion 2014",categorie:"Vins",prix:480000,image:"/img/vins/haut-brion.jpg",stock:3}
  ];
}

app.listen(PORT, '0.0.0.0', () => console.log(`Admin backend running on ${PORT}`));
