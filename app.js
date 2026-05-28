/**
 * APP.JS — Lógica principal
 * Autenticación por PIN · Subida via backend Vercel · Campo tipo de documento
 */
 
// ── STATE ─────────────────────────────────────────────────────────────────────
 
const State = {
  researchers: [],
  files: [],
  pin: null,
  selectedResearcher: null,
  charts: { bar: null, pie: null, byType: null }, // ← FIX 5: agregado byType
 
  load() {
    // FIX 1: try-catch para que JSON corrupto en localStorage no rompa el DOMContentLoaded
    try {
      this.researchers = JSON.parse(localStorage.getItem("gd_researchers") || "[]");
      this.files       = JSON.parse(localStorage.getItem("gd_files")       || "[]");
    } catch (e) {
      console.warn("localStorage corrupto, reiniciando datos locales.", e);
      this.researchers = [];
      this.files       = [];
      localStorage.removeItem("gd_researchers");
      localStorage.removeItem("gd_files");
    }
    this.pin = sessionStorage.getItem("gd_pin") || null;
  },
 
  save() {
    localStorage.setItem("gd_researchers", JSON.stringify(this.researchers));
    localStorage.setItem("gd_files", JSON.stringify(this.files));
  },
 
  savePin(pin) {
    this.pin = pin;
    sessionStorage.setItem("gd_pin", pin);
  },
 
  clearPin() {
    this.pin = null;
    sessionStorage.removeItem("gd_pin");
  },
 
  addResearcher(r) { this.researchers.push(r); this.save(); },
  removeResearcher(id) {
    this.researchers = this.researchers.filter(r => r.id !== id);
    this.files = this.files.filter(f => f.researcherId !== id);
    this.save();
  },
  addFile(f) { this.files.unshift(f); this.save(); },
  removeFile(id) { this.files = this.files.filter(f => f.id !== id); this.save(); }
};
 
// ── API ───────────────────────────────────────────────────────────────────────
 
const API = {
  async post(endpoint, body) {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: State.pin, ...body })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  },
 
  async verifyPin(pin) {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/verify-pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin })
    });
    return await res.json();
  },
 
  async ensureFolder(folderName) {
    return await this.post("ensure-folder", { folderName });
  },
 
  async getUploadSession(fileName, mimeType, folderId, docType) {
    return await this.post("upload-session", { fileName, mimeType, folderId, docType });
  }
};
 
// ── HELPERS ───────────────────────────────────────────────────────────────────
 
function fmtSize(b) {
  if (!b || b < 1024) return (b || 0) + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(2) + " MB";
}
 
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}
 
function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}
 
function colorFor(i) { return CONFIG.COLORS[i % CONFIG.COLORS.length]; }
 
