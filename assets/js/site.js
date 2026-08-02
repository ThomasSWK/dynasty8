// Page unique Dynasty 8 : chargement du contenu, filtres/galerie, et espace admin
// (ajout/édition/suppression de biens + édition du contenu de la page) qui enregistre
// les modifications via l'API GitHub (voir github-api.js) une fois un token admin fourni.

const CATEGORIES = ["Appartement", "Maison", "Entrepôt", "Garage"];
const TRANSACTIONS = ["Vente", "Location"];

let LISTINGS = [];
let SITE_CONTENT = {};
let currentListing = null;
let currentImgIdx = 0;

async function initSite() {
  wireNavToggle();
  wireAdminNav();
  wireLoginModal();
  wireGalleryModal();
  injectListingFormModal();
  injectContentFormModal();
  await loadData();
}

async function loadData() {
  try {
    const [siteRes, listingsRes] = await Promise.all([
      fetch("content/site.json", { cache: "no-store" }),
      fetch("content/listings.json", { cache: "no-store" }),
    ]);
    SITE_CONTENT = await siteRes.json();
    const listingsData = await listingsRes.json();
    LISTINGS = listingsData.items || [];
  } catch (e) {
    console.error("Erreur de chargement du contenu :", e);
  }
  applySiteContent();
  renderAdminNavState();
  renderAdminToolbar();
  renderEditContentToolbar();
  renderFilters();
  renderGrid();
}

function applySiteContent() {
  const c = SITE_CONTENT;
  if (!c) return;
  if (c.heroTagline) document.getElementById("heroTaglineEl").textContent = c.heroTagline;
  if (c.servicesLine) document.getElementById("servicesLineEl").textContent = c.servicesLine;
  if (c.aboutText) document.getElementById("aboutTextEl").textContent = c.aboutText;
  if (c.footerText) document.getElementById("footerTextEl").textContent = c.footerText;
  if (c.logo) {
    document.getElementById("brandLogoEl").src = c.logo;
    document.getElementById("heroLogoEl").src = c.logo;
  }
  if (c.contact) {
    document.getElementById("agenceContact").textContent = c.contact.nom || "";
    document.getElementById("agenceAdresse").textContent = c.contact.adresse || "";
    document.getElementById("agenceTel").textContent = c.contact.telephone || "";
    document.getElementById("agenceEmail").textContent = c.contact.email || "";
  }
  renderFounderBlock();
}

function renderFounderBlock() {
  const founder = SITE_CONTENT.founder;
  const el = document.getElementById("founderBlock");
  if (!founder || (!founder.name && !founder.photo)) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `
    ${founder.photo ? `<img src="${escapeHtml(founder.photo)}" alt="${escapeHtml(founder.name || "")}">` : ""}
    ${founder.name ? `<div class="founder-name">${escapeHtml(founder.name)}${founder.title ? `, ${escapeHtml(founder.title)}` : ""}</div>` : ""}
  `;
}

/* ---------- Navigation / menu mobile ---------- */

function wireNavToggle() {
  document.getElementById("navToggle").addEventListener("click", () => {
    document.getElementById("navList").classList.toggle("open");
  });
  document.querySelectorAll("nav a").forEach((a) => {
    a.addEventListener("click", () => document.getElementById("navList").classList.remove("open"));
  });
}

/* ---------- Admin : connexion ---------- */

function renderAdminNavState() {
  const item = document.getElementById("adminNavItem");
  if (isAdmin()) {
    item.innerHTML = `<a href="#" id="adminToggleLink"><span class="admin-badge">Admin</span> · Déconnexion</a>`;
  } else {
    item.innerHTML = `<a href="#" id="adminToggleLink">🔒 Admin</a>`;
  }
  document.getElementById("adminToggleLink").addEventListener("click", (e) => {
    e.preventDefault();
    if (isAdmin()) {
      adminLogout();
    } else {
      document.getElementById("loginModal").classList.add("open");
      document.getElementById("loginPassword").focus();
    }
  });
}

