// Page unique Dynasty 8 : chargement du contenu, filtres/galerie, et espace admin
// (ajout/édition/suppression de biens + édition du contenu de la page) qui enregistre
// les modifications via l'API GitHub (voir github-api.js) une fois un token admin fourni.

const CATEGORIES = ["Appartement", "Maison", "Entrepôt", "Garage"];
const TRANSACTIONS = ["Location", "Vente", "Location et vente"];

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
  wireAdminSaveBar();
  await loadData();
}

async function loadData() {
  try {
    const [siteRes, listingsRes] = await Promise.all([
      fetch("content/site.json", { cache: "no-store" }),
      fetch("content/listings.json", { cache: "no-store" }),
    ]);
    SITE_CONTENT = await siteRes.json();
    SITE_CONTENT.contact = SITE_CONTENT.contact || {};
    SITE_CONTENT.founder = SITE_CONTENT.founder || {};
    const listingsData = await listingsRes.json();
    LISTINGS = listingsData.items || [];
  } catch (e) {
    console.error("Erreur de chargement du contenu :", e);
  }
  applySiteContent();
  renderAdminNavState();
  renderAdminToolbar();
  renderAdminSaveBar();
  renderFilters();
  renderGrid();
}

function applySiteContent() {
  const c = SITE_CONTENT;
  if (!c) return;
  document.getElementById("heroTaglineEl").textContent = c.heroTagline || "";
  document.getElementById("servicesLineEl").textContent = c.servicesLine || "";
  document.getElementById("aboutTextEl").textContent = c.aboutText || "";
  document.getElementById("footerTextEl").textContent = c.footerText || "";
  if (c.logo) {
    document.getElementById("brandLogoEl").src = c.logo;
    document.getElementById("heroLogoEl").src = c.logo;
  }
  document.getElementById("agenceContact").textContent = c.contact.nom || "";
  document.getElementById("agenceAdresse").textContent = c.contact.adresse || "";
  document.getElementById("agenceTel").textContent = c.contact.telephone || "";
  document.getElementById("agenceEmail").textContent = c.contact.email || "";
  renderFounderBlock();
  enableInlineEditing();
}

/* ---------- Admin : édition du contenu directement sur la page ---------- */

const EDITABLE_TEXT_FIELDS = [
  { id: "heroTaglineEl", set: (v) => (SITE_CONTENT.heroTagline = v), placeholder: "Accroche" },
  { id: "servicesLineEl", set: (v) => (SITE_CONTENT.servicesLine = v), placeholder: "Ligne de services" },
  { id: "aboutTextEl", set: (v) => (SITE_CONTENT.aboutText = v), placeholder: "Présentation de l'agence" },
  { id: "agenceContact", set: (v) => (SITE_CONTENT.contact.nom = v), placeholder: "Nom du contact" },
  { id: "agenceAdresse", set: (v) => (SITE_CONTENT.contact.adresse = v), placeholder: "Adresse" },
  { id: "agenceTel", set: (v) => (SITE_CONTENT.contact.telephone = v), placeholder: "Téléphone" },
  { id: "agenceEmail", set: (v) => (SITE_CONTENT.contact.email = v), placeholder: "Email" },
  { id: "footerTextEl", set: (v) => (SITE_CONTENT.footerText = v), placeholder: "Texte du pied de page" },
];

function enableInlineEditing() {
  const admin = isAdmin();
  EDITABLE_TEXT_FIELDS.forEach(({ id, set, placeholder }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.contentEditable = admin ? "true" : "false";
    if (admin) {
      el.dataset.placeholder = placeholder;
      el.oninput = () => set(el.textContent);
    } else {
      el.oninput = null;
      delete el.dataset.placeholder;
    }
  });

  wireEditableImage(document.getElementById("brandLogoEl"), "logo");
  wireEditableImage(document.getElementById("heroLogoEl"), "logo");
}

