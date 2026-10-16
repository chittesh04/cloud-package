/* ============================================
   PSG CloudCampus — Application Logic
   ============================================ */

const state = { token: null, user: null };
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

/* ── TOAST NOTIFICATIONS ── */
function ensureToastContainer() {
  let c = $('.toast-container');
  if (!c) { c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c); }
  return c;
}
function toast(text, type = 'info', duration = 4000) {
  const c = ensureToastContainer();
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  const icons = {
    success: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`,
    error: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>`,
    info: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`
  };
  t.innerHTML = `${icons[type] || icons.info}<span>${text}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; t.style.transition = 'all 0.3s ease'; setTimeout(() => t.remove(), 300); }, duration);
}

/* ── API HELPER ── */
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(`/api/${path}`, { ...options, headers });
  const reqId = res.headers.get('X-Request-ID');
  const data = await res.json().catch(() => ({ error: 'Unexpected response' }));
  if (!res.ok) throw new Error((data.error || 'Request failed') + (reqId ? ` (Trace: ${reqId})` : ''));
  if (reqId) data._reqId = reqId;
  return data;
}

function message(el, text, error = false) {
  el.textContent = text;
  el.className = `form-message ${error ? 'error' : 'success'}`;
}

/* ── TITLE MAP ── */
const viewTitles = {
  home: { title: 'Overview', breadcrumb: 'Dashboard' },
  courses: { title: 'Course Registration', breadcrumb: 'Courses' },
  materials: { title: 'E-Learning Hub', breadcrumb: 'Materials' },
  private: { title: 'Private Records', breadcrumb: 'Secure · VPN' },
  admission: { title: 'Admission', breadcrumb: 'Apply' },
  admin: { title: 'Cloud Monitoring', breadcrumb: 'Admin Dashboard' }
};

/* ── VIEW NAVIGATION ── */
let metricsInterval;
function show(view) {
  $$('.view').forEach(x => x.hidden = x.id !== view);
  $$('.nav-item[data-view]').forEach(x => x.classList.toggle('active', x.dataset.view === view));
  clearInterval(metricsInterval);

  const info = viewTitles[view] || { title: view, breadcrumb: '' };
  $('#topbar-title').innerHTML = `<h2>${info.title}</h2><span class="topbar-breadcrumb">${info.breadcrumb}</span>`;

  // Re-trigger animation
  const viewEl = $(`#${view}`);
  if (viewEl) { viewEl.style.animation = 'none'; viewEl.offsetHeight; viewEl.style.animation = ''; }

  if (view === 'courses') loadCourses();
  if (view === 'materials') loadMaterials();
  if (view === 'private') loadPrivate();
  if (view === 'admin') { loadMetrics(); metricsInterval = setInterval(loadMetrics, 2000); }

  // Close sidebar on mobile
  $('#sidebar').classList.remove('open');
}