function wireAdminNav() {
  // Rien à faire ici : les écouteurs sont (ré)attachés dans renderAdminNavState()
  // à chaque rendu, car le contenu du lien admin change selon l'état de connexion.
}

function wireLoginModal() {
  const modal = document.getElementById("loginModal");
  document.getElementById("loginCloseBtn").addEventListener("click", () => modal.classList.remove("open"));
  modal.addEventListener("click", (e) => {
    if (e.target.id === "loginModal") modal.classList.remove("open");
  });
  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = document.getElementById("loginPassword").value;
    const ok = await attemptLogin(pw);
    if (ok) {
      location.reload();
    } else {
      document.getElementById("loginError").classList.remove("hidden");
    }
  });
}

/* ---------- Galerie (visionneuse d'un bien) ---------- */

function wireGalleryModal() {
  document.getElementById("galPrev").addEventListener("click", () => {
    if (!currentListing || !currentListing.images.length) return;
    currentImgIdx = (currentImgIdx - 1 + currentListing.images.length) % currentListing.images.length;
    updateGallery();
    renderThumbs();
  });
  document.getElementById("galNext").addEventListener("click", () => {
    if (!currentListing || !currentListing.images.length) return;
    currentImgIdx = (currentImgIdx + 1) % currentListing.images.length;
    updateGallery();
    renderThumbs();
  });
  document.getElementById("modalCloseBtn").addEventListener("click", () => {
    document.getElementById("modalOverlay").classList.remove("open");
  });
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") e.currentTarget.classList.remove("open");
  });
}

function piecesLabel(category, short) {
  switch (category) {
    case "Garage":
      return short ? "places" : "Places";
    case "Entrepôt":
      return short ? "zones" : "Zones de stockage";
    default:
      return short ? "ch." : "Chambres";
  }
}

const ICON_HOUSE = `<svg class="ph-icon" viewBox="0 0 24 24" fill="#c9a227"><path d="M12 2 2 10h3v10h6v-6h2v6h6V10h3z"/></svg>`;

function renderFilters() {
  const cats = ["Tous", ...new Set(LISTINGS.map((l) => l.category))];
  const el = document.getElementById("filters");
  el.innerHTML = cats.map((t, i) => `<button class="filter-btn ${i === 0 ? "active" : ""}" data-cat="${t}">${escapeHtml(t)}</button>`).join("");
  el.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      el.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderGrid(btn.dataset.cat);
    });
  });
}

function renderGrid(filter = "Tous") {
  const grid = document.getElementById("listingsGrid");
  const items = filter === "Tous" ? LISTINGS : LISTINGS.filter((l) => l.category === filter);
  if (!items.length) {
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--cream-dim);">Aucun bien dans cette catégorie pour le moment.</p>`;
    return;
  }
  grid.innerHTML = items
    .map(
      (l) => `
    <div class="card" onclick="openModal('${l.id}')">
      ${
        isAdmin()
          ? `<div class="card-admin-actions">
               <button onclick="event.stopPropagation(); openListingForm('${l.id}')" title="Modifier">✎</button>
               <button class="danger" onclick="event.stopPropagation(); deleteListing('${l.id}')" title="Supprimer">✕</button>
             </div>`
          : ""
      }
      <div class="card-img">
        ${l.images && l.images[0] ? `<img src="${escapeHtml(l.images[0])}" alt="${escapeHtml(l.title)}">` : ICON_HOUSE}
        <div class="badge">${escapeHtml(l.category)} · ${escapeHtml(l.transaction)}</div>
        <div class="price-tag">${escapeHtml(l.price)}</div>
      </div>
      <div class="card-body">
        <h3>${escapeHtml(l.title)}</h3>
        <div class="loc">${escapeHtml(l.location)}</div>
        <div class="specs">
          <span>🛏 ${escapeHtml(l.pieces)} ${piecesLabel(l.category, true)}</span>
          ${l.sdb ? `<span>🛁 ${escapeHtml(l.sdb)} sdb</span>` : ""}
          <span>📐 ${escapeHtml(l.surface)} m²</span>
        </div>
      </div>
    </div>`
    )
    .join("");
}

