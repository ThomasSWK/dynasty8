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
    const { sha } = await ghGetFile("content/site.json");
    await ghPutFile("content/site.json", SITE_CONTENT, "Mise à jour du contenu de la page (édition en direct)", sha);
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
  document.getElementById("lf-transaction").addEventListener("change", updatePriceFieldsVisibility);
  document.getElementById("listingForm").addEventListener("submit", handleListingSubmit);
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
  document.getElementById("lf-images").value = item && item.images ? item.images.join("\n") : "";
  document.getElementById("lf-image-files").value = "";
  document.getElementById("listingFormStatus").textContent = "";
  updatePriceFieldsVisibility();
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
    const id = existingId || `${slugify(title) || "bien"}-${Date.now().toString(36)}`;

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

initSite();
