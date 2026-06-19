# 🛠 VIVA E-MARKET — Admin d'images

## Architecture

```
┌─────────────────────────────────────┐     ┌──────────────────────────┐
│   Site statique (HTML/JS/CSS)       │     │   Backend Admin (API)    │
│   https://viva-e-market-v2.vercel.app│◄───►│   http://localhost:8001  │
│                                     │     │                          │
│   vins.html       ← admin-bridge.js │     │   FastAPI + Jinja2       │
│   epicerie.html   ← admin-bridge.js │     │   uploads/ + data/       │
│   spiritueux.html ← admin-bridge.js  │     │   Mot de passe: admin123 │
└─────────────────────────────────────┘     └──────────────────────────┘
```

## Lancer l'admin en local

```bash
cd admin-backend
uv pip install -r requirements.txt
PORT=8001 uv run python main.py
```

Ouvre http://localhost:8001 dans le navigateur. Mot de passe : **admin123**

## Ce que tu peux faire dans l'admin

1. **Dashboard** — Voir tous les 55 produits (Vins, Épicerie, Spiritueux)
2. **Filtrer** — Par catégorie, région, ou "Sans image uniquement"
3. **Uploader** — Glisse une photo, choisis un produit → Associée automatiquement
4. **Changer/Supprimer** — Les photos assignées
5. **Statistiques** — Barre de progression des images assignées

## API backend

| Endpoint | Description |
|---|---|
| GET /api/products | Liste des 55 produits |
| GET /api/products/images | Assignations (utilisé par le bridge) |
| POST /api/admin/upload | Upload image (auth requise) |
| POST /api/admin/assign | Assigner image à produit (auth requise) |
| DELETE /api/admin/image | Supprimer assignation (auth requise) |
| GET /login | Page connexion |
| GET /admin | Dashboard admin (auth requise) |

## Fichiers modifiés

- `admin-backend/` → Backend FastAPI complet
- `js/admin-bridge.js` → Pont JS pour les pages statiques
- `vins.html` → Bridge intégré (line 735)
- `epicerie.html` → Bridge intégré (line 765)
- `spiritueux.html` → Bridge intégré (line 762)

## Déploiement sur Render (gratuit)

Pour que l'admin soit accessible 24/7 sans lancer de terminal :

1. Crée un compte gratuit sur https://render.com
2. Dashboard → **New +** → **Web Service**
3. Connecte ton GitHub (ou upload direct)
4. Configure :
   - **Root Directory** : `admin-backend`
   - **Build Command** : `pip install -r requirements.txt`
   - **Start Command** : `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan** : Free
5. Variables d'environnement :
   - `ADMIN_PASSWORD` = (ton mot de passe)
   - `CORS_ORIGINS` = `https://viva-e-market-v2.vercel.app`
6. Une fois déployé, Render donne une URL : `https://ton-app.onrender.com`
7. Copie cette URL dans `js/admin-bridge.js` :
   ```js
   window.ADMIN_API_URL = 'https://ton-app.onrender.com';
   ```
   (ou mets-la avant le chargement du script dans les pages HTML)

8. Redéploie le site statique : `npx vercel --prod --yes`
9. L'admin est en ligne ! Accède à l'URL Render pour gérer les images.

⚠️ **Render Free** : Le service s'endort après 15min d'inactivité. Premier appel = 30s de réveil. Les fichiers uploadés sont sur le disque éphémère — ils survivent aux redémarrages (Render garde le disk) mais pas à un redéploiement.