function openModal(id) {
  currentListing = LISTINGS.find((l) => l.id === id);
  if (!currentListing) return;
  currentImgIdx = 0;
  document.getElementById("modalTitle").textContent = currentListing.title;
  document.getElementById("modalLoc").textContent = currentListing.location;
  document.getElementById("modalPrice").textContent = currentListing.price;
  document.getElementById("modalDesc").textContent = currentListing.desc;
  document.getElementById("modalSpecs").innerHTML = `
    <div><div class="num">${escapeHtml(currentListing.pieces)}</div><div class="lbl">${piecesLabel(currentListing.category)}</div></div>
    ${currentListing.sdb ? `<div><div class="num">${escapeHtml(currentListing.sdb)}</div><div class="lbl">Salles de bain</div></div>` : ""}
    <div><div class="num">${escapeHtml(currentListing.surface)}</div><div class="lbl">m²</div></div>
  `;
  updateGallery();
  renderThumbs();
  document.getElementById("modalOverlay").classList.add("open");
}

function updateGallery() {
  const imgs = currentListing.images || [];
  const img = document.getElementById("galleryImg");
  const count = document.getElementById("galCount");
  if (imgs.length) {
    img.src = imgs[currentImgIdx];
    img.style.display = "block";
    count.textContent = `${currentImgIdx + 1} / ${imgs.length}`;
  } else {
    img.style.display = "none";
    count.textContent = "Photos à venir";
  }
}

function renderThumbs() {
  const row = document.getElementById("thumbsRow");
  const imgs = currentListing.images || [];
  if (!imgs.length) {
    row.innerHTML = "";
    return;
  }
  row.innerHTML = imgs
    .map((src, i) => `<img src="${escapeHtml(src)}" class="${i === currentImgIdx ? "active" : ""}" onclick="currentImgIdx=${i}; updateGallery(); renderThumbs();">`)
    .join("");
}

/* ---------- Admin : ajout / édition / suppression d'un bien ---------- */

function renderAdminToolbar() {
  const el = document.getElementById("adminToolbar");
  el.innerHTML = isAdmin() ? `<button class="ghost-btn" id="addListingBtn">+ Ajouter un bien</button>` : "";
  if (isAdmin()) {
    document.getElementById("addListingBtn").addEventListener("click", () => openListingForm(null));
  }
}

