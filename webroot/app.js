/**
 * Autocut Charging WebUI — v1.0.0
 * by thaliban04
 * Supports both KernelSU API styles:
 *   - Old: window.ksu.exec(cmd, callback)
 *   - New: import { exec } from 'kernelsu'
 */
'use strict';

const MOD = '/data/adb/modules/AutocutChargingAI';
const CONF = MOD + '/autocut.conf';
const LOG = MOD + '/autocut.log';
const FLAG = MOD + '/cut_active';

// ── API abstraction — supports all KernelSU/APatch WebUI API styles ─────────
let _exec = null;

async function initApi() {
  // Style 1: New ES module API (KernelSU >= 0.9.x)
  try {
    const m = await import('kernelsu');
    if (m && typeof m.exec === 'function') {
      _exec = (cmd) => m.exec(cmd);
      setApiStatus(true, 'ES module');
      return true;
    }
  } catch (_) { }

  // Style 2: Global window.ksu (Older KSU / APatch)
  if (window.ksu && typeof window.ksu.exec === 'function') {
    _exec = (cmd) => new Promise((resolve) => {
      const cbId = '__ac_' + Date.now() + Math.random().toString(36).slice(2, 8);

      // The callback must be a global window function for older APIs
      window[cbId] = (errno, stdout, stderr) => {
        delete window[cbId];

        // Handle variations in callback argument formats
        if (typeof errno === 'string') {
          // Sometimes it returns a single JSON string
          try {
            const res = JSON.parse(errno);
            resolve({ errno: res.errno || 0, stdout: res.stdout || '', stderr: res.stderr || '' });
          } catch {
            resolve({ errno: 0, stdout: errno, stderr: '' });
          }
        } else {
          resolve({ errno: errno || 0, stdout: stdout || '', stderr: stderr || '' });
        }
      };

      try {
        // APatch / Old KSU signature: exec(cmd_string, env_json_string, callback_id_string)
        window.ksu.exec(cmd, '{}', cbId);
      } catch (e) {
        // Fallback signature just in case: exec(cmd, callback_function)
        try {
          window.ksu.exec(cmd, window[cbId]);
        } catch (e2) {
          resolve({ errno: 1, stdout: '', stderr: String(e2) });
        }
      }
    });

    // Quick validation
    const test = await _exec('echo ok');
    if (test && test.stdout && test.stdout.trim() === 'ok') {
      setApiStatus(true, 'global KSU');
      return true;
    }
  }

  setApiStatus(false, 'unavailable');
  return false;
}

function setApiStatus(ok, type) {
  console.log('[Autocut] KernelSU exec API:', type);
  const el = document.getElementById('statusUpdated');
  if (!el) return;
  el.textContent = ok ? `Exec API active (${type})` : 'Exec API unavailable — settings saved locally';
  el.style.color = ok ? 'var(--success)' : 'var(--warning)';
}

async function sh(cmd) {
  if (!_exec) return { stdout: '', stderr: '', errno: -1 };
  try { return await _exec(cmd); }
  catch (e) { return { stdout: '', stderr: String(e), errno: 1 }; }
}

async function readFile(p) {
  const r = await sh(`cat '${p}' 2>/dev/null`);
  return (r.stdout || '').trim();
}

async function writeFile(p, lines) {
  // Write line by line — most reliable approach
  const content = lines.join('\n') + '\n';
  const escaped = content.replace(/\\/g, '\\\\').replace(/'/g, "'\\''");
  const r = await sh(`printf '%s' '${escaped}' > '${p}'`);
  return r.errno === 0;
}

// ── Config ────────────────────────────────────────────────────────────────────
const DEFAULTS = {
  ENABLED: '1', THRESHOLD_SCREEN_OFF: '85', THRESHOLD_SCREEN_ON: '75',
  RESUME_LEVEL: '70', TEMP_LIMIT: '45', CURRENT_LIMIT: '0', NOTIFY: '1',
  POLL_INTERVAL_CHARGING: '60', POLL_INTERVAL_IDLE: '120',
  BYPASS_APPS: '',
};

function parseConf(raw) {
  const c = {};
  raw.split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i < 0) return;
    c[t.slice(0, i).trim()] = t.slice(i + 1).replace(/#.*/, '').trim();
  });
  return c;
}