function esc(s) {
  if (!s) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
 
let _toastTimer;
function showToast(msg, type = "success") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `toast toast-${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.add("hidden"), 3500);
}
 
// FIX 2: isValidDocType eliminada — ya no se necesita con el select
 
// ── INIT ──────────────────────────────────────────────────────────────────────
 
document.addEventListener("DOMContentLoaded", () => {
  State.load();
 
  // Login con PIN
  const pinInput = document.getElementById("pin-input");
  document.getElementById("btn-login").addEventListener("click", doLogin);
  pinInput.addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
 
  // Si ya hay PIN en sesión, entrar directamente
  if (State.pin) {
    showApp();
  }
 
  // Navegación
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
 
  document.getElementById("btn-logout").addEventListener("click", () => {
    State.clearPin();
    document.getElementById("app").classList.add("hidden");
    document.getElementById("login-screen").classList.remove("hidden");
    document.getElementById("pin-input").value = "";
  });
 
  document.getElementById("btn-export").addEventListener("click", exportExcel);
 
  // Investigadores
  document.getElementById("btn-add-researcher").addEventListener("click", () => {
    document.getElementById("add-researcher-form").classList.toggle("hidden");
  });
  document.getElementById("btn-save-researcher").addEventListener("click", saveResearcher);
  document.getElementById("btn-cancel-researcher").addEventListener("click", () => {
    document.getElementById("add-researcher-form").classList.add("hidden");
    clearResearcherForm();
  });
  document.getElementById("field-name").addEventListener("keydown", e => {
    if (e.key === "Enter") saveResearcher();
  });
 
  // FIX 3: Poblar el select de tipos de producto (correctamente indentado)
  const docTypeSelect = document.getElementById("doc-type-input");
  CONFIG.TIPOS_PRODUCTO.forEach(tp => {
    const opt = document.createElement("option");
    opt.value = tp.tipo;
    opt.textContent = `${tp.tipo} — ${tp.puntos} pts`;
    docTypeSelect.appendChild(opt);
  });
  docTypeSelect.addEventListener("change", updateDropZone);
 
  // FIX 4: Drop zone — Producto
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
 
  dropZone.addEventListener("click", () => {
    if (!dropZone.classList.contains("disabled")) fileInput.click();
  });
  dropZone.addEventListener("dragover", e => {
    e.preventDefault();
    if (!dropZone.classList.contains("disabled")) dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
  dropZone.addEventListener("drop", e => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    if (!dropZone.classList.contains("disabled")) {
      const f = e.dataTransfer.files[0];
      if (f) setProductoFile(f);
    }
  });
  fileInput.addEventListener("change", e => {
    if (e.target.files[0]) setProductoFile(e.target.files[0]);
  });
 
  // FIX 4: Drop zone — Certificado
  const certZone = document.getElementById("cert-zone");
  const certInput = document.getElementById("cert-input");
 
  certZone.addEventListener("click", () => {
    if (!certZone.classList.contains("disabled")) certInput.click();
  });
  certZone.addEventListener("dragover", e => {
    e.preventDefault();
    if (!certZone.classList.contains("disabled")) certZone.classList.add("drag-over");
  });
  certZone.addEventListener("dragleave", () => certZone.classList.remove("drag-over"));
  certZone.addEventListener("drop", e => {
    e.preventDefault();
    certZone.classList.remove("drag-over");
    if (!certZone.classList.contains("disabled")) {
      const f = e.dataTransfer.files[0];
      if (f) setCertificadoFile(f);
    }
  });
  certInput.addEventListener("change", e => {
    if (e.target.files[0]) setCertificadoFile(e.target.files[0]);
  });
 
  // Filtros
  document.getElementById("search-input").addEventListener("input", renderFilesTable);
  document.getElementById("filter-researcher").addEventListener("change", renderFilesTable);
});
 
// ── LOGIN ─────────────────────────────────────────────────────────────────────
 
async function doLogin() {
  const pin = document.getElementById("pin-input").value.trim();
  const errEl = document.getElementById("login-error");
  const btn = document.getElementById("btn-login");
 
  if (!pin) {
    errEl.textContent = "Ingresa el PIN para continuar.";
    errEl.classList.remove("hidden");
    return;
  }
 
  // FIX 2: btn.disabled=true va DENTRO del try para que el finally siempre lo reactive.
  // Si estuviera fuera y algo lanzara excepción antes del try, el finally nunca correría
  // y el botón quedaría bloqueado permanentemente.
  try {
    btn.textContent = "Verificando...";
    btn.disabled = true;
    if (errEl) errEl.classList.add("hidden");
 
    const result = await API.verifyPin(pin);
    if (result.ok) {
      State.savePin(pin);
      showApp();
    } else {
      if (errEl) {
        errEl.textContent = "PIN incorrecto. Intenta de nuevo.";
        errEl.classList.remove("hidden");
      }
    }
  } catch (err) {
    if (errEl) {
      errEl.textContent = "No se pudo conectar con el servidor. Verifica que el backend esté activo.";
      errEl.classList.remove("hidden");
    }
  } finally {
    btn.textContent = "Entrar";
    btn.disabled = false;
  }
}
 
function showApp() {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  updateAll();
}
 
// ── TABS ─────────────────────────────────────────────────────────────────────
 
function switchTab(tab) {
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-content").forEach(s => s.classList.toggle("active", s.id === `tab-${tab}`));
  const titles = { dashboard:"Dashboard", upload:"Cargar archivos", researchers:"Investigadores", files:"Archivos" };
  document.getElementById("page-title").textContent = titles[tab];
  updateSubtitle();
  if (tab === "dashboard") renderDashboard();
  if (tab === "upload") renderUploadTab();
  if (tab === "researchers") renderResearchers();
  if (tab === "files") { renderFilterSelect(); renderFilesTable(); }
}
 
function updateSubtitle() {
  document.getElementById("page-subtitle").textContent =
    `${State.files.length} archivos · ${State.researchers.length} investigadores`;
}
 
function updateAll() {
  updateSubtitle();
  renderDashboard();
  renderUploadTab();
  renderResearchers();
  renderFilterSelect();
  renderFilesTable();
}
 
// ── DASHBOARD ─────────────────────────────────────────────────────────────────
 
function renderDashboard() {
  const totalSize = State.files.reduce((a, f) => a + (f.size || 0), 0);
  const thisWeek = State.files.filter(f => (Date.now() - new Date(f.uploadedAt)) < 7 * 86400000).length;
 
  document.getElementById("stat-files").textContent = State.files.length;
  document.getElementById("stat-researchers").textContent = State.researchers.length;
  document.getElementById("stat-size").textContent = fmtSize(totalSize);
  document.getElementById("stat-week").textContent = thisWeek;
 
  const resStats = State.researchers.map((r, i) => ({
    name: r.name.split(" ")[0],
    fullName: r.name,
    count: State.files.filter(f => f.researcherId === r.id).length,
    color: colorFor(i)
  }));
 
  const barCtx = document.getElementById("chart-bar").getContext("2d");
  if (State.charts.bar) State.charts.bar.destroy();
  State.charts.bar = new Chart(barCtx, {
    type: "bar",
    data: {
      labels: resStats.map(r => r.name),
      datasets: [{ data: resStats.map(r => r.count), backgroundColor: resStats.map(r => r.color), borderRadius: 6, borderSkipped: false }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1, color: "#9CA3AF", font: { size: 11 } }, grid: { color: "#F1F5F9" } },
        x: { ticks: { color: "#9CA3AF", font: { size: 11 } }, grid: { display: false } }
      }
    }
  });
 
  const pieData = resStats.filter(r => r.count > 0);
  const pieCtx = document.getElementById("chart-pie").getContext("2d");
  if (State.charts.pie) State.charts.pie.destroy();
  State.charts.pie = new Chart(pieCtx, {
    type: "doughnut",
    data: {
      labels: pieData.map(r => r.fullName),
      datasets: [{ data: pieData.map(r => r.count), backgroundColor: pieData.map(r => r.color), borderWidth: 2, borderColor: "#fff" }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { font: { size: 11 }, color: "#6B7280", padding: 12 } } },
      cutout: "60%"
    }
  });
 
  const recent = State.files.slice(0, 6);
  const el = document.getElementById("recent-files-list");
  if (!recent.length) {
    el.innerHTML = `<p class="empty-msg">No hay archivos cargados aún.</p>`;
  } else {
    el.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Archivo</th><th>Tipo</th><th>Investigador</th><th>Tamaño</th><th>Fecha</th></tr></thead>
        <tbody>${recent.map(f => `
          <tr>
            <td class="file-name-cell"><span class="pdf-icon">PDF</span>${esc(f.name.length > 30 ? f.name.slice(0,28)+"…" : f.name)}</td>
            <td><span class="doctype-tag">${esc(f.docType || "—")}</span></td>
            <td class="muted">${esc(f.researcherName)}</td>
            <td class="muted">${fmtSize(f.size)}</td>
            <td class="muted">${fmtDate(f.uploadedAt)}</td>
          </tr>`).join("")}
        </tbody>
      </table>`;
  }
 
  // FIX 5: Gráfico por tipo de documento
  const typeMap = {};
  State.files.forEach(f => {
    const tipo = f.docType || "Sin tipo";
    if (!typeMap[tipo]) {
      const tipoConfig = CONFIG.TIPOS_PRODUCTO.find(t => t.tipo === tipo);
      typeMap[tipo] = { count: 0, puntos: tipoConfig ? tipoConfig.puntos : 0 };
    }
    typeMap[tipo].count++;
  });
 
  const typeLabels = Object.keys(typeMap);
  const typeCounts = typeLabels.map(t => typeMap[t].count);
  const typePuntos = typeLabels.map(t => typeMap[t].count * typeMap[t].puntos);
  const shortLabels = typeLabels.map(t => t.length > 30 ? t.slice(0, 28) + "…" : t);
 
  const byTypeCtx = document.getElementById("chart-by-type").getContext("2d");
  if (State.charts.byType) State.charts.byType.destroy();
 
  if (!typeLabels.length) {
    State.charts.byType = null;
    return;
  }
 
  State.charts.byType = new Chart(byTypeCtx, {
    type: "bar",
    data: {
      labels: shortLabels,
      datasets: [
        {
          label: "Archivos",
          data: typeCounts,
          backgroundColor: "#3B82F6",
          borderRadius: 4,
          yAxisID: "yCount"
        },
        {
          label: "Puntos acumulados",
          data: typePuntos,
          backgroundColor: "#10B981",
          borderRadius: 4,
          yAxisID: "yPuntos"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: {
        legend: { position: "top", labels: { font: { size: 11 }, color: "#6B7280" } },
        tooltip: {
          callbacks: {
            afterLabel: (ctx) => {
              if (ctx.datasetIndex === 1) {
                const tipo = typeLabels[ctx.dataIndex];
                const pts = typeMap[tipo].puntos;
                return `(${pts} pts × ${typeMap[tipo].count} archivos)`;
              }
              return "";
            }
          }
        }
      },
      scales: {
        yCount: {
          position: "left",
          beginAtZero: true,
          ticks: { stepSize: 1, color: "#9CA3AF", font: { size: 10 } },
          grid: { color: "#F1F5F9" }
        },
        yPuntos: {
          position: "right",
          beginAtZero: true,
          ticks: { color: "#9CA3AF", font: { size: 10 } },
          grid: { display: false }
        },
        x: {
          ticks: { color: "#9CA3AF", font: { size: 10 } },
          grid: { display: false }
        }
      }
    }
  });
}
 
// ── UPLOAD TAB ────────────────────────────────────────────────────────────────
 
function renderUploadTab() {
  const sel = document.getElementById("researcher-selector");
 
  if (!State.researchers.length) {
    sel.innerHTML = `
      <div class="empty-box">
        <p class="empty-msg">No hay investigadores registrados.</p>
        <button class="btn-primary" onclick="switchTab('researchers')">Agregar investigador</button>
      </div>`;
    return;
  }
 
  sel.innerHTML = State.researchers.map((r, i) => {
    const count = State.files.filter(f => f.researcherId === r.id).length;
    const active = State.selectedResearcher === r.id;
    return `
      <button class="researcher-option ${active ? "selected" : ""}" onclick="selectResearcher('${r.id}')">
        <div class="res-avatar" style="background:${colorFor(i)}">${initials(r.name)}</div>
        <div class="res-info">
          <span class="res-name">${esc(r.name)}</span>
          <span class="res-meta">${esc(r.area || r.email || "Sin área")}</span>
        </div>
        <span class="res-count">${count} archivos</span>
      </button>`;
  }).join("");
 
  updateDropZone();
}
 
function selectResearcher(id) {
  State.selectedResearcher = id;
  renderUploadTab();
}
 
// FIX 4: Variables globales para los dos archivos
let _productoFile = null;
let _certificadoFile = null;
 
function setProductoFile(file) {
  if (file.type !== "application/pdf") { showToast("Solo se aceptan archivos PDF", "error"); return; }
  _productoFile = file;
  const hint = document.getElementById("file-selected-name");
  hint.textContent = `✓ ${file.name} (${fmtSize(file.size)})`;
  hint.classList.remove("hidden");
  updateDropZone();
}
 
function setCertificadoFile(file) {
  if (file.type !== "application/pdf") { showToast("Solo se aceptan archivos PDF", "error"); return; }
  _certificadoFile = file;
  const hint = document.getElementById("cert-selected-name");
  hint.textContent = `✓ ${file.name} (${fmtSize(file.size)})`;
  hint.classList.remove("hidden");
  updateDropZone();
}
 
// FIX 4: updateDropZone actualizado para manejar dos zonas
function updateDropZone() {
  const dz = document.getElementById("drop-zone");
  const cz = document.getElementById("cert-zone");
  const badge = document.getElementById("folder-badge");
  const r = State.researchers.find(r => r.id === State.selectedResearcher);
  const docType = document.getElementById("doc-type-input").value.trim();
  const docTypeOk = docType.length > 0;
 
  // Zona producto: se habilita si hay investigador y tipo seleccionado
  if (r && docTypeOk) {
    dz.classList.remove("disabled");
  } else {
    dz.classList.add("disabled");
    _productoFile = null;
    const hint = document.getElementById("file-selected-name");
    if (hint) hint.classList.add("hidden");
  }
 
  // Zona certificado: se habilita solo si ya hay archivo de producto
  if (r && docTypeOk && _productoFile) {
    cz.classList.remove("disabled");
  } else {
    cz.classList.add("disabled");
    _certificadoFile = null;
    const certHint = document.getElementById("cert-selected-name");
    if (certHint) certHint.classList.add("hidden");
  }
 
  // Badge informativo
  if (r && docTypeOk) {
    badge.classList.remove("hidden");
    if (_productoFile && _certificadoFile) {
      badge.innerHTML = `✅ Listo para subir — <strong>${esc(r.folder)}</strong> · <strong>${esc(docType)}</strong>`;
    } else {
      badge.innerHTML = `📁 Carpeta: <strong>${esc(r.folder)}</strong> · Tipo: <strong>${esc(docType)}</strong>`;
    }
  } else {
    badge.classList.add("hidden");
  }
}
 
// ── UPLOAD LOGIC ──────────────────────────────────────────────────────────────
 
// FIX 2 + FIX 4: handleFiles reescrita para subir dos archivos, sin isValidDocType
async function handleFiles() {
  const docType = document.getElementById("doc-type-input").value.trim();
 
  if (!State.selectedResearcher) { showToast("Selecciona un investigador primero", "error"); return; }
  if (!docType) { showToast("El tipo de documento es obligatorio", "error"); return; }
  if (!_productoFile) { showToast("Selecciona el archivo del producto", "error"); return; }
  if (!_certificadoFile) { showToast("Selecciona el archivo del certificado", "error"); return; }
 
  const researcher = State.researchers.find(r => r.id === State.selectedResearcher);
  if (!researcher) return;
 
  const progEl = document.getElementById("upload-progress");
  const progText = document.getElementById("prog-text");
  const progPct = document.getElementById("prog-pct");
  const progFill = document.getElementById("prog-fill");
  const progDetail = document.getElementById("prog-detail");
  progEl.classList.remove("hidden");
 
  try {
    // Crear carpeta del investigador en Drive
    progText.textContent = "Preparando carpeta en Drive...";
    const { folderId } = await API.ensureFolder(researcher.folder);
    researcher.folderId = folderId;
    State.save();
 
    // Subir archivo del producto
    progText.textContent = `Subiendo producto: ${_productoFile.name}`;
    const { uploadUrl: urlProducto, finalName: nameProducto } = await API.getUploadSession(
      _productoFile.name, _productoFile.type || "application/pdf", folderId, docType
    );
    const driveProducto = await uploadToDrive(_productoFile, urlProducto, pct => {
      progPct.textContent = Math.round(pct / 2) + "%";
      progFill.style.width = Math.round(pct / 2) + "%";
    });
    progDetail.textContent = `✓ Producto subido`;
 
    // Subir archivo del certificado
    progText.textContent = `Subiendo certificado: ${_certificadoFile.name}`;
    const { uploadUrl: urlCert, finalName: nameCert } = await API.getUploadSession(
      _certificadoFile.name, _certificadoFile.type || "application/pdf", folderId, docType + "_certificado"
    );
    const driveCert = await uploadToDrive(_certificadoFile, urlCert, pct => {
      progPct.textContent = Math.round(50 + pct / 2) + "%";
      progFill.style.width = Math.round(50 + pct / 2) + "%";
    });
    progDetail.textContent = `✓ Certificado subido`;
 
    // Registrar localmente con ambos archivos
    State.addFile({
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      name: nameProducto || _productoFile.name,
      originalName: _productoFile.name,
      docType: docType,
      size: _productoFile.size,
      researcherId: researcher.id,
      researcherName: researcher.name,
      folder: researcher.folder,
      driveId: driveProducto?.id || null,
      driveLink: driveProducto?.webViewLink || null,
      certName: nameCert || _certificadoFile.name,
      certOriginalName: _certificadoFile.name,
      certSize: _certificadoFile.size,
      certDriveId: driveCert?.id || null,
      certDriveLink: driveCert?.webViewLink || null,
      uploadedAt: new Date().toISOString()
    });
 
    progFill.style.width = "100%";
    progPct.textContent = "100%";
    progText.textContent = "¡Archivos guardados en Drive correctamente!";
    showToast("Producto y certificado subidos ✓");
 
  } catch (err) {
    console.error("Error:", err);
    showToast("Error al subir: " + err.message, "error");
  }
 
  setTimeout(() => {
    progEl.classList.add("hidden");
    progFill.style.width = "0%";
  }, 3500);
 
  // Resetear estado de archivos seleccionados
  _productoFile = null;
  _certificadoFile = null;
  document.getElementById("file-input").value = "";
  document.getElementById("cert-input").value = "";
  document.getElementById("file-selected-name").classList.add("hidden");
  document.getElementById("cert-selected-name").classList.add("hidden");
  updateSubtitle();
  renderUploadTab();
  renderDashboard();
}
 
async function uploadToDrive(file, uploadUrl, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/pdf");
 
    xhr.upload.addEventListener("progress", e => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    });
 
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { resolve({}); }
      } else {
        reject(new Error(`Error al subir: ${xhr.status}`));
      }
    });
 
    xhr.addEventListener("error", () => reject(new Error("Error de red al subir el archivo")));
    xhr.send(file);
  });
}
 