function injectListingFormModal() {
  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div class="modal-overlay" id="listingFormModal">
      <div class="admin-box">
        <div class="modal-close"><button id="listingFormCloseBtn">✕</button></div>
        <h3 id="listingFormTitle">Ajouter un bien</h3>
        <form id="listingForm">
          <label>Catégorie</label>
          <select id="lf-category">${CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("")}</select>

          <label>Transaction</label>
          <select id="lf-transaction">${TRANSACTIONS.map((t) => `<option value="${t}">${t}</option>`).join("")}</select>

          <label>Titre du bien</label>
          <input type="text" id="lf-title" required>

          <label>Quartier / emplacement</label>
          <input type="text" id="lf-location" required>

          <div class="field-row">
            <div>
              <label>Prix (texte libre)</label>
              <input type="text" id="lf-price" placeholder="ex: 85 000 $ ou 2 400 $ / mois" required>
            </div>
            <div>
              <label>Superficie (m²)</label>
              <input type="text" id="lf-surface" required>
            </div>
          </div>

          <div class="field-row">
            <div>
              <label id="lf-pieces-label">Chambres / Places</label>
              <input type="text" id="lf-pieces" required>
            </div>
            <div>
              <label>Salles de bain (optionnel)</label>
              <input type="text" id="lf-sdb">
            </div>
          </div>

          <label>Description</label>
          <textarea id="lf-desc" rows="3" required></textarea>

          <label>Importer des photos (depuis votre ordinateur)</label>
          <input type="file" id="lf-image-files" accept="image/*" multiple>

          <label>Ou coller des URLs de photos (une par ligne)</label>
          <textarea id="lf-images" rows="3" placeholder="https://..."></textarea>

          <input type="hidden" id="lf-id">
          <button type="submit">Enregistrer</button>
          <p class="admin-status" id="listingFormStatus"></p>
        </form>
      </div>
    </div>
  `
  );

  document.getElementById("listingFormCloseBtn").addEventListener("click", () => {
    document.getElementById("listingFormModal").classList.remove("open");
  });
  document.getElementById("listingFormModal").addEventListener("click", (e) => {
    if (e.target.id === "listingFormModal") e.currentTarget.classList.remove("open");
  });
  document.getElementById("lf-category").addEventListener("change", (e) => {
    document.getElementById("lf-pieces-label").textContent =
      piecesLabel(e.target.value, false) === "Places" ? "Places" : piecesLabel(e.target.value, false);
  });
  document.getElementById("listingForm").addEventListener("submit", handleListingSubmit);
}

function openListingForm(id) {
  const isNew = !id;
  const item = isNew ? null : LISTINGS.find((l) => l.id === id);
  document.getElementById("listingFormTitle").textContent = isNew ? "Ajouter un bien" : "Modifier le bien";
  document.getElementById("lf-id").value = id || "";
  document.getElementById("lf-category").value = item ? item.category : CATEGORIES[0];
  document.getElementById("lf-transaction").value = item ? item.transaction : TRANSACTIONS[0];
  document.getElementById("lf-pieces-label").textContent = piecesLabel(document.getElementById("lf-category").value, false);
  document.getElementById("lf-title").value = item ? item.title : "";
  document.getElementById("lf-location").value = item ? item.location : "";
  document.getElementById("lf-price").value = item ? item.price : "";
  document.getElementById("lf-surface").value = item ? item.surface : "";
  document.getElementById("lf-pieces").value = item ? item.pieces : "";
  document.getElementById("lf-sdb").value = item ? item.sdb : "";
  document.getElementById("lf-desc").value = item ? item.desc : "";
  document.getElementById("lf-images").value = item && item.images ? item.images.join("\n") : "";
  document.getElementById("lf-image-files").value = "";
  document.getElementById("listingFormStatus").textContent = "";
  document.getElementById("listingFormModal").classList.add("open");
}

function slugify(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error("Impossible de lire le fichier " + file.name));
    reader.readAsDataURL(file);
  });
}

async function uploadImageFile(file, prefix) {
  const base64 = await fileToBase64(file);
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `images/uploads/${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  await ghPutRawFile(path, base64, `Ajout de la photo ${file.name}`);
  return path;
}

async function uploadImageFiles(fileInput, prefix, status) {
  const files = Array.from(fileInput.files || []);
  const uploaded = [];
  for (let i = 0; i < files.length; i++) {
    if (status) status.textContent = `Envoi des photos (${i + 1}/${files.length})...`;
    uploaded.push(await uploadImageFile(files[i], prefix));
  }
  return uploaded;
}

async function handleListingSubmit(e) {
  e.preventDefault();
  ensureGithubToken();
  if (!getGithubToken()) return;

  const existingId = document.getElementById("lf-id").value;
  const isNew = !existingId;
  const title = document.getElementById("lf-title").value.trim();
  const id = existingId || `${slugify(title) || "bien"}-${Date.now().toString(36)}`;

  const status = document.getElementById("listingFormStatus");
  status.textContent = "";

  const urlImages = document
    .getElementById("lf-images")
    .value.split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  let uploadedImages = [];
  try {
    uploadedImages = await uploadImageFiles(document.getElementById("lf-image-files"), id, status);
  } catch (err) {
    status.textContent = "Erreur d'envoi des photos : " + err.message;
    return;
  }

  const newItem = {
    id,
    category: document.getElementById("lf-category").value,
    transaction: document.getElementById("lf-transaction").value,
    title,
    location: document.getElementById("lf-location").value.trim(),
    price: document.getElementById("lf-price").value.trim(),
    surface: document.getElementById("lf-surface").value.trim(),
    pieces: document.getElementById("lf-pieces").value.trim(),
    sdb: document.getElementById("lf-sdb").value.trim(),
    desc: document.getElementById("lf-desc").value.trim(),
    images: [...uploadedImages, ...urlImages],
  };

  status.textContent = "Enregistrement en cours...";

  try {
    const { sha, json } = await ghGetFile("content/listings.json");
    const items = json.items || [];
    const updatedItems = isNew ? [...items, newItem] : items.map((it) => (it.id === id ? newItem : it));
    const message = isNew ? `Ajout du bien "${newItem.title}"` : `Modification du bien "${newItem.title}"`;
    await ghPutFile("content/listings.json", { items: updatedItems }, message, sha);
    LISTINGS = updatedItems;
    renderFilters();
    renderGrid();
    document.getElementById("listingFormModal").classList.remove("open");
    status.textContent = "";
  } catch (err) {
    status.textContent = "Erreur : " + err.message;
  }
}

async function deleteListing(id) {
  const item = LISTINGS.find((l) => l.id === id);
  if (!item) return;
  if (!confirm(`Supprimer "${item.title}" ?`)) return;
  ensureGithubToken();
  if (!getGithubToken()) return;
  try {
    const { sha, json } = await ghGetFile("content/listings.json");
    const updatedItems = (json.items || []).filter((it) => it.id !== id);
    await ghPutFile("content/listings.json", { items: updatedItems }, `Suppression du bien "${item.title}"`, sha);
    LISTINGS = updatedItems;
    renderFilters();
    renderGrid();
  } catch (err) {
    alert("Erreur : " + err.message);
  }
}

/* ---------- Admin : édition du contenu de la page ---------- */

function renderEditContentToolbar() {
  const el = document.getElementById("editContentToolbar");
  el.innerHTML = isAdmin() ? `<button class="ghost-btn" id="editContentBtn">Modifier le contenu</button>` : "";
  if (isAdmin()) {
    document.getElementById("editContentBtn").addEventListener("click", openContentForm);
  }
}

function injectContentFormModal() {
  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div class="modal-overlay" id="contentFormModal">
      <div class="admin-box">
        <div class="modal-close"><button id="contentFormCloseBtn">✕</button></div>
        <h3>Modifier le contenu</h3>
        <form id="contentForm">
          <label>Accroche (page d'accueil)</label>
          <textarea id="cf-heroTagline" rows="2"></textarea>

          <label>Ligne de services</label>
          <input type="text" id="cf-servicesLine">

          <label>Présentation de l'agence</label>
          <textarea id="cf-aboutText" rows="4"></textarea>

          <label>Nom du contact</label>
          <input type="text" id="cf-contactNom">

          <label>Adresse</label>
          <input type="text" id="cf-contactAdresse">

          <label>Téléphone</label>
          <input type="text" id="cf-contactTelephone">

          <label>Email</label>
          <input type="text" id="cf-contactEmail">

          <label>Texte du pied de page</label>
          <input type="text" id="cf-footerText">

          <label>Logo (chemin ou URL)</label>
          <input type="text" id="cf-logo">

          <label>Nom de la fondatrice / dirigeante</label>
          <input type="text" id="cf-founderName">

          <label>Titre (ex: CEO of Dynasty 8)</label>
          <input type="text" id="cf-founderTitle">

          <label>Photo de la fondatrice</label>
          <input type="file" id="cf-founderPhotoFile" accept="image/*">
          <input type="hidden" id="cf-founderPhotoCurrent">

          <button type="submit">Enregistrer</button>
          <p class="admin-status" id="contentFormStatus"></p>
        </form>
      </div>
    </div>
  `
  );

  document.getElementById("contentFormCloseBtn").addEventListener("click", () => {
    document.getElementById("contentFormModal").classList.remove("open");
  });
  document.getElementById("contentFormModal").addEventListener("click", (e) => {
    if (e.target.id === "contentFormModal") e.currentTarget.classList.remove("open");
  });
  document.getElementById("contentForm").addEventListener("submit", handleContentSubmit);
}

function openContentForm() {
  const c = SITE_CONTENT || {};
  const contact = c.contact || {};
  document.getElementById("cf-heroTagline").value = c.heroTagline || "";
  document.getElementById("cf-servicesLine").value = c.servicesLine || "";
  document.getElementById("cf-aboutText").value = c.aboutText || "";
  document.getElementById("cf-contactNom").value = contact.nom || "";
  document.getElementById("cf-contactAdresse").value = contact.adresse || "";
  document.getElementById("cf-contactTelephone").value = contact.telephone || "";
  document.getElementById("cf-contactEmail").value = contact.email || "";
  document.getElementById("cf-footerText").value = c.footerText || "";
  document.getElementById("cf-logo").value = c.logo || "images/logo.png";
  const founder = c.founder || {};
  document.getElementById("cf-founderName").value = founder.name || "";
  document.getElementById("cf-founderTitle").value = founder.title || "";
  document.getElementById("cf-founderPhotoCurrent").value = founder.photo || "";
  document.getElementById("cf-founderPhotoFile").value = "";
  document.getElementById("contentFormStatus").textContent = "";
  document.getElementById("contentFormModal").classList.add("open");
}

async function handleContentSubmit(e) {
  e.preventDefault();
  ensureGithubToken();
  if (!getGithubToken()) return;

  const status = document.getElementById("contentFormStatus");
  status.textContent = "";

  let founderPhoto = document.getElementById("cf-founderPhotoCurrent").value;
  const founderPhotoFile = document.getElementById("cf-founderPhotoFile").files[0];
  if (founderPhotoFile) {
    try {
      status.textContent = "Envoi de la photo...";
      founderPhoto = await uploadImageFile(founderPhotoFile, "founder");
    } catch (err) {
      status.textContent = "Erreur d'envoi de la photo : " + err.message;
      return;
    }
  }

  const updated = {
    heroTagline: document.getElementById("cf-heroTagline").value.trim(),
    servicesLine: document.getElementById("cf-servicesLine").value.trim(),
    aboutText: document.getElementById("cf-aboutText").value.trim(),
    contact: {
      nom: document.getElementById("cf-contactNom").value.trim(),
      adresse: document.getElementById("cf-contactAdresse").value.trim(),
      telephone: document.getElementById("cf-contactTelephone").value.trim(),
      email: document.getElementById("cf-contactEmail").value.trim(),
    },
    footerText: document.getElementById("cf-footerText").value.trim(),
    logo: document.getElementById("cf-logo").value.trim(),
    founder: {
      photo: founderPhoto,
      name: document.getElementById("cf-founderName").value.trim(),
      title: document.getElementById("cf-founderTitle").value.trim(),
    },
  };

  status.textContent = "Enregistrement...";

  try {
    const { sha } = await ghGetFile("content/site.json");
    await ghPutFile("content/site.json", updated, "Mise à jour du contenu de la page", sha);
    SITE_CONTENT = updated;
    applySiteContent();
    document.getElementById("contentFormModal").classList.remove("open");
  } catch (err) {
    status.textContent = "Erreur : " + err.message;
  }
}

initSite();
