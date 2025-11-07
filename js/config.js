/* =====================================
   BACKEND BASE URL
===================================== */
const BACKEND = "https://medsync-backend-yk9h.onrender.com";

/* =====================================
   API FETCH WRAPPER
===================================== */
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem("med_token") || "";
  options.headers = options.headers || {};
  if (token) options.headers["Authorization"] = "Bearer " + token;

  let res;
  try {
    res = await fetch(BACKEND + endpoint, options);
  } catch {
    throw new Error("Network Error");
  }

  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data.error || "Error");
  return data;
}

/* =====================================
   AUTH HELPERS
===================================== */
function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}
window.logout = logout;

function requireRole(role) {
  const t = localStorage.getItem("med_token");
  const r = localStorage.getItem("med_role");
  if (!t || r !== role) window.location.href = "login.html";
}
window.requireRole = requireRole;

/* =====================================
   SIDEBAR TAB SYSTEM (shared)
===================================== */
function setupTabs() {
  const links = document.querySelectorAll(".sidebar a[data-tab]");
  const panels = document.querySelectorAll(".tab-panel");
  if (!links.length) return;

  function activate(tab) {
    links.forEach(a => a.classList.toggle("active", a.dataset.tab === tab));
    panels.forEach(p => p.classList.toggle("active", p.id === tab));
  }

  links.forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      const tab = a.dataset.tab;
      activate(tab);

      // Lazy load per tab when needed
      if (tab === "hospitals" && typeof loadHospitalList === "function") loadHospitalList();
      if (tab === "patients" && typeof loadHospitalPatients === "function") loadHospitalPatients();
      if (tab === "upload" && typeof loadHospitalUploads === "function") loadHospitalUploads();
    });
  });

  // default open first tab
  activate(links[0].dataset.tab);
}

/* =====================================
   SIGNUP + LOGIN
===================================== */
async function handleSignup() {
  const nameEl = document.getElementById("signup_name");
  const emailEl = document.getElementById("signup_email");
  const pass1El = document.getElementById("signup_pass");
  const pass2El = document.getElementById("signup_pass2");
  const roleEl = document.getElementById("signup_role");
  const errEl  = document.getElementById("signup_error");

  if (!nameEl || !emailEl || !pass1El || !pass2El || !roleEl) return; // not on signup page
  errEl && (errEl.textContent = "");

  const username = nameEl.value.trim();
  const email = emailEl.value.trim();
  const password = pass1El.value;
  const password2 = pass2El.value;
  const role = roleEl.value;

  if (!username || !email || !password || !password2 || !role) {
    if (errEl) errEl.textContent = "All fields are required.";
    return;
  }
  if (password !== password2) {
    if (errEl) errEl.textContent = "Passwords do not match.";
    return;
  }

  try {
    const res = await apiFetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password, role })
    });
    alert("Account created! Your CID: " + (res.cid || ""));
    window.location.href = "login.html";
  } catch (e) {
    if (errEl) errEl.textContent = e.message;
  }
}
window.handleSignup = handleSignup;

async function handleLogin() {
  const emailEl = document.getElementById("login_email");
  const passEl  = document.getElementById("login_pass");
  const errEl   = document.getElementById("login_error");

  if (!emailEl || !passEl) return; // not on login page
  errEl && (errEl.textContent = "");

  const email = emailEl.value.trim();
  const password = passEl.value;

  if (!email || !password) {
    if (errEl) errEl.textContent = "Email and password are required.";
    return;
  }

  try {
    const res = await apiFetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    // Persist session
    localStorage.setItem("med_token", res.token);
    localStorage.setItem("med_role", res.role);
    localStorage.setItem("med_user", res.username);
    localStorage.setItem("med_cid", res.cid);

    // Route by role
    if (res.role === "patient") window.location.href = "patient_dashboard.html";
    else window.location.href = "hospital_dashboard.html";
  } catch (e) {
    if (errEl) errEl.textContent = e.message;
  }
}
window.handleLogin = handleLogin;