function wireEditableImage(imgEl, kind) {
  if (!imgEl) return;
  if (!isAdmin()) {
    imgEl.classList.remove("editable-img");
    imgEl.onclick = null;
    imgEl.title = "";
    return;
  }
  imgEl.classList.add("editable-img");
  imgEl.title = "Cliquer pour changer la photo";
  imgEl.onclick = () => triggerImageUpload(kind);
}

function triggerImageUpload(kind) {
  ensureGithubToken();
  if (!getGithubToken()) return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const status = document.getElementById("adminSaveStatus");
    status.textContent = "Envoi de la photo...";
    try {
      const path = await uploadImageFile(file, kind);
      if (kind === "logo") {
        SITE_CONTENT.logo = path;
        document.getElementById("brandLogoEl").src = path;
        document.getElementById("heroLogoEl").src = path;
      } else if (kind === "founder") {
        SITE_CONTENT.founder.photo = path;
        renderFounderBlock();
      }
      status.textContent = "Photo envoyée — pensez à Enregistrer.";
    } catch (err) {
      status.textContent = "Erreur : " + err.message;
    }
  };
  input.click();
}

function renderFounderBlock() {
  const founder = SITE_CONTENT.founder || (SITE_CONTENT.founder = {});
  const photoWrap = document.getElementById("founderPhotoWrap");
  const caption = document.getElementById("founderCaption");
  const admin = isAdmin();

  if (founder.photo) {
    photoWrap.innerHTML = `<img id="founderPhotoEl" src="${escapeHtml(founder.photo)}" alt="${escapeHtml(founder.name || "")}">`;
  } else if (admin) {
    photoWrap.innerHTML = `<div class="fs-photo-placeholder" id="founderPhotoEl">+ Photo</div>`;
  } else {
    photoWrap.innerHTML = "";
  }

  if (!admin && !founder.name && !founder.title) {
    caption.innerHTML = "";
  } else {
    caption.innerHTML = `
      <div class="fs-name" id="founderNameEl" data-placeholder="Nom">${escapeHtml(founder.name || "")}</div>
      <div class="fs-title" id="founderTitleEl" data-placeholder="Titre">${escapeHtml(founder.title || "")}</div>
    `;
  }

  if (admin) {
    const nameEl = document.getElementById("founderNameEl");
    if (nameEl) {
      nameEl.contentEditable = "true";
      nameEl.oninput = () => (founder.name = nameEl.textContent);
    }
    const titleEl = document.getElementById("founderTitleEl");
    if (titleEl) {
      titleEl.contentEditable = "true";
      titleEl.oninput = () => (founder.title = titleEl.textContent);
    }
    wireEditableImage(document.getElementById("founderPhotoEl"), "founder");
  }
}

function renderAdminSaveBar() {
  const bar = document.getElementById("adminSaveBar");
  const admin = isAdmin();
  bar.classList.toggle("hidden", !admin);
  document.body.classList.toggle("has-admin-bar", admin);
}

function wireAdminSaveBar() {
  document.getElementById("saveContentBtn").addEventListener("click", saveSiteContent);
}

let siteSaveInFlight = false;