/* ── TABLE RENDERER ── */
function renderTable(rows) {
  if (!rows.length) return '<p style="padding:20px;color:var(--gray-500);text-align:center;">No records available.</p>';
  const heads = Object.keys(rows[0]);
  return `<table><thead><tr>${heads.map(x => `<th>${x.replaceAll('_', ' ')}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${heads.map(h => `<td>${String(r[h] ?? '').replace('T', ' ').slice(0, 19)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

/* ── COURSES ── */
async function loadCourses() {
  try {
    const rows = await api('courses');
    $('#course-list').innerHTML = rows.map((c, i) => `
      <article style="animation-delay:${i * 0.06}s" class="animate-in">
        <span class="pill pill--public">${c.code}</span>
        <h3>${c.title}</h3>
        <p>${c.department}<br>${c.credits} credits · ${c.seats} seats available</p>
        <button class="btn btn-primary btn-sm" onclick="registerCourse(${c.id})">
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
          Register for Semester 5
        </button>
      </article>
    `).join('');
  } catch (e) {
    $('#course-list').innerHTML = `<p style="color:var(--rose-500);padding:20px;">${e.message}</p>`;
  }
}

/* ── MATERIALS ── */
async function loadMaterials() {
  try {
    const rows = await api('materials');
    $('#material-list').innerHTML = rows.map((m, i) => `
      <article style="animation-delay:${i * 0.06}s" class="animate-in">
        <span class="pill pill--public">${m.course_code}</span>
        <h3>${m.title}</h3>
        <p>${m.description}</p>
        <a class="resource" href="${m.resource_url}" target="_blank">
          Open learning resource
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/></svg>
        </a>
      </article>
    `).join('');
  } catch (e) {
    $('#material-list').innerHTML = `<p style="color:var(--rose-500);padding:20px;">${e.message}</p>`;
  }
}

/* ── PRIVATE RECORDS ── */
async function loadPrivate() {
  try {
    const [a, f] = await Promise.all([api('academics'), api('finance')]);
    $('#academic-records').innerHTML = `<p class="trace-info">Trace: ${a._reqId || ''} → ${a._trace?.private_service || 'private-api'}</p>` + renderTable(a.records);
    $('#finance-records').innerHTML = `<p class="trace-info">Trace: ${f._reqId || ''} → ${f._trace?.private_service || 'private-api'}</p>` + renderTable(f.records);
  } catch (e) {
    $('#academic-records').innerHTML = `<p style="color:var(--rose-500);padding:20px;">${e.message}</p>`;
  }
}

/* ── CHARTS ── */
let charts = {};
const chData = { t: [], reqs: [], rep: [], avgL: [], p95L: [] };

function initCharts() {
  if (charts.traffic) return;
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = '#64748b';

  const gridColor = 'rgba(226,232,240,0.6)';

  charts.traffic = new Chart($('#traffic-chart').getContext('2d'), {
    type: 'line',
    data: { labels: chData.t, datasets: [{ label: 'Req/s', data: chData.reqs, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.08)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4 }] },
    options: { animation: { duration: 0 }, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: gridColor } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } } } }
  });
  charts.replicas = new Chart($('#replicas-chart').getContext('2d'), {
    type: 'bar',
    data: { labels: chData.t, datasets: [{ label: 'Replicas', data: chData.rep, backgroundColor: 'rgba(139,92,246,0.6)', borderRadius: 4, borderSkipped: false }] },
    options: { animation: { duration: 0 }, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: gridColor } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } } } }
  });
  charts.latency = new Chart($('#latency-chart').getContext('2d'), {
    type: 'line',
    data: { labels: chData.t, datasets: [
      { label: 'Avg Latency', data: chData.avgL, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.06)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 0 },
      { label: 'P95', data: chData.p95L, borderColor: '#f59e0b', borderDash: [5, 5], tension: 0.4, borderWidth: 2, pointRadius: 0 }
    ] },
    options: { animation: { duration: 0 }, scales: { y: { beginAtZero: true, grid: { color: gridColor } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } } } }
  });
}

function updateCharts(m) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  chData.t.push(time);
  chData.reqs.push(m.traffic.requestsPerSec);
  chData.rep.push(m.capacity.currentReplicas);
  chData.avgL.push(m.traffic.avgLatencyMs);
  chData.p95L.push(m.traffic.p95LatencyMs);
  if (chData.t.length > 30) { chData.t.shift(); chData.reqs.shift(); chData.rep.shift(); chData.avgL.shift(); chData.p95L.shift(); }
  charts.traffic.update();
  charts.replicas.update();
  charts.latency.update();
}

/* ── ADMIN METRICS ── */
async function loadMetrics() {
  try {
    const m = await api('admin/metrics');
    const statusClass = (v) => v === 'HEALTHY' ? 'healthy' : 'error';

    $('#metric-system').innerHTML = `
      <div class="status-row"><span>Public Cloud</span><span class="status-indicator healthy">● ${m.system.publicCloud}</span></div>
      <div class="status-row"><span>Private Cloud</span><span class="status-indicator ${statusClass(m.system.privateCloud)}">● ${m.system.privateCloud}</span></div>
      <div class="status-row"><span>Hybrid Link</span><span class="status-indicator ${statusClass(m.system.hybridLink)}">● ${m.system.hybridLink}</span></div>
      <div class="status-row"><span>Database</span><span class="status-indicator healthy">● ${m.system.database}</span></div>
      <div class="status-row"><span>Services</span><span style="text-align:right;font-size:0.8em;color:var(--gray-500)">${m.services.join('<br>')}</span></div>
    `;

    // Update top-level cloud pill
    const allHealthy = m.system.privateCloud === 'HEALTHY' && m.system.hybridLink === 'HEALTHY';
    const pill = $('#cloud-status-pill');
    if (allHealthy) {
      pill.innerHTML = '<span class="status-dot status-dot--ok"></span><span>All systems operational</span>';
      pill.style.background = 'var(--emerald-50)';
      pill.style.borderColor = 'rgba(16,185,129,0.2)';
      pill.style.color = 'var(--emerald-600)';
    } else {
      pill.innerHTML = '<span class="status-dot status-dot--error"></span><span>Degraded</span>';
      pill.style.background = 'var(--rose-50)';
      pill.style.borderColor = 'rgba(244,63,94,0.2)';
      pill.style.color = 'var(--rose-600)';
    }

    $('#metric-traffic').innerHTML = `
      <div class="status-row"><span>Requests/sec</span><strong>${m.traffic.requestsPerSec}</strong></div>
      <div class="status-row"><span>Average latency</span><strong>${m.traffic.avgLatencyMs} ms</strong></div>
      <div class="status-row"><span>P95 latency</span><strong>${m.traffic.p95LatencyMs} ms</strong></div>
      <div class="status-row"><span>Error rate</span><strong>${m.traffic.errorRatePct}%</strong></div>
    `;
    $('#metric-capacity').innerHTML = `
      <div class="status-row"><span>Current replicas</span><strong>${m.capacity.currentReplicas}</strong></div>
      <div class="status-row"><span>Min replicas</span><strong>${m.capacity.minReplicas}</strong></div>
      <div class="status-row"><span>Max replicas</span><strong>${m.capacity.maxReplicas}</strong></div>
      <div class="status-row"><span>Scaling state</span><strong class="${m.capacity.scalingState === 'BURST MODE' ? 'pill pill--admin' : ''}">${m.capacity.scalingState}</strong></div>
    `;
    $('#metric-hybrid').innerHTML = `
      <div class="status-row"><span>Pub → Priv requests</span><strong>${m.hybrid.totalRequests}</strong></div>
      <div class="status-row"><span>Successful</span><strong class="success">${m.hybrid.successful}</strong></div>
      <div class="status-row"><span>Failed</span><strong class="error">${m.hybrid.failed}</strong></div>
    `;

    initCharts();
    updateCharts(m);
  } catch (e) {
    $('#metrics-grid').innerHTML = `<p style="color:var(--rose-500);padding:20px;grid-column:1/-1;">${e.message}</p>`;
  }
}

/* ── COURSE REGISTRATION ── */
window.registerCourse = async id => {
  try {
    const r = await api('registrations', { method: 'POST', body: JSON.stringify({ course_id: id, semester: 'Semester 5' }) });
    toast(r.message, 'success');
  } catch (e) {
    toast(e.message, 'error');
  }
};

/* ── LOGIN ── */
$('#login-form').onsubmit = async e => {
  e.preventDefault();
  const btn = $('#login-btn');
  const btnText = btn.querySelector('.btn-text');
  const btnLoader = btn.querySelector('.btn-loader');
  const f = new FormData(e.target);

  // Show loading state
  btnText.textContent = 'Signing in…';
  btnLoader.hidden = false;
  btn.disabled = true;

  try {
    const r = await api('auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(f)) });
    state.token = r.token;
    state.user = r.user;

    // Transition to app
    $('#auth-screen').style.opacity = '0';
    $('#auth-screen').style.transform = 'scale(1.02)';
    $('#auth-screen').style.transition = 'all 0.4s ease';

    setTimeout(() => {
      $('#auth-screen').hidden = true;
      $('#app-shell').hidden = false;
      $('#app-shell').style.animation = 'fadeIn 0.5s ease-out';

      // Set user info
      const initials = r.user.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      $('#user-avatar').textContent = initials;
      $('#user-name').textContent = r.user.full_name;
      $('#user-role').textContent = r.user.role;
      $('#admin-tab').hidden = r.user.role !== 'admin';

      show('home');
      toast(`Welcome back, ${r.user.full_name}!`, 'success');
    }, 400);
  } catch (err) {
    message($('#login-message'), err.message, true);
    btnText.textContent = 'Sign in securely';
    btnLoader.hidden = true;
    btn.disabled = false;
  }
};

/* ── ADMISSION ── */
$('#admission-form').onsubmit = async e => {
  e.preventDefault();
  try {
    const r = await api('admissions', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target))) });
    message($('#admission-message'), `${r.message}. Reference #${r.application.id}`);
    toast('Application submitted successfully!', 'success');
    e.target.reset();
  } catch (err) {
    message($('#admission-message'), err.message, true);
    toast(err.message, 'error');
  }
};

/* ── NAV BINDINGS ── */
$$('.nav-item[data-view]').forEach(b => b.onclick = () => show(b.dataset.view));
$('#refresh-metrics').onclick = () => { loadMetrics(); toast('Metrics refreshed', 'info', 2000); };
$('#logout').onclick = () => location.reload();

/* ── SIDEBAR TOGGLE (mobile) ── */
$('#sidebar-toggle').onclick = () => $('#sidebar').classList.toggle('open');

/* ── CHAOS ENGINEERING ── */
let privateChaos = false;
$('#btn-chaos-private').onclick = async () => {
  privateChaos = !privateChaos;
  try {
    const r = await api('admin/chaos/private', { method: 'POST', body: JSON.stringify({ active: privateChaos }) });
    toast(r.message, privateChaos ? 'error' : 'success');
    const btn = $('#btn-chaos-private');
    if (privateChaos) {
      btn.className = 'btn btn-success';
      btn.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg> Restore Private API`;
    } else {
      btn.className = 'btn btn-danger';
      btn.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg> Kill Private API`;
    }
  } catch (e) {
    toast(e.message, 'error');
  }
};

$('#btn-chaos-public').onclick = async () => {
  try {
    const r = await api('admin/chaos/public-cpu', { method: 'POST' });
    toast(r.message, 'info');
  } catch (e) {
    toast(e.message, 'error');
  }
};
