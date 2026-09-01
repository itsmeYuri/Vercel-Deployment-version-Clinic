(() => {
  "use strict";

  const API_URL = window.CLINIC_API_URL || "../api/index.php";
  const ASSET_BASE = window.CLINIC_ASSET_BASE || "../assets";
  const TEXT_SIZE_KEY = "clinicSystemTextSize";
  const SIDEBAR_COLLAPSED_KEY = "clinicSystemSidebarCollapsed";
  let resultScannerWorkerPromise = null;
  let resultScannerActiveForm = null;
  let resultCameraStream = null;
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
      dashboard: ["Admin Dashboard", "A clear view of clinic operations and system activity."],
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
      facilities: ["Active Facilities & Tests", "View available facilities and laboratory tests."],
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
      operations: ["Assigned Operations", "Review facility workload and active laboratory tasks."],
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
  const state = { data: null, page: "dashboard", activeDrawer: null, activeRecordId: null, utilization: null, forecast: { horizon: 7 } };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const h = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const safeStorage = {
    get(key) {
      try { return localStorage.getItem(key); } catch { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch { /* Storage can be unavailable in restricted browser modes. */ }
    },
  };

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

  function icon(name, className = "") {
    return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" ${name === "medical" ? "" : 'fill="none"'}>${iconPaths[name] || iconPaths.file}</svg>`;
  }

  function hydrateStaticIcons() {
    $$("[data-icon]").forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
    $$("[data-icon-button]").forEach((el) => { el.innerHTML = icon(el.dataset.iconButton); });
    $$("[data-icon-name]").forEach((el) => {
      if (!el.querySelector("svg")) el.insertAdjacentHTML("afterbegin", icon(el.dataset.iconName));
    });
  }

  async function api(action, payload = {}) {
    const response = await fetch(`${API_URL}?action=${encodeURIComponent(action)}`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": window.CLINIC_CSRF_TOKEN || document.querySelector('meta[name="csrf-token"]')?.content || "",
      },
      body: JSON.stringify(payload),
    });
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

  async function readAttachments(files) {
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
      const prepared = await api("prepare_result_uploads", {
        files: selectedFiles.map((file) => ({ name: file.name, type: file.type, size: file.size })),
      });
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
          } catch { /* Supabase may return an empty error response. */ }
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
    const collapsed = !document.body.classList.contains("sidebar-collapsed");
    safeStorage.set(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    applySidebarPreference(collapsed);
  }

  function resultValueInputRow(item = {}, disabled = "") {
    return `<tr><td><input name="parameter" value="${h(item.parameter || "")}" ${disabled}></td><td><input name="value" value="${h(item.value || "")}" ${disabled}></td><td><input name="unit" value="${h(item.unit || "")}" ${disabled}></td><td><input name="referenceRange" value="${h(item.referenceRange || "")}" ${disabled}></td><td><input name="flag" value="${h(item.flag || "")}" ${disabled}></td></tr>`;
  }

  function scannerAssetUrl(path) {
    return new URL(`${String(ASSET_BASE).replace(/\/$/, "")}/${path.replace(/^\//, "")}`, document.baseURI).href;
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
    if (!window.Tesseract?.createWorker) throw new Error("The local image scanner could not be loaded.");
    resultScannerActiveForm = form;
    if (!resultScannerWorkerPromise) {
      resultScannerWorkerPromise = window.Tesseract.createWorker("eng", 1, {
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

  async function prepareResultScan(file) {
    if (!window.createImageBitmap) return file;
    const bitmap = await createImageBitmap(file);
    const maxDimension = 2400;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
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
    return canvas;
  }

  function populateScannedResultValues(form, values) {
    const tbody = $(".parameter-input-table tbody", form);
    if (!tbody) return;
    const hasEnteredValues = $$('.parameter-input-table input[name="value"]', form).some((input) => input.value.trim());
    if (hasEnteredValues && !window.confirm("Replace the result values already entered with the values detected from this image?")) return;
    tbody.innerHTML = values.map((item) => resultValueInputRow(item)).join("");
  }

  async function scanResultImage(form) {
    const input = $("[data-result-scan-input]", form);
    const file = input?.files?.[0];
    if (!file) {
      toast("Choose or capture a laboratory result image first.");
      return;
    }
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      updateScannerStatus(form, "Choose a JPG, PNG, or WEBP image up to 10 MB.", null, "error");
      return;
    }

    const scanButton = $("[data-scan-result]", form);
    if (scanButton) scanButton.disabled = true;
    updateScannerStatus(form, "Preparing image scanner…", 0);
    try {
      const worker = await scannerWorker(form);
      const preparedImage = await prepareResultScan(file);
      const result = await worker.recognize(preparedImage);
      const parsed = window.ClinicLabScanner?.parse(result.data?.text || "");
      const rawOutput = $("[data-result-scan-text]", form);
      const rawPanel = $("[data-result-scan-output]", form);
      if (rawOutput) rawOutput.textContent = parsed?.rawText || "No text detected.";
      if (rawPanel) rawPanel.hidden = false;
      if (!parsed?.values?.length) {
        updateScannerStatus(form, "Text was read, but no supported laboratory values were matched. Try a clearer, straight-on image or enter the values manually.", null, "error");
        return;
      }
      populateScannedResultValues(form, parsed.values);
      updateScannerStatus(form, `${parsed.values.length} result value${parsed.values.length === 1 ? "" : "s"} detected and filled. Compare every value with the source image before uploading.`, null, "success");
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
    if (cameraOnly) input.setAttribute("capture", "environment");
    else input.removeAttribute("capture");
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

  function initials(name) {
    return String(name || "User").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "U";
  }

  function heading(title, subtitle, actions = "") {
    return `<div class="page-heading"><div><p class="eyebrow">Centralized Laboratory Results System</p><h2>${h(title)}</h2><p>${h(subtitle)}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ""}</div>`;
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
    return `<article class="stat-card" style="--accent:${accent};--tint:${tint}"><div class="stat-top"><span class="stat-icon">${icon(iconName)}</span><span class="stat-change ${String(change).startsWith("-") ? "down" : ""}">${change === "-" ? "" : icon("trend")}${h(change)}</span></div><div class="stat-value">${h(value)}</div><div class="stat-label">${h(label)}</div></article>`;
  }

  function table(headers, rows, footer = "") {
    const clean = (value) => String(value).replace(/<[^>]*>/g, "");
    const body = rows.length
      ? rows.map((row) => `<tr>${row.map((cell, index) => `<td data-label="${h(clean(headers[index]))}">${cell}</td>`).join("")}</tr>`).join("")
      : `<tr><td colspan="${headers.length}"><div class="empty-state">No records found.</div></td></tr>`;
    return `<section class="card table-card"><div class="table-responsive"><table class="data-table"><thead><tr>${headers.map((item) => `<th>${h(item)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div><div class="table-footer"><span>${h(footer || `Showing ${rows.length} records`)}</span></div></section>`;
  }

  function filters(placeholder, selects = [], actions = "") {
    return `<div class="toolbar"><div class="filter-group"><label class="control control-search">${icon("search")}<input type="search" data-table-search placeholder="${h(placeholder)}"></label>${selects.map(([label, options]) => `<label class="control"><select aria-label="${h(label)}"><option>${h(label)}</option>${options.map((option) => `<option>${h(option)}</option>`).join("")}</select>${icon("chevron", "select-arrow")}</label>`).join("")}</div><div class="toolbar-actions">${actions}</div></div>`;
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
      : `<input id="${id}" name="${h(name)}" type="${h(type)}" value="${h(value)}" ${extra}>`;
    return `<div class="form-field full"><label for="${id}">${h(label)}</label>${control}</div>`;
  }

  function drawerInfo(items) {
    return `<div class="drawer-info">${items.map(([label, value]) => `<div><span>${h(label)}</span><strong>${value}</strong></div>`).join("")}</div>`;
  }

  function valuesTable(values = []) {
    if (!values.length) return `<div class="clinical-note-box"><h4>${icon("file")} Structured Values</h4><p>No structured values were entered for this result.</p></div>`;
    return `<table class="result-values"><thead><tr><th>Parameter</th><th>Result</th><th>Unit</th><th>Reference Range</th></tr></thead><tbody>${values.map((value) => `<tr><td>${h(value.parameter)}</td><td class="${value.flag === "High" || value.flag === "Low" ? "abnormal" : ""}">${h(value.value)}</td><td>${h(value.unit)}</td><td>${h(value.referenceRange)}</td></tr>`).join("")}</tbody></table>`;
  }

  function chartFromCounts(counts) {
    const values = Object.values(counts || {});
    const points = (values.length ? values : [1, 1, 1, 1]).slice(0, 7);
    const max = Math.max(...points, 1);
    const coords = points.map((value, index) => `${index * (420 / Math.max(1, points.length - 1))},${126 - (value / max) * 92}`).join(" ");
    return `<div class="line-chart" style="--chart-points:${points.length}"><svg viewBox="0 0 420 145" preserveAspectRatio="none"><path class="chart-grid-line" d="M0 36H420M0 72H420M0 108H420"/><polygon points="0,145 ${coords} 420,145" fill="#08a394" opacity=".09"/><polyline class="chart-line" points="${coords}"/>${coords.split(" ").map((point) => { const [x, y] = point.split(","); return `<circle class="chart-dot" cx="${x}" cy="${y}" r="3"/>`; }).join("")}</svg><div class="chart-axis">${Object.keys(counts || { Records: 1 }).slice(0, 7).map((key) => `<span>${h(key)}</span>`).join("")}</div></div>`;
  }

  function utilizationTrendChart(analytics) {
    const series = [
      { key: "patients", label: "Patients", color: "#078f88" },
      { key: "requests", label: "Requests", color: "#347fb7" },
      { key: "tests", label: "Tests", color: "#795db0" },
    ];
    const buckets = analytics.buckets || [];
    const width = Math.max(700, buckets.length * 30);
    const max = Math.max(1, ...buckets.flatMap((bucket) => series.map((item) => bucket[item.key])));
    const x = (index) => buckets.length < 2 ? width / 2 : 34 + (index * (width - 68) / (buckets.length - 1));
    const y = (value) => 196 - (Number(value || 0) / max) * 156;
    const paths = series.map((item) => {
      const points = buckets.map((bucket, index) => `${x(index)},${y(bucket[item.key])}`).join(" ");
      const dots = buckets.map((bucket, index) => `<circle cx="${x(index)}" cy="${y(bucket[item.key])}" r="3" tabindex="0" style="--series-color:${item.color}"><title>${h(bucket.label)}: ${h(bucket[item.key])} ${h(item.label.toLowerCase())}</title></circle>`).join("");
      return `<polyline points="${points}" style="--series-color:${item.color}"/>${dots}`;
    }).join("");
    const labels = buckets.map((bucket, index) => `<span style="left:${x(index)}px">${h(bucket.label)}</span>`).join("");
    return `<div class="utilization-legend">${series.map((item) => `<span><i style="--series-color:${item.color}"></i>${h(item.label)}</span>`).join("")}</div><div class="utilization-chart-scroll"><div class="utilization-chart" style="width:${width}px"><svg viewBox="0 0 ${width} 215" role="img" aria-label="Laboratory utilization trend"><path class="utilization-grid" d="M34 40H${width - 34}M34 92H${width - 34}M34 144H${width - 34}M34 196H${width - 34}"/>${paths}</svg><div class="utilization-axis" aria-hidden="true">${labels}</div></div></div>`;
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
    return `<section class="card utilization-card"><div class="card-head"><div><h3 class="card-title">Laboratory Utilization</h3><p class="card-subtitle">Unique patients and laboratory activity for ${h(rangeLabel)}. A patient is counted once in the selected period.</p></div>${icon("trend")}</div><div class="utilization-toolbar"><div class="utilization-periods" role="group" aria-label="Analytics period">${controls}</div><div class="utilization-dates">${dateControls}</div></div><div class="stats-grid utilization-stats">${stat("Patients Served", totals.patients, "users", "-", "teal")}${stat("Laboratory Requests", totals.requests, "orders", "-", "blue")}${stat("Tests Requested", totals.tests, "test", "-", "purple")}${stat("Average Requests / Day", totals.averageRequestsPerDay.toFixed(1), "activity", "-", "orange")}</div><div class="card-body utilization-chart-body">${utilizationTrendChart(analytics)}<p class="utilization-note">Counts use each request's creation date.${busiest?.requests ? ` Busiest displayed interval: ${h(busiest.label)} with ${h(busiest.requests)} request${busiest.requests === 1 ? "" : "s"}.` : " No laboratory activity was recorded for this period."} Hover or focus on a point to see its value.</p></div></section>`;
  }

  function forecastTrendChart(analysis) {
    const buckets = analysis.forecast.map((day) => ({
      ...day,
      patients: Number(day.patients.toFixed(1)),
      requests: Number(day.requests.toFixed(1)),
      tests: Number(day.tests.toFixed(1)),
    }));
    return utilizationTrendChart({ buckets }).replace("Laboratory utilization trend", "Forecast laboratory demand trend");
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
    return `<section class="card"><div class="card-head"><div><h3 class="card-title">${h(title)}</h3><p class="card-subtitle">Current database distribution</p></div></div><div class="card-body donut-layout"><div class="donut" style="--segments:${segments}"><div class="donut-center"><strong>${total}</strong><span>${h(totalLabel)}</span></div></div><div class="chart-legend">${(entries.length ? entries : [["No records", 0]]).map(([label, count], index) => `<div class="legend-row" style="--dot:${colors[index % colors.length]}"><i></i><span>${h(label)}</span><strong>${h(count)}</strong></div>`).join("")}</div></div></section>`;
  }

  function notificationArticles(notifications) {
    return notifications.length ? notifications.map((item) => `<article class="notification-item ${item.isRead ? "" : "unread"}" data-drawer="notification" data-id="${item.id}"><span class="notification-icon">${icon(item.type || "bell")}</span><div class="notification-copy"><strong>${h(item.title)}</strong><p>${h(item.message)}</p></div><div class="notification-actions"><time>${shortDateTime(item.createdAt)}</time><button class="row-action" type="button" aria-label="View details">${icon("arrow")}</button></div></article>`).join("") : `<div class="empty-state">No notifications found.</div>`;
  }

  function recordBy(collection, id) {
    return (state.data?.[collection] || []).find((item) => String(item.id) === String(id));
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
    $$(".notification-count").forEach((el) => { el.textContent = unread; });
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

  function toast(message) {
    const region = $(".toast-region");
    if (!region) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `${icon("check")}<span>${h(message)}</span>`;
    region.append(el);
    setTimeout(() => el.remove(), 3500);
  }

  function downloadRecords() {
    if (!state.data || !currentUser) {
      toast("No records are loaded yet.");
      return;
    }
    const payload = {
      generatedAt: new Date().toISOString(),
      user: {
        id: currentUser.id,
        name: currentUser.name,
        role: currentUser.role,
        patientProfileId: currentUser.patientProfileId,
      },
      orders: state.data.orders,
      results: state.data.results,
      notifications: state.data.notifications,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `clinic-system-v2-${currentUser.role.toLowerCase().replace(/\s+/g, "-")}-records.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast("Database-backed records exported.");
  }

  function loading() {
    return `<section class="card"><div class="card-body"><div class="empty-state">Loading live clinic data...</div></div></section>`;
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
    const auditRows = state.data.audit.slice(0, 8).map((item) => [shortDateTime(item.createdAt), person(item.userName, item.role, initials(item.userName)), badge(item.action), item.module, `<span class="cell-wrap">${h(item.details)}</span>`]);
    return `${heading(...pageMeta.Admin.dashboard, `<button class="btn btn-secondary" data-go-page="audit">${icon("audit")} Audit Trail</button><button class="btn btn-primary" data-drawer="user">${icon("plus")} New User</button>`)}
      <div class="stats-grid">${stat("Users", state.data.users.length, "users")}${stat("Active Users", state.data.users.filter((u) => u.status === "Active").length, "check", "-", "green")}${stat("Facilities", state.data.facilities.length, "facility", "-", "blue")}${stat("Audit Records", state.data.audit.length, "audit", "-", "purple")}</div>
      <div class="admin-dashboard-layout"><div class="admin-dashboard-main"><section class="card order-activity-card"><div class="card-head"><div><h3 class="card-title">Account Overview</h3><p class="card-subtitle">Users by role</p></div></div><div class="card-body">${chartFromCounts(Object.fromEntries(["Admin", "Doctor", "Laboratory Staff", "Patient"].map((role) => [role, state.data.users.filter((u) => u.role === role).length])))}</div></section></div><section class="card notifications-card"><div class="card-head"><div><h3 class="card-title">Latest Notifications</h3><p class="card-subtitle">Database-backed system notices</p></div><button class="card-link" data-go-page="notifications">View all</button></div><div class="card-body notification-list">${notificationArticles(state.data.notifications.slice(0, 4))}</div></section></div>
      ${table(["Time", "User", "Action", "Module", "Details"], auditRows, "Latest audit records")}`;
  }

  function renderUsers() {
    const rows = state.data.users.map((user) => [person(user.name, `@${user.username}`, user.avatar), `<span class="cell-email" title="${h(user.email)}">${h(user.email)}</span>`, badge(user.role), h(user.assignedFacility || "Unassigned"), badge(user.status), `<div class="row-actions"><button class="row-action" data-drawer="user" data-id="${user.id}" aria-label="Edit user">${icon("edit")}</button><button class="row-action" data-toggle-user="${user.id}" data-status="${user.status === "Active" ? "Inactive" : "Active"}" aria-label="${user.status === "Active" ? "Deactivate user" : "Activate user"}">${icon(user.status === "Active" ? "lock" : "check")}</button><button class="row-action row-action-danger" data-delete-user="${user.id}" data-user-name="${h(user.name)}" aria-label="Delete user">${icon("trash")}</button></div>`]);
    return `${heading(...pageMeta.Admin.users, `<button class="btn btn-primary" data-drawer="user">${icon("plus")} Add User</button>`)}
      <div class="stats-grid">${stat("Total Users", state.data.users.length, "users")}${stat("Active Users", state.data.users.filter((u) => u.status === "Active").length, "check", "-", "green")}${stat("Doctors", state.data.users.filter((u) => u.role === "Doctor").length, "doctor", "-", "blue")}${stat("Patients", state.data.users.filter((u) => u.role === "Patient").length, "user", "-", "orange")}</div>
      ${filters("Search users", [["All roles", ["Admin", "Doctor", "Laboratory Staff", "Patient"]], ["All statuses", ["Active", "Inactive"]]])}
      ${table(["User", "Email", "Role", "Facility", "Status", "Actions"], rows)}`;
  }

  function renderFacilities() {
    const rows = state.data.facilities.map((facility) => [`<span class="cell-strong">${h(facility.name)}</span>`, `<span class="cell-wrap">${h(facility.address)}</span>`, h(facility.phone), h(facility.activeOrders), h(facility.activeTests), badge(facility.status), `<button class="btn btn-secondary btn-sm" data-drawer="facility" data-id="${facility.id}">Edit</button>`]);
    return `${heading(...pageMeta.Admin.facilities, `<button class="btn btn-primary" data-drawer="facility">${icon("plus")} Add Facility</button>`)}
      <div class="stats-grid">${stat("Facilities", state.data.facilities.length, "facility")}${stat("Active", state.data.facilities.filter((f) => f.status === "Active").length, "check", "-", "green")}${stat("Open Requests", state.data.facilities.reduce((sum, f) => sum + Number(f.activeOrders || 0), 0), "orders", "-", "blue")}${stat("Active Tests", state.data.tests.filter((t) => t.status === "Active").length, "test", "-", "purple")}</div>
      ${filters("Search facilities", [["All statuses", ["Active", "Inactive"]]])}
      ${table(["Facility", "Address", "Phone", "Open Requests", "Active Tests", "Status", "Action"], rows)}`;
  }

  function renderTests() {
    const rows = state.data.tests.map((test) => [`<span class="cell-strong" style="color:var(--teal-800)">${h(test.code)}</span>`, h(test.name), h(test.category), h(test.sampleType), h(test.turnaroundTime), money(test.price), badge(test.status), `<button class="btn btn-secondary btn-sm" data-drawer="test" data-id="${test.id}">Edit</button>`]);
    return `${heading(...pageMeta.Admin.tests, `<button class="btn btn-primary" data-drawer="test">${icon("plus")} Add Test</button>`)}
      <div class="stats-grid">${stat("Test Definitions", state.data.tests.length, "test")}${stat("Active Tests", state.data.tests.filter((t) => t.status === "Active").length, "check", "-", "green")}${stat("Categories", new Set(state.data.tests.map((t) => t.category)).size, "chart", "-", "blue")}${stat("Average Price", money(state.data.tests.reduce((sum, t) => sum + Number(t.price || 0), 0) / Math.max(1, state.data.tests.length)), "file", "-", "purple")}</div>
      ${filters("Search tests", [["All categories", [...new Set(state.data.tests.map((t) => t.category))]], ["All statuses", ["Active", "Inactive"]]])}
      ${table(["Code", "Test Name", "Category", "Sample", "Turnaround", "Price", "Status", "Action"], rows)}`;
  }

  function renderOrders(titleRole = currentUser.role, pageKey = "orders") {
    const rows = state.data.orders.map((order) => [`<span class="cell-strong" style="color:var(--teal-800)">${h(order.orderNumber)}</span>`, person(order.patientName, order.patientCode, order.patientAvatar, "teal"), h(order.doctorName), h(order.facilityName), `<span class="cell-wrap">${h(order.tests)}</span>`, badge(order.priority), badge(order.status), `<time datetime="${h(order.createdAt)}">${shortDateTime(order.createdAt)}</time>`, `<time datetime="${h(order.updatedAt || order.createdAt)}">${shortDateTime(order.updatedAt || order.createdAt)}</time>`, `<button class="btn btn-secondary btn-sm" data-drawer="order" data-id="${order.id}">View</button>`]);
    const meta = pageMeta[titleRole]?.[pageKey] || pageMeta[titleRole]?.orders || pageMeta.Admin.orders;
    const action = titleRole === "Doctor" ? `<button class="btn btn-primary" data-go-page="create-order">${icon("plus")} New Laboratory Request</button>` : "";
    return `${heading(...meta, action)}
      <div class="stats-grid">${stat("Requests", state.data.orders.length, "orders")}${stat("Open", state.data.orders.filter((o) => !["Released", "Rejected", "Cancelled"].includes(o.status)).length, "clock", "-", "orange")}${stat("Released", state.data.orders.filter((o) => o.status === "Released").length, "check", "-", "green")}${stat("Priority", state.data.orders.filter((o) => o.priority === "Priority").length, "alert", "-", "red")}</div>
      ${filters("Search laboratory requests", [["All statuses", Object.keys(state.data.reports.ordersByStatus || {})], ["All facilities", state.data.facilities.map((f) => f.name)]])}
      ${table(["Request No.", "Patient", "Requesting Clinician", "Facility", "Tests", "Priority", "Status", "Created", "Updated", "Action"], rows)}`;
  }

  function renderResults(titleRole = currentUser.role) {
    const rows = state.data.results.map((result) => [`<span class="cell-strong" style="color:var(--teal-800)">${h(result.resultNumber)}</span>`, h(result.orderNumber), person(result.patientName, result.patientCode), h(result.testName), h(result.facilityName), badge(result.status), `<time datetime="${h(result.createdAt || result.uploadedAt)}">${shortDateTime(result.createdAt || result.uploadedAt)}</time>`, `<time datetime="${h(result.releasedAt || result.updatedAt || result.uploadedAt)}">${shortDateTime(result.releasedAt || result.updatedAt || result.uploadedAt)}</time>`, `<span class="cell-wrap">${h(result.clinicalNote || "No clinical note yet")}</span>`, `<button class="btn btn-secondary btn-sm" data-drawer="result" data-id="${result.id}">View</button>`]);
    const meta = pageMeta[titleRole]?.results || pageMeta.Admin.results;
    return `${heading(...meta)}
      <div class="stats-grid">${stat("Results", state.data.results.length, "results")}${stat("Pending Review", state.data.results.filter((r) => r.status === "Pending Review").length, "clock", "-", "orange")}${stat("Verified", state.data.results.filter((r) => r.status === "Verified").length, "check", "-", "green")}${stat("Released", state.data.results.filter((r) => r.status === "Released").length, "download", "-", "blue")}</div>
      ${filters("Search results", [["All statuses", Object.keys(state.data.reports.resultsByStatus || {})], ["All facilities", state.data.facilities.map((f) => f.name)]])}
      ${table(["Result ID", "Request No.", "Patient", "Test", "Facility", "Status", "Created", "Updated/Released", "Clinical Note", "Action"], rows)}`;
  }

  function renderReports() {
    const facilityRows = Object.entries(state.data.reports.ordersByFacility || {}).map(([facility, count]) => [h(facility), h(count), `${Math.round((count / Math.max(1, state.data.orders.length)) * 100)}%`]);
    const testRows = Object.entries(state.data.reports.topTests || {}).map(([test, count]) => [h(test), h(count), badge(count > 1 ? "Active" : "Pending")]);
    return `${heading(...pageMeta.Admin.reports, `<button class="btn btn-secondary" data-download>${icon("download")} Export</button>`)}
      ${utilizationAnalyticsSection()}
      ${forecastingAnalysisSection()}
      <div class="stats-grid stats-eight">${dashboardStats()}</div>
      <div class="charts-pair">${donutCard("Requests by Status", state.data.reports.ordersByStatus, "Requests")}${donutCard("Results by Status", state.data.reports.resultsByStatus, "Results")}</div>
      <div class="dashboard-grid">${table(["Facility", "Requests", "Share"], facilityRows, "Requests per facility")}${table(["Requested Test", "Count", "Status"], testRows, "Most requested tests")}</div>`;
  }

  function renderAudit() {
    const rows = state.data.audit.map((item) => [shortDateTime(item.createdAt), person(item.userName, item.role), badge(item.action), h(item.module), `<span class="cell-wrap">${h(item.details)}</span>`, h(item.ipAddress)]);
    return `${heading(...pageMeta.Admin.audit)}
      ${filters("Search audit records", [["All modules", [...new Set(state.data.audit.map((a) => a.module))]], ["All actions", [...new Set(state.data.audit.map((a) => a.action))]]])}
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
      <div class="settings-grid"><section class="card settings-card"><div class="settings-card-head"><div><h3>Security</h3><p>Change your password using the secure API.</p></div>${icon("shield")}</div><button class="btn btn-secondary" data-drawer="password">Change Password</button></section>${accessibilityCard()}<section class="card settings-card"><div class="settings-card-head"><div><h3>Role Permissions</h3><p>Server-side access is enforced by every API action.</p></div>${icon("lock")}</div>${["Admin", "Doctor", "Laboratory Staff", "Patient"].map((role) => `<div class="setting-row"><div><strong>${h(role)}</strong><p>${role === "Admin" ? "Full system access" : "Role-scoped records and workflow actions"}</p></div>${toggle(true, "", "disabled aria-label=\"Server enforced\"")}</div>`).join("")}</section></div>`;
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
              <fieldset class="form-field full maintenance-options"><legend>Affected Roles</legend>
                ${["Doctor", "Laboratory Staff", "Patient"].map((role) => `<label class="register-check"><input type="checkbox" name="affectedRoles" value="${h(role)}" ${(settings.affectedRoles || []).includes(role) ? "checked" : ""}><span>${h(role)}</span></label>`).join("")}
              </fieldset>
              <fieldset class="form-field full maintenance-options"><legend>Affected Modules</legend>
                ${["dashboard", "orders", "results", "notifications", "settings", "patients", "facilities", "create-order", "upload", "review", "queue", "profile", "registration"].map((page) => `<label class="register-check"><input type="checkbox" name="affectedPages" value="${h(page)}" ${(settings.affectedPages || []).includes(page) ? "checked" : ""}><span>${h({ orders: "laboratory requests", "create-order": "new laboratory request" }[page] || page.replace("-", " "))}</span></label>`).join("")}
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
    const patientRows = state.data.patients.slice(0, 5).map((patient) => [h(patient.patientCode), person(patient.name, patient.email, patient.avatar), h(patient.sex || "-"), h(patient.primaryFacility || "-"), badge(patient.latestStatus || "Pending"), `<button class="btn btn-secondary btn-sm" data-drawer="patient" data-id="${patient.id}">View</button>`]);
    const resultRows = state.data.results.slice(0, 5).map((result) => [h(result.resultNumber), h(result.patientName), h(result.testName), badge(result.status), h(result.facilityName), `<button class="btn btn-secondary btn-sm" data-drawer="result" data-id="${result.id}">Review</button>`]);
    return `${heading(...pageMeta.Doctor.dashboard, `<button class="btn btn-secondary" data-go-page="results">${icon("results")} Results</button><button class="btn btn-primary" data-go-page="create-order">${icon("plus")} New Laboratory Request</button>`)}
      <div class="stats-grid">${dashboardStats()}</div>
      <div class="doctor-dashboard-grid"><section class="card"><div class="card-head"><div><h3 class="card-title">My Laboratory Requests</h3><p class="card-subtitle">Current status distribution</p></div></div><div class="card-body">${chartFromCounts(state.data.reports.ordersByStatus)}</div></section>${donutCard("My Request Status", state.data.reports.ordersByStatus, "Requests")}</div>
      <div class="dashboard-grid">${table(["Patient ID", "Patient", "Sex", "Facility", "Latest Status", "Action"], patientRows, "Patients linked to your laboratory requests")}${table(["Result ID", "Patient", "Test", "Status", "Facility", "Action"], resultRows, "Recent results")}</div>`;
  }

  function renderPatients(role = currentUser.role) {
    const meta = pageMeta[role].patients;
    const rows = state.data.patients.map((patient) => [h(patient.patientCode), person(patient.name, patient.email, patient.avatar), h(patient.dateOfBirth || "-"), h(patient.sex || "-"), h(patient.primaryFacility || "-"), h(patient.latestTests || "-"), badge(patient.latestStatus || "Pending"), `<button class="btn btn-secondary btn-sm" data-drawer="patient" data-id="${patient.id}">View</button>`]);
    return `${heading(...meta)}
      <div class="stats-grid">${stat("Patients", state.data.patients.length, "users")}${stat("With Requests", state.data.patients.filter((p) => p.orderCount > 0).length, "orders", "-", "blue")}${stat("Released Results", state.data.patients.reduce((sum, p) => sum + Number(p.resultCount || 0), 0), "results", "-", "green")}${stat("Facilities", new Set(state.data.patients.map((p) => p.primaryFacility).filter(Boolean)).size, "facility", "-", "purple")}</div>
      ${filters("Search patients", [["All facilities", state.data.facilities.map((f) => f.name)]])}
      ${table(["Patient ID", "Patient", "DOB", "Sex", "Facility", "Latest Tests", "Latest Status", "Action"], rows)}`;
  }

  function renderFacilitiesAndTests() {
    const facilityRows = state.data.facilities.map((facility) => [h(facility.name), h(facility.address), h(facility.phone), badge(facility.status), h(facility.activeOrders)]);
    const testRows = state.data.tests.map((test) => [h(test.code), h(test.name), h(test.category), h(test.sampleType), h(test.turnaroundTime), money(test.price), badge(test.status)]);
    return `${heading(...pageMeta.Doctor.facilities)}
      <div class="stats-grid">${stat("Facilities", state.data.facilities.length, "facility")}${stat("Active Tests", state.data.tests.length, "test", "-", "green")}${stat("Categories", new Set(state.data.tests.map((t) => t.category)).size, "chart", "-", "blue")}${stat("Fastest TAT", state.data.tests[0]?.turnaroundTime || "-", "clock", "-", "orange")}</div>
      <div class="dashboard-grid">${table(["Facility", "Address", "Phone", "Status", "Open Requests"], facilityRows)}${table(["Code", "Test", "Category", "Sample", "Turnaround", "Price", "Status"], testRows)}</div>`;
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
      <div class="create-order-layout"><section class="card"><div class="card-head"><div><h3 class="card-title">Available Patients</h3><p class="card-subtitle">Choose from database patient records.</p></div></div><div class="recent-patient-list">${state.data.availablePatients.slice(0, 6).map((patient, index) => `<button class="recent-patient ${index === 0 ? "selected" : ""}" type="button" data-patient-pick="${patient.id}">${avatar(patient.avatar)}<div><strong>${h(patient.name)}</strong><span>${h(patient.patientCode)} - ${h(patient.sex || "No sex recorded")}</span></div></button>`).join("")}</div></section>
      <form class="card order-compose-card" data-form="create-order"><div class="card-head" style="padding:0 0 17px"><div><h3 class="card-title">Laboratory Request Details</h3><p class="card-subtitle">New requests are submitted as Pending for laboratory intake.</p></div>${badge("Pending")}</div>${formHint}<div class="form-grid"><div class="form-field full"><label>Patient</label>${patientSelect}</div><div class="form-field full"><label>Facility</label>${facilitySelect}</div><div class="form-field full"><label>Requested Tests</label><div class="test-choice-grid">${testsMarkup}</div></div><div class="form-field"><label>Priority</label>${select("priority", ["Regular", "Priority"], "Regular", disabled)}</div><div class="form-field"><label>Status</label><div class="readonly-pill">${badge("Pending")} Laboratory staff updates this after intake.</div></div><div class="form-field full"><label>Clinical Indication / Notes</label><textarea name="clinicalNotes" ${disabled} placeholder="Clinical indication, provisional diagnosis, or special instructions"></textarea></div></div><div class="form-actions"><button class="btn btn-secondary" type="button" data-go-page="orders">Cancel</button><button class="btn btn-primary" type="submit" ${disabled}>${icon("plus-file")} Submit Laboratory Request</button></div></form>
      <aside class="card order-summary"><p class="eyebrow">Request Summary</p><h3 class="card-title">Clinical workflow</h3><div class="clinical-note-box"><h4>${icon("shield")} Notifications included</h4><p>Submitting creates a laboratory request, notifies laboratory staff and the patient, and writes an audit record.</p></div></aside></div>`;
  }

  function renderDoctorProfile() {
    return renderRoleProfile("Doctor");
  }

  function renderDoctorSettings() {
    return `${heading(...pageMeta.Doctor.settings)}<div class="doctor-settings"><div class="doctor-settings-grid"><section class="card settings-card"><div class="settings-card-head"><div><h3>Security</h3><p>Update your account password.</p></div>${icon("shield")}</div><button class="btn btn-secondary" data-drawer="password">Change Password</button></section>${accessibilityCard()}</div></div>`;
  }

  function renderLabDashboard() {
    const orderRows = state.data.orders.slice(0, 6).map((order) => [h(order.orderNumber), h(order.patientName), h(order.tests), badge(order.priority), badge(order.status), `<button class="btn btn-secondary btn-sm" data-drawer="order" data-id="${order.id}">Process</button>`]);
    const resultRows = state.data.results.slice(0, 5).map((result) => [h(result.resultNumber), h(result.orderNumber), h(result.patientName), h(result.testName), badge(result.status), `<button class="btn btn-secondary btn-sm" data-drawer="result" data-id="${result.id}">Review</button>`]);
    return `${heading(...pageMeta["Laboratory Staff"].dashboard)}
      <div class="stats-grid">${dashboardStats()}</div>
      <div class="lab-dashboard-grid"><section>${table(["Request No.", "Patient", "Tests", "Priority", "Status", "Action"], orderRows, "Assigned laboratory requests")}</section><div class="lab-side-stack">${donutCard("Assigned Request Status", state.data.reports.ordersByStatus, "Requests")}${table(["Result", "Request", "Patient", "Test", "Status", "Action"], resultRows, "Recent result records")}</div></div>`;
  }

  function renderLabUpload() {
    const activeResultOrderIds = new Set(state.data.results.filter((result) => result.status !== "Rejected").map((result) => String(result.orderId)));
    const uploadStatuses = new Set(["Processing", "In Progress"]);
    const eligible = state.data.orders.filter((order) => uploadStatuses.has(order.status) && !activeResultOrderIds.has(String(order.id)));
    const orderOptions = eligible.map((order) => ({ value: order.id, label: `${order.orderNumber} - ${order.patientName} - ${order.tests}` }));
    const queueRows = eligible.map((order) => [h(order.orderNumber), h(order.patientName), h(order.tests), badge(order.priority), badge(order.status), `<button class="btn btn-secondary btn-sm" data-drawer="order" data-id="${order.id}">View</button>`]);
    const disabled = eligible.length ? "" : "disabled";
    const orderSelect = eligible.length ? select("orderId", orderOptions, orderOptions[0]?.value || "", "required") : '<select name="orderId" required disabled><option>No eligible laboratory requests</option></select>';
    const defaultValueRows = ["WBC", "Hemoglobin", "Platelets", "CRP"].map((parameter) => resultValueInputRow({ parameter }, disabled)).join("");
    return `${heading(...pageMeta["Laboratory Staff"].upload)}
      <div class="upload-layout"><form class="card upload-panel" data-form="upload-result"><div class="card-head" style="padding:0 0 17px"><div><h3 class="card-title">Structured Result Entry</h3><p class="card-subtitle">Saved as a pending-review result.</p></div>${icon("upload")}</div><div class="form-grid"><div class="form-field full"><label>Laboratory Request</label>${orderSelect}</div><section class="result-scanner full" aria-labelledby="result-scanner-title"><div class="result-scanner-copy"><span class="result-scanner-icon">${icon("scan")}</span><div><h3 id="result-scanner-title">Scan Laboratory Result</h3><p>Take a new photo or choose an existing result image. The scanner fills recognized values for staff review; it never submits them automatically.</p></div></div><div class="result-scanner-controls"><button class="btn btn-secondary" type="button" data-open-result-camera ${disabled}>${icon("camera")} Take Photo</button><button class="btn btn-secondary" type="button" data-choose-result-image ${disabled}>${icon("file")} Choose Image</button><button class="btn btn-primary" type="button" data-scan-result ${disabled}>${icon("scan")} Scan and Fill Values</button><input class="result-scan-file-input" type="file" accept="image/jpeg,image/png,image/webp" data-result-scan-input ${disabled}></div><div class="result-camera-panel" data-result-camera-panel hidden><video data-result-camera-video autoplay playsinline muted></video><canvas data-result-camera-canvas hidden></canvas><div class="result-camera-actions"><button class="btn btn-primary" type="button" data-capture-result-photo>${icon("camera")} Capture Photo</button><button class="btn btn-secondary" type="button" data-close-result-camera>Cancel Camera</button></div></div><img class="result-scan-preview" alt="Selected laboratory result preview" data-result-scan-preview hidden><progress class="result-scan-progress" max="100" value="0" data-result-scan-progress hidden></progress><p class="result-scan-status" role="status" aria-live="polite" data-result-scan-status>Select a sharp, straight-on image with readable parameter names and values.</p><details class="result-scan-output" data-result-scan-output hidden><summary>Review text detected in image</summary><pre data-result-scan-text></pre></details><div class="result-scan-warning">${icon("alert")} OCR can misread decimal points, units, or flags. Laboratory Staff must compare every populated field with the source report before uploading.</div></section><div class="form-field full"><label>Findings Summary</label><textarea name="findings" required ${disabled} placeholder="Enter laboratory findings"></textarea></div><div class="form-field full"><label>Remarks</label><textarea name="remarks" ${disabled} placeholder="Specimen notes, QC notes, or review comments"></textarea></div><div class="form-field full"><label>Additional Result Attachments</label><input name="attachments" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" multiple ${disabled}><small>The scanned image is included automatically. You can attach additional PDF reports or result images up to 10 MB each.</small></div></div><h3 class="form-section-title">${icon("activity")} Result Values</h3><table class="parameter-input-table"><thead><tr><th>Parameter</th><th>Value</th><th>Unit</th><th>Reference</th><th>Flag</th></tr></thead><tbody>${defaultValueRows}</tbody></table><div class="form-actions"><button class="btn btn-secondary" type="button" data-go-page="orders">Cancel</button><button class="btn btn-primary" type="submit" ${disabled}>${icon("upload")} Upload Result</button></div></form><section>${table(["Request No.", "Patient", "Tests", "Priority", "Status", "Action"], queueRows, "Requests available for result upload")}</section></div>`;
  }

  function renderLabReview() {
    const rows = state.data.results.map((result) => [h(result.resultNumber), h(result.orderNumber), h(result.patientName), h(result.testName), h(result.facilityName), badge(result.status), shortDateTime(result.uploadedAt), `<button class="btn btn-secondary btn-sm" data-drawer="result" data-id="${result.id}">Review</button>`]);
    return `${heading(...pageMeta["Laboratory Staff"].review)}
      <div class="stats-grid">${stat("Results", state.data.results.length, "results")}${stat("Pending Review", state.data.results.filter((r) => r.status === "Pending Review").length, "clock", "-", "orange")}${stat("Verified", state.data.results.filter((r) => r.status === "Verified").length, "check", "-", "green")}${stat("Released", state.data.results.filter((r) => r.status === "Released").length, "download", "-", "blue")}</div>
      ${filters("Search review queue", [["All statuses", Object.keys(state.data.reports.resultsByStatus || {})]])}
      ${table(["Result ID", "Request No.", "Patient", "Test", "Facility", "Status", "Uploaded", "Action"], rows)}`;
  }

  function renderLabOperations() {
    return `${heading(...pageMeta["Laboratory Staff"].operations)}
      <div class="operations-layout"><section class="card"><div class="card-head"><div><h3 class="card-title">Facility Workload</h3><p class="card-subtitle">Open work by assigned facility.</p></div></div><div class="card-body">${chartFromCounts(state.data.reports.ordersByFacility)}</div></section><section class="card"><div class="card-head"><div><h3 class="card-title">Operational Tasks</h3><p class="card-subtitle">Generated from current database queue</p></div></div><div class="card-body task-list">${state.data.orders.slice(0, 8).map((order) => `<div class="task-item"><span class="check">${icon("check")}</span><div><strong>${h(order.orderNumber)} - ${h(order.tests)}</strong><span>${h(order.patientName)} at ${h(order.facilityName)}</span></div><time>${h(order.status)}</time></div>`).join("") || '<div class="empty-state">No active tasks.</div>'}</div></section></div>`;
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
    const orderRows = state.data.orders.slice(0, 5).map((order) => [h(order.orderNumber), h(order.tests), h(order.facilityName), badge(order.status), shortDate(order.createdAt), `<button class="btn btn-secondary btn-sm" data-drawer="order" data-id="${order.id}">View</button>`]);
    const resultRows = state.data.results.slice(0, 4).map((result) => [h(result.resultNumber), h(result.orderNumber), h(result.testName), badge(result.status), shortDateTime(result.releasedAt), `<button class="btn btn-primary btn-sm" data-drawer="result" data-id="${result.id}">View Result</button>`]);
    return `${heading(...pageMeta.Patient.dashboard)}
      <div class="privacy-banner">${icon("shield")} You are viewing only records linked to patient ID ${h(currentUser.patientProfileId)}.</div>
      <div class="stats-grid">${dashboardStats()}</div>
      <div class="patient-dashboard-grid"><section>${table(["Request No.", "Tests", "Facility", "Status", "Date", "Action"], orderRows, "Your recent laboratory requests")}</section><div class="patient-side-stack">${donutCard("My Request Status", state.data.reports.ordersByStatus, "Requests")}<section>${table(["Result ID", "Request No.", "Test", "Status", "Released", "Action"], resultRows, "Released results only")}</section></div></div>`;
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
    Admin: { dashboard: renderAdminDashboard, users: renderUsers, facilities: renderFacilities, tests: renderTests, orders: () => renderOrders("Admin"), results: () => renderResults("Admin"), reports: renderReports, audit: renderAudit, notifications: () => renderNotifications("Admin"), maintenance: renderAdminMaintenance, profile: renderAdminProfile, settings: renderAdminSettings },
    Doctor: { dashboard: renderDoctorDashboard, patients: () => renderPatients("Doctor"), facilities: renderFacilitiesAndTests, "create-order": renderCreateOrder, orders: () => renderOrders("Doctor"), results: () => renderResults("Doctor"), notifications: () => renderNotifications("Doctor"), profile: renderDoctorProfile, settings: renderDoctorSettings },
    "Laboratory Staff": { dashboard: renderLabDashboard, orders: () => renderOrders("Laboratory Staff"), upload: renderLabUpload, review: renderLabReview, operations: renderLabOperations, facilities: renderLabFacilities, queue: () => renderOrders("Laboratory Staff", "queue"), notifications: () => renderNotifications("Laboratory Staff"), profile: renderLabProfile, settings: renderLabSettings },
    Patient: { dashboard: renderPatientDashboard, orders: () => renderOrders("Patient"), results: () => renderResults("Patient"), notifications: () => renderNotifications("Patient"), profile: renderPatientProfile, settings: renderPatientSettings },
  };

  async function loadAppData() {
    const data = await api("app_data");
    state.data = data;
    currentUser = data.currentUser || currentUser;
    hydrateProfile();
  }

  function setPage(requested = "dashboard", updateHash = true) {
    stopResultCamera();
    const role = currentUser.role;
    const roleRenderers = renderers[role] || {};
    const page = roleRenderers[requested] ? requested : "dashboard";
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
    $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.page === page));
    const meta = pageMeta[role]?.[page] || pageMeta[role]?.dashboard || ["Dashboard"];
    $("#page-title").textContent = meta[0];
    document.title = `${meta[0]} | Centralized Laboratory Results System`;
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
    const roles = ["Admin", "Doctor", "Laboratory Staff", "Patient"];
    const facilityOptions = [{ value: "", label: "Unassigned" }, ...state.data.facilities.map((facility) => ({ value: facility.id, label: facility.name }))];
    return `<form data-form="user"><input type="hidden" name="id" value="${h(user.id || "")}"><div class="form-grid">${field("Full Name", "name", user.name || "", "text", "required")}${field("Email", "email", user.email || "", "email", "required")}${field("Username", "username", user.username || "", "text", 'required minlength="3" maxlength="20" pattern="[A-Za-z0-9._-]{3,20}"')}${field("Contact", "contact", user.contact || "")}<div class="form-field full"><label>Role</label>${select("role", roles, user.role || "Patient", "required")}</div><div class="form-field full"><label>Assigned Facility</label>${select("facilityId", facilityOptions, user.assignedFacilityId || "")}</div><div class="form-field full"><label>Status</label>${select("status", ["Active", "Inactive"], user.status || "Active", "required")}</div>${field(user.id ? "New Password (optional)" : "Password", "password", "", "password", user.id ? "" : "required")}</div><div class="form-actions"><button class="btn btn-secondary" type="button" data-close-drawer>Cancel</button><button class="btn btn-primary" type="submit">Save User</button></div></form>`;
  }

  function facilityForm(facility = {}) {
    return `<form data-form="facility"><input type="hidden" name="id" value="${h(facility.id || "")}"><div class="form-grid">${field("Facility Name", "name", facility.name || "")}${field("Address", "address", facility.address || "", "textarea")}${field("Phone", "phone", facility.phone || "")}${field("Email", "email", facility.email || "", "email")}<div class="form-field full"><label>Status</label>${select("status", ["Active", "Inactive"], facility.status || "Active")}</div></div><div class="form-actions"><button class="btn btn-secondary" type="button" data-close-drawer>Cancel</button><button class="btn btn-primary" type="submit">Save Facility</button></div></form>`;
  }

  function testForm(test = {}) {
    return `<form data-form="test"><input type="hidden" name="id" value="${h(test.id || "")}"><div class="form-grid">${field("Code", "code", test.code || "")}${field("Name", "name", test.name || "")}${field("Category", "category", test.category || "")}${field("Sample Type", "sampleType", test.sampleType || "")}${field("Turnaround Time", "turnaroundTime", test.turnaroundTime || "")}${field("Price", "price", test.price || "0", "number", 'step="0.01"')}${field("Reference Range", "referenceRange", test.referenceRange || "")}${field("Instructions", "instructions", test.instructions || "", "textarea")}<div class="form-field full"><label>Status</label>${select("status", ["Active", "Inactive"], test.status || "Active")}</div></div><div class="form-actions"><button class="btn btn-secondary" type="button" data-close-drawer>Cancel</button><button class="btn btn-primary" type="submit">Save Test</button></div></form>`;
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
    const detailDownload = canDownload ? `<a class="btn btn-primary btn-sm" href="${h(apiUrl("download_result_details", { id: result.id }))}" target="_blank" rel="noopener">${icon("download")} Download Result Details</a>` : "";
    const files = (result.files || []).length
      ? `<div class="attachment-list">${result.files.map((file) => `<a class="attachment-link" href="${h(API_URL.replace(/[^/]+$/, ""))}${h(file.downloadUrl)}" target="_blank" rel="noopener">${icon("file")} <span>Download Uploaded File: ${h(file.originalName)}</span><small>${Math.round((file.sizeBytes || 0) / 1024)} KB</small></a>`).join("")}</div>`
      : '<p>No files attached.</p>';
    return `${drawerInfo([["Result ID", h(result.resultNumber)], ["Request No.", h(result.orderNumber)], ["Patient", h(result.patientName)], ["Test", h(result.testName)], ["Facility", h(result.facilityName)], ["Created", h(shortDateTime(result.createdAt || result.uploadedAt))], ["Updated", h(shortDateTime(result.updatedAt || result.uploadedAt))], ["Released", h(shortDateTime(result.releasedAt))], ["Status", badge(result.status)]])}${detailDownload ? `<div class="result-download-actions">${detailDownload}</div>` : ""}<h3 class="form-section-title">${icon("activity")} Result Values</h3>${valuesTable(result.values)}<div class="clinical-note-box"><h4>${icon("file")} Laboratory Findings</h4><p>${h(result.findings || "No findings entered.")}</p><p>${h(result.remarks || "")}</p></div><div class="clinical-note-box"><h4>${icon("file")} Attachments</h4>${files}</div><div class="clinical-note-box" style="border-color:#ddd2f1;background:#f7f3fc"><h4 style="color:var(--purple)">${icon("note")} Clinical Note</h4><p>${h(result.clinicalNote || "No clinical note has been added.")}</p></div>${noteForm}${labActions}`;
  }

  function resultEditForm(result) {
    if (!result) return '<div class="empty-state">Result not found.</div>';
    const rows = (result.values?.length ? result.values : [{ parameter: "", value: "", unit: "", referenceRange: "", flag: "" }]).map((value) => `<tr><td><input name="parameter" value="${h(value.parameter)}"></td><td><input name="value" value="${h(value.value)}"></td><td><input name="unit" value="${h(value.unit)}"></td><td><input name="referenceRange" value="${h(value.referenceRange)}"></td><td><input name="flag" value="${h(value.flag)}"></td></tr>`).join("");
    return `<form data-form="result-edit"><input type="hidden" name="resultId" value="${h(result.id)}"><div class="form-grid">${field("Findings Summary", "findings", result.findings || "", "textarea", "required")}${field("Remarks", "remarks", result.remarks || "", "textarea")}<div class="form-field full"><label>Add Attachments</label><input name="attachments" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" multiple><small>New files will be added to the result record.</small></div></div><h3 class="form-section-title">${icon("activity")} Result Values</h3><table class="parameter-input-table"><thead><tr><th>Parameter</th><th>Value</th><th>Unit</th><th>Reference</th><th>Flag</th></tr></thead><tbody>${rows}</tbody></table><div class="form-actions"><button class="btn btn-secondary" type="button" data-close-drawer>Cancel</button><button class="btn btn-primary" type="submit">${icon("check")} Save Result</button></div></form>`;
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
    const body = $("#drawer-body");
    $("#drawer-title").textContent = drawerTitle(type);
    const content = {
      user: () => userForm(recordBy("users", id)),
      facility: () => facilityForm(recordBy("facilities", id)),
      test: () => testForm(recordBy("tests", id)),
      order: () => orderDetails(recordBy("orders", id)),
      result: () => resultDetails(recordBy("results", id)),
      "result-edit": () => resultEditForm(recordBy("results", id)),
      patient: () => patientDetails(recordBy("patients", id) || (state.data.availablePatients || []).find((p) => String(p.id) === String(id))),
      notification: () => notificationDetails(recordBy("notifications", id)),
      password: () => passwordForm(),
    }[type];
    body.innerHTML = content ? content() : '<div class="empty-state">Nothing to show.</div>';
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    $(".drawer-scrim").classList.add("open");
    document.body.style.overflow = "hidden";
    setTimeout(() => body.querySelector("input, select, textarea, button")?.focus(), 100);
  }

  function closeDrawer() {
    const drawer = $(".drawer");
    if (!drawer) return;
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    $(".drawer-scrim")?.classList.remove("open");
    document.body.style.overflow = "";
    state.activeDrawer = null;
    state.activeRecordId = null;
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
    if (payload?.app) {
      state.data = payload.app;
      currentUser = payload.app.currentUser || currentUser;
    } else {
      await loadAppData();
    }
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
        result = await api("save_user", payload);
        await refreshAfter(result, "User saved successfully.");
        closeDrawer();
      } else if (kind === "facility") {
        result = await api("save_facility", payload);
        await refreshAfter(result, "Facility saved successfully.");
        closeDrawer();
      } else if (kind === "test") {
        result = await api("save_test", payload);
        await refreshAfter(result, "Test definition saved successfully.");
        closeDrawer();
      } else if (kind === "create-order") {
        payload.testIds = $$('input[name="testIds"]:checked', form).map((input) => input.value);
        result = await api("create_order", payload);
        await refreshAfter(result, "Laboratory request submitted.");
        setPage("orders");
      } else if (kind === "upload-result") {
        const attachmentFiles = [
          ...($('input[name="attachments"]', form)?.files || []),
          ...($("[data-result-scan-input]", form)?.files || []),
        ];
        payload.attachments = await readAttachments(attachmentFiles.filter((file, index, files) => files.findIndex((candidate) => candidate.name === file.name && candidate.size === file.size && candidate.lastModified === file.lastModified) === index));
        payload.values = $$("tbody tr", form).map((row) => ({
          parameter: $('input[name="parameter"]', row)?.value || "",
          value: $('input[name="value"]', row)?.value || "",
          unit: $('input[name="unit"]', row)?.value || "",
          referenceRange: $('input[name="referenceRange"]', row)?.value || "",
          flag: $('input[name="flag"]', row)?.value || "",
        })).filter((item) => item.parameter || item.value);
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
        if (payload.isEnabled && !wasEnabled && !window.confirm("Enabling maintenance mode will prevent patients, doctors, and lab staff from accessing the system. Continue?")) {
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
      toast(error.message || "The request failed.");
    } finally {
      button?.removeAttribute("disabled");
    }
  }

  async function handleDashboardClick(event) {
    const pageLink = event.target.closest("[data-page], [data-go-page]");
    if (pageLink) {
      event.preventDefault();
      setPage(pageLink.dataset.page || pageLink.dataset.goPage);
      closeDrawer();
      return;
    }
    const drawerTrigger = event.target.closest("[data-drawer]");
    if (drawerTrigger) {
      event.preventDefault();
      openDrawer(drawerTrigger.dataset.drawer, drawerTrigger.dataset.id || drawerTrigger.dataset.record || null);
      return;
    }
    if (event.target.closest("[data-close-drawer]")) { closeDrawer(); return; }
    if (event.target.closest("[data-toggle-sidebar]")) { toggleSidebarCollapsed(); return; }
    if (event.target.closest("[data-open-sidebar]")) { openSidebar(); return; }
    if (event.target.closest("[data-close-sidebar]")) { closeSidebar(); return; }
    if (event.target.closest("[data-download]")) { downloadRecords(); return; }

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
      try {
        await api("toggle_user_status", { id: toggleUser.dataset.toggleUser, status: toggleUser.dataset.status });
        await loadAppData();
        setPage(state.page, false);
        toast("User status updated.");
      } catch (error) {
        toast(error.message);
      }
      return;
    }

    const deleteUser = event.target.closest("[data-delete-user]");
    if (deleteUser) {
      const name = deleteUser.dataset.userName || "this user";
      if (!window.confirm(`Deactivate ${name}? They will no longer be able to sign in, but existing laboratory requests and results will remain intact.`)) {
        return;
      }
      try {
        const result = await api("delete_user", { id: deleteUser.dataset.deleteUser });
        await refreshAfter(result, "User deactivated successfully.");
      } catch (error) {
        toast(error.message);
      }
      return;
    }

    const orderStatus = event.target.closest("[data-order-status]");
    if (orderStatus) {
      try {
        const result = await api("update_order_status", { orderId: orderStatus.dataset.id, status: orderStatus.dataset.orderStatus });
        await refreshAfter(result, "Laboratory request status updated.");
        closeDrawer();
      } catch (error) {
        toast(error.message);
      }
      return;
    }

    const resultStatus = event.target.closest("[data-result-status]");
    if (resultStatus) {
      try {
        const result = await api("update_result_status", { resultId: resultStatus.dataset.id, status: resultStatus.dataset.resultStatus });
        await refreshAfter(result, "Result status updated.");
        closeDrawer();
      } catch (error) {
        toast(error.message);
      }
      return;
    }

    const rejectResult = event.target.closest("[data-reject-result]");
    if (rejectResult) {
      const reason = window.prompt("Enter the reason for rejecting this result:");
      if (!reason?.trim()) return;
      try {
        const result = await api("reject_result", { resultId: rejectResult.dataset.rejectResult, reason: reason.trim() });
        await refreshAfter(result, "Result rejected.");
        closeDrawer();
      } catch (error) {
        toast(error.message);
      }
      return;
    }

    const releaseTrigger = event.target.closest("[data-release-result]");
    if (releaseTrigger) {
      openReleaseModal(recordBy("results", releaseTrigger.dataset.releaseResult));
      return;
    }

    if (event.target.closest("[data-release-cancel]")) {
      closeReleaseModal();
      return;
    }

    const releaseConfirm = event.target.closest("[data-release-confirm]");
    if (releaseConfirm) {
      try {
        const result = await api("release_result", { resultId: releaseConfirm.dataset.releaseConfirm });
        await refreshAfter(result, "Result released successfully.");
        closeReleaseModal();
        closeDrawer();
      } catch (error) {
        toast(error.message);
      }
      return;
    }

    const readNotification = event.target.closest("[data-read-notification]");
    if (readNotification) {
      try {
        await api("mark_notification_read", { id: readNotification.dataset.readNotification });
        await loadAppData();
        setPage(state.page, false);
        closeDrawer();
        toast("Notification marked as read.");
      } catch (error) {
        toast(error.message);
      }
      return;
    }

    if (event.target.closest("[data-mark-read]")) {
      try {
        await api("mark_all_notifications_read");
        await loadAppData();
        setPage("notifications", false);
        toast("All notifications marked as read.");
      } catch (error) {
        toast(error.message);
      }
    }
  }

  function applyPageFilters() {
    const content = $("#page-content");
    if (!content) return;
    const searchTerms = [
      $("#global-search")?.value || "",
      ...$$("[data-table-search]", content).map((input) => input.value || ""),
    ].map((value) => value.toLowerCase().trim()).filter(Boolean);
    const selectedTerms = $$(".toolbar select", content)
      .map((control) => control.value || "")
      .filter((value) => value && !value.startsWith("All "))
      .map((value) => value.toLowerCase());
    $$(".data-table tbody tr, .notification-item, .facility-card, .task-item", content).forEach((row) => {
      const text = row.textContent.toLowerCase();
      row.hidden = searchTerms.some((term) => !text.includes(term)) || selectedTerms.some((term) => !text.includes(term));
    });
  }

  function handleDashboardInput(event) {
    if (!event.target.matches("[data-table-search], #global-search")) return;
    applyPageFilters();
  }

  async function handleDashboardChange(event) {
    if (event.target.matches("[data-utilization-anchor], [data-utilization-from], [data-utilization-to]")) {
      if (event.target.matches("[data-utilization-anchor]")) state.utilization.anchor = event.target.value;
      if (event.target.matches("[data-utilization-from]")) state.utilization.from = event.target.value;
      if (event.target.matches("[data-utilization-to]")) state.utilization.to = event.target.value;
      setPage("reports", false);
      return;
    }
    if (event.target.matches("[data-result-scan-input]")) {
      const form = event.target.closest('form[data-form="upload-result"]');
      const file = event.target.files?.[0];
      const preview = $("[data-result-scan-preview]", form);
      if (preview?.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
      if (!file) {
        if (preview) preview.hidden = true;
        updateScannerStatus(form, "Select a sharp, straight-on image with readable parameter names and values.", null, "idle");
        return;
      }
      const objectUrl = URL.createObjectURL(file);
      if (preview) {
        preview.src = objectUrl;
        preview.dataset.objectUrl = objectUrl;
        preview.hidden = false;
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
    try { await api("logout"); } catch { /* ignored during navigation */ }
    location.href = LOGIN_URL;
  }

  function initLoginPage() {
    const loginForm = $("#login-form");
    if (!loginForm) return;
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
    const status = $(".register-status");
    const rules = {
      "patient-full-name": (v) => v.trim().length >= 2 ? "" : "Enter your full name.",
      "patient-dob": (v) => v ? "" : "Select your date of birth.",
      "patient-sex": (v) => v ? "" : "Select an option.",
      "patient-email": (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "" : "Enter a valid email address.",
      "patient-contact": (v) => /^[+\d][\d\s()-]{7,17}$/.test(v.trim()) ? "" : "Enter a valid contact number.",
      "patient-address": (v) => v.trim().length >= 5 ? "" : "Enter your complete address.",
      "patient-username": (v) => /^[a-zA-Z0-9._-]{3,20}$/.test(v) ? "" : "Use 3-20 letters, numbers, dots, hyphens, or underscores.",
      "patient-password": (v) => /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(v) ? "" : "Use 8+ characters with a letter and number.",
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

  async function initProtectedApp() {
    const requiredRole = document.body?.dataset.requiredRole;
    if (!requiredRole) return;
    $("#page-content").innerHTML = loading();
    try {
      await loadAppData();
      if (!currentUser || currentUser.role !== requiredRole) {
        location.replace(currentUser ? destinations[currentUser.role] : LOGIN_URL);
        return;
      }
      hydrateStaticIcons();
      hydrateProfile();
      setPage(location.hash.slice(1) || document.body.dataset.initialPage || "dashboard", false);
      document.addEventListener("click", handleDashboardClick);
      document.addEventListener("submit", handleDashboardSubmit);
      document.addEventListener("input", handleDashboardInput);
      document.addEventListener("change", handleDashboardChange);
      document.addEventListener("keydown", (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
          event.preventDefault();
          $("#global-search")?.focus();
        }
        if (event.key === "Escape") {
          closeDrawer();
          closeSidebar();
        }
      });
      window.addEventListener("hashchange", () => setPage(location.hash.slice(1), false));
    } catch {
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
  hydrateStaticIcons();
  initLoginPage();
  initPatientRegistrationPage();
  initProtectedApp();
})();
