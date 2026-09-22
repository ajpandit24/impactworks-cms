// Impactworks CMS Dashboard Client Controller
let currentUser = null;
let currentData = null;
let activeTab = "hero";

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

async function initApp() {
  try {
    const authRes = await fetch("/api/auth/me");
    const authData = await authRes.json();
    if (!authData.authenticated || !authData.user) {
      window.location.href = "/login";
      return;
    }
    currentUser = authData.user;
    renderUserInfo();
    setupEventListeners();
    await loadContent();
  } catch (err) {
    console.error("Init failed:", err);
    showToast("Initialization error: " + err.message, "danger");
  }
}

function renderUserInfo() {
  const userEmailEl = document.getElementById("navUserEmail");
  const userRoleEl = document.getElementById("navUserRole");
  const userAvatarEl = document.getElementById("navUserAvatar");

  if (userEmailEl) userEmailEl.textContent = currentUser.email;
  if (userRoleEl) {
    userRoleEl.textContent = currentUser.role.toUpperCase();
    if (currentUser.role === "developer") {
      userRoleEl.className = "badge bg-warning text-dark";
    } else if (currentUser.role === "admin") {
      userRoleEl.className = "badge bg-info text-dark";
    } else {
      userRoleEl.className = "badge bg-secondary";
    }
  }
  if (userAvatarEl) {
    userAvatarEl.textContent = (currentUser.name || currentUser.email)
      .charAt(0)
      .toUpperCase();
  }

  // Hide User Management tab for non-admin/non-dev if needed
  if (!["developer", "admin", "manager"].includes(currentUser.role)) {
    const usersTab = document.getElementById("tab-link-users");
    if (usersTab) usersTab.style.display = "none";
  }
}

function setupEventListeners() {
  // Navigation tabs
  document.querySelectorAll(".sidebar-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const tab = link.getAttribute("data-tab");
      switchTab(tab);
    });
  });

  // Logout button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    });
  }

  // Global save button
  const saveBtn = document.getElementById("globalSaveBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", saveAllContent);
  }

  // Quick backup button
  const backupBtn = document.getElementById("quickBackupBtn");
  if (backupBtn) {
    backupBtn.addEventListener("click", () => createManualBackup("quick_snapshot"));
  }

  // Mobile sidebar toggle
  const mobileToggle = document.getElementById("mobileSidebarToggle");
  const sidebar = document.getElementById("sidebar");
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });
  }
}

function switchTab(tabName) {
  activeTab = tabName;

  document.querySelectorAll(".sidebar-link").forEach((l) => {
    if (l.getAttribute("data-tab") === tabName) {
      l.classList.add("active");
    } else {
      l.classList.remove("active");
    }
  });

  document.querySelectorAll(".tab-pane-content").forEach((pane) => {
    if (pane.id === `pane-${tabName}`) {
      pane.classList.remove("d-none");
    } else {
      pane.classList.add("d-none");
    }
  });

  // Update header title
  const titleEl = document.getElementById("activeSectionTitle");
  const subEl = document.getElementById("activeSectionSub");
  const titles = {
    header: { t: "Header & Navigation", s: "Edit navbar links, logo text, and CTA button" },
    hero: { t: "Hero Section", s: "Headline, mission eyebrow, subtitle, and buttons" },
    whyWeExist: { t: "Why We Exist (Problems)", s: "Context, problem cards, and closing statement" },
    foundingStory: { t: "Founding Story Timeline", s: "8 timeline moment points, descriptions, and story text" },
    whoWeWorkWith: { t: "Who We Work With (Personas)", s: "Executive personas, descriptions, tags, and sectors" },
    whatWeDo: { t: "Our Solutions (What We Do)", s: "Multi-paragraph intro, 4 core service cards, and tags" },
    howWeWork: { t: "How We Work (Our Approach)", s: "The 5 methodology steps (Diagnose to Embed)" },
    sixSignals: { t: "The Six Signals (Benchmarks)", s: "6 benchmark cards with stats, source citations, and bodies" },
    whatHappensNext: { t: "What Happens Next", s: "3 introductory steps when clients reach out" },
    contact: { t: "Contact Form Copy", s: "Form field labels, placeholders, and confirmation text" },
    footer: { t: "Footer & Legal Links", s: "Belief statement, copyright, domain URL, and legal links" },
    activity: { t: "Audit & Change History", s: "Chronological log of all actions, edits, logins, and backups" },
    backups: { t: "Backups & Version History", s: "Create snapshots, download backups, or restore previous state" },
    users: { t: "User Management", s: "Manage CMS administrators, editors, and access credentials" },
    rawJson: { t: "Direct JSON Editor", s: "View and edit the complete data.json file directly" }
  };

  if (titles[tabName]) {
    if (titleEl) titleEl.textContent = titles[tabName].t;
    if (subEl) subEl.textContent = titles[tabName].s;
  }

  // Load specific data when tabs activate
  if (tabName === "activity") loadActivityLogs();
  if (tabName === "backups") loadBackups();
  if (tabName === "users") loadUsers();
  if (tabName === "rawJson") populateRawJson();
}

// -------------------------------------------------------------
// LOAD & POPULATE FORMS
// -------------------------------------------------------------

async function loadContent() {
  try {
    const res = await fetch("/api/content");
    if (!res.ok) throw new Error("Could not fetch content");
    currentData = await res.json();
    populateAllForms();
  } catch (err) {
    showToast("Error loading data: " + err.message, "danger");
  }
}