function buildConfLines(c) {
  return [
    '# Autocut Charging Config',
    `ENABLED=${c.ENABLED}`,
    `THRESHOLD_SCREEN_OFF=${c.THRESHOLD_SCREEN_OFF}`,
    `THRESHOLD_SCREEN_ON=${c.THRESHOLD_SCREEN_ON}`,
    `RESUME_LEVEL=${c.RESUME_LEVEL}`,
    `TEMP_LIMIT=${c.TEMP_LIMIT}`,
    `CURRENT_LIMIT=${c.CURRENT_LIMIT}`,
    `NOTIFY=${c.NOTIFY}`,
    `POLL_INTERVAL_CHARGING=${c.POLL_INTERVAL_CHARGING}`,
    `POLL_INTERVAL_IDLE=${c.POLL_INTERVAL_IDLE}`,
    `BYPASS_APPS=${c.BYPASS_APPS}`,
  ];
}

// localStorage for persistence when exec unavailable
const LS = {
  key: 'autocut_v2',
  save: (c) => { try { localStorage.setItem(LS.key, JSON.stringify(c)); } catch { } },
  load: () => { try { return JSON.parse(localStorage.getItem(LS.key)) || {}; } catch { return {}; } },
};

// ── DOM ───────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const masterToggle = $('masterToggle'), sliderScreenOff = $('sliderScreenOff'),
  sliderScreenOn = $('sliderScreenOn'), sliderResume = $('sliderResume'),
  sliderTemp = $('sliderTemp'), sliderCurrentLimit = $('sliderCurrentLimit'),
  toggleNotify = $('toggleNotify'),
  sliderPollCharging = $('sliderPollCharging'), sliderPollIdle = $('sliderPollIdle'),
  btnSave = $('btnSave'), btnRefreshLog = $('btnRefreshLog'),
  toastEl = $('toast'), logViewer = $('logViewer'), body = document.body;

const displays = {
  sliderScreenOff: { el: $('valScreenOff'), suffix: '%' },
  sliderScreenOn: { el: $('valScreenOn'), suffix: '%' },
  sliderResume: { el: $('valResume'), suffix: '%' },
  sliderTemp: { el: $('valTemp'), suffix: '°C' },
  sliderCurrentLimit: { el: $('valCurrentLimit'), suffix: ' mA' },
  sliderPollCharging: { el: $('valPollCharging'), suffix: 's' },
  sliderPollIdle: { el: $('valPollIdle'), suffix: 's' },
};

function updateMarkers() {
  const m = $('batteryBarMarkers');
  if (!m) return;
  m.innerHTML = '';
  
  const mk = [
    { v: sliderScreenOff.value, c: '#ff453a' },
    { v: sliderScreenOn.value, c: '#ff9f0a' },
    { v: sliderResume.value, c: '#0a84ff' }
  ];

  mk.forEach(x => {
    const d = document.createElement('div');
    d.style.position = 'absolute';
    d.style.left = x.v + '%';
    d.style.top = '0'; d.style.bottom = '0';
    d.style.width = '3px';
    d.style.backgroundColor = x.c;
    d.style.transform = 'translateX(-50%)';
    d.style.boxShadow = '0 0 6px rgba(0,0,0,0.8)';
    d.style.borderRadius = '2px';
    m.appendChild(d);
  });
}

function bindSlider(inpId, valId, suffix) {
  const inp = $(inpId), el = $(valId);
  if (!inp || !el) return;
  inp.addEventListener('input', () => { 
    el.textContent = inp.value + suffix; 
    updateMarkers(); 
    
    // Interactive battery text preview in the cylinder
    const bText = $('batteryText');
    if (bText) {
      bText.textContent = inp.value + suffix;
      bText.style.color = inpId === 'sliderScreenOff' ? '#ff453a' : inpId === 'sliderScreenOn' ? '#ff9f0a' : '#0a84ff';
      clearTimeout(bText.tId);
      bText.tId = setTimeout(() => {
        bText.tId = null;
        bText.textContent = $('statBattery') ? $('statBattery').textContent : '--%';
        bText.style.color = '#ffffff';
      }, 1500);
    }
  });
}