/* =====================================
   PATIENT DASHBOARD
   - Welcome / All Reports
   - Hospitals list
   - Hospital detail (Option B full view)
===================================== */
async function initPatientDashboard() {
  setupTabs();

  const user = localStorage.getItem("med_user") || "";
  const cid  = localStorage.getItem("med_cid") || "";

  const u1 = document.getElementById("username_display");
  const p1 = document.getElementById("profile_name");
  const cids = document.querySelectorAll("#cid_display, #cid_display_profile");

  if (u1) u1.textContent = user;
  if (p1) p1.textContent = user;
  cids.forEach(el => el && (el.textContent = cid));

  if (document.getElementById("report_grid")) loadAllReports();
  if (document.getElementById("hospital_grid")) loadHospitalList();

  const backBtn = document.getElementById("back_to_hospitals");
  if (backBtn) backBtn.onclick = () => showTab("hospitals");
}
window.initPatientDashboard = initPatientDashboard;

async function loadAllReports() {
  const box = document.getElementById("report_grid");
  if (!box) return;

  try {
    const reports = await apiFetch("/api/patient/reports");
    box.innerHTML = reports.map(r => `
      <div class="card">
        <h3>${r.original_name}</h3>
        <p class="muted">${r.hospital_name}</p>
        <p class="muted">${r.uploaded_at}</p>
        <a class="btn small" href="${BACKEND}/download/${r.filename}" target="_blank">Download</a>
      </div>
    `).join("");
  } catch (err) {
    box.innerHTML = `<p class="muted">${err.message}</p>`;
  }
}

async function loadHospitalList() {
  const box = document.getElementById("hospital_grid");
  if (!box) return;

  try {
    const reports = await apiFetch("/api/patient/reports");
    const hospitals = [...new Set(reports.map(r => r.hospital_name))];

    box.innerHTML = hospitals.map(h => `
      <div class="hospital-card" onclick="openHospital('${h.replace(/'/g, "\\'")}')">
        <h3>${h}</h3>
        <p class="muted">Click to view reports</p>
      </div>
    `).join("");
  } catch (err) {
    box.innerHTML = `<p class="muted">${err.message}</p>`;
  }
}

async function openHospital(hosName) {
  showTab("hospital_view");

  const title = document.getElementById("hospital_title");
  const box = document.getElementById("hospital_reports");
  if (title) title.textContent = hosName;
  if (!box) return;

  try {
    const reports = await apiFetch("/api/patient/reports");
    const filtered = reports.filter(r => r.hospital_name === hosName);

    box.innerHTML = filtered.map(r => `
      <div class="card">
        <h3>${r.original_name}</h3>
        <p class="muted">${r.uploaded_at}</p>
        <a class="btn small" href="${BACKEND}/download/${r.filename}" target="_blank">Download</a>
      </div>
    `).join("");
  } catch (err) {
    box.innerHTML = `<p class="muted">${err.message}</p>`;
  }
}
window.openHospital = openHospital;

/* Programmatic tab switch (shared) */
function showTab(id) {
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  const target = document.getElementById(id);
  if (target) target.classList.add("active");
}
window.showTab = showTab;