// ── RESEARCHERS ───────────────────────────────────────────────────────────────
 
function clearResearcherForm() {
  document.getElementById("field-name").value = "";
  document.getElementById("field-email").value = "";
  document.getElementById("field-area").value = "";
}
 
async function saveResearcher() {
  const name = document.getElementById("field-name").value.trim();
  if (!name) { showToast("El nombre es obligatorio", "error"); return; }
 
  const folderName = "Inv_" + name.replace(/\s+/g, "_").replace(/[^a-zA-ZÀ-ÿ0-9_\-]/g, "");
 
  State.addResearcher({
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    name,
    email: document.getElementById("field-email").value.trim(),
    area: document.getElementById("field-area").value.trim(),
    folder: folderName,
    folderId: null,
    createdAt: new Date().toISOString()
  });
 
  document.getElementById("add-researcher-form").classList.add("hidden");
  clearResearcherForm();
  updateAll();
  showToast(`"${name}" agregado/a correctamente`);
}
 
function renderResearchers() {
  document.getElementById("researchers-count").textContent =
    `${State.researchers.length} investigadores registrados`;
 
  const list = document.getElementById("researchers-list");
  if (!State.researchers.length) {
    list.innerHTML = `<div class="card"><p class="empty-msg" style="text-align:center;padding:40px 0">No hay investigadores registrados aún.</p></div>`;
    return;
  }
 
  list.innerHTML = State.researchers.map((r, i) => {
    const rFiles = State.files.filter(f => f.researcherId === r.id);
    const totalSize = rFiles.reduce((a, f) => a + (f.size || 0), 0);
    return `
      <div class="card researcher-card">
        <div class="res-avatar big" style="background:${colorFor(i)}">${initials(r.name)}</div>
        <div class="res-body">
          <div class="res-name">${esc(r.name)}</div>
          <div class="res-meta">${r.email ? esc(r.email) + " · " : ""}${esc(r.area || "Sin área")}</div>
          <div class="res-folder">📁 ${esc(r.folder)}</div>
        </div>
        <div class="res-stats">
          <div class="res-stat"><span class="res-stat-value">${rFiles.length}</span><span class="res-stat-label">archivos</span></div>
          <div class="res-stat"><span class="res-stat-value">${fmtSize(totalSize)}</span><span class="res-stat-label">tamaño</span></div>
        </div>
        <button class="btn-delete" onclick="deleteResearcher('${r.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>`;
  }).join("");
}
 