async function saveSiteContent() {
  if (siteSaveInFlight) return;
  ensureGithubToken();
  if (!getGithubToken()) return;
  const status = document.getElementById("adminSaveStatus");
  const saveBtn = document.getElementById("saveContentBtn");
  siteSaveInFlight = true;
  saveBtn.disabled = true;
  status.textContent = "Enregistrement...";
  try {
    await ghUpdateFile("content/site.json", "Mise à jour du contenu de la page (édition en direct)", () => SITE_CONTENT);
    status.textContent = "Enregistré ✓";
    setTimeout(() => {
      if (status.textContent === "Enregistré ✓") status.textContent = "";
    }, 2500);
  } catch (err) {
    status.textContent = "Erreur : " + err.message;
  } finally {
    siteSaveInFlight = false;
    saveBtn.disabled = false;
  }
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

function transactionLabel(t) {
  return t === "Location et vente" ? "Location & Vente" : t;
}

function buildPriceLines(item) {
  const lines = [];
  if (item.transaction !== "Vente" && item.priceRent) {
    lines.push({ label: "Location", text: `À partir de ${formatMoney(item.priceRent)}/semaine` });
  }
  if (item.transaction !== "Location" && item.priceSale) {
    lines.push({ label: "Vente", text: `À partir de ${formatMoney(item.priceSale)}` });
  }
  return lines;
}

function renderPriceLines(item) {
  const lines = buildPriceLines(item);
  const multi = lines.length > 1;
  return lines
    .map((l) => `<div class="price-line">${multi ? `<span class="price-kind">${l.label} :</span> ` : ""}${l.text}</div>`)
    .join("");
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
        <div class="badge">${escapeHtml(l.category)} · ${escapeHtml(transactionLabel(l.transaction))}</div>
      </div>
      <div class="card-body">
        <h3>${escapeHtml(l.title)}</h3>
        <div class="specs">
          <span>🛏 ${escapeHtml(l.pieces)} ${piecesLabel(l.category, true)}</span>
          ${l.sdb ? `<span>🛁 ${escapeHtml(l.sdb)} sdb</span>` : ""}
        </div>
        <div class="price-lines">${renderPriceLines(l)}</div>
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
  document.getElementById("modalDesc").textContent = currentListing.desc;
  document.getElementById("modalPrice").innerHTML = renderPriceLines(currentListing);
  document.getElementById("modalSpecs").innerHTML = `
    <div><div class="num">${escapeHtml(currentListing.pieces)}</div><div class="lbl">${piecesLabel(currentListing.category)}</div></div>
    ${currentListing.sdb ? `<div><div class="num">${escapeHtml(currentListing.sdb)}</div><div class="lbl">Salles de bain</div></div>` : ""}
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

          <div class="field-row">
            <div id="lf-price-rent-wrap">
              <label>Prix à la semaine ($)</label>
              <input type="number" id="lf-price-rent" min="0" placeholder="ex: 2000">
            </div>
            <div id="lf-price-sale-wrap">
              <label>Prix de vente ($)</label>
              <input type="number" id="lf-price-sale" min="0" placeholder="ex: 400000">
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

          <label>Photos (la première est la photo de couverture)</label>
          <div id="lf-photo-list" class="photo-list"></div>
          <div class="photo-add-row">
            <label class="ghost-btn photo-upload-btn">
              + Importer des photos
              <input type="file" id="lf-image-files" accept="image/*" multiple hidden>
            </label>
            <input type="text" id="lf-image-url-input" placeholder="ou coller une URL de photo">
            <button type="button" id="lf-image-url-add-btn" class="ghost-btn">Ajouter</button>
          </div>
          <p class="admin-status" id="lf-photos-status"></p>

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
  document.getElementById("lf-transaction").addEventListener("change", updatePriceFieldsVisibility);
  document.getElementById("listingForm").addEventListener("submit", handleListingSubmit);
  document.getElementById("lf-image-files").addEventListener("change", handlePhotoFilesSelected);
  document.getElementById("lf-image-url-add-btn").addEventListener("click", handleAddPhotoUrl);
}

function updatePriceFieldsVisibility() {
  const t = document.getElementById("lf-transaction").value;
  const showRent = t !== "Vente";
  const showSale = t !== "Location";
  document.getElementById("lf-price-rent-wrap").style.display = showRent ? "" : "none";
  document.getElementById("lf-price-sale-wrap").style.display = showSale ? "" : "none";
  document.getElementById("lf-price-rent").required = showRent;
  document.getElementById("lf-price-sale").required = showSale;
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
  document.getElementById("lf-price-rent").value = item && item.priceRent ? item.priceRent : "";
  document.getElementById("lf-price-sale").value = item && item.priceSale ? item.priceSale : "";
  document.getElementById("lf-pieces").value = item ? item.pieces : "";
  document.getElementById("lf-sdb").value = item ? item.sdb : "";
  document.getElementById("lf-desc").value = item ? item.desc : "";
  document.getElementById("lf-image-files").value = "";
  document.getElementById("lf-image-url-input").value = "";
  document.getElementById("listingFormStatus").textContent = "";
  document.getElementById("lf-photos-status").textContent = "";
  lfDraftId = id || `bien-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  lfImages = item && item.images ? [...item.images] : [];
  renderPhotoList();
  updatePriceFieldsVisibility();
  document.getElementById("listingFormModal").classList.add("open");
}

/* ---------- Gestion ordonnée des photos du formulaire ---------- */

let lfImages = [];
let lfDraftId = null;
let lfDragIndex = null;

function renderPhotoList() {
  const el = document.getElementById("lf-photo-list");
  if (!lfImages.length) {
    el.innerHTML = `<p class="photo-list-empty">Aucune photo pour le moment.</p>`;
    return;
  }
  el.innerHTML = lfImages
    .map(
      (src, i) => `
    <div class="photo-item" draggable="true" data-index="${i}">
      <img src="${escapeHtml(src)}" alt="">
      ${i === 0 ? `<span class="cover-badge">Couverture</span>` : ""}
      <div class="photo-item-actions">
        <button type="button" data-action="up" data-index="${i}" ${i === 0 ? "disabled" : ""} title="Monter">↑</button>
        <button type="button" data-action="down" data-index="${i}" ${i === lfImages.length - 1 ? "disabled" : ""} title="Descendre">↓</button>
        <button type="button" data-action="remove" data-index="${i}" class="danger" title="Supprimer">✕</button>
      </div>
    </div>`
    )
    .join("");

  el.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.index);
      if (btn.dataset.action === "up") movePhoto(i, -1);
      else if (btn.dataset.action === "down") movePhoto(i, 1);
      else if (btn.dataset.action === "remove") removePhoto(i);
    });
  });

  el.querySelectorAll(".photo-item").forEach((node) => {
    node.addEventListener("dragstart", () => {
      lfDragIndex = Number(node.dataset.index);
      node.classList.add("dragging");
    });
    node.addEventListener("dragend", () => {
      node.classList.remove("dragging");
      lfDragIndex = null;
    });
    node.addEventListener("dragover", (e) => e.preventDefault());
    node.addEventListener("drop", (e) => {
      e.preventDefault();
      const targetIndex = Number(node.dataset.index);
      if (lfDragIndex === null || lfDragIndex === targetIndex) return;
      const [moved] = lfImages.splice(lfDragIndex, 1);
      lfImages.splice(targetIndex, 0, moved);
      renderPhotoList();
    });
  });
}