function populateAllForms() {
  if (!currentData) return;

  // 1. Header
  const h = currentData.header || {};
  setVal("header_logoText", h.logoText || "");
  setVal("header_cta_label", h.cta?.label || "");
  setVal("header_cta_href", h.cta?.href || "");
  renderHeaderLinks(h.links || []);

  // 2. Hero
  const hr = currentData.hero || {};
  setVal("hero_eyebrow", hr.eyebrow || "");
  setVal("hero_title", hr.title || "");
  setVal("hero_subtitle", hr.subtitle || "");
  setVal("hero_ctaPrimary_label", hr.ctaPrimary?.label || "");
  setVal("hero_ctaPrimary_href", hr.ctaPrimary?.href || "");
  setVal("hero_ctaSecondary_label", hr.ctaSecondary?.label || "");
  setVal("hero_ctaSecondary_href", hr.ctaSecondary?.href || "");

  // 3. Why We Exist
  const w = currentData.whyWeExist || {};
  setVal("whyWeExist_label", w.label || "");
  setVal("whyWeExist_title", w.title || "");
  setVal("whyWeExist_context", w.context || "");
  setVal("whyWeExist_closingStatement", w.closingStatement || "");
  renderProblemCards(w.problemCards || []);

  // 4. Founding Story
  const fs = currentData.foundingStory || {};
  setVal("foundingStory_title", fs.title || "");
  setVal("foundingStory_subtitle", fs.subtitle || "");
  setVal("foundingStory_body", fs.body || "");
  renderFoundingMoments(fs.moments || []);

  // 5. Who We Work With
  const www = currentData.whoWeWorkWith || {};
  setVal("whoWeWorkWith_label", www.label || "");
  setVal("whoWeWorkWith_title", www.title || "");
  setVal("whoWeWorkWith_openingLine", www.openingLine || "");
  renderPersonas(www.personas || []);
  renderProofStrip(www.proofStrip || {});

  // 6. What We Do (Our Solutions)
  const wwd = currentData.whatWeDo || {};
  setVal("whatWeDo_label", wwd.label || "");
  setVal("whatWeDo_title", wwd.title || "");
  const pText = Array.isArray(wwd.paragraphs)
    ? wwd.paragraphs.join("\n\n")
    : wwd.openingLine2 || "";
  setVal("whatWeDo_paragraphs", pText);
  setVal("whatWeDo_introClosing", wwd.introClosing || "");
  renderServices(wwd.services || []);
  setVal("whatWeDo_cta_headline", wwd.bottomCta?.headline || "");
  setVal("whatWeDo_ctaPrimary_label", wwd.bottomCta?.ctaPrimary?.label || "");
  setVal("whatWeDo_ctaPrimary_href", wwd.bottomCta?.ctaPrimary?.href || "");
  setVal("whatWeDo_ctaSecondary_label", wwd.bottomCta?.ctaSecondary?.label || "");
  setVal("whatWeDo_ctaSecondary_href", wwd.bottomCta?.ctaSecondary?.href || "");

  // 7. How We Work
  const hww = currentData.howWeWork || {};
  setVal("howWeWork_label", hww.label || "");
  setVal("howWeWork_title", hww.title || "");
  setVal("howWeWork_context", hww.context || "");
  renderHowWeWorkSteps(hww.steps || []);
  setVal("howWeWork_bottomCta_text", hww.bottomCta?.text || "");
  setVal("howWeWork_bottomCta_label", hww.bottomCta?.link?.label || "");
  setVal("howWeWork_bottomCta_href", hww.bottomCta?.link?.href || "");

  // 8. Six Signals
  const ss = currentData.sixSignals || {};
  setVal("sixSignals_label", ss.label || "");
  setVal("sixSignals_title", ss.title || "");
  setVal("sixSignals_subtext", ss.subtext || "");
  setVal("sixSignals_opening1", ss.opening1 || "");
  setVal("sixSignals_centerCardTitle", ss.centerCardTitle || "");
  renderSixSignalsCards(ss.signals || []);
  setVal("sixSignals_closing_line1", ss.closingCard?.line1 || "");
  setVal("sixSignals_closing_line2", ss.closingCard?.line2 || "");

  // 9. What Happens Next
  const whn = currentData.whatHappensNext || {};
  setVal("whatHappensNext_title", whn.title || "");
  renderWhatHappensNextSteps(whn.steps || []);

  // 10. Contact
  const ct = currentData.contact || {};
  setVal("contact_label", ct.label || "");
  setVal("contact_title", ct.title || "");
  setVal("contact_subCopy1", ct.subCopy1 || "");
  setVal("contact_subCopy2", ct.subCopy2 || "");
  setVal("contact_subCopy3", ct.subCopy3 || "");
  setVal("contact_trustNote", ct.trustNote || "");
  setVal("contact_submitBtn", ct.submitBtn || "");
  setVal("contact_conf_heading", ct.confirmation?.heading || "");
  setVal("contact_conf_body", ct.confirmation?.body || "");

  // 11. Footer
  const ft = currentData.footer || {};
  setVal("footer_beliefStatement", ft.beliefStatement || "");
  setVal("footer_copyright", ft.copyright || "");
  setVal("footer_url", ft.url || "");
  renderLegalLinks(ft.legalLinks || []);

  // Raw JSON
  populateRawJson();
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

// -------------------------------------------------------------
// DYNAMIC ARRAY RENDERERS & BUILDERS
// -------------------------------------------------------------

// Header Links
function renderHeaderLinks(links) {
  const container = document.getElementById("headerLinksContainer");
  if (!container) return;
  container.innerHTML = "";
  links.forEach((link, idx) => {
    const div = document.createElement("div");
    div.className = "item-card mb-2";
    div.innerHTML = `
      <div class="row g-2 align-items-center">
        <div class="col-md-5">
          <label class="form-label small">Link Label</label>
          <input type="text" class="form-control form-control-sm header-link-label" value="${escapeHtml(link.label || "")}">
        </div>
        <div class="col-md-5">
          <label class="form-label small">Target URL / Route</label>
          <input type="text" class="form-control form-control-sm header-link-href" value="${escapeHtml(link.href || "")}">
        </div>
        <div class="col-md-2 text-end pt-3">
          <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.closest('.item-card').remove()">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

function addHeaderLink() {
  const container = document.getElementById("headerLinksContainer");
  if (!container) return;
  const div = document.createElement("div");
  div.className = "item-card mb-2";
  div.innerHTML = `
    <div class="row g-2 align-items-center">
      <div class="col-md-5">
        <label class="form-label small">Link Label</label>
        <input type="text" class="form-control form-control-sm header-link-label" placeholder="e.g. Case Studies">
      </div>
      <div class="col-md-5">
        <label class="form-label small">Target URL / Route</label>
        <input type="text" class="form-control form-control-sm header-link-href" placeholder="e.g. /case-studies">
      </div>
      <div class="col-md-2 text-end pt-3">
        <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.closest('.item-card').remove()">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    </div>
  `;
  container.appendChild(div);
}

// Problem Cards
function renderProblemCards(cards) {
  const container = document.getElementById("problemCardsContainer");
  if (!container) return;
  container.innerHTML = "";
  cards.forEach((card, idx) => {
    const div = document.createElement("div");
    div.className = "item-card";
    div.innerHTML = `
      <div class="item-card-header">
        <span class="item-card-badge">Card #${idx + 1}</span>
        <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.closest('.item-card').remove()">
          <i class="bi bi-trash"></i> Delete Card
        </button>
      </div>
      <div class="row g-3">
        <div class="col-md-4">
          <label class="form-label">Bootstrap Icon Class</label>
          <input type="text" class="form-control form-control-sm problem-card-icon" value="${escapeHtml(card.icon || "")}">
        </div>
        <div class="col-md-8">
          <label class="form-label">Card Title</label>
          <input type="text" class="form-control form-control-sm problem-card-title" value="${escapeHtml(card.title || "")}">
        </div>
        <div class="col-12">
          <div class="field-toolbar">
            <label class="form-label mb-0">Card Body Description</label>
            <button type="button" class="btn-break-helper" onclick="insertBreakAt(this)">+ Add \\n Break</button>
          </div>
          <textarea class="form-control problem-card-body" rows="3">${escapeHtml(card.body || "")}</textarea>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

function addProblemCard() {
  const container = document.getElementById("problemCardsContainer");
  if (!container) return;
  const count = container.children.length + 1;
  const div = document.createElement("div");
  div.className = "item-card";
  div.innerHTML = `
    <div class="item-card-header">
      <span class="item-card-badge">Card #${count}</span>
      <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.closest('.item-card').remove()">
        <i class="bi bi-trash"></i> Delete Card
      </button>
    </div>
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label">Bootstrap Icon Class</label>
        <input type="text" class="form-control form-control-sm problem-card-icon" placeholder="bi-check-circle">
      </div>
      <div class="col-md-8">
        <label class="form-label">Card Title</label>
        <input type="text" class="form-control form-control-sm problem-card-title" placeholder="Problem title">
      </div>
      <div class="col-12">
        <div class="field-toolbar">
          <label class="form-label mb-0">Card Body Description</label>
          <button type="button" class="btn-break-helper" onclick="insertBreakAt(this)">+ Add \\n Break</button>
        </div>
        <textarea class="form-control problem-card-body" rows="3" placeholder="Card body text..."></textarea>
      </div>
    </div>
  `;
  container.appendChild(div);
}

// Founding Story Moments
function renderFoundingMoments(moments) {
  const container = document.getElementById("foundingMomentsContainer");
  if (!container) return;
  container.innerHTML = "";
  moments.forEach((m, idx) => {
    const div = document.createElement("div");
    div.className = "item-card";
    div.innerHTML = `
      <div class="item-card-header">
        <span class="item-card-badge">Point #${m.id || idx + 1}</span>
        <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.closest('.item-card').remove()">
          <i class="bi bi-trash"></i>
        </button>
      </div>
      <div class="row g-3">
        <div class="col-md-2">
          <label class="form-label">ID / Step</label>
          <input type="number" class="form-control form-control-sm moment-id" value="${m.id || idx + 1}">
        </div>
        <div class="col-md-4">
          <label class="form-label">Moment Label</label>
          <input type="text" class="form-control form-control-sm moment-label" value="${escapeHtml(m.label || "")}">
        </div>
        <div class="col-md-3">
          <label class="form-label">Experience Scale (Type)</label>
          <select class="form-select form-select-sm moment-type">
            <option value="high" ${m.type === "high" ? "selected" : ""}>Positive Experience (High)</option>
            <option value="low" ${m.type === "low" ? "selected" : ""}>Negative Experience (Low)</option>
            <option value="resolve" ${m.type === "resolve" ? "selected" : ""}>Resolve / Neutral</option>
          </select>
        </div>
        <div class="col-md-3">
          <label class="form-label">Theme Color</label>
          <div class="input-group input-group-sm">
            <input type="color" class="form-control form-control-color" value="${m.color || "#50B0AF"}" onchange="this.nextElementSibling.value=this.value">
            <input type="text" class="form-control moment-color" value="${m.color || "#50B0AF"}">
          </div>
        </div>
        <div class="col-12">
          <div class="field-toolbar">
            <label class="form-label mb-0">Node Description (appears on hover / tap)</label>
            <button type="button" class="btn-break-helper" onclick="insertBreakAt(this)">+ Add \\n Break</button>
          </div>
          <textarea class="form-control moment-desc" rows="2">${escapeHtml(m.description || "")}</textarea>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

function addFoundingMoment() {
  const container = document.getElementById("foundingMomentsContainer");
  if (!container) return;
  const count = container.children.length + 1;
  const div = document.createElement("div");
  div.className = "item-card";
  div.innerHTML = `
    <div class="item-card-header">
      <span class="item-card-badge">Point #${count}</span>
      <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.closest('.item-card').remove()">
        <i class="bi bi-trash"></i>
      </button>
    </div>
    <div class="row g-3">
      <div class="col-md-2">
        <label class="form-label">ID / Step</label>
        <input type="number" class="form-control form-control-sm moment-id" value="${count}">
      </div>
      <div class="col-md-4">
        <label class="form-label">Moment Label</label>
        <input type="text" class="form-control form-control-sm moment-label" placeholder="Moment heading">
      </div>
      <div class="col-md-3">
        <label class="form-label">Experience Scale (Type)</label>
        <select class="form-select form-select-sm moment-type">
          <option value="high">Positive Experience (High)</option>
          <option value="low" selected>Negative Experience (Low)</option>
          <option value="resolve">Resolve / Neutral</option>
        </select>
      </div>
      <div class="col-md-3">
        <label class="form-label">Theme Color</label>
        <div class="input-group input-group-sm">
          <input type="color" class="form-control form-control-color" value="#50B0AF" onchange="this.nextElementSibling.value=this.value">
          <input type="text" class="form-control moment-color" value="#50B0AF">
        </div>
      </div>
      <div class="col-12">
        <div class="field-toolbar">
          <label class="form-label mb-0">Node Description</label>
          <button type="button" class="btn-break-helper" onclick="insertBreakAt(this)">+ Add \\n Break</button>
        </div>
        <textarea class="form-control moment-desc" rows="2" placeholder="Description..."></textarea>
      </div>
    </div>
  `;
  container.appendChild(div);
}

// Personas (Who We Work With)
function renderPersonas(personas) {
  const container = document.getElementById("personasContainer");
  if (!container) return;
  container.innerHTML = "";
  personas.forEach((p, idx) => {
    const div = document.createElement("div");
    div.className = "item-card";
    div.innerHTML = `
      <div class="item-card-header">
        <span class="item-card-badge">Persona #${idx + 1}: ${escapeHtml(p.role || "")}</span>
        <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.closest('.item-card').remove()">
          <i class="bi bi-trash"></i>
        </button>
      </div>
      <div class="row g-3">
        <div class="col-md-2">
          <label class="form-label">Tab ID</label>
          <input type="text" class="form-control form-control-sm persona-id" value="${escapeHtml(p.id || String(idx + 1))}">
        </div>
        <div class="col-md-4">
          <label class="form-label">Role Badge Label</label>
          <input type="text" class="form-control form-control-sm persona-role" value="${escapeHtml(p.role || "")}">
        </div>
        <div class="col-md-6">
          <label class="form-label">Persona Title</label>
          <input type="text" class="form-control form-control-sm persona-title" value="${escapeHtml(p.title || "")}">
        </div>
        <div class="col-12">
          <div class="field-toolbar">
            <label class="form-label mb-0">Lead Description</label>
            <button type="button" class="btn-break-helper" onclick="insertBreakAt(this)">+ Add \\n Break</button>
          </div>
          <textarea class="form-control persona-desc" rows="3">${escapeHtml(p.description || "")}</textarea>
        </div>
        <div class="col-12">
          <label class="form-label">Linked Area Tags (links to /what-we-do)</label>
          <div class="tags-container" id="persona-tags-${idx}">
            ${(p.tags || []).map(t => `
              <span class="tag-pill">
                <span class="tag-pill-text">${escapeHtml(t)}</span>
                <i class="bi bi-x tag-pill-remove" onclick="this.closest('.tag-pill').remove()"></i>
              </span>
            `).join("")}
          </div>
          <div class="input-group input-group-sm mt-2">
            <input type="text" class="form-control new-tag-input" placeholder="Add a new linked tag...">
            <button type="button" class="btn btn-outline-secondary" onclick="addTagPill(this)">+ Add Tag</button>
          </div>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

function addTagPill(btn) {
  const input = btn.previousElementSibling;
  const tagText = input.value.trim();
  if (!tagText) return;
  const tagsContainer = btn.closest(".col-12").querySelector(".tags-container");
  const span = document.createElement("span");
  span.className = "tag-pill";
  span.innerHTML = `
    <span class="tag-pill-text">${escapeHtml(tagText)}</span>
    <i class="bi bi-x tag-pill-remove" onclick="this.closest('.tag-pill').remove()"></i>
  `;
  tagsContainer.appendChild(span);
  input.value = "";
}

function renderProofStrip(proof) {
  setVal("proofStrip_sectorsLabel", proof.sectorsLabel || "Sectors");
  const sectorsText = Array.isArray(proof.sectors) ? proof.sectors.join(", ") : "";
  setVal("proofStrip_sectors", sectorsText);
}

// Services (What We Do)
function renderServices(services) {
  const container = document.getElementById("servicesContainer");
  if (!container) return;
  container.innerHTML = "";
  services.forEach((s, idx) => {
    const div = document.createElement("div");
    div.className = "item-card";
    div.innerHTML = `
      <div class="item-card-header">
        <span class="item-card-badge">Service ${s.num || "0" + (idx + 1)}: ${escapeHtml(s.name || "")}</span>
        <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.closest('.item-card').remove()">
          <i class="bi bi-trash"></i>
        </button>
      </div>
      <div class="row g-3">
        <div class="col-md-2">
          <label class="form-label">Number</label>
          <input type="text" class="form-control form-control-sm service-num" value="${escapeHtml(s.num || "0" + (idx + 1))}">
        </div>
        <div class="col-md-5">
          <label class="form-label">Service Name</label>
          <input type="text" class="form-control form-control-sm service-name" value="${escapeHtml(s.name || "")}">
        </div>
        <div class="col-md-5">
          <label class="form-label">Mission Line</label>
          <input type="text" class="form-control form-control-sm service-mission" value="${escapeHtml(s.mission || "")}">
        </div>
        <div class="col-12">
          <div class="field-toolbar">
            <label class="form-label mb-0">Overview Body</label>
            <button type="button" class="btn-break-helper" onclick="insertBreakAt(this)">+ Add \\n Break</button>
          </div>
          <textarea class="form-control service-body" rows="3">${escapeHtml(s.body || "")}</textarea>
        </div>
        <div class="col-12">
          <label class="form-label">Detailed Focus Tags</label>
          <div class="tags-container">
            ${(s.tags || []).map(t => `
              <span class="tag-pill">
                <span class="tag-pill-text">${escapeHtml(t)}</span>
                <i class="bi bi-x tag-pill-remove" onclick="this.closest('.tag-pill').remove()"></i>
              </span>
            `).join("")}
          </div>
          <div class="input-group input-group-sm mt-2">
            <input type="text" class="form-control new-tag-input" placeholder="e.g. Data and governance foundations: ...">
            <button type="button" class="btn btn-outline-secondary" onclick="addTagPill(this)">+ Add Tag</button>
          </div>
        </div>
        <div class="col-12">
          <label class="form-label">Closing Teal Accent Line</label>
          <input type="text" class="form-control form-control-sm service-closing" value="${escapeHtml(s.closingLine || "")}">
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

// How We Work Steps
function renderHowWeWorkSteps(steps) {
  const container = document.getElementById("howWeWorkStepsContainer");
  if (!container) return;
  container.innerHTML = "";
  steps.forEach((step, idx) => {
    const div = document.createElement("div");
    div.className = "item-card";
    div.innerHTML = `
      <div class="item-card-header">
        <span class="item-card-badge">Step ${step.num || "0" + (idx + 1)}: ${escapeHtml(step.name || "")}</span>
        <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.closest('.item-card').remove()">
          <i class="bi bi-trash"></i>
        </button>
      </div>
      <div class="row g-3">
        <div class="col-md-2">
          <label class="form-label">Step #</label>
          <input type="text" class="form-control form-control-sm hww-num" value="${escapeHtml(step.num || "0" + (idx + 1))}">
        </div>
        <div class="col-md-10">
          <label class="form-label">Step Name</label>
          <input type="text" class="form-control form-control-sm hww-name" value="${escapeHtml(step.name || "")}">
        </div>
        <div class="col-12">
          <div class="field-toolbar">
            <label class="form-label mb-0">Step Description</label>
            <button type="button" class="btn-break-helper" onclick="insertBreakAt(this)">+ Add \\n Break</button>
          </div>
          <textarea class="form-control hww-desc" rows="3">${escapeHtml(step.desc || "")}</textarea>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

// Six Signals Cards
function renderSixSignalsCards(signals) {
  const container = document.getElementById("sixSignalsContainer");
  if (!container) return;
  container.innerHTML = "";
  signals.forEach((sig, idx) => {
    const div = document.createElement("div");
    div.className = "item-card";
    div.innerHTML = `
      <div class="item-card-header">
        <span class="item-card-badge">Benchmark #${idx + 1}: ${escapeHtml(sig.title || "")}</span>
        <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.closest('.item-card').remove()">
          <i class="bi bi-trash"></i>
        </button>
      </div>
      <div class="row g-3">
        <div class="col-md-3">
          <label class="form-label">Statistic Value</label>
          <input type="text" class="form-control form-control-sm sig-stat" value="${escapeHtml(sig.stat || "")}">
        </div>
        <div class="col-md-9">
          <label class="form-label">Signal Card Title</label>
          <input type="text" class="form-control form-control-sm sig-title" value="${escapeHtml(sig.title || "")}">
        </div>
        <div class="col-md-6">
          <label class="form-label">Metric Label</label>
          <input type="text" class="form-control form-control-sm sig-label" value="${escapeHtml(sig.label || "")}">
        </div>
        <div class="col-md-6">
          <label class="form-label">Data Source Citation</label>
          <input type="text" class="form-control form-control-sm sig-source" value="${escapeHtml(sig.source || "")}">
        </div>
        <div class="col-12">
          <div class="field-toolbar">
            <label class="form-label mb-0">Body Description</label>
            <button type="button" class="btn-break-helper" onclick="insertBreakAt(this)">+ Add \\n Break</button>
          </div>
          <textarea class="form-control sig-body" rows="3">${escapeHtml(sig.body || "")}</textarea>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

// What Happens Next Steps
function renderWhatHappensNextSteps(steps) {
  const container = document.getElementById("whatHappensNextContainer");
  if (!container) return;
  container.innerHTML = "";
  steps.forEach((step, idx) => {
    const div = document.createElement("div");
    div.className = "item-card";
    div.innerHTML = `
      <div class="item-card-header">
        <span class="item-card-badge">Step #${idx + 1}</span>
        <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.closest('.item-card').remove()">
          <i class="bi bi-trash"></i>
        </button>
      </div>
      <div class="row g-3">
        <div class="col-md-2">
          <label class="form-label">Step #</label>
          <input type="text" class="form-control form-control-sm whn-num" value="${escapeHtml(step.num || "0" + (idx + 1))}">
        </div>
        <div class="col-md-10">
          <label class="form-label">Heading</label>
          <input type="text" class="form-control form-control-sm whn-heading" value="${escapeHtml(step.heading || "")}">
        </div>
        <div class="col-12">
          <div class="field-toolbar">
            <label class="form-label mb-0">Body Description</label>
            <button type="button" class="btn-break-helper" onclick="insertBreakAt(this)">+ Add \\n Break</button>
          </div>
          <textarea class="form-control whn-body" rows="2">${escapeHtml(step.body || "")}</textarea>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

// Legal Links
function renderLegalLinks(links) {
  const container = document.getElementById("legalLinksContainer");
  if (!container) return;
  container.innerHTML = "";
  links.forEach((link, idx) => {
    const div = document.createElement("div");
    div.className = "item-card mb-2";
    div.innerHTML = `
      <div class="row g-2 align-items-center">
        <div class="col-md-5">
          <label class="form-label small">Page Title</label>
          <input type="text" class="form-control form-control-sm legal-link-label" value="${escapeHtml(link.label || "")}">
        </div>
        <div class="col-md-5">
          <label class="form-label small">Route Path</label>
          <input type="text" class="form-control form-control-sm legal-link-href" value="${escapeHtml(link.href || "")}">
        </div>
        <div class="col-md-2 text-end pt-3">
          <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.closest('.item-card').remove()">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

function addLegalLink() {
  const container = document.getElementById("legalLinksContainer");
  if (!container) return;
  const div = document.createElement("div");
  div.className = "item-card mb-2";
  div.innerHTML = `
    <div class="row g-2 align-items-center">
      <div class="col-md-5">
        <label class="form-label small">Page Title</label>
        <input type="text" class="form-control form-control-sm legal-link-label" placeholder="e.g. Terms of Service">
      </div>
      <div class="col-md-5">
        <label class="form-label small">Route Path</label>
        <input type="text" class="form-control form-control-sm legal-link-href" placeholder="e.g. /terms">
      </div>
      <div class="col-md-2 text-end pt-3">
        <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.closest('.item-card').remove()">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    </div>
  `;
  container.appendChild(div);
}

// -------------------------------------------------------------
// SAVE ALL CONTENT
// -------------------------------------------------------------

async function saveAllContent() {
  const saveBtn = document.getElementById("globalSaveBtn");
  const originalText = saveBtn.innerHTML;
  saveBtn.disabled = true;
  saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Saving & Backing up...`;

  try {
    const updated = serializeAllForms();

    const res = await fetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Save failed");

    currentData = updated;
    showToast(`Content saved successfully! Snapshot created: ${data.backup?.filename || "auto-save"}`, "success");
    populateRawJson();
  } catch (err) {
    showToast("Error saving content: " + err.message, "danger");
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalText;
  }
}

function serializeAllForms() {
  const d = JSON.parse(JSON.stringify(currentData || {}));

  // 1. Header
  d.header = d.header || {};
  d.header.logoText = getVal("header_logoText");
  d.header.cta = {
    label: getVal("header_cta_label"),
    href: getVal("header_cta_href"),
  };
  const hLinks = [];
  document.querySelectorAll("#headerLinksContainer .item-card").forEach((card) => {
    const label = card.querySelector(".header-link-label")?.value.trim();
    const href = card.querySelector(".header-link-href")?.value.trim();
    if (label && href) hLinks.push({ label, href });
  });
  d.header.links = hLinks;

  // 2. Hero
  d.hero = d.hero || {};
  d.hero.eyebrow = getVal("hero_eyebrow");
  d.hero.title = getVal("hero_title");
  d.hero.subtitle = getVal("hero_subtitle");
  d.hero.ctaPrimary = {
    label: getVal("hero_ctaPrimary_label"),
    href: getVal("hero_ctaPrimary_href"),
  };
  d.hero.ctaSecondary = {
    label: getVal("hero_ctaSecondary_label"),
    href: getVal("hero_ctaSecondary_href"),
  };

  // 3. Why We Exist
  d.whyWeExist = d.whyWeExist || {};
  d.whyWeExist.label = getVal("whyWeExist_label");
  d.whyWeExist.title = getVal("whyWeExist_title");
  d.whyWeExist.context = getVal("whyWeExist_context");
  d.whyWeExist.closingStatement = getVal("whyWeExist_closingStatement");
  const pCards = [];
  document.querySelectorAll("#problemCardsContainer .item-card").forEach((card) => {
    pCards.push({
      icon: card.querySelector(".problem-card-icon")?.value.trim() || "",
      title: card.querySelector(".problem-card-title")?.value.trim() || "",
      body: card.querySelector(".problem-card-body")?.value.trim() || "",
    });
  });
  d.whyWeExist.problemCards = pCards;

  // 4. Founding Story
  d.foundingStory = d.foundingStory || {};
  d.foundingStory.title = getVal("foundingStory_title");
  d.foundingStory.subtitle = getVal("foundingStory_subtitle");
  d.foundingStory.body = getVal("foundingStory_body");
  const moments = [];
  document.querySelectorAll("#foundingMomentsContainer .item-card").forEach((card) => {
    moments.push({
      id: parseInt(card.querySelector(".moment-id")?.value, 10) || moments.length + 1,
      label: card.querySelector(".moment-label")?.value.trim() || "",
      type: card.querySelector(".moment-type")?.value || "low",
      color: card.querySelector(".moment-color")?.value.trim() || "#50B0AF",
      description: card.querySelector(".moment-desc")?.value.trim() || "",
    });
  });
  d.foundingStory.moments = moments;

  // 5. Who We Work With
  d.whoWeWorkWith = d.whoWeWorkWith || {};
  d.whoWeWorkWith.label = getVal("whoWeWorkWith_label");
  d.whoWeWorkWith.title = getVal("whoWeWorkWith_title");
  d.whoWeWorkWith.openingLine = getVal("whoWeWorkWith_openingLine");
  const personas = [];
  document.querySelectorAll("#personasContainer .item-card").forEach((card) => {
    const tags = [];
    card.querySelectorAll(".tag-pill-text").forEach((t) => tags.push(t.textContent.trim()));
    personas.push({
      id: card.querySelector(".persona-id")?.value.trim() || String(personas.length + 1),
      role: card.querySelector(".persona-role")?.value.trim() || "",
      title: card.querySelector(".persona-title")?.value.trim() || "",
      description: card.querySelector(".persona-desc")?.value.trim() || "",
      tags,
    });
  });
  d.whoWeWorkWith.personas = personas;
  d.whoWeWorkWith.proofStrip = {
    sectorsLabel: getVal("proofStrip_sectorsLabel") || "Sectors",
    sectors: getVal("proofStrip_sectors")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    stats: d.whoWeWorkWith.proofStrip?.stats || [],
  };

  // 6. What We Do
  d.whatWeDo = d.whatWeDo || {};
  d.whatWeDo.label = getVal("whatWeDo_label");
  d.whatWeDo.title = getVal("whatWeDo_title");
  const rawParas = getVal("whatWeDo_paragraphs");
  d.whatWeDo.openingLine2 = rawParas;
  d.whatWeDo.paragraphs = rawParas.split("\n\n").map((p) => p.trim()).filter(Boolean);
  d.whatWeDo.introClosing = getVal("whatWeDo_introClosing");
  const services = [];
  document.querySelectorAll("#servicesContainer .item-card").forEach((card) => {
    const tags = [];
    card.querySelectorAll(".tag-pill-text").forEach((t) => tags.push(t.textContent.trim()));
    services.push({
      num: card.querySelector(".service-num")?.value.trim() || "",
      name: card.querySelector(".service-name")?.value.trim() || "",
      mission: card.querySelector(".service-mission")?.value.trim() || "",
      body: card.querySelector(".service-body")?.value.trim() || "",
      tags,
      closingLine: card.querySelector(".service-closing")?.value.trim() || "",
    });
  });
  d.whatWeDo.services = services;
  d.whatWeDo.bottomCta = {
    headline: getVal("whatWeDo_cta_headline"),
    ctaPrimary: {
      label: getVal("whatWeDo_ctaPrimary_label"),
      href: getVal("whatWeDo_ctaPrimary_href"),
    },
    ctaSecondary: {
      label: getVal("whatWeDo_ctaSecondary_label"),
      href: getVal("whatWeDo_ctaSecondary_href"),
    },
  };

  // 7. How We Work
  d.howWeWork = d.howWeWork || {};
  d.howWeWork.label = getVal("howWeWork_label");
  d.howWeWork.title = getVal("howWeWork_title");
  d.howWeWork.context = getVal("howWeWork_context");
  const hwwSteps = [];
  document.querySelectorAll("#howWeWorkStepsContainer .item-card").forEach((card) => {
    hwwSteps.push({
      num: card.querySelector(".hww-num")?.value.trim() || "",
      name: card.querySelector(".hww-name")?.value.trim() || "",
      desc: card.querySelector(".hww-desc")?.value.trim() || "",
    });
  });
  d.howWeWork.steps = hwwSteps;
  d.howWeWork.bottomCta = {
    text: getVal("howWeWork_bottomCta_text"),
    link: {
      label: getVal("howWeWork_bottomCta_label"),
      href: getVal("howWeWork_bottomCta_href"),
    },
  };

  // 8. Six Signals
  d.sixSignals = d.sixSignals || {};
  d.sixSignals.label = getVal("sixSignals_label");
  d.sixSignals.title = getVal("sixSignals_title");
  d.sixSignals.subtext = getVal("sixSignals_subtext");
  d.sixSignals.opening1 = getVal("sixSignals_opening1");
  d.sixSignals.centerCardTitle = getVal("sixSignals_centerCardTitle");
  const signals = [];
  document.querySelectorAll("#sixSignalsContainer .item-card").forEach((card) => {
    signals.push({
      stat: card.querySelector(".sig-stat")?.value.trim() || "",
      title: card.querySelector(".sig-title")?.value.trim() || "",
      label: card.querySelector(".sig-label")?.value.trim() || "",
      source: card.querySelector(".sig-source")?.value.trim() || "",
      body: card.querySelector(".sig-body")?.value.trim() || "",
    });
  });
  d.sixSignals.signals = signals;
  d.sixSignals.closingCard = {
    line1: getVal("sixSignals_closing_line1"),
    line2: getVal("sixSignals_closing_line2"),
    cta: d.sixSignals.closingCard?.cta || { label: "Get in touch", href: "/contact" },
  };

  // 9. What Happens Next
  d.whatHappensNext = d.whatHappensNext || {};
  d.whatHappensNext.title = getVal("whatHappensNext_title");
  const whnSteps = [];
  document.querySelectorAll("#whatHappensNextContainer .item-card").forEach((card) => {
    whnSteps.push({
      num: card.querySelector(".whn-num")?.value.trim() || "",
      heading: card.querySelector(".whn-heading")?.value.trim() || "",
      body: card.querySelector(".whn-body")?.value.trim() || "",
    });
  });
  d.whatHappensNext.steps = whnSteps;

  // 10. Contact
  d.contact = d.contact || {};
  d.contact.label = getVal("contact_label");
  d.contact.title = getVal("contact_title");
  d.contact.subCopy1 = getVal("contact_subCopy1");
  d.contact.subCopy2 = getVal("contact_subCopy2");
  d.contact.subCopy3 = getVal("contact_subCopy3");
  d.contact.trustNote = getVal("contact_trustNote");
  d.contact.submitBtn = getVal("contact_submitBtn");
  d.contact.confirmation = {
    heading: getVal("contact_conf_heading"),
    body: getVal("contact_conf_body"),
  };

  // 11. Footer
  d.footer = d.footer || {};
  d.footer.beliefStatement = getVal("footer_beliefStatement");
  d.footer.copyright = getVal("footer_copyright");
  d.footer.url = getVal("footer_url");
  const legLinks = [];
  document.querySelectorAll("#legalLinksContainer .item-card").forEach((card) => {
    const label = card.querySelector(".legal-link-label")?.value.trim();
    const href = card.querySelector(".legal-link-href")?.value.trim();
    if (label && href) legLinks.push({ label, href });
  });
  d.footer.legalLinks = legLinks;

  return d;
}

// -------------------------------------------------------------
// LINE BREAK HELPER UTILITY
// -------------------------------------------------------------

function insertBreakAt(button) {
  const container = button.closest(".col-12") || button.parentElement;
  const textarea = container.querySelector("textarea") || container.querySelector("input");
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;

  textarea.value = val.substring(0, start) + "\n" + val.substring(end);
  textarea.selectionStart = textarea.selectionEnd = start + 1;
  textarea.focus();
}

// -------------------------------------------------------------
// BACKUP MANAGEMENT
// -------------------------------------------------------------

async function loadBackups() {
  const tbody = document.getElementById("backupsTableBody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Loading backups...</td></tr>`;

  try {
    const res = await fetch("/api/backups");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (data.backups.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-muted">No backup snapshots available.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.backups.map(b => `
      <tr>
        <td>
          <i class="bi bi-file-earmark-code text-teal me-2"></i>
          <strong>${escapeHtml(b.filename)}</strong>
        </td>
        <td>${formatDate(b.createdAt)}</td>
        <td>${(b.size / 1024).toFixed(1)} KB</td>
        <td class="text-end">
          <a href="/api/backups/download/${encodeURIComponent(b.filename)}" class="btn btn-outline-secondary btn-sm me-1" title="Download">
            <i class="bi bi-download"></i>
          </a>
          <button class="btn btn-outline-warning btn-sm" onclick="restoreBackup('${escapeHtml(b.filename)}')" title="Restore Live Content">
            <i class="bi bi-arrow-counterclockwise"></i> Restore
          </button>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-danger py-3">Error loading backups: ${err.message}</td></tr>`;
  }
}

async function createManualBackup(defaultLabel = "manual") {
  const label = prompt("Enter a label/note for this backup snapshot:", defaultLabel);
  if (label === null) return;

  try {
    const res = await fetch("/api/backups/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast("Snapshot created: " + data.backup.filename, "success");
    if (activeTab === "backups") loadBackups();
  } catch (err) {
    showToast("Backup failed: " + err.message, "danger");
  }
}

async function restoreBackup(filename) {
  if (!confirm(`Are you sure you want to rollback and restore content from ${filename}?\n\nA safety backup of current data will be created automatically.`)) {
    return;
  }

  try {
    const res = await fetch("/api/backups/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast(data.message, "success");
    await loadContent();
  } catch (err) {
    showToast("Restore failed: " + err.message, "danger");
  }
}

async function uploadJsonFile(input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  if (!confirm(`Import and overwrite live data.json with '${file.name}'? (A pre-import backup will be created)`)) {
    input.value = "";
    return;
  }

  const formData = new FormData();
  formData.append("jsonFile", file);

  try {
    const res = await fetch("/api/backups/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast(data.message, "success");
    input.value = "";
    await loadContent();
    if (activeTab === "backups") loadBackups();
  } catch (err) {
    showToast("Import failed: " + err.message, "danger");
  }
}

// -------------------------------------------------------------
// AUDIT & ACTIVITY HISTORY (SuperAdmin / Developer)
// -------------------------------------------------------------

async function loadActivityLogs() {
  const tbody = document.getElementById("activityTableBody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="text-center py-3 text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Loading audit logs...</td></tr>`;

  try {
    const res = await fetch("/api/activity?limit=100");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (data.logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-3 text-muted">No activity records logged yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.logs.map(log => {
      let badgeClass = "bg-secondary";
      if (log.action.includes("UPDATE")) badgeClass = "bg-primary";
      else if (log.action.includes("BACKUP") || log.action.includes("RESTORE")) badgeClass = "bg-warning text-dark";
      else if (log.action.includes("CREATE")) badgeClass = "bg-success";
      else if (log.action.includes("DELETE") || log.action.includes("FAILED")) badgeClass = "bg-danger";

      return `
        <tr>
          <td><small class="text-muted">${formatDate(log.timestamp)}</small></td>
          <td><strong>${escapeHtml(log.user)}</strong></td>
          <td><span class="badge ${badgeClass}">${escapeHtml(log.action)}</span></td>
          <td><small class="text-muted font-monospace">${escapeHtml(JSON.stringify(log.details || {}))}</small></td>
          <td><small class="text-muted">${escapeHtml(log.ip || "")}</small></td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-danger py-3">Error loading activity: ${err.message}</td></tr>`;
  }
}

// -------------------------------------------------------------
// USER MANAGEMENT
// -------------------------------------------------------------

async function loadUsers() {
  const tbody = document.getElementById("usersTableBody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="text-center py-3 text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Loading users...</td></tr>`;

  try {
    const res = await fetch("/api/users");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    tbody.innerHTML = data.users.map(u => `
      <tr>
        <td><strong>${escapeHtml(u.name)}</strong></td>
        <td>${escapeHtml(u.email)}</td>
        <td><span class="badge ${u.role === "developer" ? "bg-warning text-dark" : u.role === "admin" ? "bg-info text-dark" : "bg-secondary"}">${u.role.toUpperCase()}</span></td>
        <td><small class="text-muted">${formatDate(u.createdAt)}</small></td>
        <td class="text-end">
          <button class="btn btn-outline-secondary btn-sm me-1" onclick="promptResetPassword('${u.id}', '${escapeHtml(u.email)}')">
            <i class="bi bi-key"></i> Key
          </button>
          ${u.id !== currentUser.id && (currentUser.role === "developer" || currentUser.role === "admin") ? `
            <button class="btn btn-outline-danger btn-sm" onclick="deleteUser('${u.id}', '${escapeHtml(u.name)}')">
              <i class="bi bi-trash"></i>
            </button>
          ` : ""}
        </td>
      </tr>
    `).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-danger py-3">Error loading users: ${err.message}</td></tr>`;
  }
}

async function handleCreateUser(e) {
  e.preventDefault();
  const name = document.getElementById("newUserName").value.trim();
  const email = document.getElementById("newUserEmail").value.trim();
  const password = document.getElementById("newUserPassword").value;
  const role = document.getElementById("newUserRole").value;

  try {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast(data.message, "success");
    document.getElementById("createUserForm").reset();
    const modalEl = document.getElementById("addUserModal");
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
    loadUsers();
  } catch (err) {
    alert("User creation error: " + err.message);
  }
}

async function deleteUser(id, name) {
  if (!confirm(`Are you sure you want to delete user account: ${name}?`)) return;
  try {
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast(data.message, "success");
    loadUsers();
  } catch (err) {
    showToast("Delete failed: " + err.message, "danger");
  }
}

async function promptResetPassword(id, email) {
  const newPassword = prompt(`Enter new password for ${email} (minimum 6 chars):`);
  if (!newPassword) return;

  try {
    const res = await fetch(`/api/users/${id}/password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast(data.message, "success");
  } catch (err) {
    showToast("Password reset failed: " + err.message, "danger");
  }
}

// -------------------------------------------------------------
// RAW JSON EDITOR
// -------------------------------------------------------------

function populateRawJson() {
  const el = document.getElementById("rawJsonTextarea");
  if (el && currentData) {
    el.value = JSON.stringify(currentData, null, 2);
  }
}

async function applyRawJson() {
  const el = document.getElementById("rawJsonTextarea");
  if (!el) return;
  try {
    const parsed = JSON.parse(el.value);
    currentData = parsed;
    populateAllForms();
    await saveAllContent();
    showToast("Raw JSON parsed and saved successfully!", "success");
  } catch (err) {
    alert("Invalid JSON format: " + err.message);
  }
}

// -------------------------------------------------------------
// HELPERS & TOASTS
// -------------------------------------------------------------

function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast align-items-center text-white bg-${type === "danger" ? "danger" : "dark"} border-0 show shadow-lg mb-2`;
  toast.setAttribute("role", "alert");
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body d-flex align-items-center gap-2">
        <i class="bi ${type === "danger" ? "bi-exclamation-triangle" : "bi-check-circle-fill text-teal"}"></i>
        ${escapeHtml(message)}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" onclick="this.closest('.toast').remove()"></button>
    </div>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4500);
}

function escapeHtml(str) {
  if (typeof str !== "string") return str || "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return d.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