Object.entries(displays).forEach(([id, { el, suffix }]) => {
  bindSlider(id, el.id, suffix);
});

masterToggle.addEventListener('change', () => {
  body.classList.toggle('module-disabled', !masterToggle.checked);
  saveConfig();
});

// Auto-save toggleNotify
toggleNotify.addEventListener('change', saveConfig);

// Debounced auto-save for sliders
let saveTO;
const debouncedSave = () => { clearTimeout(saveTO); saveTO = setTimeout(saveConfig, 1000); };
Object.keys(displays).forEach(id => {
  const el = $(id);
  if (el) el.addEventListener('change', debouncedSave);
});

let toastTO;
function showToast(msg) {
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toastTO); toastTO = setTimeout(() => toastEl.classList.remove('show'), 2800);
}

function applyConf(conf) {
  const get = k => conf[k] || DEFAULTS[k];
  masterToggle.checked = get('ENABLED') !== '0';
  body.classList.toggle('module-disabled', !masterToggle.checked);
  const setS = (el, key) => {
    const v = parseInt(get(key)); el.value = v;
    const d = displays[el.id]; if (d?.el) d.el.textContent = v + d.suffix;
  };
  setS(sliderScreenOff, 'THRESHOLD_SCREEN_OFF');
  setS(sliderScreenOn, 'THRESHOLD_SCREEN_ON');
  setS(sliderResume, 'RESUME_LEVEL');
  setS(sliderTemp, 'TEMP_LIMIT');
  setS(sliderCurrentLimit, 'CURRENT_LIMIT');
  setS(sliderPollCharging, 'POLL_INTERVAL_CHARGING');
  setS(sliderPollIdle, 'POLL_INTERVAL_IDLE');
  toggleNotify.checked = get('NOTIFY') !== '0';
  bypassApps = (get('BYPASS_APPS') || '').split(',').filter(Boolean);
  updateMarkers();
}

let bypassApps = [];
let allApps = [];

async function loadAppList() {
  const container = $('appList');
  if (!container) return;
  
  const res = await sh('pm list packages -3');
  if (res.errno !== 0 || !res.stdout) {
    container.innerHTML = '<div style="text-align: center; color: var(--warning); padding: 20px;">Failed to load apps (exec API unavailable)</div>';
    return;
  }
  
  allApps = res.stdout.split('\n')
    .filter(line => line.startsWith('package:'))
    .map(line => line.replace('package:', '').trim())
    .sort();
    
  renderAppList();
}

function renderAppList(query = '') {
  const container = $('appList');
  if (!container) return;
  container.innerHTML = '';
  
  const q = query.toLowerCase();
  const filtered = allApps.filter(p => p.toLowerCase().includes(q));
  
  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 12px; padding: 20px;">No apps found</div>';
    return;
  }
  
  filtered.forEach(pkg => {
    const isChecked = bypassApps.includes(pkg);
    const div = document.createElement('div');
    div.className = 'app-item';
    div.innerHTML = `
      <div class="app-item-info">
        <div class="app-item-name">${pkg.split('.').pop()}</div>
        <div class="app-item-pkg">${pkg}</div>
      </div>
      <input type="checkbox" class="app-checkbox" value="${pkg}" ${isChecked ? 'checked' : ''} />
    `;
    
    div.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT') {
        const cb = div.querySelector('input');
        cb.checked = !cb.checked;
      }
      const cb = div.querySelector('input');
      if (cb.checked && !bypassApps.includes(pkg)) bypassApps.push(pkg);
      else if (!cb.checked) bypassApps = bypassApps.filter(p => p !== pkg);
    });
    
    container.appendChild(div);
  });
}

$('bypassSearch')?.addEventListener('input', (e) => renderAppList(e.target.value));

async function loadConfig() {
  // Try file first, fallback to localStorage
  const raw = await readFile(CONF);
  const conf = (raw && raw.includes('=')) ? parseConf(raw) : LS.load();
  applyConf(Object.keys(conf).length ? conf : DEFAULTS);
}

