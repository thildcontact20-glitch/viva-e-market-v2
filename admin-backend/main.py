"""
Viva E-Market Admin Backend — FastAPI
=======================================
- Session-based password auth (cookie)
- JSON-based product store (data/produits.json)
- Full CRUD: ajouter / modifier / supprimer des produits
- Sync products to catalogue.html (updates inline JS array)
- Image upload / assignment / deletion
- Serves admin frontend via Jinja2 templates
- API endpoint /api/produits for public catalogue consumption
"""

import json
import os
import re
import secrets
import shutil
import uuid
from datetime import datetime, timedelta
from pathlib import Path

import uvicorn
from fastapi import (
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
)
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.cors import CORSMiddleware

# ─── Paths ───────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent  # viva-e-market-v2/
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = BASE_DIR / "uploads"
TEMPLATES_DIR = BASE_DIR / "templates"

DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)

PRODUITS_JSON = DATA_DIR / "produits.json"
IMAGES_JSON = DATA_DIR / "images.json"
CATALOGUE_HTML = PROJECT_DIR / "catalogue.html"

# ─── Auth ────────────────────────────────────────────────────────────────
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Mystiko2026!")

# Persistent session token (survives reload)
SESSION_FILE = DATA_DIR / "session_token.txt"
if SESSION_FILE.exists():
    SESSION_TOKEN = SESSION_FILE.read_text().strip()
else:
    SESSION_TOKEN = secrets.token_hex(32)
    SESSION_FILE.write_text(SESSION_TOKEN)

app = FastAPI(title="Viva E-Market Admin Backend")