function movePhoto(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= lfImages.length) return;
  [lfImages[index], lfImages[target]] = [lfImages[target], lfImages[index]];
  renderPhotoList();
}

function removePhoto(index) {
  lfImages.splice(index, 1);
  renderPhotoList();
}

function handleAddPhotoUrl() {
  const input = document.getElementById("lf-image-url-input");
  const url = input.value.trim();
  if (!url) return;
  lfImages.push(url);
  input.value = "";
  renderPhotoList();
}

async function handlePhotoFilesSelected(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  ensureGithubToken();
  if (!getGithubToken()) {
    e.target.value = "";
    return;
  }
  const status = document.getElementById("lf-photos-status");
  for (let i = 0; i < files.length; i++) {
    status.textContent = `Envoi de la photo ${i + 1}/${files.length}...`;
    try {
      const path = await uploadImageFile(files[i], lfDraftId);
      lfImages.push(path);
      renderPhotoList();
    } catch (err) {
      status.textContent = "Erreur d'envoi d'une photo : " + err.message;
      e.target.value = "";
      return;
    }
  }
  status.textContent = "";
  e.target.value = "";
}

const IMAGE_MAX_DIMENSION = 1600;
const IMAGE_JPEG_QUALITY = 0.82;

// Redimensionne et recompresse une image côté navigateur (canvas) avant envoi, pour
// éviter d'alourdir le dépôt et de ralentir le site avec des photos en pleine résolution.
function compressImageFile(file, maxDim = IMAGE_MAX_DIMENSION, quality = IMAGE_JPEG_QUALITY) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * ratio));
      const h = Math.max(1, Math.round(img.height * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Échec de la compression de l'image"))),
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossible de charger l'image " + file.name));
    };
    img.src = url;
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error("Impossible de lire l'image compressée"));
    reader.readAsDataURL(blob);
  });
}