async function saveConfig() {
  if (parseInt(sliderResume.value) >= Math.min(parseInt(sliderScreenOff.value), parseInt(sliderScreenOn.value))) {
    showToast('⚠ Resume level must be lower than both thresholds!'); return;
  }
  btnSave.disabled = true;
  btnSave.innerHTML = '<span class="btn-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span> Saving…';
  const conf = {
    ENABLED: masterToggle.checked ? '1' : '0',
    THRESHOLD_SCREEN_OFF: sliderScreenOff.value, THRESHOLD_SCREEN_ON: sliderScreenOn.value,
    RESUME_LEVEL: sliderResume.value, TEMP_LIMIT: sliderTemp.value,
    CURRENT_LIMIT: sliderCurrentLimit.value,
    NOTIFY: toggleNotify.checked ? '1' : '0',
    POLL_INTERVAL_CHARGING: sliderPollCharging.value, POLL_INTERVAL_IDLE: sliderPollIdle.value,
    BYPASS_APPS: bypassApps.join(','),
  };
  LS.save(conf);
  const ok = await writeFile(CONF, buildConfLines(conf));
  showToast(ok ? 'Settings saved to device' : 'Settings saved locally');
  btnSave.innerHTML = '<span class="btn-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span> Saved!';
  setTimeout(() => { btnSave.disabled = false; btnSave.innerHTML = '<span class="btn-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></span> Save & Apply'; }, 2000);
}
btnSave.addEventListener('click', saveConfig);