# CORS – allow Vercel deployment
CORS_ORIGINS = os.environ.get(
    "CORS_ORIGINS",
    "https://viva-e-market.vercel.app,https://viva-e-market-v2.vercel.app,http://localhost:8000,http://localhost:8001,https://*.onrender.com",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

# ─── Product persistence (JSON) ─────────────────────────────────────────


def _generate_id(nom: str) -> str:
    """Generate a URL-safe product ID from the product name."""
    base = nom.lower().strip()
    base = re.sub(r"[^a-z0-9]+", "-", base)
    base = base.strip("-")
    suffix = uuid.uuid4().hex[:6]
    return f"{base}-{suffix}"


def load_produits() -> list[dict]:
    """Load all products from produits.json."""
    if not PRODUITS_JSON.exists():
        return []
    try:
        with open(PRODUITS_JSON, encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
            return []
    except (json.JSONDecodeError, OSError):
        return []


def save_produits(products: list[dict]) -> None:
    """Write products list to produits.json."""
    with open(PRODUITS_JSON, "w", encoding="utf-8") as f:
        json.dump(products, f, indent=2, ensure_ascii=False)
    # After saving JSON, sync catalogue.html
    sync_catalogue_html(products)


def sync_catalogue_html(products: list[dict]) -> bool:
    """Update the inline products[] array in catalogue.html from JSON data."""
    if not CATALOGUE_HTML.exists():
        return False

    html = CATALOGUE_HTML.read_text(encoding="utf-8")

    # Build the JS array string from our products
    lines = []
    for p in products:
        nom_escaped = p.get("nom", "").replace("'", "\\'")
        mill_escaped = p.get("millesime", "").replace("'", "\\'")
        cat_escaped = p.get("categorie", "").replace("'", "\\'")
        icon = p.get("icon", "fa-wine-bottle")
        image = p.get("image", "")
        prix = p.get("prix", 0)
        lines.append(
            f"  {{ nom: '{nom_escaped}', millesime: '{mill_escaped}', categorie: '{cat_escaped}', prix: {prix}, icon: '{icon}', image: '{image}' }},"
        )

    js_array = "var produits = [\n" + "\n".join(lines) + "\n];"

    # Find and replace the existing var produits = [ ... ];
    pattern = r"var produits\s*=\s*\[.*?\];"
    match = re.search(pattern, html, re.DOTALL)
    if not match:
        return False

    new_html = html[: match.start()] + js_array + html[match.end() :]
    CATALOGUE_HTML.write_text(new_html, encoding="utf-8")
    return True


def ensure_produits_json():
    """Create produits.json from catalogue.html if it doesn't exist or is empty."""
    if PRODUITS_JSON.exists():
        try:
            existing = json.loads(PRODUITS_JSON.read_text(encoding="utf-8"))
            if isinstance(existing, list) and len(existing) > 0:
                return  # Already has data
        except (json.JSONDecodeError, OSError):
            pass  # File is corrupt, rebuild

    # Try to parse from catalogue.html
    if CATALOGUE_HTML.exists():
        html = CATALOGUE_HTML.read_text(encoding="utf-8")
        products = _parse_products_from_catalogue_html(html)
        if products:
            save_produits(products)
            return

    # Fallback: write default products
    default_products = [
        {"id": "chateau-margaux-2015", "nom": "Château Margaux", "millesime": "2015", "categorie": "Vins Rouges", "prix": 350000, "icon": "fa-wine-bottle", "image": ""},
        {"id": "domaine-romane-conti-2018", "nom": "Domaine de la Romanée-Conti", "millesime": "2018", "categorie": "Vins Rouges", "prix": 850000, "icon": "fa-wine-bottle", "image": ""},
        {"id": "chateau-lafite-2016", "nom": "Château Lafite Rothschild", "millesime": "2016", "categorie": "Vins Rouges", "prix": 420000, "icon": "fa-wine-bottle", "image": ""},
        {"id": "sassicaia-2017", "nom": "Sassicaia", "millesime": "2017", "categorie": "Vins Rouges", "prix": 290000, "icon": "fa-wine-bottle", "image": ""},
        {"id": "chateau-yquem-2014", "nom": "Château d'Yquem", "millesime": "2014", "categorie": "Vins Blancs", "prix": 380000, "icon": "fa-wine-bottle", "image": ""},
        {"id": "puligny-montrachet-2019", "nom": "Puligny-Montrachet", "millesime": "2019", "categorie": "Vins Blancs", "prix": 220000, "icon": "fa-wine-bottle", "image": ""},
        {"id": "sancerre-2020", "nom": "Sancerre", "millesime": "2020", "categorie": "Vins Blancs", "prix": 85000, "icon": "fa-wine-bottle", "image": ""},
        {"id": "dom-perignon-2012", "nom": "Dom Pérignon", "millesime": "2012", "categorie": "Champagne", "prix": 250000, "icon": "fa-champagne-glasses", "image": ""},
        {"id": "cristal-roederer-2014", "nom": "Cristal Roederer", "millesime": "2014", "categorie": "Champagne", "prix": 320000, "icon": "fa-champagne-glasses", "image": ""},
        {"id": "bollinger-rd-2007", "nom": "Bollinger R.D.", "millesime": "2007", "categorie": "Champagne", "prix": 180000, "icon": "fa-champagne-glasses", "image": ""},
        {"id": "macallan-18-ans", "nom": "Macallan 18 ans", "millesime": "", "categorie": "Whisky", "prix": 350000, "icon": "fa-whiskey-glass", "image": ""},
        {"id": "johnnie-walker-blue", "nom": "Johnnie Walker Blue Label", "millesime": "", "categorie": "Whisky", "prix": 280000, "icon": "fa-whiskey-glass", "image": ""},
        {"id": "glenfiddich-21-ans", "nom": "Glenfiddich 21 ans", "millesime": "", "categorie": "Whisky", "prix": 220000, "icon": "fa-whiskey-glass", "image": ""},
        {"id": "hendricks-gin", "nom": "Hendrick's Gin", "millesime": "", "categorie": "Spiritueux", "prix": 45000, "icon": "fa-wine-bottle", "image": ""},
        {"id": "monkey-47", "nom": "Monkey 47", "millesime": "", "categorie": "Spiritueux", "prix": 55000, "icon": "fa-wine-bottle", "image": ""},
        {"id": "the-botanist", "nom": "The Botanist", "millesime": "", "categorie": "Spiritueux", "prix": 42000, "icon": "fa-wine-bottle", "image": ""},
        {"id": "diplomatico-reserva", "nom": "Diplomático Reserva Exclusiva", "millesime": "", "categorie": "Spiritueux", "prix": 65000, "icon": "fa-wine-bottle", "image": ""},
        {"id": "zacapa-23", "nom": "Zacapa 23", "millesime": "", "categorie": "Spiritueux", "prix": 78000, "icon": "fa-wine-bottle", "image": ""},
        {"id": "grey-goose", "nom": "Grey Goose", "millesime": "", "categorie": "Spiritueux", "prix": 60000, "icon": "fa-wine-bottle", "image": ""},
        {"id": "belvedere", "nom": "Belvedere", "millesime": "", "categorie": "Spiritueux", "prix": 55000, "icon": "fa-wine-bottle", "image": ""},
        {"id": "caisse-bois-personnalisee", "nom": "Caisse Bois Personnalisée", "millesime": "", "categorie": "Services", "prix": 50000, "icon": "fa-gem", "image": ""},
        {"id": "coffret-degustation-6-vins", "nom": "Coffret Dégustation 6 vins", "millesime": "", "categorie": "Services", "prix": 150000, "icon": "fa-gem", "image": ""},
        {"id": "abonnement-wine-club", "nom": "Abonnement Wine Club", "millesime": "par mois", "categorie": "Services", "prix": 250000, "icon": "fa-gem", "image": ""},
        {"id": "cours-oenologie", "nom": "Cours d'Œnologie", "millesime": "", "categorie": "Services", "prix": 75000, "icon": "fa-gem", "image": ""},
    ]
    for p in default_products:
        if "id" not in p:
            p["id"] = _generate_id(p.get("nom", "produit"))
    save_produits(default_products)


def _parse_products_from_catalogue_html(html: str) -> list[dict]:
    """Parse the var produits = [...] array from catalogue.html into a list of dicts."""
    pattern = r"var produits\s*=\s*\[(.*?)\];"
    match = re.search(pattern, html, re.DOTALL)
    if not match:
        return []

    inner = match.group(1).strip()
    # Split into individual objects by matching top-level braces
    objects = []
    depth = 0
    buf = []
    in_string = False
    string_char = None
    for ch in inner:
        if in_string:
            buf.append(ch)
            if ch == "\\":
                # skip next char for escaping
                pass
            elif ch == string_char:
                in_string = False
                string_char = None
        elif ch in ("'", '"'):
            in_string = True
            string_char = ch
            buf.append(ch)
        elif ch == "{":
            if depth == 0:
                buf = ["{"]
            else:
                buf.append(ch)
            depth += 1
        elif ch == "}":
            depth -= 1
            buf.append(ch)
            if depth == 0:
                obj_text = "".join(buf)
                obj = _parse_simple_js_obj(obj_text)
                if obj.get("nom"):
                    obj.setdefault("id", _generate_id(obj.get("nom", "produit")))
                    obj.setdefault("icon", "fa-wine-bottle")
                    obj.setdefault("image", "")
                    objects.append(obj)
                buf = []
        else:
            if depth > 0:
                buf.append(ch)
    return objects


def _parse_simple_js_obj(text: str) -> dict:
    """Parse a simple JS object literal like { nom: '...', prix: 123 } into a Python dict."""
    obj = {}
    text = text.strip()
    if text.startswith("{"):
        text = text[1:]
    if text.endswith("}"):
        text = text[:-1]

    # Simple key: value parsing (assumes no nested objects)
    depth_brace = 0
    depth_bracket = 0
    in_str = False
    str_char = None
    buf = []
    key = None
    for ch in text:
        if in_str:
            buf.append(ch)
            if ch == "\\":
                pass
            elif ch == str_char:
                in_str = False
                str_char = None
        elif ch in ("'", '"'):
            in_str = True
            str_char = ch
            buf.append(ch)
        elif ch in ("{",):
            depth_brace += 1
            buf.append(ch)
        elif ch in ("}",):
            depth_brace -= 1
            buf.append(ch)
        elif ch in ("[",):
            depth_bracket += 1
            buf.append(ch)
        elif ch in ("]",):
            depth_bracket -= 1
            buf.append(ch)
        elif ch == ":" and depth_brace == 0 and depth_bracket == 0:
            key = "".join(buf).strip().strip("'").strip('"')
            buf = []
        elif ch == "," and depth_brace == 0 and depth_bracket == 0:
            if key:
                val_str = "".join(buf).strip()
                obj[key] = _parse_simple_js_val(val_str)
                key = None
            buf = []
        else:
            buf.append(ch)

    # Last pair
    if key:
        val_str = "".join(buf).strip()
        obj[key] = _parse_simple_js_val(val_str)

    return obj


def _parse_simple_js_val(raw: str):
    """Parse a JS literal value."""
    raw = raw.strip()
    if not raw:
        return ""
    # String
    if (raw.startswith("'") and raw.endswith("'")) or (raw.startswith('"') and raw.endswith('"')):
        return raw[1:-1].replace("\\'", "'").replace('\\"', '"').replace("\\\\", "\\")
    # Number
    try:
        if "." in raw:
            return float(raw)
        return int(raw)
    except ValueError:
        pass
    # Boolean/null
    if raw == "true":
        return True
    if raw == "false":
        return False
    if raw in ("null", "undefined"):
        return None
    return raw


# ─── Image persistence ─────────────────────────────────────────────────


def load_images_data() -> list[dict]:
    """Load the list of product → image assignments from images.json."""
    if not IMAGES_JSON.exists():
        return []
    try:
        with open(IMAGES_JSON, encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
            return []
    except (json.JSONDecodeError, OSError):
        return []


def save_images_data(assignments: list[dict]) -> None:
    """Write the image assignments list to images.json."""
    with open(IMAGES_JSON, "w", encoding="utf-8") as f:
        json.dump(assignments, f, indent=2, ensure_ascii=False)


# ─── Auth helpers ───────────────────────────────────────────────────────


def _check_session(request: Request) -> bool:
    """Check the session cookie."""
    token = request.cookies.get("admin_session")
    return token == SESSION_TOKEN


def _require_session(request: Request):
    """Raise 401 if not authenticated."""
    if not _check_session(request):
        accept = request.headers.get("accept", "")
        if "text/html" in accept:
            return RedirectResponse(url="/login", status_code=303)
        raise HTTPException(status_code=401, detail="Non authentifié")


# ─── Initialise on startup ─────────────────────────────────────────────
@app.on_event("startup")
def startup():
    """Ensure produits.json exists on first run."""
    ensure_produits_json()


# ─── Auth Routes ────────────────────────────────────────────────────────


@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    """Serve the login page."""
    if _check_session(request):
        return RedirectResponse(url="/admin", status_code=303)
    return templates.TemplateResponse("login.html", {"request": request})


@app.post("/login")
def login(request: Request, password: str = Form(...)):
    """Authenticate with password."""
    if password != ADMIN_PASSWORD:
        return templates.TemplateResponse(
            "login.html",
            {"request": request, "error": "Mot de passe incorrect"},
        )
    response = RedirectResponse(url="/admin", status_code=303)
    response.set_cookie(
        key="admin_session",
        value=SESSION_TOKEN,
        httponly=True,
        max_age=86400,
        path="/",
    )
    return response


@app.get("/logout")
def logout():
    """Clear the session cookie and redirect to login."""
    response = RedirectResponse(url="/login", status_code=303)
    response.delete_cookie("admin_session", path="/")
    return response


# ─── Admin dashboard ────────────────────────────────────────────────────


@app.get("/admin", response_class=HTMLResponse)
def admin_dashboard(request: Request):
    """Serve the admin dashboard."""
    _require_session(request)
    products = load_produits()
    images = load_images_data()
    return templates.TemplateResponse(
        "admin.html",
        {
            "request": request,
            "products": products,
            "images": images,
        },
    )


# ─── Public API — catalogue products ────────────────────────────────────


@app.get("/api/produits")
def api_produits():
    """Return all products as JSON (public, no auth required).
    This is what catalogue.html calls to load products dynamically."""
    products = load_produits()
    return JSONResponse(content=products)


@app.get("/api/produits/images")
def api_produits_images():
    """Return image assignments as a dict: { product_id: image_url } (public)."""
    assignments = load_images_data()
    by_id = {}
    for a in assignments:
        by_id[a["product_id"]] = a["image_url"]
    return JSONResponse(content=by_id)


# ─── Old API endpoints (backward compat) ────────────────────────────────


@app.get("/api/products")
def api_products_old():
    """Legacy: return products from old HTML files. Now returns JSON products instead."""
    return api_produits()


@app.get("/api/products/images")
def api_products_images_old():
    """Legacy image endpoint."""
    return api_produits_images()


# ─── Admin CRUD API ─────────────────────────────────────────────────────


@app.get("/api/admin/produits")
def admin_get_produits(_request: Request):
    """List all products (protected)."""
    _require_session(_request)
    return JSONResponse(content=load_produits())


@app.post("/api/admin/produits")
async def admin_create_produit(_request: Request):
    """Create a new product (protected). Accepts JSON body."""
    _require_session(_request)
    body = await _request.json()
    nom = body.get("nom", "").strip()
    if not nom:
        raise HTTPException(status_code=400, detail="Le nom du produit est requis")

    # Generate ID if not provided
    produit_id = body.get("id", "").strip()
    if not produit_id:
        produit_id = _generate_id(nom)

    # Ensure unique ID
    products = load_produits()
    if any(p.get("id") == produit_id for p in products):
        raise HTTPException(status_code=409, detail=f"Un produit avec l'ID '{produit_id}' existe déjà")

    new_product = {
        "id": produit_id,
        "nom": nom,
        "millesime": body.get("millesime", ""),
        "categorie": body.get("categorie", "Autres"),
        "prix": int(body.get("prix", 0)),
        "icon": body.get("icon", "fa-wine-bottle"),
        "image": body.get("image", ""),
    }
    products.append(new_product)
    save_produits(products)
    return JSONResponse(content=new_product, status_code=201)


@app.put("/api/admin/produits/{product_id}")
async def admin_update_produit(product_id: str, _request: Request):
    """Update an existing product (protected)."""
    _require_session(_request)
    body = await _request.json()
    products = load_produits()

    idx = None
    for i, p in enumerate(products):
        if p.get("id") == product_id:
            idx = i
            break

    if idx is None:
        raise HTTPException(status_code=404, detail=f"Produit '{product_id}' introuvable")

    # Update fields
    for field in ("nom", "millesime", "categorie", "icon", "image"):
        if field in body:
            products[idx][field] = body[field]
    if "prix" in body:
        try:
            products[idx]["prix"] = int(body["prix"])
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Le prix doit être un nombre")

    save_produits(products)
    return JSONResponse(content=products[idx])


@app.delete("/api/admin/produits/{product_id}")
def admin_delete_produit(product_id: str, _request: Request):
    """Delete a product (protected)."""
    _require_session(_request)
    products = load_produits()

    new_products = [p for p in products if p.get("id") != product_id]
    if len(new_products) == len(products):
        raise HTTPException(status_code=404, detail=f"Produit '{product_id}' introuvable")

    save_produits(new_products)
    return JSONResponse(content={"status": "deleted", "id": product_id})


# ─── Admin Image API ────────────────────────────────────────────────────


@app.get("/api/admin/images")
def admin_images(_request: Request):
    """List all image assignments (protected)."""
    _require_session(_request)
    return JSONResponse(content=load_images_data())


@app.post("/api/admin/upload")
async def admin_upload(_request: Request, file: UploadFile = File(...)):
    """Upload an image file. Stores in uploads/ and returns the public URL."""
    _require_session(_request)

    if not file.filename:
        raise HTTPException(status_code=400, detail="Nom de fichier manquant")

    original_name = file.filename
    ext = Path(original_name).suffix.lower()
    allowed_exts = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"}
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Extension '{ext}' non supportée. Utilisez: {', '.join(sorted(allowed_exts))}",
        )

    unique_name = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / unique_name

    try:
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Fichier trop volumineux (max 10 MB)")
        dest.write_bytes(content)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erreur d'upload: {exc}")

    public_url = f"/uploads/{unique_name}"

    return JSONResponse(
        content={
            "filename": original_name,
            "stored_as": unique_name,
            "url": public_url,
        }
    )


@app.post("/api/admin/assign")
def admin_assign(_request: Request, data: dict):
    """Assign an image URL to a product."""
    _require_session(_request)

    product_id = data.get("product_id")
    image_url = data.get("image_url")

    if not product_id or not image_url:
        raise HTTPException(status_code=400, detail="Champs requis: product_id, image_url")

    stored_name = image_url.replace("/uploads/", "")
    stored_path = UPLOAD_DIR / stored_name
    if not stored_path.exists():
        raise HTTPException(status_code=404, detail="Fichier image introuvable sur le serveur")

    # Verify the product exists
    products = load_produits()
    product = next((p for p in products if p["id"] == product_id), None)
    if not product:
        raise HTTPException(
            status_code=404,
            detail=f"Produit '{product_id}' introuvable",
        )

    assignments = load_images_data()
    assignments = [
        a
        for a in assignments
        if a["product_id"] != product_id
    ]

    now = datetime.utcnow().isoformat()
    assignments.append(
        {
            "product_id": product_id,
            "image_url": image_url,
            "assigned_at": now,
        }
    )
    save_images_data(assignments)

    # Also update the product's image field in produits.json
    for p in products:
        if p["id"] == product_id:
            p["image"] = image_url
            break
    save_produits(products)

    return JSONResponse(
        content={
            "status": "ok",
            "product_id": product_id,
            "image_url": image_url,
        }
    )


@app.delete("/api/admin/image")
def admin_delete_image(_request: Request, data: dict):
    """Delete an image assignment."""
    _require_session(_request)

    product_id = data.get("product_id")
    image_url = data.get("image_url")

    if not product_id:
        raise HTTPException(status_code=400, detail="Champs requis: product_id")

    assignments = load_images_data()
    to_remove = [a for a in assignments if a["product_id"] == product_id]
    if not to_remove:
        raise HTTPException(status_code=404, detail=f"Aucune assignation trouvée pour {product_id}")

    new_assignments = [a for a in assignments if a["product_id"] != product_id]

    if image_url:
        stored_name = image_url.replace("/uploads/", "")
        stored_path = UPLOAD_DIR / stored_name
        if stored_path.exists():
            still_referenced = any(a["image_url"] == image_url for a in new_assignments)
            if not still_referenced:
                try:
                    stored_path.unlink()
                except OSError:
                    pass

    save_images_data(new_assignments)

    # Also clear image from product in produits.json
    products = load_produits()
    for p in products:
        if p["id"] == product_id:
            p["image"] = ""
            break
    save_produits(products)

    return JSONResponse(content={"status": "deleted", "product_id": product_id})


@app.delete("/api/admin/image/delete")
def admin_delete_image_alt(
    _request: Request,
    product_id: str = Form(...),
    image_url: str = Form(""),
):
    """Delete an image assignment via form data (for HTML forms)."""
    _require_session(_request)
    return admin_delete_image(
        _request,
        {"product_id": product_id, "image_url": image_url},
    )


# ─── Static files ──────────────────────────────────────────────────────


app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")


# ─── Health ────────────────────────────────────────────────────────────


@app.get("/api/health")
def health():
    """Simple health check."""
    return {"status": "ok", "product_count": len(load_produits())}


# ─── Entry point ────────────────────────────────────────────────────────


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    print(f"🚀 Viva E-Market Admin Backend → http://{host}:{port}")
    print(f"   Dashboard: http://localhost:{port}/admin")
    print(f"   Login:     http://localhost:{port}/login")
    print(f"   API:       http://localhost:{port}/api/produits")
    uvicorn.run("main:app", host=host, port=port, reload=True)
