(() => {
  "use strict";

  const API_URL = window.CLINIC_API_URL || "../api/index.php";
  const ASSET_BASE = window.CLINIC_ASSET_BASE || "../assets";
  const TEXT_SIZE_KEY = "clinicSystemTextSize";
  const SIDEBAR_COLLAPSED_KEY = "clinicSystemSidebarCollapsed";
  const LEGACY_APP_CACHE_PREFIX = "clinicSystemAppData:v1";
  let resultScannerWorkerPromise = null;
  let resultScannerActiveForm = null;
  let resultCameraStream = null;
  let notificationPollTimer = null;
  let notificationPollPending = false;
  let notificationPollDelay = 30000;
  const textSizeOptions = [
    { value: "small", label: "Small" },
    { value: "default", label: "Default" },
    { value: "large", label: "Large" },
    { value: "extra-large", label: "Extra Large" },
  ];
  const destinations = window.CLINIC_ROLE_URLS || {
    Admin: "admin/dashboard.php#dashboard",
    Doctor: "doctor/dashboard.php#dashboard",
    "Laboratory Staff": "laboratory/dashboard.php#dashboard",
    Patient: "patient/dashboard.php#dashboard",
  };
  const LOGIN_URL = window.CLINIC_LOGIN_URL || "auth/login.php#login";

  const iconPaths = {
    medical: '<path d="M10 2h4v8h8v4h-8v8h-4v-8H2v-4h8V2Z"/>',
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"/>',
    doctor: '<circle cx="12" cy="7" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2M9 15l3 3 3-3"/>',
    facility: '<path d="M3 21h18M5 21V5h14v16M9 9h2M13 9h2M9 13h2M13 13h2M10 21v-4h4v4"/>',
    test: '<path d="M9 3v6l-5 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-5-9V3M8 3h8M7 15h10"/>',
    orders: '<path d="M9 5H6a2 2 0 0 0-2 2v13h16V7a2 2 0 0 0-2-2h-3M9 3h6v4H9zM8 12h8M8 16h5"/>',
    results: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 15l2.5 2.5L16 12"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    audit: '<path d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z"/><path d="M12 6v6l4 2"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4a1.7 1.7 0 0 0 1-1.6v-.2h4v.2A1.7 1.7 0 0 0 15 4a1.7 1.7 0 0 0 1.9.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
    logout: '<path d="M10 17l5-5-5-5M15 12H3M15 3h5a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    chevron: '<path d="m7 10 5 5 5-5"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    "plus-file": '<path d="M14 2H6a2 2 0 0 0-2 2v16h16V8Z"/><path d="M14 2v6h6M12 11v6M9 14h6"/>',
    filter: '<path d="M4 5h16M7 12h10M10 19h4"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 11v6M14 11v6"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    arrow: '<path d="M5 12h14M14 7l5 5-5 5"/>',
    trend: '<path d="m3 17 6-6 4 4 8-9M15 6h6v6"/>',
    check: '<path d="m4 12 5 5L20 6"/>',
    alert: '<path d="M10.3 3.7 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    maintenance: '<path d="M14.7 6.3a4 4 0 0 0-5 5l-5.4 5.4a2 2 0 1 0 3 3l5.4-5.4a4 4 0 0 0 5-5l-2.8 2.8-2.8-2.8 2.6-3Z"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    camera: '<path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v10H2V9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="4"/>',
    scan: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 12h10M7 15h7"/>',
    review: '<path d="M9 11l2 2 4-4M5 4h14v16H5zM8 17h8"/>',
    activity: '<path d="M3 12h4l2-7 4 14 2-7h6"/>',
    queue: '<path d="M4 6h16M4 12h16M4 18h16M8 6v12"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16h16V8Z"/><path d="M14 2v6h6"/>',
    note: '<path d="M4 4h16v16H4zM8 9h8M8 13h6M8 17h4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    phone: '<path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-1.5 3a16 16 0 0 1-8.5-8.5L9 8 7 3Z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
  };

  const pageMeta = {
    Admin: {
      dashboard: ["Administration Overview", "Manage user access, facilities, system availability, and administrative activity."],
      users: ["User Management", "Manage system users, roles, and access permissions."],
      facilities: ["Healthcare Facilities", "Manage clinic locations and assigned care teams."],
      tests: ["Laboratory Tests", "Manage active laboratory tests, pricing, and reference details."],
      orders: ["Laboratory Requests", "Review laboratory requests across all facilities."],
      results: ["Laboratory Results", "Review result workflow status across the system."],
      reports: ["Reports & Analytics", "Monitor performance, trends, and operational health."],
      audit: ["Audit Trail", "Track system activities, security events, and user actions."],
      notifications: ["Notifications", "Review alerts, updates, and action items across the clinic."],
      maintenance: ["Maintenance Mode", "Control temporary access restrictions by role or module."],
      profile: ["My Profile", "Review your administrator account information."],
      settings: ["Settings", "Manage security, accessibility, and role permissions."],
    },
    Doctor: {
      dashboard: ["Doctor Dashboard", "Monitor your patients, laboratory requests, and available results."],
      patients: ["Patients", "Search and view patients related to your laboratory work."],
      facilities: ["Facilities", "View facilities available for laboratory requests."],
      tests: ["Tests", "Browse available laboratory tests, samples, and turnaround times."],
      "create-order": ["New Laboratory Request", "Submit a new laboratory request for one of your patients."],
      orders: ["My Laboratory Requests", "Track the laboratory requests submitted by you."],
      results: ["Laboratory Results", "View results and add clinical notes."],
      notifications: ["Notifications", "View personal alerts and laboratory request updates."],
      profile: ["My Profile", "Review your clinician identity and facility assignment."],
      settings: ["Settings", "Manage security, accessibility, and work preferences."],
    },
    "Laboratory Staff": {
      dashboard: ["Laboratory Staff Dashboard", "Monitor assigned laboratory work and result review tasks."],
      orders: ["Laboratory Requests", "Process laboratory requests assigned to your facility."],
      upload: ["Results Upload", "Upload structured findings and result values."],
      review: ["Result Review", "Verify, release, or reject uploaded results."],
      facilities: ["Assigned Facilities", "View your laboratory facility assignments."],
      queue: ["Test Queue", "Track active tests by priority, status, and date."],
      notifications: ["Notifications", "Review laboratory alerts and workflow updates."],
      profile: ["My Profile", "Review your laboratory staff identity and assignment."],
      settings: ["Settings", "Manage security, accessibility, and workflow preferences."],
    },
    Patient: {
      dashboard: ["Patient Dashboard", "View your laboratory requests, released results, and care updates."],
      orders: ["My Laboratory Requests", "View laboratory requests linked to your patient profile."],
      results: ["My Results", "View released results and clinical notes."],
      notifications: ["Notifications", "View personal laboratory request, result, and care updates."],
      profile: ["Profile", "Review and update your patient profile."],
      settings: ["Settings", "Manage account security, preferences, and privacy."],
    },
  };

  const statusColor = {
    Active: "green",
    Inactive: "red",
    Pending: "orange",
    "Pending Sample": "orange",
    Accepted: "blue",
    "Sample Collected": "teal",
    Processing: "purple",
    "In Progress": "blue",
    "Result Uploaded": "purple",
    "Pending Review": "orange",
    Verified: "green",
    Released: "blue",
    Rejected: "red",
    Cancelled: "red",
    Completed: "green",
    Urgent: "red",
    High: "orange",
    Normal: "green",
    Routine: "teal",
    Regular: "green",
    Priority: "red",
    Critical: "red",
    "Pending Verification": "orange",
    Delayed: "orange",
    Admin: "purple",
    Doctor: "blue",
    "Laboratory Staff": "teal",
    Patient: "green",
    CREATE: "green",
    UPDATE: "blue",
    LOGIN: "purple",
    LOGOUT: "gray",
    RELEASE: "blue",
    VERIFY: "teal",
    REJECT: "red",
  };

  let currentUser = null;
  const PAGE_CACHE_TTL = 60000;
  const state = { data: null, page: "dashboard", activeDrawer: null, activeRecordId: null, lastFocusedElement: null, utilization: null, forecast: { horizon: 7 }, trends: null, adminTurnaroundPeriod: "week", loadingPages: new Set(), pageRequests: new Map(), pageLoadedAt: new Map(), collectionLoadedAt: new Map(), metadataLoadedAt: 0 };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const h = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const safeStorage = {
    get(key) {
      try { return localStorage.getItem(key); } catch { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch {}
    },
  };
  function clearAppCache() {
    try {
      Object.keys(sessionStorage).filter((key) => key.startsWith(LEGACY_APP_CACHE_PREFIX)).forEach((key) => sessionStorage.removeItem(key));
    } catch {}
  }

  function getTextSize() {
    const saved = safeStorage.get(TEXT_SIZE_KEY);
    return textSizeOptions.some((option) => option.value === saved) ? saved : "default";
  }

  function applyTextSize(size = getTextSize()) {
    const next = textSizeOptions.some((option) => option.value === size) ? size : "default";
    document.documentElement.dataset.textSize = next;
    safeStorage.set(TEXT_SIZE_KEY, next);
    $$("[data-text-size-option]").forEach((button) => {
      const selected = button.dataset.textSizeOption === next;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }
  const money = (value) => `PHP ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const shortDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "-";
  const shortDateTime = (value) => value ? new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "-";
  const datetimeInputValue = (value) => {
    if (!value) return "";
    const date = new Date(String(value).replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return "";
    const pad = (part) => String(part).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };
  const uiConfig = () => state.data?.uiConfig || {};
  const appName = () => uiConfig().appName || "Centralized Laboratory Results System";
  const previewLimit = () => Math.min(Number(uiConfig().previewLimit || 6), window.matchMedia("(max-width: 620px)").matches ? 3 : Infinity);

  function icon(name, className = "") {
    return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" ${name === "medical" ? "" : 'fill="none"'}>${iconPaths[name] || iconPaths.file}</svg>`;
  }

  function hydrateStaticIcons() {
    $$("[data-icon]").forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
    $$("[data-icon-button]").forEach((el) => { el.innerHTML = icon(el.dataset.iconButton); });
    $$("[data-icon-name]").forEach((el) => {
      if (!el.querySelector("svg")) el.insertAdjacentHTML("afterbegin", icon(el.dataset.iconName));
    });
    hydrateTooltips();
  }

  let activeTooltip = null;

  function hydrateTooltips(root = document) {
    $$(".icon-button[aria-label], .row-action[aria-label], .password-toggle[aria-label], .nav-item[title]", root).forEach((element) => {
      const label = element.getAttribute("aria-label") || element.getAttribute("title");
      if (!label) return;
      element.dataset.tooltip = label;
      element.removeAttribute("title");
    });
  }

  function hideTooltip() {
    activeTooltip?.remove();
    activeTooltip = null;
  }

  function showTooltip(target) {
    if (!target || (target.matches(".nav-item") && !document.body.classList.contains("sidebar-collapsed"))) return;
    hideTooltip();
    const tooltip = document.createElement("div");
    tooltip.className = "app-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.textContent = target.dataset.tooltip;
    document.body.append(tooltip);
    activeTooltip = tooltip;
    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const sidebarTip = target.matches(".sidebar .nav-item, .sidebar-collapse");
    let left = sidebarTip ? rect.right + 10 : rect.left + ((rect.width - tooltipRect.width) / 2);
    let top = sidebarTip ? rect.top + ((rect.height - tooltipRect.height) / 2) : rect.top - tooltipRect.height - 9;
    if (top < 8) top = rect.bottom + 9;
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - tooltipRect.height - 8));
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function initTooltips() {
    document.addEventListener("pointerover", (event) => {
      const target = event.target.closest?.("[data-tooltip]");
      if (target && !target.contains(event.relatedTarget)) showTooltip(target);
    });
    document.addEventListener("pointerout", (event) => {
      const target = event.target.closest?.("[data-tooltip]");
      if (target && !target.contains(event.relatedTarget)) hideTooltip();
    });
    document.addEventListener("focusin", (event) => showTooltip(event.target.closest?.("[data-tooltip]")));
    document.addEventListener("focusout", hideTooltip);
    document.addEventListener("pointerdown", (event) => {
      if (!window.matchMedia("(hover: none)").matches) return;
      const target = event.target.closest?.("[data-tooltip]");
      if (target) showTooltip(target);
      else hideTooltip();
    });
    window.addEventListener("scroll", hideTooltip, true);
    window.addEventListener("resize", hideTooltip);
  }

  async function api(action, payload = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let response;
    try {
      response = await fetch(`${API_URL}?action=${encodeURIComponent(action)}`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": window.CLINIC_CSRF_TOKEN || document.querySelector('meta[name="csrf-token"]')?.content || "",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (error) {
      if (error.name === "AbortError") throw new Error("The clinic server took too long to respond. Try again.");
      throw new Error("The clinic server could not be reached. Check your connection and try again.");
    } finally {
      clearTimeout(timeout);
    }
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      const snippet = text.replace(/\s+/g, " ").trim().slice(0, 120);
      throw new Error(`The PHP API returned an invalid response (${response.status}). ${snippet || "Empty response"}`);
    }
    if (!response.ok || json.success === false || json.ok === false) {
      if (response.status === 503 && json.data?.maintenance) {
        location.href = window.CLINIC_MAINTENANCE_URL || "../maintenance.php";
      }
      const error = new Error(json.message || "The request could not be completed.");
      error.status = response.status;
      error.response = json;
      throw error;
    }
    if (json.data?.csrfToken) window.CLINIC_CSRF_TOKEN = json.data.csrfToken;
    return json.data || {};
  }

  async function readAttachments(files, options = {}) {
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    const maxBytes = 10 * 1024 * 1024;
    const selectedFiles = [...files];
    if (!selectedFiles.length) return [];
    if (selectedFiles.length > 5 || selectedFiles.reduce((sum, file) => sum + file.size, 0) > 25 * 1024 * 1024) {
      throw new Error("Attach no more than five files with a combined size up to 25 MB.");
    }
    selectedFiles.forEach((file) => {
      if (!allowed.includes(file.type) || file.size > maxBytes) {
        throw new Error("Attachments must be PDF, JPG, PNG, or WEBP files up to 10 MB.");
      }
    });

    if (state.data?.storage?.driver === "supabase") {
      let prepared;
      try {
        prepared = await api("prepare_result_uploads", {
          files: selectedFiles.map((file) => ({ name: file.name, type: file.type, size: file.size })),
        });
      } catch (error) {
        // OCR already runs in the browser. If Vercel/Supabase cannot store the
        // optional source image, preserve the extracted values and let the user
        // submit them after review instead of failing the whole result entry.
        if (options.optional) {
          console.warn("Optional OCR source attachment was skipped:", error);
          toast("The OCR values were kept, but the source image could not be attached.", "warning");
          return [];
        }
        throw error;
      }
      if (prepared.storageUnavailable) {
        if (options.optional) {
          toast("The OCR values will be submitted, but the source image could not be attached because protected storage is unavailable.", "warning");
          return [];
        }
        throw new Error(prepared.warning || "Protected file storage is unavailable. Try again later or remove the attachment.");
      }
      const uploads = prepared.uploads || [];
      if (uploads.length !== selectedFiles.length) throw new Error("The secure upload could not be prepared.");
      for (let index = 0; index < uploads.length; index += 1) {
        const formData = new FormData();
        formData.append("cacheControl", "3600");
        formData.append("", selectedFiles[index]);
        const response = await fetch(uploads[index].uploadUrl, {
          method: "PUT",
          headers: { "x-upsert": "false" },
          body: formData,
        });
        if (!response.ok) {
          let message = `Could not upload ${selectedFiles[index].name}.`;
          try {
            const error = await response.json();
            message = error.message || error.error || message;
          } catch {}
          throw new Error(message);
        }
      }
      return uploads.map(({ uploadUrl, ...metadata }) => metadata);
    }

    return Promise.all(selectedFiles.map((file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, data: String(reader.result).split(",")[1] || "" });
      reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
      reader.readAsDataURL(file);
    })));
  }

  function applySidebarPreference(collapsed = safeStorage.get(SIDEBAR_COLLAPSED_KEY) === "1") {
    if (!document.body?.dataset.requiredRole) return;
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    const button = $("[data-toggle-sidebar]");
    if (button) {
      button.setAttribute("aria-expanded", String(!collapsed));
      button.setAttribute("aria-label", collapsed ? "Expand navigation" : "Collapse navigation");
      button.title = collapsed ? "Expand navigation" : "Collapse navigation";
    }
  }

  function toggleSidebarCollapsed() {
    hideTooltip();
    const collapsed = !document.body.classList.contains("sidebar-collapsed");
    safeStorage.set(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    applySidebarPreference(collapsed);
  }

  function resultValueInputRow(item = {}, disabled = "") {
    const warnings = item.reviewWarnings || [];
    const lowConfidence = Number(item.confidence ?? 100) < 75 || warnings.length > 0;
    const reviewNote = warnings.length ? `<small class="ocr-review-note">${h(warnings.join(" "))}</small>` : "";
    return `<tr class="${lowConfidence ? "ocr-low-confidence" : ""}" ${item.confidence ? `data-tooltip="OCR confidence: ${h(item.confidence)}%. Verify this row carefully."` : ""}><td><input name="parameter" aria-label="Parameter" value="${h(item.parameter || "")}" ${disabled}>${reviewNote}</td><td><input name="value" aria-label="Value" value="${h(item.value || "")}" ${disabled}></td><td><input name="unit" aria-label="Unit" value="${h(item.unit || "")}" ${disabled}></td><td><input name="referenceRange" aria-label="Reference range" value="${h(item.referenceRange || "")}" ${disabled}></td><td><input name="flag" aria-label="Flag" value="${h(item.flag || "")}" ${disabled}></td><td><button class="parameter-remove" type="button" data-remove-result-parameter aria-label="Remove parameter" data-tooltip="Remove parameter" ${disabled}>${icon("trash")}</button></td></tr>`;
  }

  function resultValueTable(rows, disabled = "") {
    return `<div class="parameter-table-wrap"><table class="parameter-input-table"><thead><tr><th>Parameter</th><th>Value</th><th>Unit</th><th>Reference Range</th><th>Flag</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows}</tbody></table></div><button class="btn btn-secondary btn-sm parameter-add" type="button" data-add-result-parameter ${disabled}>${icon("plus")} Add Parameter</button>`;
  }

  function scannerAssetUrl(path) {
    return new URL(`${String(ASSET_BASE).replace(/\/$/, "")}/${path.replace(/^\//, "")}`, document.baseURI).href;
  }

  function loadScriptOnce(src, ready) {
    if (ready()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-lazy-src="${src}"]`);
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.lazySrc = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error("A scanner component could not be loaded."));
      document.head.append(script);
    });
  }

  function updateScannerStatus(form, message, progress = null, tone = "working") {
    const status = $("[data-result-scan-status]", form);
    const progressElement = $("[data-result-scan-progress]", form);
    if (status) {
      status.textContent = message;
      status.dataset.tone = tone;
    }
    if (progressElement) {
      const percent = progress === null ? 0 : Math.max(0, Math.min(100, Math.round(progress * 100)));
      progressElement.hidden = progress === null;
      progressElement.value = percent;
    }
  }

  async function scannerWorker(form) {
    await loadScriptOnce(scannerAssetUrl("vendor/tesseract/tesseract.min.js?v=7.0.0"), () => Boolean(window.Tesseract?.createWorker));
    if (!window.Tesseract?.createWorker) throw new Error("The local image scanner could not be loaded.");
    resultScannerActiveForm = form;
    if (!resultScannerWorkerPromise) {
      resultScannerWorkerPromise = window.Tesseract.createWorker(uiConfig().scannerLanguage || "eng", 1, {
        workerPath: scannerAssetUrl("vendor/tesseract/worker.min.js"),
        corePath: scannerAssetUrl("vendor/tesseract/core"),
        langPath: scannerAssetUrl("vendor/tesseract/lang"),
        logger: (event) => {
          const activeForm = resultScannerActiveForm;
          if (!activeForm?.isConnected) return;
          const label = event.status === "recognizing text" ? "Reading laboratory values" : "Preparing image scanner";
          updateScannerStatus(activeForm, `${label}${Number.isFinite(event.progress) ? ` (${Math.round(event.progress * 100)}%)` : ""}…`, Number.isFinite(event.progress) ? event.progress : 0);
        },
      }).catch((error) => {
        resultScannerWorkerPromise = null;
        throw error;
      });
    }
    return resultScannerWorkerPromise;
  }

  function removeScanTableRules(canvas) {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const { width, height } = canvas;
    const image = context.getImageData(0, 0, width, height);
    const mask = new Uint8Array(width * height);
    const isDark = (x, y) => {
      const offset = (y * width + x) * 4;
      return image.data[offset] * .299 + image.data[offset + 1] * .587 + image.data[offset + 2] * .114 < 180;
    };
    // Remove only long continuous rules; preserve short strokes in letters/numbers.
    for (let y = 0; y < height; y += 1) {
      let start = -1;
      for (let x = 0; x <= width; x += 1) {
        if (x < width && isDark(x, y)) { if (start < 0) start = x; }
        else if (start >= 0) {
          if (x - start > Math.max(80, width * .35)) {
            for (let xx = start; xx < x; xx += 1) {
              for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy += 1) mask[yy * width + xx] = 1;
            }
          }
          start = -1;
        }
      }
    }
    for (let x = 0; x < width; x += 1) {
      let start = -1;
      for (let y = 0; y <= height; y += 1) {
        if (y < height && isDark(x, y)) { if (start < 0) start = y; }
        else if (start >= 0) {
          if (y - start > Math.max(80, height * .07)) {
            for (let yy = start; yy < y; yy += 1) {
              for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx += 1) mask[yy * width + xx] = 1;
            }
          }
          start = -1;
        }
      }
    }
    for (let i = 0; i < mask.length; i += 1) {
      if (mask[i]) image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = 255;
    }
    context.putImageData(image, 0, 0);
    return canvas;
  }

  async function prepareResultScan(file, rotation = 0) {
    if (file.type === "application/pdf") {
      const pdfScript = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      await loadScriptOnce(pdfScript, () => Boolean(window.pdfjsLib?.getDocument));
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      const pages = [];
      for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 5); pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(2, 2200 / Math.max(baseViewport.width, baseViewport.height));
        const viewport = page.getViewport({ scale, rotation });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: canvas.getContext("2d", { willReadFrequently: true }), viewport }).promise;
        pages.push(removeScanTableRules(canvas));
      }
      return pages;
    }
    if (!window.createImageBitmap) return [file];
    const bitmap = await createImageBitmap(file);
    const maxDimension = 2400;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    const sourceWidth = Math.max(1, Math.round(bitmap.width * scale));
    const sourceHeight = Math.max(1, Math.round(bitmap.height * scale));
    const quarterTurn = Math.abs(rotation % 180) === 90;
    canvas.width = quarterTurn ? sourceHeight : sourceWidth;
    canvas.height = quarterTurn ? sourceWidth : sourceHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((rotation * Math.PI) / 180);
    context.drawImage(bitmap, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight);
    context.setTransform(1, 0, 0, 1, 0, 0);
    bitmap.close();
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < image.data.length; index += 4) {
      const gray = (image.data[index] * 0.299) + (image.data[index + 1] * 0.587) + (image.data[index + 2] * 0.114);
      const contrasted = Math.max(0, Math.min(255, ((gray - 128) * 1.22) + 128));
      image.data[index] = contrasted;
      image.data[index + 1] = contrasted;
      image.data[index + 2] = contrasted;
    }
    context.putImageData(image, 0, 0);
    return [removeScanTableRules(canvas)];
  }

  async function populateScannedResultValues(form, values) {
    const tbody = $(".parameter-input-table tbody", form);
    if (!tbody) return;
    const hasEnteredValues = $$('.parameter-input-table input[name="value"]', form).some((input) => input.value.trim());
    if (hasEnteredValues && !await glassDialog({ title: "Replace entered values?", message: "The detected values will replace the result values currently in this form.", confirmText: "Replace values" })) return false;
    tbody.innerHTML = values.map((item) => resultValueInputRow(item)).join("");
    hydrateTooltips(tbody);
    return true;
  }

  function populateScannedResultText(form, parsed) {
    [["findings", parsed.findings], ["remarks", parsed.remarks]].forEach(([name, value]) => {
      const input = $(`[name="${name}"]`, form);
      if (input && value && !input.value.trim()) input.value = value;
    });
  }

  async function scanResultImage(form) {
    const input = $("[data-result-scan-input]", form);
    const file = input?.files?.[0];
    if (!file) {
      toast("Choose or capture a laboratory result image first.");
      return;
    }
    if (!(file.type.startsWith("image/") || file.type === "application/pdf") || file.size > 10 * 1024 * 1024) {
      updateScannerStatus(form, "Choose a PDF, JPG, PNG, or WEBP file up to 10 MB.", null, "error");
      return;
    }

    const scanButton = $("[data-scan-result]", form);
    if (scanButton) scanButton.disabled = true;
    updateScannerStatus(form, "Preparing image scanner…", 0);
    try {
      const worker = await scannerWorker(form);
      await worker.setParameters({ tessedit_pageseg_mode: "6" });
      const preparedPages = await prepareResultScan(file, Number(form.dataset.scanRotation || 0));
      const recognizedPages = [];
      for (let index = 0; index < preparedPages.length; index += 1) {
        updateScannerStatus(form, `Reading page ${index + 1} of ${preparedPages.length}...`, index / preparedPages.length);
        recognizedPages.push(await worker.recognize(preparedPages[index]));
      }
      const parsed = window.ClinicLabScanner?.parse(recognizedPages.map((page) => page.data?.text || "").join("\n"));
      const rawOutput = $("[data-result-scan-text]", form);
      const rawPanel = $("[data-result-scan-output]", form);
      if (rawOutput) rawOutput.textContent = parsed?.rawText || "No text detected.";
      if (rawPanel) rawPanel.hidden = false;
      if (!parsed?.values?.length) {
        updateScannerStatus(form, "Text was read, but no supported laboratory values were matched. Try a clearer, straight-on image or enter the values manually.", null, "error");
        return;
      }
      const confidence = Math.round(recognizedPages.reduce((sum, page) => sum + Number(page.data?.confidence || 0), 0) / Math.max(1, recognizedPages.length));
      parsed.values = parsed.values.map((value) => ({ ...value, confidence }));
      const populated = await populateScannedResultValues(form, parsed.values);
      if (populated === false) {
        updateScannerStatus(form, "Scan completed without replacing your entered values.", null, "idle");
        return;
      }
      populateScannedResultText(form, parsed);
      const reviewCount = parsed.values.filter((value) => value.reviewWarnings?.length).length;
      const reviewMessage = reviewCount ? ` ${reviewCount} row(s) contain unclear fields left blank and highlighted for review.` : "";
      updateScannerStatus(form, `${parsed.values.length} result value${parsed.values.length === 1 ? "" : "s"} detected with ${confidence}% OCR confidence.${reviewMessage} Compare every value with the source image before uploading.`, null, confidence >= 75 && !reviewCount ? "success" : "warning");
      toast(`${parsed.values.length} laboratory values filled from the scanned image.`);
    } catch (error) {
      updateScannerStatus(form, error.message || "The image could not be scanned.", null, "error");
    } finally {
      if (scanButton) scanButton.disabled = false;
    }
  }

  function stopResultCamera(form = $('form[data-form="upload-result"]')) {
    if (resultCameraStream) {
      resultCameraStream.getTracks().forEach((track) => track.stop());
      resultCameraStream = null;
    }
    const video = form ? $("[data-result-camera-video]", form) : null;
    const panel = form ? $("[data-result-camera-panel]", form) : null;
    if (video) video.srcObject = null;
    if (panel) panel.hidden = true;
  }

  function openImagePicker(form, cameraOnly = false) {
    const input = $("[data-result-scan-input]", form);
    if (!input) return;
    if (cameraOnly) {
      input.accept = "image/jpeg,image/png,image/webp";
      input.setAttribute("capture", "environment");
    } else {
      input.accept = "application/pdf,image/jpeg,image/png,image/webp";
      input.removeAttribute("capture");
    }
    input.click();
  }

  async function openResultCamera(form) {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      openImagePicker(form, true);
      return;
    }
    stopResultCamera(form);
    updateScannerStatus(form, "Requesting camera access…", null, "working");
    try {
      resultCameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      const panel = $("[data-result-camera-panel]", form);
      const video = $("[data-result-camera-video]", form);
      if (panel) panel.hidden = false;
      if (video) {
        video.srcObject = resultCameraStream;
        await video.play();
      }
      updateScannerStatus(form, "Camera ready. Position the complete report inside the frame, then take the photo.", null, "idle");
    } catch (error) {
      stopResultCamera(form);
      updateScannerStatus(form, "Camera access was unavailable. You can still use Choose Image.", null, "error");
    }
  }

  async function captureResultCameraImage(form) {
    const video = $("[data-result-camera-video]", form);
    const canvas = $("[data-result-camera-canvas]", form);
    const input = $("[data-result-scan-input]", form);
    if (!video?.videoWidth || !canvas || !input) {
      updateScannerStatus(form, "The camera is not ready yet. Try again in a moment.", null, "error");
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) throw new Error("The camera image could not be created.");
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], `laboratory-result-${Date.now()}.jpg`, { type: "image/jpeg", lastModified: Date.now() }));
    input.files = transfer.files;
    stopResultCamera(form);
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function badge(value) {
    const color = statusColor[value] || "gray";
    return `<span class="badge badge-${color}">${h(value || "-")}</span>`;
  }

  function avatar(text, color = "teal") {
    return `<span class="avatar avatar-${color}">${h(text || "U")}</span>`;
  }

  function person(name, sub, av, color = "teal") {
    return `<div class="table-person">${avatar(av || initials(name), color)}<div><span class="cell-strong">${h(name)}</span><span class="cell-sub">${h(sub || "")}</span></div></div>`;
  }

  function identity(name, code, email = "", av = "", color = "teal") {
    return `<div class="table-person">${avatar(av || initials(name), color)}<div><span class="cell-strong">${h(name)}</span>${code ? `<span class="cell-sub">${h(code)}</span>` : ""}${email ? `<span class="cell-sub cell-email" title="${h(email)}">${h(email)}</span>` : ""}</div></div>`;
  }

  function initials(name) {
    return String(name || "User").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "U";
  }

  function heading(title, subtitle, actions = "") {
    return actions ? `<div class="page-heading page-heading-actions-only"><div class="heading-actions">${actions}</div></div>` : "";
  }

  function stat(label, value, iconName, change = "-", color = "teal") {
    const palette = {
      teal: ["#078f88", "#e6f7f5"],
      blue: ["#347fb7", "#e8f3fb"],
      purple: ["#795db0", "#f1ecfa"],
      orange: ["#c27a24", "#fff3e2"],
      red: ["#c64755", "#ffedf0"],
      green: ["#188363", "#e7f7ef"],
      gray: ["#687e87", "#edf2f3"],
    };
    const [accent, tint] = palette[color] || palette.teal;
    return `<article class="stat-card" style="--accent:${accent};--tint:${tint}"><div class="stat-top"><span class="stat-icon">${icon(iconName)}</span>${change === "-" ? "" : `<span class="stat-change ${String(change).startsWith("-") ? "down" : ""}">${icon("trend")}${h(change)}</span>`}</div><div class="stat-value">${h(value)}</div><div class="stat-label">${h(label)}</div></article>`;
  }

  function table(headers, rows, footer = "") {
    const clean = (value) => String(value).replace(/<[^>]*>/g, "");
    const prepared = rows.map((entry) => {
      const cells = Array.isArray(entry) ? entry : entry.cells;
      const last = String(cells[cells.length - 1] || "");
      const opener = last.match(/data-drawer="([^"]+)"[^>]*data-id="([^"]+)"/s);
      const openOnly = Boolean(opener && /^(Action|Actions)$/i.test(clean(headers[headers.length - 1] || "")) && /^(View(?: Result)?|Review|Process)$/i.test(clean(last).trim()));
      const date = cells.join(" ").match(/<time[^>]*datetime="([^"]+)"/)?.[1] || "";
      return { cells, opener, openOnly, date, goPage: Array.isArray(entry) ? "" : entry.goPage || "" };
    });
    const removeOpenColumn = prepared.length > 0 && prepared.every((row) => row.openOnly);
    const visibleHeaders = removeOpenColumn ? headers.slice(0, -1) : headers;
    const body = rows.length
      ? prepared.map((row) => {
        const cells = removeOpenColumn ? row.cells.slice(0, -1) : row.cells;
        const attributes = row.opener
          ? ` class="clickable-row" data-drawer="${h(row.opener[1])}" data-id="${h(row.opener[2])}" role="button" tabindex="0" aria-label="Open record details"`
          : row.goPage ? ` class="clickable-row" data-go-page="${h(row.goPage)}" role="link" tabindex="0" aria-label="Open ${h(row.goPage)} page"` : "";
        return `<tr${attributes}${row.date ? ` data-table-date="${h(row.date.slice(0, 10))}"` : ""}>${cells.map((cell, index) => `<td data-label="${h(clean(visibleHeaders[index]))}">${cell}</td>`).join("")}</tr>`;
      }).join("")
      : `<tr><td colspan="${visibleHeaders.length}"><div class="empty-state">No records found.</div></td></tr>`;
    const headerCells = visibleHeaders.map((item, index) => {
      const label = clean(item);
      const sortable = !/^(Action|Actions)$/i.test(label);
      return sortable
        ? `<th scope="col" aria-sort="none"><button class="table-sort" type="button" data-table-sort="${index}" aria-label="Sort by ${h(label)}">${h(item)}<span class="table-sort-indicator" aria-hidden="true"></span></button></th>`
        : `<th scope="col">${h(item)}</th>`;
    }).join("");
    return `<section class="card table-card" data-paginated-table data-table-page="1" data-table-label="${h(footer)}"><div class="table-responsive"><table class="data-table"><thead><tr>${headerCells}</tr></thead><tbody>${body}</tbody></table></div><div class="table-footer"><span data-table-page-summary aria-live="polite">${h(footer || `${rows.length} records`)}</span><div class="table-pager" aria-label="Table pages"><button class="btn btn-secondary btn-sm" type="button" data-table-prev>Previous</button><button class="btn btn-secondary btn-sm" type="button" data-table-next>Next</button></div></div></section>`;
  }

  function sortTable(sortButton) {
    const tableElement = sortButton.closest("table");
    const card = sortButton.closest("[data-paginated-table]");
    const tbody = tableElement?.tBodies?.[0];
    if (!tableElement || !card || !tbody) return;

    const column = Number(sortButton.dataset.tableSort);
    const header = sortButton.closest("th");
    const nextDirection = header.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
    const rows = [...tbody.rows].filter((row) => !row.querySelector(".empty-state"));
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
    const valueFor = (row) => {
      const cell = row.cells[column];
      const dateValue = cell?.querySelector("time[datetime]")?.getAttribute("datetime");
      return dateValue || cell?.dataset.sortValue || cell?.textContent?.trim() || "";
    };
    const comparable = (value) => {
      const normalized = String(value).trim();
      const date = /[-/:]|\b(?:am|pm)\b/i.test(normalized) ? Date.parse(normalized) : NaN;
      if (Number.isFinite(date)) return { kind: "number", value: date };
      const numeric = normalized.replace(/[^\d.+-]/g, "");
      if (numeric && /^[-+]?\d*\.?\d+$/.test(numeric)) return { kind: "number", value: Number(numeric) };
      return { kind: "text", value: normalized };
    };

    rows.forEach((row, index) => { if (!row.dataset.sortIndex) row.dataset.sortIndex = String(index); });
    rows.sort((first, second) => {
      const a = comparable(valueFor(first));
      const b = comparable(valueFor(second));
      const comparison = a.kind === "number" && b.kind === "number" ? a.value - b.value : collator.compare(String(a.value), String(b.value));
      return (comparison || Number(first.dataset.sortIndex) - Number(second.dataset.sortIndex)) * (nextDirection === "ascending" ? 1 : -1);
    });
    rows.forEach((row) => tbody.appendChild(row));
    $$('th[aria-sort]', tableElement).forEach((item) => item.setAttribute("aria-sort", item === header ? nextDirection : "none"));
    card.dataset.tablePage = "1";
    paginateTables(card.parentElement || document);
  }

  function paginateTables(root = document) {
    $$('[data-paginated-table]', root).forEach((card) => {
      const pageSize = Math.min(Number(uiConfig().pageSize || 25), window.matchMedia("(max-width: 620px)").matches ? 4 : Infinity);
      const rows = $$('.data-table tbody tr', card).filter((row) => !row.querySelector(".empty-state") && row.dataset.filterMatch !== "false");
      const pages = Math.max(1, Math.ceil(rows.length / pageSize));
      const page = Math.min(Math.max(1, Number(card.dataset.tablePage || 1)), pages);
      card.dataset.tablePage = String(page);
      $$('.data-table tbody tr', card).forEach((row) => { row.hidden = true; });
      rows.forEach((row, index) => { row.hidden = index < (page - 1) * pageSize || index >= page * pageSize; });
      const summary = $('[data-table-page-summary]', card);
      const label = card.dataset.tableLabel;
      if (summary) summary.textContent = rows.length ? `${label ? `${label} · ` : ""}Page ${page} of ${pages} · ${rows.length} records` : `${label ? `${label} · ` : ""}No records`;
      const previous = $('[data-table-prev]', card);
      const next = $('[data-table-next]', card);
      if (previous) previous.disabled = page <= 1;
      if (next) next.disabled = page >= pages;
      $('.table-pager', card)?.toggleAttribute("hidden", pages <= 1);
    });
  }

  function filters(placeholder, selects = [], actions = "", options = {}) {
    const dates = options.dates ? `<label class="control control-date"><span>From</span><input type="date" data-table-date-from aria-label="From date"></label><label class="control control-date"><span>To</span><input type="date" data-table-date-to aria-label="To date"></label>` : "";
    return `<div class="toolbar"><div class="filter-group"><label class="control control-search">${icon("search")}<input type="search" data-table-search placeholder="${h(placeholder)}"></label>${selects.map(([label, options]) => `<label class="control"><select aria-label="${h(label)}"><option>${h(label)}</option>${options.filter(Boolean).map((option) => `<option>${h(option)}</option>`).join("")}</select>${icon("chevron", "select-arrow")}</label>`).join("")}${dates}</div><div class="toolbar-actions">${actions}<button class="btn btn-secondary btn-sm" type="button" data-clear-filters>Clear filters</button></div></div>`;
  }

  function toggle(checked = true, label = "", attrs = "") {
    return `<label class="toggle"><input type="checkbox" ${checked ? "checked" : ""} ${attrs}><span class="toggle-track"></span>${label ? `<span>${h(label)}</span>` : ""}</label>`;
  }

  function accessibilityCard() {
    const selected = getTextSize();
    return `<section class="card settings-card accessibility-card"><div class="settings-card-head"><div><h3>Accessibility</h3><p>Adjust the system text size for better readability.</p></div>${icon("settings")}</div><div class="text-size-control" role="group" aria-label="Text size">${textSizeOptions.map((option) => `<button class="text-size-option ${option.value === selected ? "active" : ""}" type="button" data-text-size-option="${h(option.value)}" aria-pressed="${option.value === selected ? "true" : "false"}">${h(option.label)}</button>`).join("")}</div></section>`;
  }

  function select(name, options, selected = "", attrs = "") {
    return `<select name="${h(name)}" ${attrs}>${options.map((option) => {
      const value = typeof option === "object" ? option.value : option;
      const label = typeof option === "object" ? option.label : option;
      return `<option value="${h(value)}" ${String(value) === String(selected) ? "selected" : ""}>${h(label)}</option>`;
    }).join("")}</select>`;
  }

  function field(label, name, value = "", type = "text", extra = "") {
    const id = `${name}-${Math.random().toString(16).slice(2)}`;
    const control = type === "textarea"
      ? `<textarea id="${id}" name="${h(name)}" ${extra}>${h(value)}</textarea>`
      : type === "password"
        ? `<div class="drawer-password-wrap"><input id="${id}" name="${h(name)}" type="password" value="${h(value)}" ${extra}><button class="password-toggle" type="button" data-drawer-password-toggle="${id}" aria-label="Show password" aria-pressed="false">${icon("eye", "eye-open")}<svg class="eye-closed" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 6.1A10 10 0 0 1 12 6c6.5 0 10 6 10 6a16 16 0 0 1-3 3.6M6.1 6.1C3.4 7.8 2 12 2 12s3.5 6 10 6a10 10 0 0 0 3.1-.5"/></svg></button></div>`
        : `<input id="${id}" name="${h(name)}" type="${h(type)}" value="${h(value)}" ${extra}>`;
    return `<div class="form-field full"><label for="${id}">${h(label)}</label>${control}</div>`;
  }

  function drawerInfo(items) {
    return `<div class="drawer-info">${items.map(([label, value]) => `<div><span>${h(label)}</span><strong>${value}</strong></div>`).join("")}</div>`;
  }

  function valuesTable(values = []) {
    if (!values.length) return `<div class="clinical-note-box"><h4>${icon("file")} Structured Values</h4><p>No structured values were entered for this result.</p></div>`;
    return `<table class="result-values"><thead><tr><th>Parameter</th><th>Result</th><th>Unit</th><th>Reference Range</th><th>Validation</th></tr></thead><tbody>${values.map((value) => `<tr><td>${h(value.parameter)}</td><td class="${["High", "Low", "Critical", "Invalid Entry"].includes(value.flag) ? "abnormal" : ""}">${h(value.value)}</td><td>${h(value.unit)}</td><td>${h(value.referenceRange)}</td><td><strong>${h(value.flag || "Not evaluated")}</strong><p>${h(value.validationReason || "")}</p>${value.validationRule ? `<small>Source: ${h(value.validationRule.source)}</small>` : ""}</td></tr>`).join("")}</tbody></table>`;
  }

  function chartFromCounts(counts) {
    const values = Object.values(counts || {});
    if (!values.length) return '<div class="empty-state">No chart data is available yet.</div>';
    const points = values;
    const max = Math.max(...points, 1);
    const coords = points.map((value, index) => `${index * (420 / Math.max(1, points.length - 1))},${126 - (value / max) * 92}`).join(" ");
    return `<div class="line-chart" style="--chart-points:${points.length}"><svg viewBox="0 0 420 145" preserveAspectRatio="none"><path class="chart-grid-line" d="M0 36H420M0 72H420M0 108H420"/><polygon points="0,145 ${coords} 420,145" fill="#08a394" opacity=".09"/><polyline class="chart-line" points="${coords}"/>${coords.split(" ").map((point) => { const [x, y] = point.split(","); return `<circle class="chart-dot" cx="${x}" cy="${y}" r="3"/>`; }).join("")}</svg><div class="chart-axis">${Object.keys(counts || {}).map((key) => `<span>${h(key)}</span>`).join("")}</div></div>`;
  }

  function utilizationTrendChart(analytics) {
    return window.ClinicReportCharts.timeline(analytics.buckets || [], [{key: "patients", label: "Patients"}, {key: "requests", label: "Requests"}, {key: "tests", label: "Tests"}], {title: "Laboratory utilization over time"});
  }

  function formatPhilippineMobile(value = "") {
    let digits = String(value).replace(/\D/g, "");
    if (digits.startsWith("63") && digits.length >= 12) digits = `0${digits.slice(2)}`;
    digits = digits.slice(0, 11);
    if (digits.length <= 4) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  function filteredTable(headers, rows, footer, placeholder, selects = [], options = {}) {
    return `<div class="table-filter-scope">${filters(placeholder, selects, "", options)}${table(headers, rows, footer)}</div>`;
  }

  function utilizationAnalyticsSection() {
    const service = window.LabUtilizationAnalytics;
    if (!service) return "";
    if (!state.utilization) {
      const latest = service.latestOrderDate(state.data.orders);
      const anchor = service.dateKey(latest);
      state.utilization = { period: "month", anchor, from: anchor, to: anchor };
    }
    const selection = state.utilization;
    const analytics = service.build(state.data.orders, selection);
    const rangeLabel = analytics.start === analytics.end ? shortDate(service.parseDate(analytics.start)) : `${shortDate(service.parseDate(analytics.start))} – ${shortDate(service.parseDate(analytics.end))}`;
    const periods = [["day", "Day"], ["week", "Week"], ["month", "Month"], ["year", "Year"], ["custom", "Custom"]];
    const controls = periods.map(([value, label]) => `<button type="button" class="utilization-period${selection.period === value ? " active" : ""}" data-utilization-period="${value}" aria-pressed="${selection.period === value}">${label}</button>`).join("");
    const dateControls = selection.period === "custom"
      ? `<label>From<input class="control" type="date" value="${h(selection.from)}" data-utilization-from></label><label>To<input class="control" type="date" value="${h(selection.to)}" data-utilization-to></label>`
      : `<label>${selection.period === "day" ? "Date" : "Period containing"}<input class="control" type="date" value="${h(selection.anchor)}" data-utilization-anchor></label>`;
    const totals = analytics.totals;
    const busiest = analytics.buckets.reduce((best, bucket) => bucket.requests > (best?.requests || 0) ? bucket : best, null);
    return `<section class="card utilization-card"><div class="card-head"><div><h3 class="card-title">Laboratory Utilization</h3><p class="card-subtitle">Unique patients and laboratory activity for ${h(rangeLabel)}. A patient is counted once in the selected period.</p></div>${icon("trend")}</div><div class="utilization-toolbar"><div class="utilization-periods" role="group" aria-label="Analytics period">${controls}</div><div class="utilization-dates">${dateControls}</div></div><div class="stats-grid utilization-stats">${stat("Patients Served", totals.patients, "users", "-", "teal")}${stat("Laboratory Requests", totals.requests, "orders", "-", "blue")}${stat("Tests Requested", totals.tests, "test", "-", "purple")}${stat("Average Requests / Day", totals.averageRequestsPerDay.toFixed(1), "activity", "-", "orange")}</div><div class="card-body utilization-chart-body">${utilizationTrendChart(analytics)}<p class="utilization-note">Counts use each request's creation date.${busiest?.requests ? ` Busiest displayed interval: ${h(busiest.label)} with ${h(busiest.requests)} request${busiest.requests === 1 ? "" : "s"}.` : " No laboratory activity was recorded for this period."} Open chart data for exact values.</p></div></section>`;
  }

  function forecastTrendChart(analysis) {
    const buckets = analysis.forecast.map((day) => ({
      ...day,
      patients: Number(day.patients.toFixed(1)),
      requests: Number(day.requests.toFixed(1)),
      tests: Number(day.tests.toFixed(1)),
    }));
    return analysis.historicalRequests ? window.ClinicReportCharts.timeline(buckets, [{key: "requests", label: "Projected requests"}, {key: "tests", label: "Projected tests"}, {key: "patients", label: "Projected patient visits"}], {forecast: true, area: true, title: "Projected laboratory demand", unit: "Expected daily count"}) : '<div class="empty-state">A demand forecast needs laboratory request history. No requests are available yet.</div>';
  }

  function forecastingAnalysisSection() {
    const service = window.LabForecastingAnalysis;
    if (!service) return "";
    const analysis = service.build(state.data.orders, state.forecast);
    const horizons = [[7, "7 Days"], [30, "30 Days"], [90, "90 Days"]];
    const controls = horizons.map(([value, label]) => `<button type="button" class="utilization-period${analysis.horizon === value ? " active" : ""}" data-forecast-horizon="${value}" aria-pressed="${analysis.horizon === value}">${label}</button>`).join("");
    const confidenceClass = analysis.confidence.toLowerCase();
    const peakDate = analysis.peak ? shortDate(service.parseDate(analysis.peak.date)) : "No predicted activity";
    return `<section class="card utilization-card forecast-card"><div class="card-head"><div><div class="forecast-title-line"><h3 class="card-title">Laboratory Demand Forecast</h3><span class="forecast-confidence ${confidenceClass}">${h(analysis.confidence)} confidence</span></div><p class="card-subtitle">Projected demand after ${h(shortDate(service.parseDate(analysis.asOf)))} based on recent laboratory-request patterns.</p></div>${icon("activity")}</div><div class="utilization-toolbar forecast-toolbar"><div class="utilization-periods" role="group" aria-label="Forecast horizon">${controls}</div><span class="forecast-training">Training window: ${h(shortDate(service.parseDate(analysis.trainingStart)))} – ${h(shortDate(service.parseDate(analysis.asOf)))}</span></div><div class="stats-grid utilization-stats">${stat("Predicted Patient Visits", analysis.totals.patients, "users", "-", "teal")}${stat("Predicted Requests", analysis.totals.requests, "orders", "-", "blue")}${stat("Predicted Tests", analysis.totals.tests, "test", "-", "purple")}${stat("Expected Request Range", `${analysis.interval.requestsLow}–${analysis.interval.requestsHigh}`, "trend", "-", "orange")}</div><div class="card-body utilization-chart-body">${forecastTrendChart(analysis)}<div class="forecast-insights"><span><strong>Expected trend:</strong> ${h(analysis.trend)}</span><span><strong>Peak day:</strong> ${h(peakDate)}${analysis.peak ? ` (${h(analysis.peak.requests.toFixed(1))} requests)` : ""}</span><span><strong>Historical requests used:</strong> ${h(analysis.historicalRequests)}</span></div><p class="utilization-note forecast-disclaimer">Planning estimate only. Patient visits are the sum of expected daily unique patients, not guaranteed distinct people across the whole forecast. The model uses up to 90 days of history, gives newer records more weight, learns weekday patterns, and applies a limited recent trend. Holidays, outbreaks, missing records, or operational changes can make actual demand different.</p></div></section>`;
  }

  function donutCard(title, counts, totalLabel = "Total") {
    const entries = Object.entries(counts || {});
    const total = entries.reduce((sum, [, count]) => sum + Number(count), 0);
    const colors = ["#08a394", "#397fb7", "#8366bc", "#e5a23f", "#d95a66", "#9aabb2"];
    let cursor = 0;
    const segments = entries.length
      ? entries.map(([, count], index) => {
        const start = cursor;
        cursor += (Number(count) / Math.max(1, total)) * 100;
        return `${colors[index % colors.length]} ${start}% ${cursor}%`;
      }).join(",")
      : "#dce9eb 0 100%";
    return `<section class="card"><div class="card-head"><div><h3 class="card-title">${h(title)}</h3><p class="card-subtitle">Breakdown of records currently in scope</p></div></div><div class="card-body donut-layout"><div class="donut" style="--segments:${segments}"><div class="donut-center"><strong>${total}</strong><span>${h(totalLabel)}</span></div></div><div class="chart-legend">${(entries.length ? entries : [["No records", 0]]).map(([label, count], index) => `<div class="legend-row" style="--dot:${colors[index % colors.length]}"><i></i><span>${h(label)}</span><strong>${h(count)}</strong></div>`).join("")}</div></div></section>`;
  }

  function notificationArticles(notifications) {
    return notifications.length ? notifications.map((item) => `<article class="notification-item ${item.isRead ? "" : "unread"}" data-drawer="notification" data-id="${item.id}" role="button" tabindex="0" aria-label="Open notification: ${h(item.title)}"><span class="notification-icon">${icon(item.type || "bell")}</span><div class="notification-copy"><strong>${h(item.title)}</strong><p>${h(item.message)}</p></div><div class="notification-actions"><time>${shortDateTime(item.createdAt)}</time><span class="row-action" aria-hidden="true">${icon("arrow")}</span></div></article>`).join("") : `<div class="empty-state">No notifications found.</div>`;
  }

  function recordBy(collection, id) {
    return (state.data?.[collection] || []).find((item) => String(item.id) === String(id));
  }

  function trendAnalysisSection() {
    const service = window.LabTrendAnalysis;
    if (!service) return "";
    if (!state.trends) {
      const dates = [...state.data.orders, ...state.data.results].map((row) => service.parseDate(row.createdAt)).filter(Boolean).sort((a, b) => a - b);
      const latest = dates.at(-1) || new Date();
      state.trends = { from: service.dateKey(new Date(latest.getFullYear(), latest.getMonth(), latest.getDate() - 29)), to: service.dateKey(latest), group: "day", facility: "", test: "" };
    }
    const analysis = service.build(state.data.orders, state.data.results, state.trends);
    const turnaround = analysis.totals.averageTurnaroundMinutes === null ? "No data" : analysis.totals.averageTurnaroundMinutes < 120 ? `${analysis.totals.averageTurnaroundMinutes} min` : `${(analysis.totals.averageTurnaroundMinutes / 60).toFixed(1)} hr`;
    return `<section class="trend-analysis" aria-labelledby="trend-analysis-title"><div class="trend-analysis-head"><div><h2 id="trend-analysis-title">Trend Analysis</h2><p>Descriptive and diagnostic views for laboratory volume, turnaround, validation flags, and facility workload.</p></div>${icon("trend")}</div><div class="trend-filter-grid"><label>From<input class="control" type="date" value="${h(analysis.filters.from)}" data-trend-from></label><label>To<input class="control" type="date" value="${h(analysis.filters.to)}" data-trend-to></label><label>Group by${select("trendGroup", [{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }], analysis.filters.group, "data-trend-group")}</label><label>Facility${select("trendFacility", [{ value: "", label: "All facilities" }, ...analysis.facilities.map((value) => ({ value, label: value }))], analysis.filters.facility, "data-trend-facility")}</label><label>Test type${select("trendTest", [{ value: "", label: "All test types" }, ...analysis.tests.map((value) => ({ value, label: value }))], analysis.filters.test, "data-trend-test")}</label></div><div class="stats-grid utilization-stats trend-summary">${stat("Tests Processed", analysis.totals.tests, "test", "-", "purple")}${stat("Results Encoded", analysis.totals.results, "results", "-", "blue")}${stat("Average Turnaround", turnaround, "clock", "-", "teal")}${stat("Validation Flags", analysis.totals.flaggedValues, "alert", "-", "orange")}</div><div class="trend-analysis-grid"><section class="trend-panel"><h3>Test Volume by Period</h3><p>Requested tests in each selected time interval.</p>${window.ClinicReportCharts.bars(analysis.buckets, [{key: "tests", label: "Requested tests"}], {title: "Test volume by period", unit: "Tests"})}</section><section class="trend-panel"><h3>Turnaround Time Trends</h3><p>Average time from result encoding to release.</p>${window.ClinicReportCharts.timeline(analysis.buckets, [{key: "averageTurnaroundMinutes", label: "Average turnaround"}], {title: "Turnaround time over time", unit: "Minutes"})}</section><section class="trend-panel"><h3>Flagged-result Trends</h3><p>Flags produced during rule-based result validation.</p>${window.ClinicReportCharts.distribution(analysis.flags, "category", "count")}</section><section class="trend-panel"><h3>Workload Distribution</h3><p>Requested test volume by facility.</p>${window.ClinicReportCharts.pie(analysis.workload, "facility", "tests")}</section></div><p class="utilization-note">Turnaround uses released results with valid encoding and release timestamps. Workload is grouped by facility because staff-shift data is not currently stored.</p></section>`;
  }

  function syncNotifications(notifications) {
    state.data.notifications = notifications;
    if (state.data.dashboard) {
      state.data.dashboard.unreadNotifications = notifications.filter((item) => !item.isRead).length;
    }
    hydrateProfile();
  }

  function rebuildDerivedData() {
    if (!state.data) return;
    const orders = state.data.orders || [];
    const results = state.data.results || [];
    const users = state.data.users || [];
    const notifications = state.data.notifications || [];
    const countBy = (items, key) => items.reduce((counts, item) => {
      const label = item[key] || "Unknown";
      counts[label] = (counts[label] || 0) + 1;
      return counts;
    }, {});
    const tests = {};
    orders.forEach((order) => String(order.tests || "").split(",").map((name) => name.trim()).filter(Boolean).forEach((name) => { tests[name] = (tests[name] || 0) + 1; }));
    state.data.reports = {
      ...(state.data.reports || {}),
      ordersByStatus: countBy(orders, "status"),
      resultsByStatus: countBy(results, "status"),
      ordersByFacility: countBy(orders, "facilityName"),
      topTests: Object.fromEntries(Object.entries(tests).sort((a, b) => b[1] - a[1]).slice(0, 8)),
    };
    state.data.dashboard = {
      ...(state.data.dashboard || {}),
      totalUsers: users.length,
      totalPatients: users.filter((item) => item.role === "Patient").length,
      totalDoctors: users.filter((item) => item.role === "Doctor").length,
      totalLabStaff: users.filter((item) => item.role === "Laboratory Staff").length,
      totalFacilities: (state.data.facilities || []).length,
      totalTests: (state.data.tests || []).length,
      totalOrders: orders.length,
      pendingOrders: orders.filter((item) => !["Released", "Rejected", "Cancelled"].includes(item.status)).length,
      openOrders: orders.filter((item) => !["Released", "Rejected", "Cancelled"].includes(item.status)).length,
      releasedResults: results.filter((item) => item.status === "Released").length,
      unreadNotifications: notifications.filter((item) => !item.isRead).length,
    };
  }

  function apiUrl(action, params = {}) {
    const query = new URLSearchParams({ action, ...params });
    return `${API_URL}?${query.toString()}`;
  }

  function hydrateProfile() {
    if (!currentUser) return;
    $$(".profile-copy strong").forEach((el) => { el.textContent = currentUser.name; });
    $$(".profile-copy small").forEach((el) => { el.textContent = currentUser.role; });
    $$(".profile-button .avatar").forEach((el) => { el.textContent = currentUser.avatar || initials(currentUser.name); });
    const unread = (state.data?.notifications || []).filter((item) => !item.isRead).length;
    $$(".notification-count").forEach((el) => {
      el.textContent = unread;
      el.hidden = unread === 0;
    });
    $$(".notification-button").forEach((el) => { el.setAttribute("aria-label", `View ${unread} unread notifications`); });
    const counts = {
      notifications: unread,
      orders: state.data?.orders?.length || 0,
      results: state.data?.results?.length || 0,
      review: (state.data?.results || []).filter((item) => item.status === "Pending Review").length,
      queue: (state.data?.orders || []).filter((item) => !["Released", "Rejected", "Cancelled"].includes(item.status)).length,
    };
    Object.entries(counts).forEach(([page, count]) => {
      $$(`.nav-item[data-page="${page}"] .nav-count`).forEach((el) => { el.textContent = count; });
    });
  }

  function showStatus(form, message, type = "error") {
    const status = form?.previousElementSibling;
    if (!status) return;
    status.textContent = message;
    status.className = status.classList.contains("register-status")
      ? `register-status visible`
      : `status-message is-visible ${type}`;
    if (status.classList.contains("register-status")) {
      status.style.color = type === "error" ? "var(--red)" : "var(--green)";
      status.style.background = type === "error" ? "var(--red-bg)" : "var(--green-bg)";
    }
  }

  function toast(message, tone = "success") {
    const region = $(".toast-region");
    if (!region) return;
    const el = document.createElement("div");
    el.className = `toast toast-${tone}`;
    el.setAttribute("role", tone === "error" ? "alert" : "status");
    el.innerHTML = `${icon(tone === "error" ? "alert" : "check")}<span>${h(message)}</span><button type="button" class="toast-close" aria-label="Dismiss notification">${icon("close")}</button>`;
    $(".toast-close", el)?.addEventListener("click", () => el.remove());
    region.append(el);
    setTimeout(() => el.remove(), 3500);
  }

  function glassDialog({ title, message, confirmText = "Confirm", danger = false, inputLabel = "", inputRequired = false, detailHtml = "" }) {
    return new Promise((resolve) => {
      const returnFocus = document.activeElement;
      const modal = document.createElement("div");
      modal.className = "glass-dialog";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      const titleId = `dialog-title-${Date.now()}`;
      const messageId = `dialog-message-${Date.now()}`;
      modal.setAttribute("aria-labelledby", titleId);
      modal.setAttribute("aria-describedby", messageId);
      modal.innerHTML = `<div class="glass-dialog-card"><h2 id="${titleId}">${h(title)}</h2><p id="${messageId}">${h(message)}</p>${detailHtml}${inputLabel ? `<label>${h(inputLabel)}<textarea data-dialog-input ${inputRequired ? "required" : ""}></textarea></label>` : ""}<div class="form-actions"><button class="btn btn-secondary" type="button" data-dialog-cancel>Cancel</button><button class="btn ${danger ? "btn-danger" : "btn-primary"}" type="button" data-dialog-confirm>${h(confirmText)}</button></div></div>`;
      const siblings = [...document.body.children];
      siblings.forEach((element) => element.setAttribute("inert", ""));
      const finish = (value) => {
        modal.remove();
        siblings.forEach((element) => element.removeAttribute("inert"));
        returnFocus?.focus?.();
        resolve(value);
      };
      modal.addEventListener("click", (event) => {
        if (event.target === modal || event.target.closest("[data-dialog-cancel]")) finish(null);
        if (event.target.closest("[data-dialog-confirm]")) {
          const input = $("[data-dialog-input]", modal);
          if (inputRequired && !input?.value.trim()) { input?.focus(); return; }
          finish(input ? input.value.trim() : true);
        }
      });
      modal.addEventListener("keydown", (event) => {
        if (event.key === "Escape") finish(null);
        if (event.key === "Enter" && !event.shiftKey && event.target.matches("[data-dialog-input]")) {
          event.preventDefault();
          $("[data-dialog-confirm]", modal)?.click();
        }
        if (event.key === "Tab") {
          const focusable = $$("button, textarea, input, select, [tabindex]:not([tabindex='-1'])", modal).filter((element) => !element.disabled);
          if (!focusable.length) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      });
      document.body.append(modal);
      ($("[data-dialog-input]", modal) || $("[data-dialog-confirm]", modal))?.focus();
    });
  }

  async function downloadRecords() {
    if (!state.data || !currentUser) {
      toast("No records are loaded yet.");
      return;
    }
    const payload = await api("export_records");
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `clinic-records-${currentUser.role.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast("Your records were exported.");
  }

  function loading() {
    return `<div class="skeleton-page" role="status" aria-live="polite" aria-busy="true">
      <span class="sr-only">Loading live clinic data...</span>
      <div class="skeleton-heading"><span class="skeleton-line skeleton-line-short"></span><span class="skeleton-line skeleton-line-title"></span><span class="skeleton-line skeleton-line-copy"></span></div>
      <div class="skeleton-stats">${Array.from({ length: 4 }, () => '<div class="skeleton-card"><span class="skeleton-icon"></span><span class="skeleton-line skeleton-line-short"></span><span class="skeleton-line skeleton-line-value"></span></div>').join("")}</div>
      <div class="skeleton-content"><div class="skeleton-panel"><span class="skeleton-line skeleton-line-title"></span>${Array.from({ length: 5 }, () => '<span class="skeleton-row"></span>').join("")}</div><div class="skeleton-panel"><span class="skeleton-line skeleton-line-copy"></span>${Array.from({ length: 3 }, () => '<span class="skeleton-row"></span>').join("")}</div></div>
    </div>`;
  }

  function dashboardStats() {
    const d = state.data.dashboard || {};
    if (currentUser.role === "Admin") {
      return [
        stat("Total Users", d.totalUsers || 0, "users", "-", "teal"),
        stat("Patients", d.totalPatients || 0, "user", "-", "green"),
        stat("Doctors", d.totalDoctors || 0, "doctor", "-", "blue"),
        stat("Lab Staff", d.totalLabStaff || 0, "test", "-", "purple"),
        stat("Facilities", d.totalFacilities || 0, "facility", "-", "teal"),
        stat("Tests", d.totalTests || 0, "test", "-", "orange"),
        stat("Open Requests", d.pendingOrders || 0, "orders", "-", "blue"),
        stat("Released Results", d.releasedResults || 0, "results", "-", "green"),
      ].join("");
    }
    const patientLabel = currentUser.role === "Patient" ? "My Requests" : currentUser.role === "Laboratory Staff" ? "Assigned Requests" : "My Requests";
    return [
      stat(patientLabel, d.totalOrders || 0, "orders", "-", "teal"),
      stat("Open Requests", d.openOrders || 0, "clock", "-", "orange"),
      stat("Released Results", d.releasedResults || 0, "results", "-", "green"),
      stat("Unread Notifications", d.unreadNotifications || 0, "bell", "-", "blue"),
    ].join("");
  }

  function renderAdminDashboard() {
    const orders = state.data.orders || [];
    const results = state.data.results || [];
    const tests = state.data.tests || [];
    const todayKey = new Date().toLocaleDateString("en-CA");
    const dateKey = (value) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleDateString("en-CA") : "";
    const finalOrderStatuses = ["Released", "Rejected", "Cancelled"];
    const resultsByOrder = new Map(results.map((result) => [String(result.orderId), result]));
    const criticalValues = (result) => (result.values || []).filter((value) => String(value.flag).toLowerCase() === "critical");
    const criticalResults = results.filter((result) => criticalValues(result).length);
    const awaitingVerification = results.filter((result) => result.status === "Pending Review");
    const pendingResults = orders.filter((order) => !finalOrderStatuses.includes(order.status) && !resultsByOrder.has(String(order.id)));
    const completedResults = results.filter((result) => ["Verified", "Released"].includes(result.status));
    const todaysOrders = orders.filter((order) => dateKey(order.createdAt) === todayKey);
    const turnaroundMinutes = results.map((result) => {
      const order = orders.find((item) => String(item.id) === String(result.orderId));
      const start = new Date(order?.createdAt || result.createdAt);
      const end = new Date(result.releasedAt || result.verifiedAt || "");
      return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start ? Math.round((end - start) / 60000) : null;
    }).filter((value) => value !== null);
    const averageMinutes = turnaroundMinutes.length ? Math.round(turnaroundMinutes.reduce((sum, value) => sum + value, 0) / turnaroundMinutes.length) : null;
    const durationLabel = (minutes) => minutes === null ? "No data" : `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
    const firstValue = (result) => criticalValues(result)[0] || (result.values || [])[0] || null;
    const resultTime = (result) => result.releasedAt || result.verifiedAt || result.updatedAt || result.createdAt;
    const departmentFor = (testName) => {
      const names = String(testName || "").split(",").map((name) => name.trim());
      const matched = tests.find((test) => names.some((name) => String(test.name).toLowerCase() === name.toLowerCase()));
      if (matched?.category) return matched.category;
      const value = names.join(" ").toLowerCase();
      if (/cbc|blood count|hemoglobin|hematocrit|esr/.test(value)) return "Hematology";
      if (/culture|bacteria|microb/.test(value)) return "Microbiology";
      if (/antigen|antibody|thyroid|immun|crp/.test(value)) return "Immunology";
      if (/blood bank|crossmatch|typing/.test(value)) return "Blood Bank";
      if (/urinal|stool|microscop/.test(value)) return "Clinical Microscopy";
      return "Clinical Chemistry";
    };
    const criticalRows = criticalResults.slice(0, previewLimit()).map((result) => {
      const value = firstValue(result) || {};
      const measured = [value.value, value.unit].filter(Boolean).join(" ") || "Flagged value";
      return [identity(result.patientName, result.patientCode), h(value.parameter || result.testName), `<strong class="critical-value">${h(measured)}</strong>`, h(value.referenceRange || "Not provided"), badge("Critical"), `<time datetime="${h(resultTime(result))}">${shortDateTime(resultTime(result))}</time>`, `<button class="btn btn-secondary btn-sm" type="button" data-drawer="result" data-id="${result.id}">View Result</button>`];
    });
    const recentRows = results.slice(0, Math.max(previewLimit(), 6)).map((result) => {
      const value = firstValue(result);
      const isCritical = criticalValues(result).length > 0;
      const displayStatus = isCritical ? "Critical" : result.status === "Pending Review" ? "Pending Verification" : result.status;
      const measured = value ? [value.value, value.unit].filter(Boolean).join(" ") : (result.findings || "Available");
      return [`<time datetime="${h(resultTime(result))}">${shortDateTime(resultTime(result))}</time>`, `<span class="cell-strong">${h(result.patientName)}</span><span class="cell-sub">${h(result.patientCode)}</span>`, h(result.testName), h(departmentFor(result.testName)), `<span class="cell-wrap">${h(measured)}</span>`, badge(displayStatus), `<button class="btn btn-secondary btn-sm" type="button" data-drawer="result" data-id="${result.id}">${result.status === "Pending Review" ? "Review" : "View"}</button>`];
    });
    const now = new Date();
    const periodDays = state.adminTurnaroundPeriod === "today" ? 1 : state.adminTurnaroundPeriod === "month" ? 30 : 7;
    const turnaroundBuckets = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, weekday) => {
      const values = results.map((result) => {
        const end = new Date(result.releasedAt || result.verifiedAt || "");
        const order = orders.find((item) => String(item.id) === String(result.orderId));
        const start = new Date(order?.createdAt || result.createdAt);
        const age = (now - end) / 86400000;
        const mondayIndex = end.getDay() === 0 ? 6 : end.getDay() - 1;
        return !Number.isNaN(end.getTime()) && !Number.isNaN(start.getTime()) && end >= start && age >= 0 && age < periodDays && mondayIndex === weekday ? (end - start) / 60000 : null;
      }).filter((value) => value !== null);
      return [label, values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0];
    });
    const maxTurnaround = Math.max(...turnaroundBuckets.map(([, value]) => value), 1);
    const turnaroundChart = `<div class="turnaround-bars" role="img" aria-label="Average laboratory turnaround time by weekday">${turnaroundBuckets.map(([label, value]) => `<div class="turnaround-column"><span class="turnaround-value">${value ? durationLabel(value) : "—"}</span><div class="turnaround-track"><i style="height:${value ? Math.max(12, (value / maxTurnaround) * 100) : 3}%"></i></div><small>${label}</small></div>`).join("")}</div>`;
    const departmentMap = new Map();
    orders.forEach((order) => {
      const orderTests = String(order.tests || "").split(",").map((name) => name.trim()).filter(Boolean);
      (orderTests.length ? orderTests : ["Laboratory Test"]).forEach((testName) => {
        const department = departmentFor(testName);
        const item = departmentMap.get(department) || { total: 0, completed: 0, processing: 0, pending: 0 };
        item.total += 1;
        if (["Verified", "Released"].includes(order.status)) item.completed += 1;
        else if (["Accepted", "Sample Collected", "Processing", "In Progress", "Result Uploaded", "Pending Review"].includes(order.status)) item.processing += 1;
        else item.pending += 1;
        departmentMap.set(department, item);
      });
    });
    const departments = [...departmentMap.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 5);
    const departmentHtml = departments.length ? departments.map(([name, item]) => `<div class="department-row"><div class="department-copy"><strong>${h(name)}</strong><span>${h(item.total)} request${item.total === 1 ? "" : "s"}</span></div><div class="department-progress" aria-label="${h(item.completed)} of ${h(item.total)} completed"><i style="width:${Math.round((item.completed / Math.max(1, item.total)) * 100)}%"></i></div><div class="department-counts"><span><b>${h(item.completed)}</b> completed</span><span><b>${h(item.processing)}</b> processing</span><span><b>${h(item.pending)}</b> pending</span></div></div>`).join("") : '<div class="empty-state">Department activity will appear when laboratory requests are available.</div>';
    const delayedOrders = orders.filter((order) => !finalOrderStatuses.includes(order.status) && (now - new Date(order.createdAt)) > 48 * 3600000);
    const rejectedResults = results.filter((result) => result.status === "Rejected");
    const rejectedSamples = orders.filter((order) => order.status === "Rejected");
    const recollectionOrders = orders.filter((order) => /recollect|new sample|repeat sample/i.test(String(order.latestUpdate || "")));
    const attentionItems = [
      [criticalResults.length, "Critical Results", "results", "red", "alert"],
      [awaitingVerification.length, "Results Awaiting Verification", "results", "orange", "clock"],
      [delayedOrders.length, "Delayed Laboratory Requests", "orders", "orange", "activity"],
      [rejectedSamples.length || rejectedResults.length, "Rejected Samples", rejectedSamples.length ? "orders" : "results", "gray", "close"],
      [recollectionOrders.length, "Samples Requiring Recollection", "orders", "gray", "test"],
    ];
    return `${heading(...pageMeta.Admin.dashboard, `<button class="btn btn-secondary" data-go-page="audit">${icon("audit")} Audit Trail</button><button class="btn btn-primary" data-drawer="user">${icon("plus")} New User</button>`)}
      <div class="stats-grid admin-lab-stats">${stat("Laboratory Requests Today", todaysOrders.length, "orders", "-", "teal")}${stat("Pending Results", pendingResults.length, "clock", "-", "orange")}${stat("Awaiting Verification", awaitingVerification.length, "review", "-", "orange")}${stat("Completed Results", completedResults.length, "check", "-", "green")}${stat("Critical Results", criticalResults.length, "alert", "-", "red")}${stat("Average Turnaround Time", durationLabel(averageMinutes), "activity", "-", "blue")}</div>
      <section class="dashboard-section critical-results-section"><div class="section-heading"><div><h3>${icon("alert")} Critical Results</h3><p>Structured result values flagged as critical and requiring prompt review.</p></div><button class="card-link" type="button" data-go-page="results">View all results</button></div>${filteredTable(["Patient", "Laboratory Test", "Result", "Reference Range", "Status", "Time", "Action"], criticalRows, "Critical laboratory results", "Search patient, test, or result", [["All statuses", ["Critical"]]], { dates: true })}</section>
      <section class="dashboard-section"><div class="section-heading"><div><h3>Recent Laboratory Results</h3><p>Latest result activity across all connected facilities.</p></div><button class="card-link" type="button" data-go-page="results">View all results</button></div>${filteredTable(["Time", "Patient", "Laboratory Test", "Department", "Result", "Status", "Action"], recentRows, "Recent laboratory results", "Search patient, test, or department", [["All statuses", [...new Set(results.map((result) => result.status))]]], { dates: true })}</section>
      <div class="laboratory-analytics-grid"><section class="card turnaround-card"><div class="card-head"><div><h3 class="card-title">Laboratory Turnaround Time</h3><p class="card-subtitle">Average request-to-verification time by weekday.</p></div><label class="compact-select"><span class="sr-only">Turnaround period</span>${select("turnaroundPeriod", [{ value: "today", label: "Today" }, { value: "week", label: "This Week" }, { value: "month", label: "This Month" }], state.adminTurnaroundPeriod, "data-admin-turnaround-period")}</label></div><div class="card-body">${turnaroundChart}</div></section><section class="card department-card"><div class="card-head"><div><h3 class="card-title">Laboratory Department Activity</h3><p class="card-subtitle">Workload derived from current laboratory requests.</p></div>${icon("test")}</div><div class="card-body department-list">${departmentHtml}</div></section></div>
      <section class="card attention-card dashboard-attention-full"><div class="card-head"><div><h3 class="card-title">Requires Attention</h3><p class="card-subtitle">Items that may need administrator or laboratory staff action.</p></div>${icon("alert")}</div><div class="card-body attention-list">${attentionItems.map(([count, label, page, tone, iconName]) => `<button type="button" class="attention-item attention-${tone}" data-go-page="${page}"><span>${icon(iconName)}</span><strong>${h(count)}</strong><small>${h(label)}</small>${icon("arrow")}</button>`).join("")}</div></section>`;
  }

  function renderUsers() {
    const rows = state.data.users.map((user) => [identity(user.name, `@${user.username}`, user.email, user.avatar), `${badge(user.role)}<span class="cell-sub">${h(user.assignedFacility || "Unassigned")}</span>`, badge(user.status), `<div class="row-actions"><button class="row-action" data-drawer="user" data-id="${user.id}" aria-label="Edit user">${icon("edit")}</button><button class="row-action" data-toggle-user="${user.id}" data-status="${user.status === "Active" ? "Inactive" : "Active"}" aria-label="${user.status === "Active" ? "Deactivate user" : "Activate user"}">${icon(user.status === "Active" ? "lock" : "check")}</button><button class="row-action row-action-danger" data-delete-user="${user.id}" data-user-name="${h(user.name)}" aria-label="Delete user">${icon("trash")}</button></div>`]);
    return `${heading(...pageMeta.Admin.users, `<button class="btn btn-primary" data-drawer="user">${icon("plus")} Add User</button>`)}
      <div class="stats-grid">${stat("Total Users", state.data.users.length, "users")}${stat("Active Users", state.data.users.filter((u) => u.status === "Active").length, "check", "-", "green")}${stat("Doctors", state.data.users.filter((u) => u.role === "Doctor").length, "doctor", "-", "blue")}${stat("Patients", state.data.users.filter((u) => u.role === "Patient").length, "user", "-", "orange")}</div>
      ${filters("Search users", [["All roles", ["Admin", "Doctor", "Laboratory Staff", "Patient"]], ["All statuses", ["Active", "Inactive"]]])}
      ${table(["User", "Role & Facility", "Status", "Actions"], rows)}`;
  }

  function renderFacilities() {
    const rows = state.data.facilities.map((facility) => [`<span class="cell-strong">${h(facility.name)}</span><span class="cell-sub">${h(facility.address)}</span>`, `<span class="cell-strong">${h(facility.phone || "No phone")}</span><span class="cell-sub">${h(facility.email || "No email")}</span>`, `<span class="cell-strong">${h(facility.activeOrders)} open requests</span><span class="cell-sub">${h(facility.activeTests)} active tests</span>`, badge(facility.status), `<button class="btn btn-secondary btn-sm" data-drawer="facility" data-id="${facility.id}">Edit</button>`]);
    return `${heading(...pageMeta.Admin.facilities, `<button class="btn btn-primary" data-drawer="facility">${icon("plus")} Add Facility</button>`)}
      <div class="stats-grid">${stat("Facilities", state.data.facilities.length, "facility")}${stat("Active", state.data.facilities.filter((f) => f.status === "Active").length, "check", "-", "green")}${stat("Open Requests", state.data.facilities.reduce((sum, f) => sum + Number(f.activeOrders || 0), 0), "orders", "-", "blue")}${stat("Active Tests", state.data.tests.filter((t) => t.status === "Active").length, "test", "-", "purple")}</div>
      ${filters("Search facilities", [["All statuses", ["Active", "Inactive"]]])}
      ${table(["Facility", "Contact", "Activity", "Status", "Action"], rows)}`;
  }

  function renderAdminManagementDashboard() {
    const users = state.data.users || [];
    const facilities = state.data.facilities || [];
    const audit = state.data.audit || [];
    const notifications = state.data.notifications || [];
    const maintenance = state.data.maintenance || {};
    const activeUsers = users.filter((user) => user.status === "Active");
    const inactiveUsers = users.filter((user) => user.status !== "Active");
    const activeFacilities = facilities.filter((facility) => facility.status === "Active");
    const inactiveFacilities = facilities.filter((facility) => facility.status !== "Active");
    const unassignedUsers = users.filter((user) => ["Doctor", "Laboratory Staff"].includes(user.role) && !user.assignedFacilityId && !user.assignedFacility);
    const unreadNotifications = notifications.filter((notification) => !notification.isRead);
    const recentUsers = users.slice(0, Math.max(5, previewLimit())).map((user) => [identity(user.name, `@${user.username}`, user.email, user.avatar), badge(user.role), h(user.assignedFacility || "Unassigned"), badge(user.status), `<button class="btn btn-secondary btn-sm" type="button" data-drawer="user" data-id="${user.id}">Manage</button>`]);
    const facilityRows = facilities.slice(0, Math.max(5, previewLimit())).map((facility) => [`<span class="cell-strong">${h(facility.name)}</span><span class="cell-sub">${h(facility.address || "No address")}</span>`, `<span class="cell-strong">${h(facility.phone || "No phone")}</span><span class="cell-sub">${h(facility.email || "No email")}</span>`, badge(facility.status), `<button class="btn btn-secondary btn-sm" type="button" data-drawer="facility" data-id="${facility.id}">Manage</button>`]);
    const auditRows = audit.slice(0, Math.max(6, previewLimit())).map((item) => [`<time datetime="${h(item.createdAt)}">${shortDateTime(item.createdAt)}</time>`, person(item.userName, item.role), badge(item.action), h(item.module), `<span class="cell-wrap">${h(item.details)}</span>`]);
    const governanceItems = [
      [inactiveUsers.length, "Inactive user accounts", "Review who should retain access.", "users", "lock"],
      [unassignedUsers.length, "Users without a facility", "Assign doctors and laboratory staff to a facility.", "users", "facility"],
      [inactiveFacilities.length, "Inactive facilities", "Review facilities that are unavailable to users.", "facilities", "facility"],
      [unreadNotifications.length, "Unread system notifications", "Review recent system and account updates.", "notifications", "bell"],
      [maintenance.isEnabled ? 1 : 0, "Maintenance restrictions active", maintenance.isEnabled ? "Review the current access restrictions." : "No access restrictions are currently enabled.", "maintenance", "maintenance"],
    ];
    return `${heading("Administration Overview", "Manage user access, facilities, system availability, and administrative activity.", `<button class="btn btn-secondary" data-go-page="audit">${icon("audit")} Audit Trail</button><button class="btn btn-primary" data-drawer="user">${icon("plus")} New User</button>`)}
      <div class="stats-grid admin-management-stats">${stat("Total Users", users.length, "users", "-", "teal")}${stat("Active Users", activeUsers.length, "check", "-", "green")}${stat("Active Facilities", activeFacilities.length, "facility", "-", "blue")}${stat("Audit Events", audit.length, "audit", "-", "purple")}</div>
      <div class="admin-management-grid"><section class="dashboard-section"><div class="section-heading"><div><h3>User Administration</h3><p>Recently added accounts, roles, facility assignments, and access status.</p></div><button class="card-link" type="button" data-go-page="users">Manage all users</button></div>${table(["User", "Role", "Facility", "Status", "Action"], recentUsers)}</section><section class="card admin-governance-card"><div class="card-head"><div><h3 class="card-title">Governance Review</h3><p class="card-subtitle">Administrative items that may require attention.</p></div></div><div class="card-body admin-governance-list">${governanceItems.map(([count, label, copy, page, iconName]) => `<button type="button" class="admin-governance-item" data-go-page="${page}"><span class="admin-governance-icon">${icon(iconName)}</span><span class="admin-governance-copy"><strong>${h(label)}</strong><small>${h(copy)}</small></span><b>${h(count)}</b>${icon("arrow")}</button>`).join("")}</div></section></div>
      <section class="dashboard-section"><div class="section-heading"><div><h3>Facility Administration</h3><p>Manage registered facilities, contact information, and availability.</p></div><button class="card-link" type="button" data-go-page="facilities">Manage all facilities</button></div>${table(["Facility", "Contact", "Status", "Action"], facilityRows)}</section>
      <section class="dashboard-section"><div class="section-heading"><div><h3>Recent Administrative Activity</h3><p>Latest account, facility, security, and configuration events.</p></div><button class="card-link" type="button" data-go-page="audit">View complete audit trail</button></div>${table(["Time", "Administrator", "Action", "Module", "Details"], auditRows)}</section>`;
  }

  function renderTests() {
    const rows = state.data.tests.map((test) => [`<span class="cell-strong" style="color:var(--teal-800)">${h(test.name)}</span><span class="cell-sub">${h(test.code)}</span>`, `<span class="cell-strong">${h(test.category)}</span><span class="cell-sub">${h(test.sampleType)}</span>`, `<span class="cell-strong">${h(test.turnaroundTime)}</span><span class="cell-sub">${money(test.price)}</span>`, badge(test.status), `<button class="btn btn-secondary btn-sm" data-drawer="test" data-id="${test.id}">Edit</button>`]);
    return `${heading(...pageMeta.Admin.tests, `<button class="btn btn-primary" data-drawer="test">${icon("plus")} Add Test</button>`)}
      <div class="stats-grid">${stat("Test Definitions", state.data.tests.length, "test")}${stat("Active Tests", state.data.tests.filter((t) => t.status === "Active").length, "check", "-", "green")}${stat("Categories", new Set(state.data.tests.map((t) => t.category)).size, "chart", "-", "blue")}${stat("Average Price", money(state.data.tests.reduce((sum, t) => sum + Number(t.price || 0), 0) / Math.max(1, state.data.tests.length)), "file", "-", "purple")}</div>
      ${filters("Search test name or code", [["All categories", [...new Set(state.data.tests.map((t) => t.category))]], ["All samples", [...new Set(state.data.tests.map((t) => t.sampleType))]], ["All statuses", ["Active", "Inactive"]]])}
      ${table(["Test", "Category & Sample", "Turnaround & Price", "Status", "Action"], rows)}`;
  }

  function renderOrders(titleRole = currentUser.role, pageKey = "orders") {
    const rows = state.data.orders.map((order) => [`<span class="cell-strong" style="color:var(--teal-800)">${h(order.orderNumber)}</span><span class="cell-sub">Created <time datetime="${h(order.createdAt)}">${shortDateTime(order.createdAt)}</time></span><span class="cell-sub">Updated ${shortDateTime(order.updatedAt || order.createdAt)}</span>`, identity(order.patientName, order.patientCode, "", order.patientAvatar), `<span class="cell-strong">${h(order.doctorName)}</span><span class="cell-sub">${h(order.facilityName)}</span>`, `<span class="cell-wrap">${h(order.tests)}</span>`, `${badge(order.priority)} ${badge(order.status)}`, `<button class="btn btn-secondary btn-sm" data-drawer="order" data-id="${order.id}">View</button>`]);
    const meta = pageMeta[titleRole]?.[pageKey] || pageMeta[titleRole]?.orders || pageMeta.Admin.orders;
    const action = titleRole === "Doctor" ? `<button class="btn btn-primary" data-go-page="create-order">${icon("plus")} New Laboratory Request</button>` : "";
    return `${heading(...meta, action)}
      <div class="stats-grid">${stat("Requests", state.data.orders.length, "orders")}${stat("Open", state.data.orders.filter((o) => !["Released", "Rejected", "Cancelled"].includes(o.status)).length, "clock", "-", "orange")}${stat("Released", state.data.orders.filter((o) => o.status === "Released").length, "check", "-", "green")}${stat("Priority", state.data.orders.filter((o) => o.priority === "Priority").length, "alert", "-", "red")}</div>
      ${filters("Search request, patient, clinician, or test", [["All statuses", Object.keys(state.data.reports.ordersByStatus || {})], ["All facilities", state.data.facilities.map((f) => f.name)], ["All priorities", ["Regular", "Priority"]]], "", { dates: true })}
      ${table(["Request", "Patient", "Clinician & Facility", "Tests", "Workflow", "Action"], rows)}`;
  }

  function renderResults(titleRole = currentUser.role) {
    const rows = state.data.results.map((result) => [`<span class="cell-strong" style="color:var(--teal-800)">${h(result.resultNumber)}</span><span class="cell-sub">Request ${h(result.orderNumber)}</span><span class="cell-sub"><time datetime="${h(result.createdAt || result.uploadedAt)}">${shortDateTime(result.releasedAt || result.updatedAt || result.uploadedAt)}</time></span>`, identity(result.patientName, result.patientCode), `<span class="cell-strong">${h(result.testName)}</span><span class="cell-sub">${h(result.facilityName)}</span>`, badge(result.status), `<span class="cell-wrap">${h(result.clinicalNote || "No clinical note yet")}</span>`, `<button class="btn btn-secondary btn-sm" data-drawer="result" data-id="${result.id}">View</button>`]);
    const meta = pageMeta[titleRole]?.results || pageMeta.Admin.results;
    return `${heading(...meta)}
      <div class="stats-grid">${stat("Results", state.data.results.length, "results")}${stat("Pending Review", state.data.results.filter((r) => r.status === "Pending Review").length, "clock", "-", "orange")}${stat("Verified", state.data.results.filter((r) => r.status === "Verified").length, "check", "-", "green")}${stat("Released", state.data.results.filter((r) => r.status === "Released").length, "download", "-", "blue")}</div>
      ${filters("Search result, request, patient, or test", [["All statuses", Object.keys(state.data.reports.resultsByStatus || {})], ["All facilities", state.data.facilities.map((f) => f.name)]], "", { dates: true })}
      ${table(["Result", "Patient", "Test & Facility", "Status", "Clinical Note", "Action"], rows)}`;
  }

  const reportViews = [["trends", "Trend Analysis"], ["utilization", "Laboratory Utilization"], ["forecast", "Laboratory Demand Forecast"], ["overview", "Activity Summary"]];
  function renderReports() {
    const facilityRows = Object.entries(state.data.reports.ordersByFacility || {}).map(([facility, count]) => ({ cells: [h(facility), h(count), `${Math.round((count / Math.max(1, state.data.orders.length)) * 100)}%`], goPage: "facilities" }));
    const testRows = Object.entries(state.data.reports.topTests || {}).map(([test, count]) => ({ cells: [h(test), h(count), badge(count > 1 ? "Active" : "Pending")], goPage: "tests" }));
    const requestedView = new URLSearchParams(location.search).get("report");
    const activeView = reportViews.some(([key]) => key === requestedView) ? requestedView : "trends";
    const navigation = `<nav class="report-navigation" aria-label="Statistics reports">${reportViews.map(([key, label]) => `<button type="button" data-report-view="${key}" aria-current="${key === activeView ? 'page' : 'false'}">${h(label)}</button>`).join("")}</nav>`;
    const reportBody = activeView === "trends" ? trendAnalysisSection() : activeView === "utilization" ? utilizationAnalyticsSection() : activeView === "forecast" ? forecastingAnalysisSection() : `<div class="report-overview"><h2>Activity Summary</h2><p>Current request and result status across the clinic.</p><div class="stats-grid stats-eight">${dashboardStats()}</div><div class="charts-pair">${donutCard("Requests by Status", state.data.reports.ordersByStatus, "Requests")}${donutCard("Results by Status", state.data.reports.resultsByStatus, "Results")}</div><div class="dashboard-grid">${filteredTable(["Facility", "Requests", "Share"], facilityRows, "Requests per facility", "Search facility")}${filteredTable(["Requested Test", "Count", "Status"], testRows, "Most requested tests", "Search laboratory test", [["All statuses", ["Active", "Pending"]]])}</div></div>`;
    return `<div class="reports-workspace"><div class="reports-toolbar">${navigation}<button class="btn btn-secondary report-export" type="button" data-download>${icon("download")} Export report</button></div><div id="report-view">${reportBody}</div></div>`;
  }

  function renderAudit() {
    const rows = state.data.audit.map((item) => [`<time datetime="${h(item.createdAt)}">${shortDateTime(item.createdAt)}</time>`, person(item.userName, item.role), badge(item.action), h(item.module), `<span class="cell-wrap">${h(item.details)}</span>`, h(item.ipAddress)]);
    return `${heading(...pageMeta.Admin.audit)}
      ${filters("Search user, details, module, or IP", [["All users", [...new Set(state.data.audit.map((a) => a.userName))]], ["All modules", [...new Set(state.data.audit.map((a) => a.module))]], ["All actions", [...new Set(state.data.audit.map((a) => a.action))]]], "", { dates: true })}
      ${table(["Time", "User", "Action", "Module", "Details", "IP"], rows)}`;
  }

  function renderNotifications(role = currentUser.role) {
    const meta = pageMeta[role].notifications;
    return `${heading(...meta, `<button class="btn btn-secondary" data-mark-read>${icon("check")} Mark all as read</button>`)}
      <div class="stats-grid">${stat("Notifications", state.data.notifications.length, "bell")}${stat("Unread", state.data.notifications.filter((n) => !n.isRead).length, "alert", "-", "orange")}${stat("Result Alerts", state.data.notifications.filter((n) => n.type === "results").length, "results", "-", "green")}${stat("Request Updates", state.data.notifications.filter((n) => n.type === "orders").length, "orders", "-", "blue")}</div>
      ${filters("Search notifications", [["All types", [...new Set(state.data.notifications.map((n) => n.type))]]], `<button class="btn btn-secondary" data-mark-read>Mark all as read</button>`)}
      <div class="notification-sections"><section><h3 class="notification-section-title">All Updates</h3><div class="card">${notificationArticles(state.data.notifications)}</div></section></div>`;
  }

  function renderRoleProfile(role, color = "teal") {
    return `${heading(...pageMeta[role].profile)}
      <div class="settings-grid"><section class="card settings-card"><div class="settings-card-head"><div><h3>Account Information</h3><p>${h(currentUser.assignedFacility || "System-wide account")}</p></div>${avatar(currentUser.avatar, color)}</div><div class="info-display-grid"><div class="info-display"><span>Name</span><strong>${h(currentUser.name)}</strong></div><div class="info-display"><span>Email</span><strong>${h(currentUser.email)}</strong></div><div class="info-display"><span>Username</span><strong>${h(currentUser.username || "-")}</strong></div><div class="info-display"><span>Contact</span><strong>${h(currentUser.contact || "-")}</strong></div><div class="info-display"><span>Role</span><strong>${h(currentUser.role)}</strong></div><div class="info-display"><span>Assigned Facility</span><strong>${h(currentUser.assignedFacility || "Not assigned")}</strong></div></div></section></div>`;
  }

  function renderAdminProfile() {
    return renderRoleProfile("Admin");
  }

  function renderAdminSettings() {
    return `${heading(...pageMeta.Admin.settings)}
      <div class="settings-grid"><section class="card settings-card"><div class="settings-card-head"><div><h3>Security</h3><p>Update the password for your administrator account.</p></div>${icon("shield")}</div><button class="btn btn-secondary" data-drawer="password">Change Password</button></section>${accessibilityCard()}<section class="card settings-card"><div class="settings-card-head"><div><h3>Role Permissions</h3><p>Access is assigned according to each clinic role.</p></div>${icon("lock")}</div>${["Admin", "Doctor", "Laboratory Staff", "Patient"].map((role) => `<div class="setting-row"><div><strong>${h(role)}</strong><p>${role === "Admin" ? "Full system access" : "Role-scoped records and workflow actions"}</p></div><span class="badge badge-green">Enforced</span></div>`).join("")}</section></div>`;
  }

  function renderAdminMaintenance() {
    const settings = state.data.maintenance || {};
    const enabled = Boolean(settings.isEnabled);
    const activeText = settings.isActive ? "Enabled" : enabled ? "Scheduled" : "Disabled";
    const nextAction = enabled ? "Disable Maintenance Mode" : "Enable Maintenance Mode";
    return `${heading(...pageMeta.Admin.maintenance)}
      <div class="maintenance-simple-layout">
        <section class="card maintenance-hero-card ${enabled ? "is-enabled" : "is-disabled"}">
          <div class="maintenance-hero-top">
            <span class="maintenance-hero-icon">${icon(enabled ? "alert" : "shield")}</span>
            <span class="maintenance-status-badge ${enabled ? "enabled" : "disabled"}">${h(activeText)}</span>
          </div>
          <h3>Maintenance Mode is ${enabled ? "enabled" : "disabled"}</h3>
          <p>When active, the selected non-admin roles or modules are redirected to the maintenance page. Admin users retain access so maintenance can be disabled safely.</p>
          <div class="maintenance-preview"><strong>Public message</strong><p>${h(settings.message || "The system is currently undergoing maintenance. Please try again later.")}</p>${settings.reason ? `<small>${h(settings.reason)}</small>` : ""}</div>
        </section>

        <section class="card maintenance-form-card maintenance-control-card">
          <form data-form="maintenance">
            <div class="settings-card-head">
              <div><h3>Maintenance Settings</h3><p>Use this only when the system needs temporary downtime or controlled access.</p></div>
              ${toggle(enabled, "Enabled", 'name="isEnabled" value="1"')}
            </div>
            <div class="maintenance-warning">${icon("alert")} Enabling maintenance mode will prevent patients, doctors, and lab staff from accessing the system.</div>
            <div class="form-grid">
              <div class="form-field full"><label>Access Scope</label>${select("scope", [
                { value: "all", label: "All non-admin users" },
                { value: "roles", label: "Selected roles" },
                { value: "pages", label: "Selected modules/pages" },
              ], settings.scope || "all")}</div>
              <fieldset class="form-field full maintenance-options" data-maintenance-options="roles" ${settings.scope !== "roles" ? "hidden" : ""}><legend>Affected Roles</legend>
                <div class="maintenance-option-grid">${(uiConfig().roles || ["Admin", "Doctor", "Laboratory Staff", "Patient"]).filter((role) => role !== "Admin").map((role) => `<label class="maintenance-option"><input type="checkbox" name="affectedRoles" value="${h(role)}" ${(settings.affectedRoles || []).includes(role) ? "checked" : ""}><span>${h(role)}</span></label>`).join("")}</div>
              </fieldset>
              <fieldset class="form-field full maintenance-options" data-maintenance-options="pages" ${settings.scope !== "pages" ? "hidden" : ""}><legend>Affected Modules</legend>
                <div class="maintenance-option-grid maintenance-module-grid">${(uiConfig().maintenancePages || ["dashboard", "orders", "results", "notifications", "settings", "patients", "facilities", "create-order", "upload", "review", "queue", "profile", "registration"]).map((page) => `<label class="maintenance-option"><input type="checkbox" name="affectedPages" value="${h(page)}" ${(settings.affectedPages || []).includes(page) ? "checked" : ""}><span>${h({ orders: "laboratory requests", "create-order": "new laboratory request" }[page] || page.replace("-", " "))}</span></label>`).join("")}</div>
              </fieldset>
              ${field("Maintenance Message", "message", settings.message || "", "textarea", "rows=\"4\" required maxlength=\"255\"")}
              ${field("Reason", "reason", settings.reason || "", "text", "maxlength=\"255\" placeholder=\"Optional internal or public reason\"")}
              ${field("Start Date & Time", "startAt", datetimeInputValue(settings.startAt), "datetime-local")}
              ${field("End Date & Time", "endAt", datetimeInputValue(settings.endAt), "datetime-local")}
            </div>
            <div class="form-actions"><button class="btn ${enabled ? "btn-danger" : "btn-primary"}" type="submit">${icon(enabled ? "close" : "check")} ${h(nextAction)}</button></div>
          </form>
        </section>
      </div>`;
  }

  function renderDoctorDashboard() {
    const orders = state.data.orders || [];
    const results = state.data.results || [];
    const activeOrders = orders.filter((order) => !["Released", "Rejected", "Cancelled"].includes(order.status));
    const criticalResults = results.filter((result) => (result.values || []).some((value) => String(value.flag).toLowerCase() === "critical"));
    const startOfWeek = new Date();
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
    const releasedThisWeek = results.filter((result) => result.releasedAt && new Date(result.releasedAt) >= startOfWeek);
    const patientRows = state.data.patients.slice(0, Math.max(previewLimit(), 6)).map((patient) => [identity(patient.name, patient.patientCode, patient.email, patient.avatar), `<time datetime="${h(patient.dateOfBirth || "")}">${h(patient.dateOfBirth || "No birth date")}</time><span class="cell-sub">${h(patient.sex || "Not recorded")}</span>`, h(patient.primaryFacility || "-"), badge(patient.latestStatus || "Pending"), `<button class="btn btn-secondary btn-sm" data-drawer="patient" data-id="${patient.id}">View</button>`]);
    const criticalRows = criticalResults.slice(0, previewLimit()).map((result) => {
      const value = (result.values || []).find((item) => String(item.flag).toLowerCase() === "critical") || {};
      return [identity(result.patientName, result.patientCode), h(value.parameter || result.testName), `<strong class="critical-value">${h([value.value, value.unit].filter(Boolean).join(" ") || "Flagged")}</strong>`, h(value.referenceRange || "Not provided"), shortDateTime(result.releasedAt || result.verifiedAt || result.updatedAt), `<button class="btn btn-secondary btn-sm" type="button" data-drawer="result" data-id="${result.id}">Review</button>`];
    });
    const resultRows = results.slice(0, previewLimit()).map((result) => [`<span class="cell-strong">${h(result.resultNumber)}</span><span class="cell-sub">${h(result.orderNumber)}</span>`, identity(result.patientName, result.patientCode), `<span class="cell-strong">${h(result.testName)}</span><span class="cell-sub">${h(result.facilityName)}</span>`, badge(result.status), `<button class="btn btn-secondary btn-sm" type="button" data-drawer="result" data-id="${result.id}">Review</button>`]);
    return `${heading(...pageMeta.Doctor.dashboard, `<button class="btn btn-secondary" data-go-page="results">${icon("results")} Results</button><button class="btn btn-primary" data-go-page="create-order">${icon("plus")} New Laboratory Request</button>`)}
      <div class="stats-grid role-dashboard-stats">${stat("Active Requests", activeOrders.length, "orders")}${stat("Awaiting Sample", orders.filter((order) => ["Pending", "Pending Sample"].includes(order.status)).length, "clock", "-", "orange")}${stat("Results Available", results.length, "results", "-", "green")}${stat("Critical Results", criticalResults.length, "alert", "-", "red")}${stat("Patients With Activity", state.data.patients.length, "users", "-", "blue")}${stat("Released This Week", releasedThisWeek.length, "check", "-", "teal")}</div>
      <section class="role-dashboard-section"><div class="section-heading"><div><h3>Patients</h3><p>Patients with laboratory activity, shown before their results.</p></div><button class="card-link" type="button" data-go-page="patients">View all patients</button></div>${filteredTable(["Patient", "DOB & Sex", "Facility", "Status", "Action"], patientRows, "Patients", "Search patient name, ID, or email", [["All genders", ["Female", "Male", "Prefer not to say"]], ["All statuses", [...new Set(state.data.patients.map((patient) => patient.latestStatus))]]], { dates: true })}</section>
      <section class="role-dashboard-section"><div class="section-heading"><div><h3>Critical Results</h3><p>Verified or released results containing structured critical values.</p></div><button class="card-link" type="button" data-go-page="results">View all results</button></div>${filteredTable(["Patient", "Laboratory Test", "Result", "Reference Range", "Released", "Action"], criticalRows, "Critical results", "Search patient, test, or result", [], { dates: true })}</section>
      <section class="role-dashboard-section"><div class="section-heading"><div><h3>Recent Patient Results</h3><p>Latest verified and released results available for clinical review.</p></div></div>${filteredTable(["Result", "Patient", "Test & Facility", "Status", "Action"], resultRows, "Recent results", "Search result, patient, test, or facility", [["All statuses", [...new Set(results.map((result) => result.status))]]])}</section>`;
  }

  function renderPatients(role = currentUser.role) {
    const meta = pageMeta[role].patients;
    const rows = state.data.patients.map((patient) => [identity(patient.name, patient.patientCode, patient.email, patient.avatar), `<time datetime="${h(patient.dateOfBirth || "")}">${h(patient.dateOfBirth || "No birth date")}</time><span class="cell-sub">${h(patient.sex || "Not recorded")}</span>`, h(patient.primaryFacility || "-"), `<span class="cell-wrap">${h(patient.latestTests || "No tests")}</span>${badge(patient.latestStatus || "Pending")}`, `<button class="btn btn-secondary btn-sm" data-drawer="patient" data-id="${patient.id}">View</button>`]);
    return `${heading(...meta)}
      <div class="stats-grid">${stat("Patients", state.data.patients.length, "users")}${stat("With Requests", state.data.patients.filter((p) => p.orderCount > 0).length, "orders", "-", "blue")}${stat("Released Results", state.data.patients.reduce((sum, p) => sum + Number(p.resultCount || 0), 0), "results", "-", "green")}${stat("Facilities", new Set(state.data.patients.map((p) => p.primaryFacility).filter(Boolean)).size, "facility", "-", "purple")}</div>
      ${filters("Search patient name, ID, or email", [["All genders", ["Female", "Male", "Prefer not to say"]], ["All statuses", [...new Set(state.data.patients.map((p) => p.latestStatus))]], ["All facilities", state.data.facilities.map((f) => f.name)]], "", { dates: true })}
      ${table(["Patient", "DOB & Sex", "Facility", "Latest Activity", "Action"], rows)}`;
  }

  function renderDoctorFacilities() {
    const facilityRows = state.data.facilities.map((facility) => [h(facility.name), h(facility.address), h(facility.phone), badge(facility.status), h(facility.activeOrders), `<button class="btn btn-secondary btn-sm" data-drawer="facility" data-id="${facility.id}">View</button>`]);
    return `${heading(...pageMeta.Doctor.facilities)}
      <div class="stats-grid">${stat("Facilities", state.data.facilities.length, "facility")}${stat("Active", state.data.facilities.filter((f) => f.status === "Active").length, "check", "-", "green")}${stat("Open Requests", state.data.facilities.reduce((sum, f) => sum + Number(f.activeOrders || 0), 0), "orders", "-", "blue")}</div>
      ${filters("Search facility name or address", [["All statuses", ["Active", "Inactive"]]])}${table(["Facility", "Address", "Phone", "Status", "Open Requests", "Action"], facilityRows)}`;
  }

  function renderDoctorTests() {
    const testRows = state.data.tests.map((test) => [`<span class="cell-strong">${h(test.name)}</span><span class="cell-sub">${h(test.code)}</span>`, `<span class="cell-strong">${h(test.category)}</span><span class="cell-sub">${h(test.sampleType)}</span>`, `<span class="cell-strong">${h(test.turnaroundTime)}</span><span class="cell-sub">${money(test.price)}</span>`, badge(test.status), `<button class="btn btn-secondary btn-sm" data-drawer="test" data-id="${test.id}">View</button>`]);
    return `${heading(...pageMeta.Doctor.tests)}<div class="stats-grid">${stat("Tests", state.data.tests.length, "test")}${stat("Active", state.data.tests.filter((t) => t.status === "Active").length, "check", "-", "green")}${stat("Categories", new Set(state.data.tests.map((t) => t.category)).size, "chart", "-", "blue")}${stat("Fastest TAT", state.data.tests[0]?.turnaroundTime || "-", "clock", "-", "orange")}</div>${filters("Search test name or code", [["All categories", [...new Set(state.data.tests.map((t) => t.category))]], ["All samples", [...new Set(state.data.tests.map((t) => t.sampleType))]], ["All statuses", ["Active", "Inactive"]]])}${table(["Test", "Category & Sample", "Turnaround & Price", "Status", "Action"], testRows)}`;
  }

  function renderCreateOrder() {
    const patientOptions = state.data.availablePatients.map((patient) => ({ value: patient.id, label: `${patient.name} - ${patient.patientCode}` }));
    const facilityOptions = state.data.facilities.filter((facility) => facility.status === "Active").map((facility) => ({ value: facility.id, label: facility.name }));
    const activeTests = state.data.tests.filter((test) => test.status === "Active");
    const cannotSubmit = !patientOptions.length || !facilityOptions.length || !activeTests.length;
    const disabled = cannotSubmit ? "disabled" : "";
    const patientSelect = patientOptions.length ? select("patientId", patientOptions, patientOptions[0]?.value || "", "required") : '<select name="patientId" required disabled><option>No active patients</option></select>';
    const facilitySelect = facilityOptions.length ? select("facilityId", facilityOptions, facilityOptions[0]?.value || "", "required") : '<select name="facilityId" required disabled><option>No active facilities</option></select>';
    const defaultTestId = activeTests.find((test) => test.code === "CBC")?.id || activeTests[0]?.id || "";
    const testsMarkup = activeTests.length
      ? activeTests.map((test) => `<label class="test-choice-card"><input type="checkbox" name="testIds" value="${test.id}" ${String(test.id) === String(defaultTestId) ? "checked" : ""} ${disabled}><span><strong>${h(test.code)} - ${h(test.name)}</strong><small>${h(test.category)} / ${h(test.sampleType)} / ${h(test.turnaroundTime)}</small></span></label>`).join("")
      : '<div class="empty-state">No active laboratory tests are available.</div>';
    const formHint = cannotSubmit ? '<div class="form-hint">Add at least one active patient, facility, doctor, and test before submitting a laboratory request.</div>' : "";
    const meta = pageMeta[currentUser.role]["create-order"] || pageMeta.Doctor["create-order"];
    return `${heading(...meta)}
      <div class="create-order-layout"><section class="card"><div class="card-head"><div><h3 class="card-title">Available Patients</h3><p class="card-subtitle">Choose from database patient records.</p></div></div><div class="recent-patient-list">${state.data.availablePatients.slice(0, previewLimit()).map((patient, index) => `<button class="recent-patient ${index === 0 ? "selected" : ""}" type="button" data-patient-pick="${patient.id}">${avatar(patient.avatar)}<div><strong>${h(patient.name)}</strong><span>${h(patient.patientCode)} - ${h(patient.sex || "No sex recorded")}</span></div></button>`).join("")}</div></section>
      <form class="card order-compose-card" data-form="create-order"><div class="card-head" style="padding:0 0 17px"><div><h3 class="card-title">Laboratory Request Details</h3><p class="card-subtitle">Complete the four sections in order. New requests begin as Pending.</p></div>${badge("Pending")}</div>${formHint}<div class="request-form-sections"><fieldset class="request-form-section"><legend><span>1</span> Patient</legend><div class="form-field full"><label>Search and select patient</label>${patientSelect}</div></fieldset><fieldset class="request-form-section"><legend><span>2</span> Facility</legend><div class="form-field full"><label>Select destination laboratory facility</label>${facilitySelect}<small>All active facilities in the centralized laboratory network are available.</small></div></fieldset><fieldset class="request-form-section"><legend><span>3</span> Requested Tests</legend><div class="form-field full"><label>Select one or more laboratory tests</label><div class="test-choice-grid">${testsMarkup}</div></div></fieldset><fieldset class="request-form-section"><legend><span>4</span> Request Details</legend><div class="form-grid"><div class="form-field"><label>Priority</label>${select("priority", ["Regular", "Priority"], "Regular", disabled)}</div><div class="form-field"><label>Status</label><div class="readonly-pill">${badge("Pending")} Laboratory staff updates this after intake.</div></div><div class="form-field full"><label>Clinical Indication / Notes</label><textarea name="clinicalNotes" ${disabled} placeholder="Clinical indication, provisional diagnosis, or special instructions"></textarea></div></div></fieldset></div><div class="form-actions"><button class="btn btn-secondary" type="button" data-go-page="orders">Cancel</button><button class="btn btn-primary" type="submit" ${disabled}>${icon("plus-file")} Submit Laboratory Request</button></div></form>
      <aside class="card order-summary"><p class="eyebrow">Request Summary</p><h3 class="card-title">Clinical workflow</h3><div class="clinical-note-box"><h4>${icon("shield")} Notifications included</h4><p>Submitting creates a laboratory request, notifies laboratory staff and the patient, and writes an audit record.</p></div></aside></div>`;
  }

  function renderDoctorProfile() {
    return renderRoleProfile("Doctor");
  }

  function renderDoctorSettings() {
    return `${heading(...pageMeta.Doctor.settings)}<div class="doctor-settings"><div class="doctor-settings-grid"><section class="card settings-card"><div class="settings-card-head"><div><h3>Security</h3><p>Update your account password.</p></div>${icon("shield")}</div><button class="btn btn-secondary" data-drawer="password">Change Password</button></section>${accessibilityCard()}</div></div>`;
  }

  function renderLabDashboard() {
    const orders = state.data.orders || [];
    const results = state.data.results || [];
    const now = new Date();
    const todayKey = now.toLocaleDateString("en-CA");
    const delayed = orders.filter((order) => !["Released", "Rejected", "Cancelled"].includes(order.status) && now - new Date(order.createdAt) > 48 * 3600000);
    const critical = results.filter((result) => (result.values || []).some((value) => String(value.flag).toLowerCase() === "critical"));
    const priorityOrders = [...orders].filter((order) => !["Released", "Rejected", "Cancelled"].includes(order.status)).sort((a, b) => {
      const score = (order) => (order.priority === "Priority" || order.priority === "Urgent" ? 2 : 0) + (delayed.includes(order) ? 1 : 0);
      return score(b) - score(a) || new Date(a.createdAt) - new Date(b.createdAt);
    });
    const orderRows = priorityOrders.slice(0, Math.max(previewLimit(), 6)).map((order) => [h(order.orderNumber), `<span class="cell-strong">${h(order.patientName)}</span><span class="cell-sub">${h(order.patientCode)}</span>`, h(order.tests), badge(order.priority), badge(delayed.includes(order) ? "Delayed" : order.status), `<time datetime="${h(order.createdAt)}">${shortDateTime(order.createdAt)}</time>`, `<button class="btn btn-secondary btn-sm" data-drawer="order" data-id="${order.id}">Process</button>`]);
    const pendingResults = results.filter((result) => result.status === "Pending Review");
    const resultRows = pendingResults.slice(0, previewLimit()).map((result) => [h(result.resultNumber), h(result.orderNumber), `<span class="cell-strong">${h(result.patientName)}</span><span class="cell-sub">${h(result.patientCode)}</span>`, h(result.testName), `<time datetime="${h(result.updatedAt || result.createdAt)}">${shortDateTime(result.updatedAt || result.createdAt)}</time>`, `<button class="btn btn-secondary btn-sm" type="button" data-drawer="result" data-id="${result.id}">Review</button>`]);
    const issueRows = orders.filter((order) => order.status === "Rejected" || /recollect|new sample|repeat sample/i.test(String(order.latestUpdate || ""))).slice(0, previewLimit()).map((order) => [h(order.orderNumber), h(order.patientCode), h(order.tests), badge(order.status === "Rejected" ? "Rejected" : "Pending Sample"), h(order.latestUpdate || "Specimen requires attention"), `<button class="btn btn-secondary btn-sm" data-drawer="order" data-id="${order.id}">View</button>`]);
    return `${heading(...pageMeta["Laboratory Staff"].dashboard)}
      <div class="stats-grid role-dashboard-stats">${stat("Assigned Today", orders.filter((order) => new Date(order.createdAt).toLocaleDateString("en-CA") === todayKey).length, "orders")}${stat("Awaiting Collection", orders.filter((order) => ["Pending", "Pending Sample", "Accepted"].includes(order.status)).length, "clock", "-", "orange")}${stat("Processing", orders.filter((order) => ["Sample Collected", "Processing", "In Progress"].includes(order.status)).length, "activity", "-", "blue")}${stat("Awaiting Verification", pendingResults.length, "review", "-", "orange")}${stat("Critical Results", critical.length, "alert", "-", "red")}${stat("Delayed Requests", delayed.length, "clock", "-", "red")}</div>
      <section class="role-dashboard-section"><div class="section-heading"><div><h3>Priority Work Queue</h3><p>Urgent and delayed requests are listed first.</p></div><button class="card-link" type="button" data-go-page="queue">Open full queue</button></div>${filteredTable(["Request No.", "Patient", "Tests", "Priority", "Status", "Received", "Action"], orderRows, "Assigned laboratory requests", "Search request, patient, or test", [["All priorities", ["Regular", "Priority", "Urgent"]], ["All statuses", [...new Set(priorityOrders.map((order) => delayed.includes(order) ? "Delayed" : order.status))]]], { dates: true })}</section>
      <div class="role-dashboard-split"><section class="role-dashboard-section"><div class="section-heading"><div><h3>Awaiting Verification</h3><p>Uploaded results ready for laboratory review.</p></div></div>${filteredTable(["Result", "Request", "Patient", "Test", "Updated", "Action"], resultRows, "Results awaiting verification", "Search result, request, patient, or test", [], { dates: true })}</section><section class="card attention-card"><div class="card-head"><div><h3 class="card-title">Current Workload</h3><p class="card-subtitle">Open requests by assigned facility.</p></div></div><div class="card-body">${chartFromCounts(state.data.reports.ordersByFacility)}</div></section></div>
      <section class="role-dashboard-section"><div class="section-heading"><div><h3>Specimen Issues</h3><p>Rejected samples and requests that mention recollection.</p></div></div>${filteredTable(["Request", "Patient ID", "Tests", "Status", "Latest Update", "Action"], issueRows, "Specimen issues", "Search request, patient, or test", [["All statuses", ["Rejected", "Pending Sample"]]])}</section>`;
  }

  function renderLabUpload() {
    const activeResultOrderIds = new Set(state.data.results.filter((result) => result.status !== "Rejected").map((result) => String(result.orderId)));
    const uploadStatuses = new Set(["Pending", "Pending Sample", "Accepted", "Sample Collected", "Processing", "In Progress"]);
    const eligible = state.data.orders.filter((order) => uploadStatuses.has(order.status) && !activeResultOrderIds.has(String(order.id)));
    const orderOptions = eligible.map((order) => ({ value: order.id, label: `${order.orderNumber} - ${order.patientName} - ${order.tests}` }));
    const queueRows = eligible.map((order) => [h(order.orderNumber), h(order.patientName), h(order.tests), badge(order.priority), badge(order.status), `<button class="btn btn-secondary btn-sm" data-drawer="order" data-id="${order.id}">View</button>`]);
    const disabled = eligible.length ? "" : "disabled";
    const orderSelect = eligible.length ? select("orderId", orderOptions, orderOptions[0]?.value || "", "required") : '<select name="orderId" required disabled><option>No eligible laboratory requests</option></select>';
    const defaultValueRows = resultValueInputRow({}, disabled);
    return `${heading(...pageMeta["Laboratory Staff"].upload)}
      <div class="upload-layout"><form class="card upload-panel" data-form="upload-result"><div class="card-head form-card-head"><div><h3 class="card-title">Structured Result Entry</h3><p class="card-subtitle">Saved as a pending-review result.</p></div>${icon("upload")}</div><div class="form-grid"><div class="form-field full"><label>Laboratory Request</label>${orderSelect}</div><section class="result-scanner full" aria-labelledby="result-scanner-title"><div class="result-scanner-copy"><span class="result-scanner-icon">${icon("scan")}</span><div><h3 id="result-scanner-title">Scan Laboratory Result</h3><p>PDF, JPG, PNG, or WEBP up to 10 MB. PDFs scan the first five pages. OCR fills the form but never submits it.</p></div></div><div class="result-scanner-controls"><button class="btn btn-secondary" type="button" data-open-result-camera ${disabled}>${icon("camera")} Take Photo</button><button class="btn btn-secondary" type="button" data-choose-result-image ${disabled}>${icon("file")} Choose File</button><button class="btn btn-primary" type="button" data-scan-result ${disabled}>${icon("scan")} Scan and Fill Values</button><input class="result-scan-file-input" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" data-result-scan-input ${disabled}></div><div class="result-camera-panel" data-result-camera-panel hidden><video data-result-camera-video autoplay playsinline muted></video><canvas data-result-camera-canvas hidden></canvas><div class="result-camera-actions"><button class="btn btn-primary" type="button" data-capture-result-photo>${icon("camera")} Capture Photo</button><button class="btn btn-secondary" type="button" data-close-result-camera>Cancel Camera</button></div></div><img class="result-scan-preview" alt="Selected laboratory result preview" data-result-scan-preview hidden><div class="result-scan-file-actions"><button class="btn btn-secondary btn-sm" type="button" data-rotate-result-image disabled>${icon("activity")} Rotate 90°</button><button class="btn btn-secondary btn-sm" type="button" data-remove-result-source disabled>${icon("trash")} Remove source</button></div><label class="register-check result-source-choice"><input type="checkbox" data-include-result-source checked><span>Keep the selected source report as a protected result attachment.</span></label><progress class="result-scan-progress" max="100" value="0" data-result-scan-progress hidden></progress><p class="result-scan-status" role="status" aria-live="polite" data-result-scan-status>Select a sharp, straight-on image with the complete result table visible.</p><details class="result-scan-output" data-result-scan-output hidden><summary>Review text detected in file</summary><pre data-result-scan-text></pre></details><div class="result-scan-warning">${icon("alert")} OCR can misread decimal points, units, or flags. Rows below 75% confidence are highlighted. Compare every field with the source before uploading.</div></section><div class="form-field full"><label>Findings Summary</label><textarea name="findings" required ${disabled} placeholder="Enter laboratory findings"></textarea></div><div class="form-field full"><label>Remarks</label><textarea name="remarks" ${disabled} placeholder="Specimen notes, QC notes, or review comments"></textarea></div><div class="form-field full"><label>Additional Result Attachments</label><input name="attachments" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" multiple ${disabled}><small>Add up to five protected reports or images, maximum 10 MB each.</small></div></div><h3 class="form-section-title">${icon("activity")} Result Values</h3>${resultValueTable(defaultValueRows, disabled)}<div class="form-actions"><button class="btn btn-secondary" type="button" data-go-page="orders">Cancel</button><button class="btn btn-primary" type="submit" ${disabled}>${icon("upload")} Upload Result</button></div></form><section class="upload-queue-section" aria-label="Requests available for result upload">${filteredTable(["Request No.", "Patient", "Tests", "Priority", "Status", "Action"], queueRows, "Requests available for result upload", "Search request, patient, or test", [["All priorities", ["Regular", "Priority", "Urgent"]], ["All statuses", [...uploadStatuses]]])}</section></div>`;
  }

  function renderLabReview() {
    const resultRow = (result) => [`<span class="cell-strong">${h(result.resultNumber)}</span><span class="cell-sub">${h(result.orderNumber)}</span>`, identity(result.patientName, result.patientCode), `<span class="cell-strong">${h(result.testName)}</span><span class="cell-sub">${h(result.facilityName)}</span>`, badge(result.status), `<time datetime="${h(result.releasedAt || result.updatedAt || result.uploadedAt)}">${shortDateTime(result.releasedAt || result.updatedAt || result.uploadedAt)}</time>`, `<button class="btn btn-secondary btn-sm" type="button" data-drawer="result" data-id="${result.id}">Review</button>`];
    const pendingRows = state.data.results.filter((result) => result.status === "Pending Review").map(resultRow);
    const verifiedRows = state.data.results.filter((result) => result.status === "Verified").map(resultRow);
    const completedRows = state.data.results.filter((result) => ["Released", "Rejected"].includes(result.status)).map(resultRow);
    const columns = ["Result", "Patient", "Test & Facility", "Status", "Updated/Released", "Action"];
    return `${heading(...pageMeta["Laboratory Staff"].review)}
      <div class="stats-grid">${stat("Results", state.data.results.length, "results")}${stat("Pending Review", state.data.results.filter((r) => r.status === "Pending Review").length, "clock", "-", "orange")}${stat("Verified", state.data.results.filter((r) => r.status === "Verified").length, "check", "-", "green")}${stat("Released", state.data.results.filter((r) => r.status === "Released").length, "download", "-", "blue")}</div>
      ${filters("Search result, patient, test, or facility", [["All facilities", [...new Set(state.data.results.map((r) => r.facilityName))]]], "", { dates: true })}
      <div class="result-review-sections"><section><h3>Pending Review</h3>${table(columns, pendingRows, "No results are waiting for verification.")}</section><section><h3>Verified Results</h3>${table(columns, verifiedRows, "No verified results are waiting for release.")}</section><section><h3>Released and Rejected Results</h3>${table(columns, completedRows, "No completed result records.")}</section></div>`;
  }

  function renderLabFacilities() {
    const cards = state.data.facilities.map((facility) => `<article class="card facility-card"><div class="facility-card-cover"><span class="facility-mini-icon">${icon("facility")}</span></div><div class="facility-card-body"><h3>${h(facility.name)}</h3><p class="facility-address">${h(facility.address)}</p><div class="facility-contact"><span>${icon("phone")} ${h(facility.phone)}</span><span>${icon("mail")} ${h(facility.email || "-")}</span></div><div class="facility-metrics"><div class="facility-metric"><strong>${h(facility.activeOrders)}</strong><span>Open requests</span></div><div class="facility-metric"><strong>${h(facility.activeTests)}</strong><span>Active tests</span></div></div>${badge(facility.status)}</div></article>`).join("");
    return `${heading(...pageMeta["Laboratory Staff"].facilities)}<div class="facilities-card-grid">${cards || '<section class="card"><div class="empty-state">No assigned facilities.</div></section>'}</div>`;
  }

  function renderLabProfile() {
    return renderRoleProfile("Laboratory Staff", "purple");
  }

  function renderLabSettings() {
    return `${heading(...pageMeta["Laboratory Staff"].settings)}<div class="lab-settings-layout"><div class="lab-settings-grid"><section class="card settings-card"><div class="settings-card-head"><div><h3>Security</h3><p>Change your password.</p></div>${icon("shield")}</div><button class="btn btn-secondary" data-drawer="password">Change Password</button></section>${accessibilityCard()}</div></div>`;
  }

  function renderPatientDashboard() {
    const orders = state.data.orders || [];
    const results = state.data.results || [];
    const activeOrders = orders.filter((order) => !["Released", "Rejected", "Cancelled"].includes(order.status));
    const currentOrder = activeOrders[0] || orders[0] || null;
    const stages = ["Requested", "Sample Collected", "Processing", "Verification", "Available"];
    const stageForStatus = { Pending: 0, "Pending Sample": 0, Accepted: 0, "Sample Collected": 1, Processing: 2, "In Progress": 2, "Result Uploaded": 3, "Pending Review": 3, Verified: 3, Released: 4 };
    const currentStage = currentOrder ? (stageForStatus[currentOrder.status] ?? 0) : -1;
    const progress = currentOrder ? `<div class="patient-request-summary"><div><span>Current request</span><strong>${h(currentOrder.orderNumber)}</strong><small>${h(currentOrder.tests)} · ${h(currentOrder.facilityName)}</small></div>${badge(currentOrder.status)}</div><div class="patient-progress" aria-label="Current laboratory request progress">${stages.map((label, index) => `<div class="patient-progress-step ${index < currentStage ? "complete" : index === currentStage ? "current" : ""}"><i></i><span>${h(label)}</span></div>`).join("")}</div><p class="patient-latest-update">${h(currentOrder.latestUpdate || "Your laboratory request is being processed.")}</p>` : '<div class="empty-state">You do not have any laboratory requests yet.</div>';
    const actionItems = activeOrders.filter((order) => ["Pending", "Pending Sample", "Rejected"].includes(order.status) || /recollect|new sample|repeat sample/i.test(String(order.latestUpdate || ""))).slice(0, 4);
    const orderRows = orders.slice(0, previewLimit()).map((order) => [h(order.orderNumber), h(order.tests), h(order.facilityName), badge(order.status), `<time datetime="${h(order.createdAt)}">${shortDate(order.createdAt)}</time>`, `<button class="btn btn-secondary btn-sm" data-drawer="order" data-id="${order.id}">View</button>`]);
    const resultRows = results.slice(0, previewLimit()).map((result) => [h(result.resultNumber), h(result.testName), h(result.facilityName), `<time datetime="${h(result.releasedAt)}">${shortDateTime(result.releasedAt)}</time>`, `<button class="btn btn-primary btn-sm" data-drawer="result" data-id="${result.id}">View Result</button>`]);
    return `${heading(...pageMeta.Patient.dashboard)}
      <div class="stats-grid patient-summary-stats">${stat("Active Requests", activeOrders.length, "orders")}${stat("Processing", orders.filter((order) => ["Sample Collected", "Processing", "In Progress", "Result Uploaded", "Pending Review"].includes(order.status)).length, "activity", "-", "blue")}${stat("Results Available", results.length, "results", "-", "green")}${stat("Completed Requests", orders.filter((order) => order.status === "Released").length, "check", "-", "teal")}</div>
      <section class="card patient-current-request"><div class="card-head"><div><h3 class="card-title">Current Request Status</h3><p class="card-subtitle">Follow your latest laboratory request from submission to availability.</p></div></div><div class="card-body">${progress}</div></section>
      <div class="patient-dashboard-priority"><section class="role-dashboard-section"><div class="section-heading"><div><h3>Available Results</h3><p>Only verified and released results linked to your patient profile are shown.</p></div><button class="card-link" type="button" data-go-page="results">View all results</button></div>${filteredTable(["Result ID", "Test", "Facility", "Released", "Action"], resultRows, "Available laboratory results", "Search result, test, or facility", [["All facilities", [...new Set(results.map((result) => result.facilityName))]]], { dates: true })}</section><section class="card patient-action-card"><div class="card-head"><div><h3 class="card-title">Required Actions</h3><p class="card-subtitle">Steps needed to keep your requests moving.</p></div></div><div class="card-body patient-action-list">${actionItems.length ? actionItems.map((order) => `<button type="button" data-drawer="order" data-id="${order.id}"><strong>${h(order.status === "Rejected" ? "Contact the laboratory" : "Sample collection required")}</strong><span>${h(order.orderNumber)} · ${h(order.latestUpdate || order.tests)}</span></button>`).join("") : '<div class="empty-state">No action is required from you right now.</div>'}</div></section></div>
      <section class="role-dashboard-section"><div class="section-heading"><div><h3>Recent Laboratory Requests</h3><p>Your latest requests and their current status.</p></div></div>${filteredTable(["Request No.", "Tests", "Facility", "Status", "Date", "Action"], orderRows, "Recent laboratory requests", "Search request, test, or facility", [["All statuses", [...new Set(orders.map((order) => order.status))]], ["All facilities", [...new Set(orders.map((order) => order.facilityName))]]], { dates: true })}</section>
      <div class="privacy-banner privacy-banner-compact">${icon("shield")} Only records linked to patient ID ${h(currentUser.patientProfileId)} are visible in this portal.</div>`;
  }

  function renderPatientProfile() {
    const patient = state.data.patients[0] || {};
    return `${heading(...pageMeta.Patient.profile)}
      <div class="privacy-banner">${icon("shield")} Your profile changes are saved to the database and audited.</div>
      <div class="patient-profile-layout"><aside class="card patient-profile-card"><div class="patient-profile-avatar">${h(currentUser.avatar)}</div><h3>${h(currentUser.name)}</h3><p>Patient portal account</p><span class="profile-id-badge">${h(currentUser.patientProfileId)}</span></aside><form class="patient-profile-stack" data-form="patient-profile"><section class="card settings-card"><div class="settings-card-head"><div><h3>Personal Information</h3><p>Your contact and identification details.</p></div>${icon("user")}</div><div class="form-grid"><div class="form-field full"><label>Email Address</label><input name="email" type="email" value="${h(currentUser.email)}" required></div><div class="form-field"><label>Date of Birth</label><input name="dateOfBirth" type="date" value="${h(patient.dateOfBirth || "")}"></div><div class="form-field"><label>Sex</label>${select("sex", [{ value: "", label: "Select sex" }, "Female", "Male", "Prefer not to say"], patient.sex || "")}</div><div class="form-field"><label>Contact Number</label><input name="contact" value="${h(currentUser.contact || "")}"></div><div class="form-field full"><label>Address</label><input name="address" value="${h(patient.address || currentUser.address || "")}"></div></div></section><section class="card settings-card"><div class="settings-card-head"><div><h3>Primary Facility</h3><p>${h(patient.primaryFacility || currentUser.assignedFacility || "Not assigned")}</p></div>${icon("facility")}</div><div class="info-display-grid"><div class="info-display"><span>Patient ID</span><strong>${h(currentUser.patientProfileId)}</strong></div><div class="info-display"><span>Visible Results</span><strong>${h(state.data.results.length)}</strong></div></div></section><div class="form-actions"><button class="btn btn-secondary" type="button" data-go-page="dashboard">Cancel</button><button class="btn btn-primary" type="submit">Save Profile</button></div></form></div>`;
  }

  function renderPatientSettings() {
    return `${heading(...pageMeta.Patient.settings)}
      <div class="patient-settings"><div class="patient-settings-grid"><section class="card settings-card"><div class="settings-card-head"><div><h3>Account Settings</h3><p>Manage sign-in and privacy.</p></div>${icon("user")}</div><div class="info-display-grid"><div class="info-display"><span>Email</span><strong>${h(currentUser.email)}</strong></div><div class="info-display"><span>Username</span><strong>${h(currentUser.username)}</strong></div></div><button class="btn btn-secondary" style="margin-top:14px" data-drawer="password">Change Password</button></section><section class="card settings-card"><div class="settings-card-head"><div><h3>Privacy Settings</h3><p>Patients can only see released own results.</p></div>${icon("lock")}</div><div class="clinical-note-box"><h4>${icon("shield")} Data access notice</h4><p>API filtering restricts your portal to patient profile ${h(currentUser.patientProfileId)}.</p></div><div class="patient-download-box"><div><strong>Download records</strong><p>Export your currently visible database-backed records.</p></div><button class="btn btn-primary btn-sm" data-download>${icon("download")} Download</button></div></section>${accessibilityCard()}</div></div>`;
  }

  const renderers = {
    Admin: { dashboard: renderAdminManagementDashboard, users: renderUsers, facilities: renderFacilities, tests: renderTests, orders: () => renderOrders("Admin"), results: () => renderResults("Admin"), reports: renderReports, audit: renderAudit, notifications: () => renderNotifications("Admin"), maintenance: renderAdminMaintenance, profile: renderAdminProfile, settings: renderAdminSettings },
    Doctor: { dashboard: renderDoctorDashboard, patients: () => renderPatients("Doctor"), facilities: renderDoctorFacilities, tests: renderDoctorTests, "create-order": renderCreateOrder, orders: () => renderOrders("Doctor"), results: () => renderResults("Doctor"), notifications: () => renderNotifications("Doctor"), profile: renderDoctorProfile, settings: renderDoctorSettings },
    "Laboratory Staff": { dashboard: renderLabDashboard, orders: () => renderOrders("Laboratory Staff"), upload: renderLabUpload, review: renderLabReview, facilities: renderLabFacilities, queue: () => renderOrders("Laboratory Staff", "queue"), notifications: () => renderNotifications("Laboratory Staff"), profile: renderLabProfile, settings: renderLabSettings },
    Patient: { dashboard: renderPatientDashboard, orders: () => renderOrders("Patient"), results: () => renderResults("Patient"), notifications: () => renderNotifications("Patient"), profile: renderPatientProfile, settings: renderPatientSettings },
  };

  async function loadAppData(page = "dashboard") {
    const data = await api("app_data", { page });
    state.data = data;
    currentUser = data.currentUser || currentUser;
    state.collectionLoadedAt.clear();
    state.metadataLoadedAt = Date.now();
    rememberCollections(data, page);
    (data.loadedPages || [page]).forEach((loadedPage) => state.pageLoadedAt.set(loadedPage, Date.now()));
    hydrateProfile();
  }

  function pageDataKeys(page) {
    const role = currentUser?.role;
    const map = {
      dashboard: role === "Admin" ? ["users", "facilities", "tests", "orders", "results", "notifications", "audit"] : role === "Doctor" ? ["patients", "orders", "results", "notifications"] : role === "Patient" ? ["patients", "orders", "results", "notifications"] : ["orders", "results", "notifications"],
      users: ["users", "facilities"], facilities: ["facilities"], tests: ["tests"], patients: ["patients", "facilities"],
      "create-order": ["patients", "availablePatients", "facilities", "tests"], orders: ["orders", "facilities"], queue: ["orders", "facilities"], upload: ["orders", "results"],
      review: ["results"], results: ["results", "facilities"], reports: ["users", "facilities", "tests", "orders", "results", "notifications"],
      audit: ["audit"], notifications: ["notifications"], profile: role === "Patient" ? ["patients", "results"] : [], settings: [], maintenance: [],
    };
    return map[page] || [];
  }

  function rememberCollections(data, page) {
    const keys = data.loadedCollections || pageDataKeys(page);
    keys.forEach((key) => { if (Array.isArray(data[key])) state.collectionLoadedAt.set(key, Date.now()); });
    return keys;
  }

  function pageHasData(page) {
    return pageDataKeys(page).every((key) => state.collectionLoadedAt.has(key));
  }

  function missingPageCollections(page, force = false) {
    return pageDataKeys(page).filter((key) => force || !state.collectionLoadedAt.has(key) || Date.now() - state.collectionLoadedAt.get(key) >= PAGE_CACHE_TTL);
  }

  async function warmPanelCache() {
    const role = currentUser?.role;
    const pages = role === "Admin" ? ["tests", "orders", "results"] : role === "Doctor" ? ["orders", "facilities", "tests"] : ["orders"];
    for (const page of ["dashboard", ...pages]) {
      if (!currentUser || currentUser.role !== role || document.hidden || navigator.connection?.saveData || state.pageRequests.size) return;
      if (!pageHasData(page)) {
        await ensurePageData(page);
        if (!pageHasData(page)) return; // Do not keep retrying an unavailable server.
      }
    }
  }

  async function ensurePageData(page, force = false) {
    const collections = missingPageCollections(page, force);
    if (!force && !collections.length && Date.now() - state.metadataLoadedAt < PAGE_CACHE_TTL) return;
    if (state.pageRequests.has(page)) return state.pageRequests.get(page);
    state.loadingPages.add(page);
    const startedAt = Date.now();
    const request = (async () => { try {
      const fresh = await api("page_data", { page, collections: [...new Set(collections.map((key) => key === "availablePatients" ? "patients" : key))] });
      (fresh.loadedCollections || pageDataKeys(page)).forEach((key) => {
        if (Array.isArray(fresh[key]) && (state.collectionLoadedAt.get(key) || 0) <= startedAt) {
          state.data[key] = fresh[key];
          state.collectionLoadedAt.set(key, Date.now());
        }
      });
      state.metadataLoadedAt = Date.now();
      state.data.maintenance = fresh.maintenance || state.data.maintenance;
      state.data.uiConfig = fresh.uiConfig || state.data.uiConfig;
      state.data.loadedPages = [...new Set([...(state.data.loadedPages || []), page])];
      state.pageLoadedAt.set(page, Date.now());
      rebuildDerivedData();
      if (state.page === page && !document.activeElement?.closest("form")) setPage(page, false);
    } catch (error) {
      if (state.page === page) {
        toast(error.message || "This page could not be loaded.", "error");
        if (!pageHasData(page) && $("#page-content")) $("#page-content").innerHTML = `<section class="card"><div class="empty-state"><h3>Unable to load this page</h3><p>${h(error.message || "Check your connection and try again.")}</p><button class="btn btn-primary" type="button" data-retry-page="${h(page)}">Try again</button></div></section>`;
      }
    } finally {
      state.loadingPages.delete(page);
      state.pageRequests.delete(page);
    } })();
    state.pageRequests.set(page, request);
    return request;
  }

  async function pollNotifications() {
    if (document.hidden || notificationPollPending || !state.data || !currentUser) return;
    notificationPollPending = true;
    try {
      const payload = await api("notifications", { limit: 50 });
      if (Array.isArray(payload.notifications)) {
        const previous = state.data.notifications || [];
        const merged = [...payload.notifications, ...previous.filter((item) => !payload.notifications.some((fresh) => fresh.id === item.id))]
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const changed = JSON.stringify(merged) !== JSON.stringify(previous);
        syncNotifications(merged);
        if (changed && currentUser?.role === "Laboratory Staff") {
          ["orders", "results", "patients"].forEach((key) => state.collectionLoadedAt.set(key, 0));
          if (["dashboard", "orders", "upload", "review", "queue"].includes(state.page)) ensurePageData(state.page, true);
        }
        if (changed && state.page === "notifications" && !document.activeElement?.closest("form")) setPage("notifications", false);
      }
      notificationPollDelay = 30000;
    } catch (error) {
      if (error.status === 401) {
        clearTimeout(notificationPollTimer);
        notificationPollTimer = null;
        currentUser = null;
        return;
      }
      notificationPollDelay = Math.min(notificationPollDelay * 2, 300000);
    } finally {
      notificationPollPending = false;
      if (currentUser) notificationPollTimer = setTimeout(pollNotifications, notificationPollDelay);
    }
  }

  function startNotificationPolling() {
    if (notificationPollTimer) clearTimeout(notificationPollTimer);
    notificationPollDelay = 30000;
    notificationPollTimer = setTimeout(pollNotifications, notificationPollDelay);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) pollNotifications(); });
  }

  function setPage(requested = "dashboard", updateHash = true) {
    hideTooltip();
    stopResultCamera();
    const role = currentUser.role;
    const roleRenderers = renderers[role] || {};
    const page = roleRenderers[requested] ? requested : "dashboard";
    if (!pageHasData(page)) {
      state.page = page;
      if (updateHash && location.hash !== `#${page}`) history.pushState(null, "", `#${page}`);
      const meta = pageMeta[role]?.[page] || pageMeta[role]?.dashboard || ["Dashboard"];
      if ($("#page-title")) $("#page-title").textContent = meta[0];
      if ($("#page-content")) $("#page-content").innerHTML = loading();
      ensurePageData(page);
      return;
    }
    const liveFacilityPage = (role === "Laboratory Staff" && ["dashboard", "orders", "upload", "review", "queue"].includes(page))
      || (role === "Doctor" && ["dashboard", "patients", "create-order", "orders", "results"].includes(page));
    if (liveFacilityPage) ensurePageData(page, true);
    else if (missingPageCollections(page).length || Date.now() - state.metadataLoadedAt >= PAGE_CACHE_TTL) ensurePageData(page);
    const maintenance = state.data?.maintenance;
    const roleBlocked = maintenance?.scope === "all"
      || (maintenance?.scope === "roles" && (maintenance.affectedRoles || []).includes(role));
    const pageBlocked = maintenance?.scope === "pages" && (maintenance.affectedPages || []).includes(page);
    if (role !== "Admin" && maintenance?.isActive && (roleBlocked || pageBlocked)) {
      location.href = window.CLINIC_MAINTENANCE_URL || "../maintenance.php";
      return;
    }
    const renderer = roleRenderers[page];
    if (!renderer) {
      $("#page-content").innerHTML = '<section class="card"><div class="empty-state">This workspace is not available for your role.</div></section>';
      return;
    }
    state.page = page;
    $("#page-content").innerHTML = renderer();
    hydrateTooltips($("#page-content"));
    paginateTables($("#page-content"));
    $$(".nav-item").forEach((item) => {
      const active = item.dataset.page === page;
      item.classList.toggle("active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    const meta = pageMeta[role]?.[page] || pageMeta[role]?.dashboard || ["Dashboard"];
    $("#page-title").textContent = meta[0];
    document.title = `${meta[0]} | ${appName()}`;
    const profileDropdown = $(".profile-dropdown");
    if (profileDropdown) profileDropdown.hidden = true;
    $("[data-profile-toggle]")?.setAttribute("aria-expanded", "false");
    if (updateHash && location.hash !== `#${page}`) history.pushState(null, "", `#${page}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
    closeSidebar();
    applyPageFilters();
  }

  function drawerTitle(type) {
    return ({ user: "User Details", facility: "Facility Details", test: "Test Definition", order: "Laboratory Request Details", result: "Result Details", patient: "Patient Details", notification: "Notification Details", password: "Change Password" })[type] || "Details";
  }

  function userForm(user = {}) {
    const roles = uiConfig().roles || ["Admin", "Doctor", "Laboratory Staff", "Patient"];
    const facilityOptions = [{ value: "", label: "Unassigned" }, ...state.data.facilities.map((facility) => ({ value: facility.id, label: facility.name }))];
    return `<form data-form="user"><input type="hidden" name="id" value="${h(user.id || "")}"><div class="form-grid user-form-grid">${field("Full Name", "name", user.name || "", "text", "required")}${field("Email", "email", user.email || "", "email", "required")}${field("Username", "username", user.username || "", "text", 'class="user-compact-input" required minlength="3" maxlength="20" pattern="[A-Za-z0-9._-]{3,20}"')}${field("Contact", "contact", formatPhilippineMobile(user.contact || ""), "tel", 'class="user-compact-input" inputmode="numeric" autocomplete="tel-national" placeholder="09XX-XXX-XXXX" maxlength="13" pattern="09[0-9]{2}-[0-9]{3}-[0-9]{4}" title="Use the format 09XX-XXX-XXXX"')}<div class="form-field"><label>Role</label>${select("role", roles, user.role || "Patient", "required")}</div><div class="form-field"><label>Assigned Facility</label>${select("facilityId", facilityOptions, user.assignedFacilityId || "")}</div><div class="form-field"><label>Status</label>${select("status", ["Active", "Inactive"], user.status || "Active", "required")}</div>${field(user.id ? "New Password (optional)" : "Password", "password", "", "password", user.id ? "" : "required")}</div><div class="form-actions"><button class="btn btn-secondary" type="button" data-close-drawer>Cancel</button><button class="btn btn-primary" type="submit">Save User</button></div></form>`;
  }

  function facilityForm(facility = {}) {
    return `<form data-form="facility"><input type="hidden" name="id" value="${h(facility.id || "")}"><div class="form-grid">${field("Facility Name", "name", facility.name || "")}${field("Address", "address", facility.address || "", "textarea")}${field("Phone", "phone", facility.phone || "")}${field("Email", "email", facility.email || "", "email")}<div class="form-field full"><label>Status</label>${select("status", ["Active", "Inactive"], facility.status || "Active")}</div></div><div class="form-actions"><button class="btn btn-secondary" type="button" data-close-drawer>Cancel</button><button class="btn btn-primary" type="submit">Save Facility</button></div></form>`;
  }

  function validationRuleEditor(rule = {}) {
    return `<fieldset class="validation-rule"><legend>Parameter rule</legend><div class="validation-rule-grid">${field("Parameter name", "ruleParameter", rule.parameter || "", "text", "required")}${field("Unit (1 for dimensionless)", "ruleUnit", rule.unit || "")}${field("Reference minimum", "ruleMinimum", rule.minimum ?? "", "number", 'step="any"')}${field("Reference maximum", "ruleMaximum", rule.maximum ?? "", "number", 'step="any"')}<label><input name="ruleMinimumInclusive" type="checkbox" ${rule.minimumInclusive !== false ? "checked" : ""}> Include minimum boundary</label><label><input name="ruleMaximumInclusive" type="checkbox" ${rule.maximumInclusive !== false ? "checked" : ""}> Include maximum boundary</label>${field("Critical at or below (optional)", "ruleCriticalLow", rule.criticalLow ?? "", "number", 'step="any"')}${field("Critical at or above (optional)", "ruleCriticalHigh", rule.criticalHigh ?? "", "number", 'step="any"')}<label>Value type<select name="ruleType"><option value="numeric" ${rule.type !== "text" ? "selected" : ""}>Numeric</option><option value="text" ${rule.type === "text" ? "selected" : ""}>Qualitative</option></select></label>${field("Permitted qualitative values (comma separated)", "ruleAllowedValues", rule.allowedValues || "")}${field("Approved source / basis and applicability", "ruleSource", rule.source || "", "textarea", "required")}<label><input name="ruleRequired" type="checkbox" ${rule.required !== false ? "checked" : ""}> Required parameter</label></div><button class="btn btn-danger btn-sm" type="button" data-remove-validation-rule>Remove rule</button></fieldset>`;
  }

  function validationReportHtml(report) {
    return `<section class="validation-report" role="status" aria-live="polite"><h3>Result validation</h3>${(report.issues || []).map(issue => `<p class="abnormal">${h(issue)}</p>`).join("")}${(report.warnings || []).map(warning => `<p class="validation-warning">${h(warning)} The entered values will use strict format checks.</p>`).join("")}${report.values.map(value => `<article><strong>${h(value.parameter)}: ${h(value.flag)}</strong><p>${h(value.value)} ${h(value.unit)} &middot; Reference: ${h(value.referenceRange || "Unconfigured")}</p><p>${h(value.validationReason)}</p>${value.validationRule ? `<small>Rule: ${h(value.validationRule.parameter)}. Source: ${h(value.validationRule.source)}${value.validationRule.criticalLow != null ? ` &middot; Critical &le; ${h(value.validationRule.criticalLow)}` : ""}${value.validationRule.criticalHigh != null ? ` &middot; Critical &ge; ${h(value.validationRule.criticalHigh)}` : ""}</small>` : ""}</article>`).join("")}</section>`;
  }

  function showResultValidationErrors(form, report) {
    $$(".result-field-error", form).forEach((element) => element.remove());
    $$(".parameter-input-table input", form).forEach((input) => input.removeAttribute("aria-invalid"));
    const rows = $$(".parameter-input-table tbody tr", form);
    (report.values || []).forEach((value, index) => {
      if (value.flag !== "Invalid Entry" || !rows[index]) return;
      const inputs = $$("input", rows[index]);
      inputs.forEach((input) => input.setAttribute("aria-invalid", "true"));
      const error = document.createElement("small");
      error.className = "result-field-error";
      error.textContent = value.validationReason || "This result row is invalid.";
      rows[index].querySelector("td")?.append(error);
    });
  }

  function validateRequiredResultFields(form, values) {
    const report = { valid: true, issues: [], values: [] };
    const rows = $$(".parameter-input-table tbody tr", form);
    if (!values.length) {
      report.valid = false;
      report.issues.push("At least one result parameter is required.");
      const firstRow = rows[0];
      if (firstRow) report.values.push({ parameter: "Result row", flag: "Invalid Entry", validationReason: "Parameter and result value are required." });
    }
    values.forEach((value, index) => {
      const reasons = [];
      if (!value.parameter.trim()) reasons.push("Parameter is required.");
      if (!value.value.trim()) reasons.push("Result value is required.");
      if (reasons.length) report.valid = false;
      report.values.push({ ...value, flag: reasons.length ? "Invalid Entry" : "", validationReason: reasons.join(" ") });
      if (reasons.length && rows[index]) $$("input", rows[index]).forEach((input) => input.setAttribute("aria-invalid", "true"));
    });
    showResultValidationErrors(form, report);
    return report.valid;
  }

  async function reviewResultValidation(form, payload) {
    if (!validateRequiredResultFields(form, payload.values)) {
      toast("Complete every required result field before validation.", "error");
      return false;
    }
    const { validation } = await api("validate_result", { orderId: payload.orderId, resultId: payload.resultId, values: payload.values });
    showResultValidationErrors(form, validation);
    form.querySelector(".validation-report")?.remove();
    form.querySelector(".form-actions").insertAdjacentHTML("beforebegin", validationReportHtml(validation));
    if (!validation.valid) {
      form.querySelector(".validation-report").scrollIntoView({ block: "nearest", behavior: "smooth" });
      toast("Correct the validation issues shown below the result values.", "error");
      return false;
    }
    const confirmed = await glassDialog({ title: "Confirm laboratory values", message: "Compare every value and unit with the source report and review the validation report. Approved reference ranges and calculated flags will be saved. Abnormal or critical values require professional review; this confirmation does not verify or release the result.", confirmText: "I reviewed the values", detailHtml: validationReportHtml(validation) });
    if (!confirmed) return false;
    payload.validationReviewed = true;
    return true;
  }

  async function validateStoredResultBeforeStatus(result) {
    if (!result) return false;
    const { validation } = await api("validate_result", { resultId: result.id, values: result.values || [] });
    const drawerBody = $("#drawer-body");
    drawerBody?.querySelector(".validation-report")?.remove();
    if (!validation.valid) {
      drawerBody?.insertAdjacentHTML("beforeend", validationReportHtml(validation));
      const invalidValue = (validation.values || []).find(value => value.flag === "Invalid Entry");
      const reason = (validation.issues || [])[0] || invalidValue?.validationReason || "This result must be corrected before verification or release.";
      toast(reason, "error");
      drawerBody?.querySelector(".validation-report")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      return false;
    }
    return true;
  }

  function testForm(test = {}) {
    return `<form data-form="test"><input type="hidden" name="id" value="${h(test.id || "")}"><div class="form-grid">${field("Code", "code", test.code || "")}${field("Name", "name", test.name || "")}${field("Category", "category", test.category || "")}${field("Sample Type", "sampleType", test.sampleType || "")}${field("Turnaround Time", "turnaroundTime", test.turnaroundTime || "")}${field("Price", "price", test.price || "0", "number", 'step="0.01"')}${field("Reference Range", "referenceRange", test.referenceRange || "")}${field("Instructions", "instructions", test.instructions || "", "textarea")}<div class="form-field full"><label>Status</label>${select("status", ["Active", "Inactive"], test.status || "Active")}</div></div><section class="validation-rule-editor"><h3>Approved validation rules</h3><p>Configure rules for the exact parameters in this test. Choose whether each reference boundary is inclusive. Leave a critical limit blank only when it does not apply. Record the approved source and patient applicability. Unconfigured tests cannot pass validation.</p><div data-validation-rules>${(test.validationRules || []).map(validationRuleEditor).join("")}</div><button type="button" class="btn btn-secondary" data-add-validation-rule>Add parameter rule</button></section><div class="form-actions"><button class="btn btn-secondary" type="button" data-close-drawer>Cancel</button><button class="btn btn-primary" type="submit">Save Test</button></div></form>`;
  }

  function facilityDetails(facility) {
    if (!facility) return '<div class="empty-state">Facility not found.</div>';
    return `${drawerInfo([["Facility", h(facility.name)], ["Address", h(facility.address || "-")], ["Phone", h(facility.phone || "-")], ["Email", h(facility.email || "-")], ["Open requests", h(facility.activeOrders || 0)], ["Active tests", h(facility.activeTests || 0)], ["Status", badge(facility.status)]])}`;
  }

  function testDetails(test) {
    if (!test) return '<div class="empty-state">Laboratory test not found.</div>';
    return `${drawerInfo([["Code", h(test.code)], ["Test", h(test.name)], ["Category", h(test.category || "-")], ["Sample type", h(test.sampleType || "-")], ["Turnaround time", h(test.turnaroundTime || "-")], ["Price", h(money(test.price))], ["Reference range", h(test.referenceRange || "-")], ["Status", badge(test.status)]])}<div class="clinical-note-box"><h4>${icon("note")} Instructions</h4><p>${h(test.instructions || "No special instructions.")}</p></div>`;
  }

  function orderDetails(order) {
    if (!order) return '<div class="empty-state">Laboratory request not found.</div>';
    const canUpdateOrder = !["Result Uploaded", "Verified", "Released", "Rejected", "Cancelled"].includes(order.status);
    const transitions = {
      Pending: ["Accepted", "Pending Sample", "Rejected", "Cancelled"],
      "Pending Sample": ["Accepted", "Sample Collected", "Rejected", "Cancelled"],
      Accepted: ["Pending Sample", "Sample Collected", "Rejected", "Cancelled"],
      "Sample Collected": ["Processing", "In Progress", "Rejected", "Cancelled"],
      Processing: ["In Progress", "Rejected", "Cancelled"],
      "In Progress": ["Processing", "Rejected", "Cancelled"],
    };
    const labActions = currentUser.role === "Laboratory Staff" && canUpdateOrder
      ? `<div class="form-actions">${(transitions[order.status] || []).map((status) => `<button class="btn btn-secondary" type="button" data-order-status="${h(status)}" data-id="${order.id}">${h(status)}</button>`).join("")}</div>`
      : "";
    return `${drawerInfo([["Request No.", h(order.orderNumber)], ["Patient", h(order.patientName)], ["Patient ID", h(order.patientCode)], ["Requesting Clinician", h(order.doctorName)], ["Facility", h(order.facilityName)], ["Tests", h(order.tests)], ["Priority", badge(order.priority)], ["Status", badge(order.status)], ["Created", h(shortDateTime(order.createdAt))], ["Updated", h(shortDateTime(order.updatedAt || order.createdAt))]])}<div class="clinical-note-box"><h4>${icon("note")} Clinical Indication / Notes</h4><p>${h(order.clinicalNotes || "No clinical indication entered.")}</p></div>${labActions}`;
  }

  function resultDetails(result) {
    if (!result) return '<div class="empty-state">Result not found.</div>';
    const resultButtons = [
      !["Released", "Rejected"].includes(result.status) ? `<button class="btn btn-secondary" type="button" data-drawer="result-edit" data-id="${result.id}">${icon("edit")} Edit</button>` : "",
      result.status === "Pending Review" ? `<button class="btn btn-success" type="button" data-result-status="Verified" data-id="${result.id}">${icon("check")} Verify</button>` : "",
      ["Pending Review", "Verified"].includes(result.status) ? `<button class="btn btn-danger" type="button" data-reject-result="${result.id}">${icon("close")} Reject</button>` : "",
      result.status === "Verified" ? `<button class="btn btn-blue" type="button" data-release-result="${result.id}">${icon("download")} Release</button>` : "",
    ].join("");
    const labActions = currentUser.role === "Laboratory Staff"
      ? `<div class="form-actions">${resultButtons || '<span class="cell-sub">No review actions available.</span>'}</div>`
      : "";
    const noteForm = currentUser.role === "Doctor"
      ? `<form data-form="clinical-note"><input type="hidden" name="resultId" value="${h(result.id)}"><div class="form-field full"><label>Clinical Note</label><textarea name="note" required>${h(result.clinicalNote || "")}</textarea></div><div class="form-actions"><button class="btn btn-primary" type="submit">Save Clinical Note</button></div></form>`
      : "";
    const canDownload = result.status === "Released";
    const detailDownload = canDownload ? `<a class="btn btn-primary btn-sm" href="${h(apiUrl("download_result_details", { id: result.id }))}" target="_blank" rel="noopener">${icon("download")} Print / Save PDF</a>` : "";
    const files = (result.files || []).length
      ? `<div class="attachment-list">${result.files.map((file) => `<a class="attachment-link" href="${h(API_URL.replace(/[^/]+$/, ""))}${h(file.downloadUrl)}" target="_blank" rel="noopener">${icon("file")} <span>Download Uploaded File: ${h(file.originalName)}</span><small>${Math.round((file.sizeBytes || 0) / 1024)} KB</small></a>`).join("")}</div>`
      : '<p>No files attached.</p>';
    return `${drawerInfo([["Result ID", h(result.resultNumber)], ["Request No.", h(result.orderNumber)], ["Patient", h(result.patientName)], ["Test", h(result.testName)], ["Facility", h(result.facilityName)], ["Created", h(shortDateTime(result.createdAt || result.uploadedAt))], ["Updated", h(shortDateTime(result.updatedAt || result.uploadedAt))], ["Released", h(shortDateTime(result.releasedAt))], ["Status", badge(result.status)], ["Entered by", h(result.uploadedBy || "-")], ["Verified by", h(result.reviewedBy || "-")], ["Released by", h(result.releasedBy || "-")]])}${detailDownload ? `<div class="result-download-actions">${detailDownload}</div>` : ""}<h3 class="form-section-title">${icon("activity")} Result Values</h3>${valuesTable(result.values)}<div class="clinical-note-box"><h4>${icon("file")} Laboratory Findings</h4><p>${h(result.findings || "No findings entered.")}</p><p>${h(result.remarks || "")}</p></div><div class="clinical-note-box"><h4>${icon("file")} Attachments</h4>${files}</div><div class="clinical-note-box" style="border-color:#ddd2f1;background:#f7f3fc"><h4 style="color:var(--purple)">${icon("note")} Clinical Note</h4><p>${h(result.clinicalNote || "No clinical note has been added.")}</p></div>${noteForm}${labActions}`;
  }

  function resultEditForm(result) {
    if (!result) return '<div class="empty-state">Result not found.</div>';
    const rows = (result.values?.length ? result.values : [{ parameter: "", value: "", unit: "", referenceRange: "", flag: "" }]).map((value) => resultValueInputRow(value)).join("");
    return `<form data-form="result-edit"><input type="hidden" name="resultId" value="${h(result.id)}"><input type="hidden" name="expectedUpdatedAt" value="${h(result.updatedAt || result.createdAt || "")}"><div class="form-grid">${field("Findings Summary", "findings", result.findings || "", "textarea", "required")}${field("Remarks", "remarks", result.remarks || "", "textarea")}<div class="form-field full"><label>Add Attachments</label><input name="attachments" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" multiple><small>New files will be added to the result record.</small></div></div><h3 class="form-section-title">${icon("activity")} Result Values</h3>${resultValueTable(rows)}<div class="form-actions"><button class="btn btn-secondary" type="button" data-close-drawer>Cancel</button><button class="btn btn-primary" type="submit">${icon("check")} Save Result</button></div></form>`;
  }

  function patientDetails(patient) {
    if (!patient) return '<div class="empty-state">Patient not found.</div>';
    return `${drawerInfo([["Patient ID", h(patient.patientCode)], ["Name", h(patient.name)], ["Email", h(patient.email)], ["Contact", h(patient.contact || "-")], ["Date of Birth", h(patient.dateOfBirth || "-")], ["Sex", h(patient.sex || "-")], ["Facility", h(patient.primaryFacility || "-")]])}<div class="clinical-note-box"><h4>${icon("shield")} Access Scope</h4><p>This view is filtered by your role and the records connected to your workflow.</p></div>`;
  }

  function notificationDetails(notification) {
    if (!notification) return '<div class="empty-state">Notification not found.</div>';
    return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:18px"><span class="notification-icon">${icon(notification.type || "bell")}</span><div><h3 style="margin:0 0 5px;font-size:15px">${h(notification.title)}</h3>${badge(notification.isRead ? "Active" : "Pending")}</div></div><p style="color:var(--muted);font-size:12px;line-height:1.6">${h(notification.message)}</p>${drawerInfo([["Date", h(shortDateTime(notification.createdAt))], ["Type", h(notification.type)], ["Read", h(notification.isRead ? "Yes" : "No")]])}<div class="form-actions"><button class="btn btn-success" type="button" data-read-notification="${notification.id}">Mark Read</button></div>`;
  }

  function passwordForm() {
    return `<form data-form="password"><div class="form-grid">${field("Current Password", "currentPassword", "", "password", "required")}${field("New Password", "newPassword", "", "password", "required minlength=\"8\"")}${field("Confirm New Password", "confirmPassword", "", "password", "required minlength=\"8\"")}</div><div class="form-actions"><button class="btn btn-secondary" type="button" data-close-drawer>Cancel</button><button class="btn btn-primary" type="submit">Update Password</button></div></form>`;
  }

  function openDrawer(type, id = null) {
    state.activeDrawer = type;
    state.activeRecordId = id;
    const drawer = $(".drawer");
    if (!drawer?.classList.contains("open")) state.lastFocusedElement = document.activeElement;
    const body = $("#drawer-body");
    $("#drawer-title").textContent = drawerTitle(type);
    const content = {
      user: () => userForm(recordBy("users", id)),
      facility: () => currentUser.role === "Admin" ? facilityForm(recordBy("facilities", id)) : facilityDetails(recordBy("facilities", id)),
      test: () => currentUser.role === "Admin" ? testForm(recordBy("tests", id)) : testDetails(recordBy("tests", id)),
      order: () => orderDetails(recordBy("orders", id)),
      result: () => resultDetails(recordBy("results", id)),
      "result-edit": () => resultEditForm(recordBy("results", id)),
      patient: () => patientDetails(recordBy("patients", id) || (state.data.availablePatients || []).find((p) => String(p.id) === String(id))),
      notification: () => notificationDetails(recordBy("notifications", id)),
      password: () => passwordForm(),
    }[type];
    body.innerHTML = content ? content() : '<div class="empty-state">Nothing to show.</div>';
    hydrateTooltips(body);
    drawer.classList.add("open");
    drawer.closest(".popup-layer")?.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    $(".drawer-scrim").classList.add("open");
    document.body.style.overflow = "hidden";
    setTimeout(() => body.querySelector("input, select, textarea, button")?.focus(), 100);
  }

  function closeDrawer() {
    const drawer = $(".drawer");
    if (!drawer) return;
    drawer.classList.remove("open");
    drawer.closest(".popup-layer")?.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    $(".drawer-scrim")?.classList.remove("open");
    document.body.style.overflow = "";
    state.activeDrawer = null;
    state.activeRecordId = null;
    if (state.lastFocusedElement?.isConnected) state.lastFocusedElement.focus();
    state.lastFocusedElement = null;
  }

  function closeReleaseModal() {
    $(".release-modal")?.remove();
  }

  function openReleaseModal(result) {
    if (!result) return;
    closeReleaseModal();
    document.body.insertAdjacentHTML("beforeend", `<div class="release-modal" role="dialog" aria-modal="true" aria-labelledby="release-title"><div class="release-modal-card"><h2 id="release-title">Confirm Result Release</h2><p>Release ${h(result.resultNumber)} for ${h(result.patientName)} / ${h(result.orderNumber)}? Released results become visible to authorized patient and doctor portals.</p><label class="register-check"><input type="checkbox" data-release-confirm-check><span>I confirm that this result has been reviewed and is ready for release.</span></label><div class="form-actions"><button class="btn btn-secondary" type="button" data-release-cancel>Cancel</button><button class="btn btn-blue" type="button" data-release-confirm="${h(result.id)}" disabled>Confirm Release</button></div></div></div>`);
  }

  function openSidebar() {
    $("#sidebar")?.classList.add("open");
    $(".sidebar-scrim")?.classList.add("open");
  }

  function closeSidebar() {
    $("#sidebar")?.classList.remove("open");
    $(".sidebar-scrim")?.classList.remove("open");
  }

  function formObject(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  async function refreshAfter(payload, message) {
    // Keep cached screens available, but refresh collections changed by a save.
    state.collectionLoadedAt.forEach((_, key) => state.collectionLoadedAt.set(key, 0));
    if (payload?.app) {
      state.data = payload.app;
      currentUser = payload.app.currentUser || currentUser;
      state.collectionLoadedAt.clear();
      rememberCollections(payload.app, state.page);
    } else {
      ["users", "facilities", "tests", "patients", "availablePatients", "orders", "results", "notifications", "audit"].forEach((key) => {
        if (Array.isArray(payload?.[key])) {
          state.data[key] = payload[key];
          state.collectionLoadedAt.set(key, Date.now());
        }
      });
      if (payload?.maintenance) state.data.maintenance = payload.maintenance;
      if (payload?.currentUser || payload?.user) currentUser = payload.currentUser || payload.user;
      state.data.currentUser = currentUser;
    }
    rebuildDerivedData();
    state.pageLoadedAt.set(state.page, Date.now());
    hydrateProfile();
    setPage(state.page, false);
    toast(message);
  }

  async function handleDashboardSubmit(event) {
    const form = event.target;
    const kind = form.dataset.form;
    if (!kind) return;
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button?.setAttribute("disabled", "disabled");
    try {
      let payload = formObject(form);
      let result;
      if (kind === "user") {
        payload.contact = formatPhilippineMobile(payload.contact || "");
        result = await api("save_user", payload);
        await refreshAfter(result, "User saved successfully.");
        closeDrawer();
      } else if (kind === "facility") {
        result = await api("save_facility", payload);
        await refreshAfter(result, "Facility saved successfully.");
        closeDrawer();
      } else if (kind === "test") {
        payload.validationRules = $$(".validation-rule", form).map(row => ({
          parameter: $('[name="ruleParameter"]', row).value, unit: $('[name="ruleUnit"]', row).value,
          minimum: $('[name="ruleMinimum"]', row).value, maximum: $('[name="ruleMaximum"]', row).value,
          criticalLow: $('[name="ruleCriticalLow"]', row).value, criticalHigh: $('[name="ruleCriticalHigh"]', row).value,
          minimumInclusive: $('[name="ruleMinimumInclusive"]', row).checked, maximumInclusive: $('[name="ruleMaximumInclusive"]', row).checked,
          type: $('[name="ruleType"]', row).value, source: $('[name="ruleSource"]', row).value,
          allowedValues: $('[name="ruleAllowedValues"]', row).value, required: $('[name="ruleRequired"]', row).checked,
        }));
        result = await api("save_test", payload);
        await refreshAfter(result, "Test definition saved successfully.");
        closeDrawer();
      } else if (kind === "create-order") {
        payload.testIds = $$('input[name="testIds"]:checked', form).map((input) => input.value);
        result = await api("create_order", payload);
        await refreshAfter(result, "Laboratory request submitted.");
        setPage("orders");
      } else if (kind === "upload-result") {
        const includeSource = $("[data-include-result-source]", form)?.checked !== false;
        const additionalFiles = [...($('input[name="attachments"]', form)?.files || [])];
        const sourceFiles = includeSource ? [...($("[data-result-scan-input]", form)?.files || [])] : [];
        const attachmentFiles = [...additionalFiles, ...sourceFiles];
        payload.attachments = await readAttachments(attachmentFiles.filter((file, index, files) => files.findIndex((candidate) => candidate.name === file.name && candidate.size === file.size && candidate.lastModified === file.lastModified) === index), { optional: additionalFiles.length === 0 && sourceFiles.length > 0 });
        payload.values = $$("tbody tr", form).map((row) => ({
          parameter: $('input[name="parameter"]', row)?.value || "",
          value: $('input[name="value"]', row)?.value || "",
          unit: $('input[name="unit"]', row)?.value || "",
          referenceRange: $('input[name="referenceRange"]', row)?.value || "",
          flag: $('input[name="flag"]', row)?.value || "",
        })).filter((item) => item.parameter || item.value);
        if (!await reviewResultValidation(form, payload)) return;
        result = await api("upload_result", payload);
        await refreshAfter(result, "Result uploaded for review.");
        setPage("review");
      } else if (kind === "result-edit") {
        payload.attachments = await readAttachments($('input[name="attachments"]', form)?.files || []);
        payload.values = $$("tbody tr", form).map((row) => ({
          parameter: $('input[name="parameter"]', row)?.value || "",
          value: $('input[name="value"]', row)?.value || "",
          unit: $('input[name="unit"]', row)?.value || "",
          referenceRange: $('input[name="referenceRange"]', row)?.value || "",
          flag: $('input[name="flag"]', row)?.value || "",
        })).filter((item) => item.parameter || item.value);
        if (!await reviewResultValidation(form, payload)) return;
        result = await api("update_result_content", payload);
        await refreshAfter(result, "Result updated.");
        closeDrawer();
      } else if (kind === "clinical-note") {
        result = await api("add_clinical_note", payload);
        await refreshAfter(result, "Clinical note saved.");
        closeDrawer();
      } else if (kind === "patient-profile") {
        result = await api("update_patient_profile", payload);
        await refreshAfter(result, "Profile updated.");
      } else if (kind === "maintenance") {
        payload.isEnabled = Boolean($('input[name="isEnabled"]', form)?.checked);
        payload.affectedRoles = $$('input[name="affectedRoles"]:checked', form).map((input) => input.value);
        payload.affectedPages = $$('input[name="affectedPages"]:checked', form).map((input) => input.value);
        const wasEnabled = Boolean(state.data?.maintenance?.isEnabled);
        if (payload.isEnabled && !wasEnabled && !await glassDialog({ title: "Enable maintenance mode?", message: "Patients, doctors, and laboratory staff covered by this scope will temporarily lose access.", confirmText: "Enable maintenance", danger: true })) {
          return;
        }
        result = await api("save_maintenance_settings", payload);
        await refreshAfter(result, payload.isEnabled ? "Maintenance mode enabled." : "Maintenance mode disabled.");
      } else if (kind === "password") {
        await api("change_password", payload);
        toast("Password changed successfully.");
        closeDrawer();
      }
    } catch (error) {
      if (error.response?.data?.validation) {
        showResultValidationErrors(form, error.response.data.validation);
        form.querySelector(".validation-report")?.remove();
        form.querySelector(".form-actions")?.insertAdjacentHTML("beforebegin", validationReportHtml(error.response.data.validation));
      }
      toast(error.message || "The request failed.", "error");
    } finally {
      button?.removeAttribute("disabled");
    }
  }

  async function handleDashboardClick(event) {
    const passwordToggle = event.target.closest("[data-drawer-password-toggle]");
    if (passwordToggle) {
      const input = document.getElementById(passwordToggle.dataset.drawerPasswordToggle);
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      passwordToggle.setAttribute("aria-pressed", String(show));
      passwordToggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
      return;
    }
    const addRule = event.target.closest("[data-add-validation-rule]");
    if (addRule) { addRule.closest("form").querySelector("[data-validation-rules]").insertAdjacentHTML("beforeend", validationRuleEditor()); return; }
    const removeRule = event.target.closest("[data-remove-validation-rule]");
    if (removeRule) { removeRule.closest(".validation-rule").remove(); return; }

    const retry = event.target.closest("[data-retry-page]");
    if (retry) {
      const page = retry.dataset.retryPage || state.page;
      $("#page-content").innerHTML = loading();
      ensurePageData(page, true);
      return;
    }
    const pageLink = event.target.closest("a[data-page], button[data-page], [data-go-page]");
    const nestedPageControl = pageLink?.matches("tr") && event.target.closest("button, a, input, select, textarea, label");
    if (pageLink && !nestedPageControl) {
      event.preventDefault();
      if (document.body?.dataset.requiredRole === "Doctor" && pageLink.matches('a.nav-item[data-page="facilities"], a.nav-item[data-page="tests"]')) {
        const destination = new URL(pageLink.href, location.href);
        if (destination.pathname !== location.pathname) {
          location.href = destination.href;
          return;
        }
      }
      setPage(pageLink.dataset.page || pageLink.dataset.goPage);
      closeDrawer();
      return;
    }
    const drawerTrigger = event.target.closest("[data-drawer]");
    const interactiveTarget = event.target.closest("button, a, input, select, textarea, label");
    const rowActionHandledElsewhere = drawerTrigger?.matches("tr") && interactiveTarget && interactiveTarget !== drawerTrigger;
    if (drawerTrigger && !rowActionHandledElsewhere) {
      event.preventDefault();
      openDrawer(drawerTrigger.dataset.drawer, drawerTrigger.dataset.id || drawerTrigger.dataset.record || null);
      return;
    }
    if (event.target.closest("[data-close-drawer]")) { closeDrawer(); return; }
    if (event.target.closest("[data-toggle-sidebar]")) { toggleSidebarCollapsed(); return; }
    if (event.target.closest("[data-open-sidebar]")) { openSidebar(); return; }
    if (event.target.closest("[data-close-sidebar]")) { closeSidebar(); return; }
    if (event.target.closest("[data-download]")) {
      downloadRecords().catch((error) => toast(error.message || "The export failed.", "error"));
      return;
    }

    if (event.target.closest("[data-clear-filters]")) {
      const toolbar = event.target.closest(".toolbar");
      $$("input", toolbar).forEach((input) => { input.value = ""; });
      $$("select", toolbar).forEach((control) => { control.selectedIndex = 0; });
      applyPageFilters();
      return;
    }

    const tableSortButton = event.target.closest("[data-table-sort]");
    if (tableSortButton) {
      sortTable(tableSortButton);
      return;
    }

    const tablePageButton = event.target.closest("[data-table-prev], [data-table-next]");
    if (tablePageButton) {
      const card = tablePageButton.closest("[data-paginated-table]");
      card.dataset.tablePage = String(Math.max(1, Number(card.dataset.tablePage || 1) + (tablePageButton.matches("[data-table-next]") ? 1 : -1)));
      paginateTables(card.parentElement || document);
      return;
    }

    const addParameter = event.target.closest("[data-add-result-parameter]");
    if (addParameter) {
      const form = addParameter.closest('form[data-form="upload-result"], form[data-form="result-edit"]');
      const tbody = $(".parameter-input-table tbody", form);
      if (tbody) {
        tbody.insertAdjacentHTML("beforeend", resultValueInputRow());
        const row = tbody.lastElementChild;
        hydrateTooltips(row);
        $('input[name="parameter"]', row)?.focus();
      }
      return;
    }

    const removeParameter = event.target.closest("[data-remove-result-parameter]");
    if (removeParameter) {
      const row = removeParameter.closest("tr");
      const tbody = row?.parentElement;
      if (!row || !tbody) return;
      if (tbody.children.length > 1) row.remove();
      else $$('input', row).forEach((input) => { input.value = ""; });
      return;
    }

    const rotateResultImage = event.target.closest("[data-rotate-result-image]");
    if (rotateResultImage) {
      const form = rotateResultImage.closest('form[data-form="upload-result"]');
      if (!form || !$("[data-result-scan-input]", form)?.files?.length) return;
      form.dataset.scanRotation = String((Number(form.dataset.scanRotation || 0) + 90) % 360);
      const preview = $("[data-result-scan-preview]", form);
      if (preview) preview.style.transform = `rotate(${form.dataset.scanRotation}deg)`;
      scanResultImage(form);
      return;
    }

    const removeResultSource = event.target.closest("[data-remove-result-source]");
    if (removeResultSource) {
      const form = removeResultSource.closest('form[data-form="upload-result"]');
      const input = $("[data-result-scan-input]", form);
      const preview = $("[data-result-scan-preview]", form);
      if (input) input.value = "";
      if (preview?.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
      if (preview) { preview.hidden = true; preview.removeAttribute("src"); preview.style.transform = ""; }
      $$('[data-rotate-result-image], [data-remove-result-source]', form).forEach((button) => { button.disabled = true; });
      form.dataset.scanRotation = "0";
      updateScannerStatus(form, "Source removed. Choose another file or enter values manually.", null, "idle");
      return;
    }

    const reportView = event.target.closest("[data-report-view]");
    if (reportView) {
      const url = new URL(location.href);
      url.searchParams.set("report", reportView.dataset.reportView);
      url.hash = "reports";
      history.pushState(null, "", url);
      setPage("reports", false);
      $(`[data-report-view="${reportView.dataset.reportView}"]`)?.focus({ preventScroll: true });
      return;
    }

    const utilizationPeriod = event.target.closest("[data-utilization-period]");
    if (utilizationPeriod) {
      state.utilization.period = utilizationPeriod.dataset.utilizationPeriod;
      if (state.utilization.period === "custom" && state.utilization.from === state.utilization.to) {
        const anchor = window.LabUtilizationAnalytics.parseDate(state.utilization.anchor);
        state.utilization.from = window.LabUtilizationAnalytics.dateKey(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
        state.utilization.to = window.LabUtilizationAnalytics.dateKey(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0));
      }
      setPage("reports", false);
      return;
    }

    const forecastHorizon = event.target.closest("[data-forecast-horizon]");
    if (forecastHorizon) {
      state.forecast.horizon = Number(forecastHorizon.dataset.forecastHorizon);
      setPage("reports", false);
      return;
    }

    const chooseResultImage = event.target.closest("[data-choose-result-image]");
    if (chooseResultImage) {
      openImagePicker(chooseResultImage.closest('form[data-form="upload-result"]'));
      return;
    }

    const openCamera = event.target.closest("[data-open-result-camera]");
    if (openCamera) {
      await openResultCamera(openCamera.closest('form[data-form="upload-result"]'));
      return;
    }

    const capturePhoto = event.target.closest("[data-capture-result-photo]");
    if (capturePhoto) {
      const form = capturePhoto.closest('form[data-form="upload-result"]');
      try {
        await captureResultCameraImage(form);
      } catch (error) {
        updateScannerStatus(form, error.message || "The photo could not be captured.", null, "error");
      }
      return;
    }

    const closeCamera = event.target.closest("[data-close-result-camera]");
    if (closeCamera) {
      const form = closeCamera.closest('form[data-form="upload-result"]');
      stopResultCamera(form);
      updateScannerStatus(form, "Camera closed. Choose another source when ready.", null, "idle");
      return;
    }

    const scanTrigger = event.target.closest("[data-scan-result]");
    if (scanTrigger) {
      await scanResultImage(scanTrigger.closest('form[data-form="upload-result"]'));
      return;
    }

    const textSizeButton = event.target.closest("[data-text-size-option]");
    if (textSizeButton) {
      applyTextSize(textSizeButton.dataset.textSizeOption);
      toast(`Text size set to ${textSizeButton.textContent.trim()}.`);
      return;
    }

    const patientPick = event.target.closest("[data-patient-pick]");
    if (patientPick) {
      const selectEl = $('form[data-form="create-order"] select[name="patientId"]');
      if (selectEl) {
        selectEl.value = patientPick.dataset.patientPick;
        $$("[data-patient-pick]").forEach((button) => button.classList.toggle("selected", button === patientPick));
      }
      return;
    }

    const profileToggle = event.target.closest("[data-profile-toggle]");
    const profileDropdown = $(".profile-dropdown");
    if (profileToggle) {
      const expanded = profileToggle.getAttribute("aria-expanded") === "true";
      profileToggle.setAttribute("aria-expanded", String(!expanded));
      if (profileDropdown) profileDropdown.hidden = expanded;
      return;
    }
    if (!event.target.closest(".profile-menu-wrap") && profileDropdown && $("[data-profile-toggle]")) {
      $("[data-profile-toggle]").setAttribute("aria-expanded", "false");
      profileDropdown.hidden = true;
    }

    const toggleUser = event.target.closest("[data-toggle-user]");
    if (toggleUser) {
      const user = recordBy("users", toggleUser.dataset.toggleUser);
      const previousStatus = user?.status;
      const nextStatus = toggleUser.dataset.status;
      if (user) {
        user.status = nextStatus;
        setPage(state.page, false);
      }
      try {
        const result = await api("toggle_user_status", { id: toggleUser.dataset.toggleUser, status: nextStatus });
        if (result.users) state.data.users = result.users;
        setPage(state.page, false);
        toast("User status updated.");
      } catch (error) {
        if (user) user.status = previousStatus;
        setPage(state.page, false);
        toast(error.message, "error");
      }
      return;
    }

    const deleteUser = event.target.closest("[data-delete-user]");
    if (deleteUser) {
      const name = deleteUser.dataset.userName || "this user";
      if (!await glassDialog({ title: `Permanently delete ${name}?`, message: "This permanently removes the account, profile, facility assignments, sessions, and account notifications. This cannot be undone. Deletion is blocked when protected laboratory requests, results, or clinical notes are linked; deactivate those accounts instead.", confirmText: "Delete user permanently", danger: true })) {
        return;
      }
      try {
        const result = await api("delete_user", { id: deleteUser.dataset.deleteUser });
        await refreshAfter(result, "User permanently deleted.");
      } catch (error) {
        toast(error.message, "error");
      }
      return;
    }

    const orderStatus = event.target.closest("[data-order-status]");
    if (orderStatus) {
      const order = recordBy("orders", orderStatus.dataset.id);
      const previousStatus = order?.status;
      if (order) {
        order.status = orderStatus.dataset.orderStatus;
        setPage(state.page, false);
      }
      closeDrawer();
      try {
        const result = await api("update_order_status", { orderId: orderStatus.dataset.id, status: orderStatus.dataset.orderStatus, expectedUpdatedAt: order?.updatedAt || order?.createdAt });
        await refreshAfter(result, "Laboratory request status updated.");
      } catch (error) {
        if (order) order.status = previousStatus;
        setPage(state.page, false);
        toast(error.message, "error");
      }
      return;
    }

    const resultStatus = event.target.closest("[data-result-status]");
    if (resultStatus) {
      const resultRecord = recordBy("results", resultStatus.dataset.id);
      if (resultStatus.dataset.resultStatus === "Verified") {
        try {
          if (!await validateStoredResultBeforeStatus(resultRecord)) return;
        } catch (error) {
          toast(error.message, "error");
          return;
        }
      }
      const previousStatus = resultRecord?.status;
      if (resultRecord) {
        resultRecord.status = resultStatus.dataset.resultStatus;
        setPage(state.page, false);
      }
      closeDrawer();
      try {
        const result = await api("update_result_status", { resultId: resultStatus.dataset.id, status: resultStatus.dataset.resultStatus, expectedUpdatedAt: resultRecord?.updatedAt || resultRecord?.createdAt });
        await refreshAfter(result, "Result status updated.");
      } catch (error) {
        if (resultRecord) resultRecord.status = previousStatus;
        setPage(state.page, false);
        toast(error.message, "error");
      }
      return;
    }

    const rejectResult = event.target.closest("[data-reject-result]");
    if (rejectResult) {
      const reason = await glassDialog({ title: "Reject laboratory result?", message: "Record why this result cannot be verified. The reason will be stored with the workflow.", confirmText: "Reject result", danger: true, inputLabel: "Rejection reason", inputRequired: true });
      if (!reason?.trim()) return;
      const resultRecord = recordBy("results", rejectResult.dataset.rejectResult);
      const previousStatus = resultRecord?.status;
      const previousReason = resultRecord?.rejectedReason;
      if (resultRecord) {
        resultRecord.status = "Rejected";
        resultRecord.rejectedReason = reason.trim();
        setPage(state.page, false);
      }
      closeDrawer();
      try {
        const result = await api("reject_result", { resultId: rejectResult.dataset.rejectResult, reason: reason.trim(), expectedUpdatedAt: resultRecord?.updatedAt || resultRecord?.createdAt });
        await refreshAfter(result, "Result rejected.");
      } catch (error) {
        if (resultRecord) {
          resultRecord.status = previousStatus;
          resultRecord.rejectedReason = previousReason;
        }
        setPage(state.page, false);
        toast(error.message, "error");
      }
      return;
    }

    const releaseTrigger = event.target.closest("[data-release-result]");
    if (releaseTrigger) {
      const resultRecord = recordBy("results", releaseTrigger.dataset.releaseResult);
      releaseTrigger.disabled = true;
      try {
        if (await validateStoredResultBeforeStatus(resultRecord)) openReleaseModal(resultRecord);
      } catch (error) {
        toast(error.message, "error");
      } finally {
        releaseTrigger.disabled = false;
      }
      return;
    }

    if (event.target.closest("[data-release-cancel]")) {
      closeReleaseModal();
      return;
    }

    const releaseConfirm = event.target.closest("[data-release-confirm]");
    if (releaseConfirm) {
      const resultRecord = recordBy("results", releaseConfirm.dataset.releaseConfirm);
      const previousStatus = resultRecord?.status;
      const previousReleasedAt = resultRecord?.releasedAt;
      if (resultRecord) {
        resultRecord.status = "Released";
        resultRecord.releasedAt = new Date().toISOString();
        setPage(state.page, false);
      }
      closeReleaseModal();
      closeDrawer();
      try {
        const result = await api("release_result", { resultId: releaseConfirm.dataset.releaseConfirm, expectedUpdatedAt: resultRecord?.updatedAt || resultRecord?.createdAt });
        await refreshAfter(result, "Result released successfully.");
      } catch (error) {
        if (resultRecord) {
          resultRecord.status = previousStatus;
          resultRecord.releasedAt = previousReleasedAt;
        }
        setPage(state.page, false);
        toast(error.message, "error");
      }
      return;
    }

    const readNotification = event.target.closest("[data-read-notification]");
    if (readNotification) {
      const notification = recordBy("notifications", readNotification.dataset.readNotification);
      const wasRead = notification?.isRead;
      if (notification) notification.isRead = true;
      syncNotifications(state.data.notifications);
      setPage(state.page, false);
      closeDrawer();
      try {
        const result = await api("mark_notification_read", { id: readNotification.dataset.readNotification });
        if (result.notifications) syncNotifications(result.notifications);
        setPage(state.page, false);
        toast("Notification marked as read.");
      } catch (error) {
        if (notification) notification.isRead = wasRead;
        syncNotifications(state.data.notifications);
        setPage(state.page, false);
        toast(error.message, "error");
      }
      return;
    }

    if (event.target.closest("[data-mark-read]")) {
      const previousReadState = state.data.notifications.map((item) => [item.id, item.isRead]);
      state.data.notifications.forEach((item) => { item.isRead = true; });
      syncNotifications(state.data.notifications);
      setPage("notifications", false);
      try {
        const result = await api("mark_all_notifications_read");
        if (result.notifications) syncNotifications(result.notifications);
        setPage("notifications", false);
        toast("All notifications marked as read.");
      } catch (error) {
        const previousById = new Map(previousReadState);
        state.data.notifications.forEach((item) => { item.isRead = previousById.get(item.id) ?? item.isRead; });
        syncNotifications(state.data.notifications);
        setPage("notifications", false);
        toast(error.message, "error");
      }
    }
  }

  function applyPageFilters() {
    const content = $("#page-content");
    if (!content) return;
    const globalTerm = ($("#global-search")?.value || "").toLowerCase().trim();
    const applyRows = (rows, toolbar = null) => {
      const searchTerms = [globalTerm, ...(toolbar ? $$("[data-table-search]", toolbar).map((input) => input.value || "") : [])]
        .map((value) => value.toLowerCase().trim()).filter(Boolean);
      const selectedTerms = toolbar ? $$("select", toolbar).map((control) => control.value || "")
        .filter((value) => value && !value.startsWith("All ")).map((value) => value.toLowerCase()) : [];
      const from = toolbar ? $("[data-table-date-from]", toolbar)?.value || "" : "";
      const to = toolbar ? $("[data-table-date-to]", toolbar)?.value || "" : "";
      rows.forEach((row) => {
        const text = row.textContent.toLowerCase();
        const rowDate = row.dataset.tableDate || "";
        const dateMatches = (!from || (rowDate && rowDate >= from)) && (!to || (rowDate && rowDate <= to));
        const matches = !searchTerms.some((term) => !text.includes(term)) && !selectedTerms.some((term) => !text.includes(term)) && dateMatches;
        row.dataset.filterMatch = String(matches);
        row.hidden = !matches;
      });
    };
    $$(".table-filter-scope", content).forEach((scope) => applyRows($$(".data-table tbody tr", scope), $(".toolbar", scope)));
    const unscopedToolbar = $$(".toolbar", content).find((toolbar) => !toolbar.closest(".table-filter-scope")) || null;
    const unscopedRows = $$(".data-table tbody tr, .notification-item, .facility-card, .task-item", content).filter((row) => !row.closest(".table-filter-scope"));
    applyRows(unscopedRows, unscopedToolbar);
    $$('[data-paginated-table]', content).forEach((card) => { card.dataset.tablePage = "1"; });
    paginateTables(content);
  }

  function trapDrawerFocus(event) {
    const drawer = $(".drawer.open");
    if (!drawer || event.key !== "Tab") return;
    const focusable = $$("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])", drawer)
      .filter((element) => !element.hidden && element.getClientRects().length);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function handleDashboardInput(event) {
    if (event.target.matches('form[data-form="user"] input[name="contact"]')) {
      event.target.value = formatPhilippineMobile(event.target.value);
      return;
    }
    if (!event.target.matches("[data-table-search], [data-table-date-from], [data-table-date-to], #global-search")) return;
    applyPageFilters();
  }

  async function handleDashboardChange(event) {
    if (event.target.matches("[data-admin-turnaround-period]")) {
      state.adminTurnaroundPeriod = event.target.value;
      setPage("dashboard", false);
      return;
    }
    if (event.target.matches('form[data-form="maintenance"] select[name="scope"]')) {
      const form = event.target.closest('form[data-form="maintenance"]');
      $$('[data-maintenance-options]', form).forEach((group) => {
        group.hidden = group.dataset.maintenanceOptions !== event.target.value;
      });
      return;
    }
    if (event.target.matches("[data-utilization-anchor], [data-utilization-from], [data-utilization-to]")) {
      if (event.target.matches("[data-utilization-anchor]")) state.utilization.anchor = event.target.value;
      if (event.target.matches("[data-utilization-from]")) state.utilization.from = event.target.value;
      if (event.target.matches("[data-utilization-to]")) state.utilization.to = event.target.value;
      setPage("reports", false);
      return;
    }
    if (event.target.matches("[data-trend-from], [data-trend-to], [data-trend-group], [data-trend-facility], [data-trend-test]")) {
      if (event.target.matches("[data-trend-from]")) state.trends.from = event.target.value;
      if (event.target.matches("[data-trend-to]")) state.trends.to = event.target.value;
      if (event.target.matches("[data-trend-group]")) state.trends.group = event.target.value;
      if (event.target.matches("[data-trend-facility]")) state.trends.facility = event.target.value;
      if (event.target.matches("[data-trend-test]")) state.trends.test = event.target.value;
      setPage("reports", false);
      return;
    }
    if (event.target.matches("[data-result-scan-input]")) {
      const form = event.target.closest('form[data-form="upload-result"]');
      const file = event.target.files?.[0];
      const preview = $("[data-result-scan-preview]", form);
      form.dataset.scanRotation = "0";
      if (preview?.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
      if (!file) {
        if (preview) preview.hidden = true;
        $$('[data-rotate-result-image], [data-remove-result-source]', form).forEach((button) => { button.disabled = true; });
        updateScannerStatus(form, "Select a sharp, straight-on image with readable parameter names and values.", null, "idle");
        return;
      }
      $$('[data-rotate-result-image], [data-remove-result-source]', form).forEach((button) => { button.disabled = false; });
      const objectUrl = URL.createObjectURL(file);
      if (preview) {
        if (file.type === "application/pdf") {
          URL.revokeObjectURL(objectUrl);
          preview.removeAttribute("src");
          preview.hidden = true;
          updateScannerStatus(form, `Selected PDF: ${file.name}. Up to five pages will be scanned.`, null, "idle");
        } else {
          preview.src = objectUrl;
          preview.dataset.objectUrl = objectUrl;
          preview.hidden = false;
        }
      }
      await scanResultImage(form);
      return;
    }
    if (event.target.matches("[data-release-confirm-check]")) {
      const button = $("[data-release-confirm]");
      if (button) button.disabled = !event.target.checked;
      return;
    }
    if (!event.target.matches(".toolbar select")) return;
    applyPageFilters();
  }

  async function logout() {
    clearAppCache();
    try { await api("logout"); } catch {}
    location.href = LOGIN_URL;
  }

  function initLoginPage() {
    const loginForm = $("#login-form");
    if (!loginForm) return;
    clearAppCache();
    const registerForm = $("#register-form");
    const screens = { login: $("#login-screen"), register: $("#register-screen") };
    const setScreen = (name, updateHash = true) => {
      const selected = name === "register" && screens.register ? "register" : "login";
      Object.entries(screens).forEach(([key, el]) => { if (el) el.hidden = key !== selected; });
      if (updateHash && location.hash !== `#${selected}`) history.pushState(null, "", `#${selected}`);
      screens[selected]?.querySelector("h2")?.focus?.({ preventScroll: true });
    };
    const setError = (input, message) => {
      const field = input.closest(".field");
      const error = $(`#${input.id}-error`);
      field?.classList.toggle("has-error", Boolean(message));
      input.setAttribute("aria-invalid", String(Boolean(message)));
      if (error) error.textContent = message;
    };
    const validate = (form) => {
      let valid = true;
      $$("input[required]", form).forEach((input) => {
        const message = input.type === "checkbox" && !input.checked ? "This is required." : input.value.trim() ? "" : "This is required.";
        setError(input, message);
        valid = valid && !message;
      });
      const password = $("#register-password");
      const confirm = $("#confirm-password");
      if (form === registerForm && password && confirm && password.value !== confirm.value) {
        setError(confirm, "Passwords do not match.");
        valid = false;
      }
      return valid;
    };
    const demoAccounts = [
      { role: "Admin", identifier: "admin", password: "admin123" },
      { role: "Laboratory Staff", identifier: "lab", password: "lab123" },
      { role: "Doctor", identifier: "doctor", password: "doctor123" },
      { role: "Patient", identifier: "patient", password: "patient123" },
    ];
    $$("[data-demo-account]").forEach((button) => {
      button.addEventListener("click", () => {
        if (loginForm.classList.contains("is-loading")) return;
        const account = demoAccounts.find((item) => item.role === button.dataset.demoAccount);
        if (!account) return;
        const identifier = $("#login-identifier");
        const password = $("#login-password");
        identifier.value = account.identifier;
        password.value = account.password;
        [identifier, password].forEach((input) => {
          setError(input, "");
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        });
        showStatus(loginForm, `${account.role} demo credentials filled. Click Log in securely to continue.`, "success");
        loginForm.querySelector('button[type="submit"]')?.focus();
      });
    });
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!validate(loginForm)) return;
      const button = loginForm.querySelector('button[type="submit"]');
      button?.setAttribute("disabled", "disabled");
      loginForm.classList.add("is-loading");
      try {
        const data = await api("login", { identifier: $("#login-identifier").value, password: $("#login-password").value });
        showStatus(loginForm, `Welcome, ${data.user.name}. Opening your dashboard...`, "success");
        setTimeout(() => { location.href = destinations[data.user.role] || LOGIN_URL; }, 400);
      } catch (error) {
        showStatus(loginForm, error.message, "error");
        button?.removeAttribute("disabled");
        loginForm.classList.remove("is-loading");
      }
    });
    registerForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!validate(registerForm)) return;
      const button = registerForm.querySelector('button[type="submit"]');
      button?.setAttribute("disabled", "disabled");
      registerForm.classList.add("is-loading");
      try {
        const data = await api("register_patient", { fullName: $("#full-name").value, email: $("#email").value, contact: $("#contact-number").value, username: $("#username").value, password: $("#register-password").value });
        showStatus(registerForm, "Your account has been created. Opening your portal...", "success");
        setTimeout(() => { location.href = destinations[data.user.role]; }, 500);
      } catch (error) {
        showStatus(registerForm, error.message, "error");
        button?.removeAttribute("disabled");
        registerForm.classList.remove("is-loading");
      }
    });
    $$("[data-toggle-password]").forEach((button) => {
      button.addEventListener("click", () => {
        const input = $(`#${button.dataset.togglePassword}`);
        if (!input) return;
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        button.setAttribute("aria-pressed", String(show));
        button.setAttribute("aria-label", show ? "Hide password" : "Show password");
      });
    });
    $$("[data-screen-link]").forEach((link) => link.addEventListener("click", (event) => {
      event.preventDefault();
      setScreen(link.dataset.screenLink);
    }));
    $("#current-year") && ($("#current-year").textContent = new Date().getFullYear());
    window.addEventListener("hashchange", () => setScreen(location.hash.slice(1), false));
    setScreen(location.hash.slice(1), false);
  }

  function initPatientRegistrationPage() {
    const form = $("#patient-register-form");
    if (!form) return;
    clearAppCache();
    const status = $(".register-status");
    const rules = {
      "patient-full-name": (v) => v.trim().length >= 2 ? "" : "Enter your full name.",
      "patient-dob": (v) => v ? "" : "Select your date of birth.",
      "patient-sex": (v) => v ? "" : "Select an option.",
      "patient-email": (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "" : "Enter a valid email address.",
      "patient-contact": (v) => /^[+\d][\d\s()-]{7,17}$/.test(v.trim()) ? "" : "Enter a valid contact number.",
      "patient-address": (v) => v.trim().length >= 5 ? "" : "Enter your complete address.",
      "patient-facility": (v) => v ? "" : "Select your primary facility.",
      "patient-username": (v) => /^[a-zA-Z0-9._-]{3,20}$/.test(v) ? "" : "Use 3-20 letters, numbers, dots, hyphens, or underscores.",
      "patient-password": (v) => /^(?=.*[A-Za-z])(?=.*\d).{12,128}$/.test(v) ? "" : "Use 12-128 characters with a letter and number.",
      "patient-confirm": (v) => v && v === $("#patient-password").value ? "" : "Passwords do not match.",
    };
    const validateInput = (input) => {
      const message = rules[input.id]?.(input.value) || "";
      input.closest(".form-field")?.classList.toggle("has-error", Boolean(message));
      const error = input.closest(".form-field")?.querySelector(".register-error");
      if (error) error.textContent = message;
      input.setAttribute("aria-invalid", String(Boolean(message)));
      return !message;
    };
    $$("[data-password-toggle]").forEach((button) => button.addEventListener("click", () => {
      const input = $(`#${button.dataset.passwordToggle}`);
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.setAttribute("aria-pressed", String(show));
      button.setAttribute("aria-label", show ? "Hide password" : "Show password");
    }));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const valid = $$("input,select", form).filter((input) => rules[input.id]).map(validateInput).every(Boolean);
      if (!valid || !$("#patient-terms").checked || !$("#patient-privacy-ack").checked) {
        status.textContent = !$("#patient-terms").checked || !$("#patient-privacy-ack").checked ? "Please complete the required privacy agreements." : "Please review the highlighted fields.";
        status.classList.add("visible");
        status.style.color = "var(--red)";
        status.style.background = "var(--red-bg)";
        return;
      }
      const button = form.querySelector('button[type="submit"]');
      button?.setAttribute("disabled", "disabled");
      form.classList.add("is-loading");
      try {
        const data = await api("register_patient", {
          fullName: $("#patient-full-name").value,
          dateOfBirth: $("#patient-dob").value,
          sex: $("#patient-sex").value,
          email: $("#patient-email").value,
          contact: $("#patient-contact").value,
          address: $("#patient-address").value,
          facilityId: $("#patient-facility").value,
          username: $("#patient-username").value,
          password: $("#patient-password").value,
          termsAccepted: $("#patient-terms").checked,
          privacyAcknowledged: $("#patient-privacy-ack").checked,
        });
        status.textContent = "Your patient account has been created. Opening your secure dashboard...";
        status.classList.add("visible");
        status.style.color = "var(--green)";
        status.style.background = "var(--green-bg)";
        setTimeout(() => { location.href = destinations[data.user.role]; }, 600);
      } catch (error) {
        status.textContent = error.message;
        status.classList.add("visible");
        status.style.color = "var(--red)";
        status.style.background = "var(--red-bg)";
        button?.removeAttribute("disabled");
        form.classList.remove("is-loading");
      }
    });
  }

  let protectedEventsBound = false;

  function bindProtectedAppEvents() {
    if (protectedEventsBound) return;
    protectedEventsBound = true;
    const prefetchPanel = (event) => {
      const link = event.target.closest?.(".nav-item[data-page], [data-go-page]");
      const page = link?.dataset.page || link?.dataset.goPage;
      if (!state.data || !renderers[currentUser?.role]?.[page] || state.pageRequests.size || navigator.connection?.saveData) return;
      if (missingPageCollections(page).length || Date.now() - state.metadataLoadedAt >= PAGE_CACHE_TTL) ensurePageData(page);
    };
    document.addEventListener("pointerover", prefetchPanel);
    document.addEventListener("focusin", prefetchPanel);
    window.matchMedia("(max-width: 620px)").addEventListener("change", () => {
      paginateTables();
    });
    document.addEventListener("click", handleDashboardClick);
    document.addEventListener("submit", handleDashboardSubmit);
    document.addEventListener("input", handleDashboardInput);
    document.addEventListener("change", handleDashboardChange);
    document.addEventListener("keydown", (event) => {
      trapDrawerFocus(event);
      const keyboardDrawer = event.target.closest?.("[data-drawer][role='button']");
      if (keyboardDrawer && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        openDrawer(keyboardDrawer.dataset.drawer, keyboardDrawer.dataset.id || null);
        return;
      }
      const keyboardPage = event.target.closest?.("[data-go-page][role='link']");
      if (keyboardPage && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        setPage(keyboardPage.dataset.goPage);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        $("#global-search")?.focus();
      }
      if (event.key === "Escape") {
        closeDrawer();
        closeSidebar();
      }
    });
    window.addEventListener("popstate", () => { if (state.data && currentUser) setPage(location.hash.slice(1), false); });
    window.addEventListener("hashchange", () => {
      if (state.data && currentUser) setPage(location.hash.slice(1), false);
    });
  }

  async function initProtectedApp() {
    const requiredRole = document.body?.dataset.requiredRole;
    if (!requiredRole) return;
    const requestedPage = location.hash.slice(1) || document.body.dataset.initialPage || "dashboard";
    $("#page-content").innerHTML = loading();
    bindProtectedAppEvents();
    try {
      await loadAppData(requestedPage);
      if (!currentUser || currentUser.role !== requiredRole) {
        clearAppCache();
        location.replace(currentUser ? destinations[currentUser.role] : LOGIN_URL);
        return;
      }
      hydrateStaticIcons();
      hydrateProfile();
      setPage(requestedPage, false);
      startNotificationPolling();
      setTimeout(warmPanelCache, 250);
    } catch (error) {
      clearAppCache();
      location.replace(LOGIN_URL);
    }
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-logout], .sidebar-logout, .profile-dropdown a[data-logout]")) {
      event.preventDefault();
      logout();
    }
  });

  window.ClinicAuth = { destinations, api, logout };
  applyTextSize();
  applySidebarPreference();
  initTooltips();
  hydrateStaticIcons();
  initLoginPage();
  initPatientRegistrationPage();
  initProtectedApp();
})();