// ── Battery Chart (Pure SVG) ──────────────────────────────────────────────────
async function renderSVGChart() {
  const container = $('chartContainer');
  if (!container) return;
  const raw = await readFile('/data/adb/modules/AutocutChargingAI/bat_stats.csv');
  if (!raw || raw.errno) return;
  
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('time'));
  if (lines.length < 2) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:12px;padding-top:40px;">Not enough data yet</div>';
    return;
  }

  // Parse Data
  const data = lines.map(l => {
    const p = l.split(',');
    return { time: p[0], bat: parseInt(p[1]), temp: parseInt(p[2]) };
  });

  const w = container.clientWidth;
  const h = container.clientHeight;
  if (w === 0 || h === 0) return;
  
  const padX = 30, padY = 15;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  
  // Math bounds
  const xStep = innerW / (data.length - 1 || 1);
  const maxBat = 100, minBat = 0;
  
  // Dynamic temp bounds for better visibility
  const temps = data.map(d => d.temp);
  const minT = Math.min(...temps) - 2;
  const maxT = Math.max(...temps) + 2;
  const maxTemp = Math.max(50, maxT), minTemp = Math.min(20, minT);

  const getY = (val, min, max) => padY + innerH - ((val - min) / (max - min)) * innerH;

  // Build Paths
  let dBat = '', dTemp = '';
  data.forEach((d, i) => {
    const x = padX + i * xStep;
    const yB = getY(d.bat, minBat, maxBat);
    const yT = getY(d.temp, minTemp, maxTemp);
    if (i === 0) { dBat += `M${x},${yB} `; dTemp += `M${x},${yT} `; }
    else { dBat += `L${x},${yB} `; dTemp += `L${x},${yT} `; }
  });

  // Build SVG String
  const svg = `
    <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <!-- Grid lines -->
      <line x1="${padX}" y1="${padY}" x2="${w-padX}" y2="${padY}" stroke="#ffffff15" stroke-dasharray="2,2"/>
      <line x1="${padX}" y1="${padY + innerH/2}" x2="${w-padX}" y2="${padY + innerH/2}" stroke="#ffffff15" stroke-dasharray="2,2"/>
      <line x1="${padX}" y1="${padY + innerH}" x2="${w-padX}" y2="${padY + innerH}" stroke="#ffffff15"/>
      
      <!-- Axis Labels (Y) -->
      <text x="${padX - 5}" y="${padY + 4}" fill="#ffffff60" font-size="9" text-anchor="end">100%</text>
      <text x="${padX - 5}" y="${padY + innerH + 4}" fill="#ffffff60" font-size="9" text-anchor="end">0%</text>
      
      <!-- Axis Labels (X) First and Last -->
      <text x="${padX}" y="${h - 2}" fill="#ffffff60" font-size="9" text-anchor="middle">${data[0].time}</text>
      <text x="${w - padX}" y="${h - 2}" fill="#ffffff60" font-size="9" text-anchor="middle">${data[data.length-1].time}</text>

      <!-- Paths -->
      <path d="${dBat}" fill="none" stroke="#0a84ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 4px rgba(10,132,255,0.4));"/>
      <path d="${dTemp}" fill="none" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  container.innerHTML = svg;
}

async function loadStatus() {
  const [batR, tmpR, stR, cutR, curR] = await Promise.all([
    sh('cat /sys/class/power_supply/battery/capacity 2>/dev/null'),
    sh('cat /sys/class/power_supply/battery/temp 2>/dev/null'),
    sh('cat /sys/class/power_supply/battery/status 2>/dev/null'),
    sh(`cat '${FLAG}' 2>/dev/null || echo 0`),
    sh('cat /sys/class/power_supply/battery/current_now 2>/dev/null || cat /sys/class/power_supply/charger/current_now 2>/dev/null'),
  ]);
  const bat = parseInt(batR.stdout) || 0;
  const temp = Math.round((parseInt(tmpR.stdout) || 250) / 10);
  const status = (stR.stdout || '').trim() || '—';
  const cut = (cutR.stdout || '').trim() === '1';
  const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
  const col = (id, c) => { const e = $(id); if (e) e.style.color = c; };
  set('statBattery', bat + '%');
  
  const bBar = $('batteryBarFill');
  if (bBar) {
    bBar.style.width = Math.min(bat, 100) + '%';
    bBar.style.backgroundColor = bat < 20 ? 'var(--danger)' : bat < 50 ? 'var(--warning)' : 'var(--success)';
  }

  const bText = $('batteryText');
  if (bText && !bText.tId) {
    bText.textContent = status === '—' ? '—%' : bat + '%';
  }

  const stripes = $('batteryStripes');
  if (stripes) {
    stripes.style.opacity = (status === 'Charging') ? '1' : '0';
  }
  set('statTemp', temp + '°C');
  col('statTemp', temp >= parseInt(sliderTemp.value) ? 'var(--danger)' : 'var(--text-primary)');
  
  // Render Chart
  renderSVGChart();

  let chg = status === 'Charging';
  let statusText = status;
  
  if (chg && curR && curR.stdout) {
    const rawCur = parseInt(curR.stdout.trim());
    if (!isNaN(rawCur) && rawCur !== 0) {
      // Convert microamps to milliamps if needed
      const ma = Math.abs(rawCur > 50000 || rawCur < -50000 ? Math.round(rawCur / 1000) : rawCur);
      statusText = `Charging (${ma} mA)`;
    }
  }

  set('statCharge', statusText); col('statCharge', chg ? 'var(--success)' : 'var(--text-secondary)');
  const ic = $('statChargeIcon');
  if (ic) {
    ic.innerHTML = chg
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>'
      : cut
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8h14v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8z"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
  }
  set('statCut', cut ? 'Yes' : 'No'); col('statCut', cut ? 'var(--warning)' : 'var(--success)');
  const upd = $('statusUpdated');
  if (upd) {
    const working = bat > 0 || status !== '—';
    upd.textContent = working ? 'Updated: ' + new Date().toLocaleTimeString() : 'Live status unavailable (exec API not supported)';
    upd.style.color = working ? '' : 'var(--warning)';
  }
}

async function loadLog() {
  btnRefreshLog.textContent = '↺ Loading…';
  const raw = await readFile(LOG);
  logViewer.textContent = '';
  if (!raw) { logViewer.textContent = 'No log / exec unavailable.'; }
  else {
    raw.split('\n').filter(Boolean).slice(-80).reverse().forEach(line => {
      const d = document.createElement('div'); d.textContent = line;
      d.style.color = line.includes('WARN') ? 'var(--warning)'
        : line.includes('ERROR') ? 'var(--danger)'
          : line.includes('INFO') ? 'var(--accent-2)' : '';
      logViewer.appendChild(d);
    });
  }
  btnRefreshLog.textContent = '↺ Refresh';
}
btnRefreshLog.addEventListener('click', loadLog);

async function init() {
  await initApi();
  await loadConfig();
  await loadAppList();
  await loadStatus();
  await loadLog();
  setInterval(loadStatus, 10000);
}
document.addEventListener('DOMContentLoaded', init);