/* =====================================
   HOSPITAL DASHBOARD (Option B)
   - Patients list (from your uploads)
   - Patient view (only that patient's reports)
   - Upload report
   - My uploads
   - Profile
===================================== */
async function initHospitalDashboard() {
  setupTabs();

  // identity
  const name = localStorage.getItem("med_user") || "";
  const cid  = localStorage.getItem("med_cid") || "";

  const u1 = document.getElementById("username_display");
  const u2 = document.getElementById("username_display_2");
  const cidEl = document.getElementById("profile_cid");

  if (u1) u1.textContent = name;
  if (u2) u2.textContent = name;
  if (cidEl) cidEl.textContent = cid;

  if (document.getElementById("patients_grid")) loadHospitalPatients();
  if (document.getElementById("my_uploads")) loadHospitalUploads();

  const backBtn = document.getElementById("back_to_patients");
  if (backBtn) backBtn.onclick = () => showTab("patients");

  const upBtn = document.querySelector(".upload-btn");
  if (upBtn) {
    upBtn.addEventListener("click", async () => {
      const msg = document.getElementById("upload_msg");
      const inputCid = document.getElementById("upload_cid");
      const inputFile = document.getElementById("upload_file");
      if (msg) msg.textContent = "";

      const patientCID = inputCid ? inputCid.value.trim() : "";
      const file = inputFile ? inputFile.files[0] : null;

      if (!patientCID || !file) {
        if (msg) msg.textContent = "Missing CID or file.";
        return;
      }

      try {
        const patient = await apiFetch(`/api/hospital/find_patient?cid=${encodeURIComponent(patientCID)}`);

        const fd = new FormData();
        fd.append("patient_id", patient.id);
        fd.append("report_file", file);

        await apiFetch("/api/hospital/upload", { method: "POST", body: fd });

        if (msg) msg.textContent = "✅ Uploaded successfully!";
        if (inputCid) inputCid.value = "";
        if (inputFile) inputFile.value = "";

        if (typeof loadHospitalUploads === "function") loadHospitalUploads();
        if (typeof loadHospitalPatients === "function") loadHospitalPatients();

      } catch (err) {
        if (msg) msg.textContent = "❌ " + err.message;
      }
    });
  }
}
window.initHospitalDashboard = initHospitalDashboard;

async function loadHospitalPatients() {
  const grid = document.getElementById("patients_grid");
  if (!grid) return;

  try {
    const list = await apiFetch("/api/hospital/reports");

    // group by patient_cid
    const map = new Map();
    list.forEach(r => {
      const key = r.patient_cid || "Unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });

    // sort patient CIDs
    const patients = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));

    grid.innerHTML = patients.map(cid => {
      const count = map.get(cid).length;
      return `
        <div class="card clickable" onclick="openPatient('${cid.replace(/'/g, "\\'")}')">
          <h3>${cid}</h3>
          <p class="muted">${count} report${count > 1 ? "s" : ""}</p>
        </div>
      `;
    }).join("");

  } catch (err) {
    grid.innerHTML = `<p class="muted">${err.message}</p>`;
  }
}

async function openPatient(patientCid) {
  showTab("patient_view");

  const title = document.getElementById("patient_title");
  const box = document.getElementById("patient_reports");
  if (title) title.textContent = `Patient ${patientCid}`;
  if (!box) return;

  try {
    const list = await apiFetch("/api/hospital/reports");
    const filtered = list.filter(r => r.patient_cid === patientCid);

    // newest first (optional)
    filtered.sort((a, b) => (b.uploaded_at || "").localeCompare(a.uploaded_at || ""));

    box.innerHTML = filtered.map(r => `
      <div class="card">
        <h3>${r.original_name}</h3>
        <p class="muted">${r.uploaded_at}</p>
        <a class="btn small" href="${BACKEND}/download/${r.filename}" target="_blank">Download</a>
      </div>
    `).join("");

  } catch (err) {
    box.innerHTML = `<p class="muted">${err.message}</p>`;
  }
}
window.openPatient = openPatient;

async function loadHospitalUploads() {
  const box = document.getElementById("my_uploads");
  if (!box) return;

  try {
    const list = await apiFetch("/api/hospital/reports");

    // newest first (optional)
    list.sort((a, b) => (b.uploaded_at || "").localeCompare(a.uploaded_at || ""));

    box.innerHTML = list.map(r => `
      <div class="card">
        <h3>${r.original_name}</h3>
        <p class="muted">CID: ${r.patient_cid}</p>
        <p class="muted">${r.uploaded_at}</p>
        <a class="btn small" href="${BACKEND}/download/${r.filename}" target="_blank">Download</a>
      </div>
    `).join("");

  } catch (err) {
    box.innerHTML = `<p class="muted">${err.message}</p>`;
  }
}