function deleteResearcher(id) {
  const r = State.researchers.find(x => x.id === id);
  if (!confirm(`¿Eliminar a "${r?.name}"? Los registros locales se eliminarán. Los archivos en Drive permanecen.`)) return;
  State.removeResearcher(id);
  if (State.selectedResearcher === id) State.selectedResearcher = null;
  updateAll();
  showToast(`"${r?.name}" eliminado/a`);
}
 
// ── FILES TABLE ───────────────────────────────────────────────────────────────
 
function renderFilterSelect() {
  const sel = document.getElementById("filter-researcher");
  const cur = sel.value;
  sel.innerHTML = `<option value="">Todos los investigadores</option>` +
    State.researchers.map(r => `<option value="${r.id}"${r.id === cur ? " selected" : ""}>${esc(r.name)}</option>`).join("");
}
 
function renderFilesTable() {
  const search = document.getElementById("search-input").value.toLowerCase();
  const filterR = document.getElementById("filter-researcher").value;
 
  const filtered = State.files.filter(f => {
    const matchR = !filterR || f.researcherId === filterR;
    const matchS = !search ||
      f.name.toLowerCase().includes(search) ||
      f.researcherName.toLowerCase().includes(search) ||
      (f.docType || "").toLowerCase().includes(search);
    return matchR && matchS;
  });
 
  const wrap = document.getElementById("files-table-wrap");
  const countLabel = document.getElementById("files-count-label");
 
  if (!filtered.length) {
    wrap.innerHTML = `<p class="empty-msg" style="text-align:center;padding:48px 0">${State.files.length === 0 ? "No hay archivos cargados aún." : "Sin resultados."}</p>`;
    countLabel.textContent = "";
    return;
  }
 
  countLabel.textContent = `Mostrando ${filtered.length} de ${State.files.length} archivos`;
 
  // FIX 4 + FIX (tbody): tabla con columna de certificado
  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Producto</th><th>Certificado</th><th>Tipo</th><th>Investigador</th>
        <th>Carpeta Drive</th><th>Tamaño</th><th>Fecha</th><th></th>
      </tr></thead>
      <tbody>${filtered.map(f => `
        <tr>
          <td class="file-name-cell">
            <span class="pdf-icon">PDF</span>
            ${f.driveLink
              ? `<a href="${esc(f.driveLink)}" target="_blank" class="file-link">${esc(f.name.length > 28 ? f.name.slice(0,26)+"…" : f.name)}</a>`
              : esc(f.name.length > 28 ? f.name.slice(0,26)+"…" : f.name)}
          </td>
          <td class="file-name-cell">
            ${f.certDriveLink
              ? `<a href="${esc(f.certDriveLink)}" target="_blank" class="file-link">📋 ${esc(f.certName && f.certName.length > 20 ? f.certName.slice(0,18)+"…" : f.certName || "Certificado")}</a>`
              : `<span class="muted">—</span>`}
          </td>
          <td><span class="doctype-tag">${esc(f.docType || "—")}</span></td>
          <td class="muted">${esc(f.researcherName)}</td>
          <td><code class="folder-tag">${esc(f.folder)}</code></td>
          <td class="muted">${fmtSize(f.size)}</td>
          <td class="muted">${fmtDate(f.uploadedAt)}</td>
          <td>
            <button class="btn-icon-del" onclick="deleteFileRecord('${f.id}','${f.driveId||''}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </td>
        </tr>`).join("")}
      </tbody>
    </table>`;
}
 
function deleteFileRecord(id, driveId) {
  const f = State.files.find(x => x.id === id);
  if (!confirm(`¿Eliminar el registro de "${f?.name}"?`)) return;
  State.removeFile(id);
  renderFilesTable();
  updateSubtitle();
  showToast(`"${f?.name}" eliminado del registro`);
}
 
// ── EXCEL EXPORT ──────────────────────────────────────────────────────────────
 
function exportExcel() {
  const wb = XLSX.utils.book_new();
 
  const filesData = State.files.map(f => ({
    "Nombre del archivo": f.originalName || f.name,
    "Tipo de documento": f.docType || "",
    "Certificado": f.certOriginalName || f.certName || "",
    "Link certificado": f.certDriveLink || "Sin link",
    "Investigador": f.researcherName,
    "Área": State.researchers.find(r => r.id === f.researcherId)?.area || "",
    "Carpeta Drive": f.folder,
    "Tamaño": fmtSize(f.size),
    "Link en Drive": f.driveLink || "Sin link",
    "Fecha de carga": fmtDate(f.uploadedAt)
  }));
  XLSX.utils.book_append_sheet(wb,
    XLSX.utils.json_to_sheet(filesData.length ? filesData : [{ "Sin datos": "" }]),
    "Archivos"
  );
 
  const statsData = State.researchers.map(r => {
    const rFiles = State.files.filter(f => f.researcherId === r.id);
    const byType = {};
    rFiles.forEach(f => {
      const t = f.docType || "Sin tipo";
      byType[t] = (byType[t] || 0) + 1;
    });
    const totalPuntos = Object.entries(byType).reduce((sum, [tipo, count]) => {
      const cfg = CONFIG.TIPOS_PRODUCTO.find(t => t.tipo === tipo);
      return sum + (cfg ? cfg.puntos * count : 0);
    }, 0);
    return {
      "Investigador": r.name,
      "Email": r.email,
      "Área": r.area,
      "Total archivos": rFiles.length,
      "Puntos totales": totalPuntos,
      "Tamaño total": fmtSize(rFiles.reduce((a, f) => a + (f.size || 0), 0)),
      "Tipos de documentos": Object.entries(byType).map(([k, v]) => `${k}: ${v}`).join(" | "),
      "Carpeta Drive": r.folder,
      "Registrado desde": fmtDate(r.createdAt)
    };
  });
  XLSX.utils.book_append_sheet(wb,
    XLSX.utils.json_to_sheet(statsData.length ? statsData : [{ "Sin datos": "" }]),
    "Estadísticas"
  );
 
  XLSX.writeFile(wb, `Reporte_Investigacion_${new Date().toISOString().slice(0, 10)}.xlsx`);
  showToast("Excel exportado correctamente");
}