async function uploadImageFile(file, prefix) {
  const compressed = await compressImageFile(file);
  const base64 = await blobToBase64(compressed);
  const path = `images/uploads/${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.jpg`;
  await ghPutRawFile(path, base64, `Ajout de la photo ${file.name}`);
  return path;
}

let listingSubmitInFlight = false;

async function handleListingSubmit(e) {
  e.preventDefault();
  if (listingSubmitInFlight) return;
  ensureGithubToken();
  if (!getGithubToken()) return;

  const submitBtn = document.querySelector("#listingForm button[type='submit']");
  listingSubmitInFlight = true;
  submitBtn.disabled = true;
  const originalBtnText = submitBtn.textContent;

  const status = document.getElementById("listingFormStatus");
  status.textContent = "";

  try {
    const existingId = document.getElementById("lf-id").value;
    const isNew = !existingId;
    const title = document.getElementById("lf-title").value.trim();
    const id = existingId || lfDraftId;

    const transaction = document.getElementById("lf-transaction").value;
    const priceRentVal = document.getElementById("lf-price-rent").value;
    const priceSaleVal = document.getElementById("lf-price-sale").value;

    const newItem = {
      id,
      category: document.getElementById("lf-category").value,
      transaction,
      title,
      priceRent: transaction !== "Vente" && priceRentVal ? Number(priceRentVal) : null,
      priceSale: transaction !== "Location" && priceSaleVal ? Number(priceSaleVal) : null,
      pieces: document.getElementById("lf-pieces").value.trim(),
      sdb: document.getElementById("lf-sdb").value.trim(),
      desc: document.getElementById("lf-desc").value.trim(),
      images: [...lfImages],
    };

    status.textContent = "Enregistrement en cours...";

    try {
      const message = isNew ? `Ajout du bien "${newItem.title}"` : `Modification du bien "${newItem.title}"`;
      const updated = await ghUpdateFile("content/listings.json", message, (json) => {
        const items = json.items || [];
        return { items: isNew ? [...items, newItem] : items.map((it) => (it.id === id ? newItem : it)) };
      });
      LISTINGS = updated.items;
      renderFilters();
      renderGrid();
      document.getElementById("listingFormModal").classList.remove("open");
      status.textContent = "";
    } catch (err) {
      status.textContent = "Erreur : " + err.message;
    }
  } finally {
    listingSubmitInFlight = false;
    submitBtn.disabled = false;
    submitBtn.textContent = originalBtnText;
  }
}

async function deleteListing(id) {
  const item = LISTINGS.find((l) => l.id === id);
  if (!item) return;
  if (!confirm(`Supprimer "${item.title}" ?`)) return;
  ensureGithubToken();
  if (!getGithubToken()) return;
  try {
    const updated = await ghUpdateFile("content/listings.json", `Suppression du bien "${item.title}"`, (json) => ({
      items: (json.items || []).filter((it) => it.id !== id),
    }));
    LISTINGS = updated.items;
    renderFilters();
    renderGrid();
  } catch (err) {
    alert("Erreur : " + err.message);
  }
}

initSite();
