const $ = (sel) => document.querySelector(sel);

const els = {
  dropzone: $('#dropzone'),
  fileInput: $('#fileInput'),
  convertPanel: $('#convertPanel'),
  resultPanel: $('#resultPanel'),
  fileName: $('#fileName'),
  fileMeta: $('#fileMeta'),
  qualityRow: $('#qualityRow'),
  quality: $('#quality'),
  qualityValue: $('#qualityValue'),
  targets: $('#targets'),
  convertBtn: $('#convertBtn'),
  status: $('#status'),
  resetBtn: $('#resetBtn'),
  resultName: $('#resultName'),
  downloadLink: $('#downloadLink'),
  againBtn: $('#againBtn'),
};

const MEDIA_CATEGORIES = new Set(['image', 'audio', 'video']);

let currentFile = null;
let currentTarget = null;
let categoryLabels = {};

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function extOf(name) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function setStatus(el, text, isError = false) {
  el.textContent = text;
  el.classList.remove('hidden');
  el.classList.toggle('err', isError);
}

async function boot() {
  try {
    const res = await fetch('/api/formats');
    const data = await res.json();
    categoryLabels = Object.fromEntries((data.categories ?? []).map((c) => [c.id, c.label]));
  } catch {
    setStatus(els.status, 'Could not reach the server', true);
  }
}

function selectFile(file) {
  currentFile = file;
  currentTarget = null;
  els.convertBtn.disabled = true;
  els.fileName.textContent = file.name;
  els.fileMeta.textContent = humanSize(file.size);
  els.convertPanel.classList.remove('hidden');
  els.resultPanel.classList.add('hidden');
  els.status.classList.add('hidden');

  const ext = extOf(file.name);
  loadTargets(ext);
}

async function loadTargets(ext) {
  els.targets.innerHTML = '';
  els.qualityRow.classList.add('hidden');
  try {
    const res = await fetch(`/api/targets?from=${encodeURIComponent(ext)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unknown format');
    renderTargets(data);
  } catch (err) {
    setStatus(els.status, err.message, true);
  }
}

function renderTargets(data) {
  const grouped = new Map();
  for (const t of data.targets) {
    if (!grouped.has(t.category)) grouped.set(t.category, []);
    grouped.get(t.category).push(t);
  }

  const buttons = [];
  for (const [category, list] of grouped) {
    const label = categoryLabels[category] ?? category;
    buttons.push(`<div class="target-group-label">${label}</div>`);
    for (const t of list) {
      buttons.push(`<button class="target-btn" data-ext="${t.ext}">${t.label}</button>`);
    }
  }

  if (data.action) {
    buttons.push(`<div class="target-group-label">Archive</div>`);
    buttons.push(`<button class="target-btn" data-ext="${data.action.id}">${data.action.label}</button>`);
  }

  els.targets.innerHTML = buttons.join('');

  els.targets.querySelectorAll('.target-btn').forEach((btn, i) => {
    btn.style.animationDelay = `${i * 24}ms`;
    btn.addEventListener('click', () => {
      els.targets.querySelectorAll('.target-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentTarget = btn.dataset.ext;
      els.convertBtn.disabled = false;
      const showQuality = MEDIA_CATEGORIES.has(data.category);
      els.qualityRow.classList.toggle('hidden', !showQuality);
    });
  });
}

async function convert() {
  if (!currentFile || !currentTarget) return;
  els.convertBtn.disabled = true;
  els.convertBtn.classList.add('loading');
  els.convertBtn.querySelector('.btn-label').textContent = 'Converting…';
  els.status.classList.remove('hidden');
  setStatus(els.status, 'Processing file…');

  const form = new FormData();
  form.append('file', currentFile);
  form.append('to', currentTarget);
  if (!els.qualityRow.classList.contains('hidden')) {
    form.append('quality', els.quality.value);
  }

  try {
    const res = await fetch('/api/convert', { method: 'POST', body: form });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const name = filenameFromHeader(res) || `${currentFile.name.replace(/\.[^.]+$/, '')}.${currentTarget}`;
    els.downloadLink.href = url;
    els.downloadLink.setAttribute('download', name);
    els.resultName.textContent = name;
    els.convertPanel.classList.add('hidden');
    els.resultPanel.classList.remove('hidden');
  } catch (err) {
    setStatus(els.status, err.message, true);
  } finally {
    els.convertBtn.disabled = false;
    els.convertBtn.classList.remove('loading');
    els.convertBtn.querySelector('.btn-label').textContent = 'Convert';
  }
}

function filenameFromHeader(res) {
  const cd = res.headers.get('content-disposition');
  if (!cd) return null;
  const m = cd.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

function reset() {
  currentFile = null;
  currentTarget = null;
  els.fileInput.value = '';
  els.convertPanel.classList.add('hidden');
  els.resultPanel.classList.add('hidden');
}

function wireEvents() {
  els.dropzone.addEventListener('click', () => els.fileInput.click());
  els.fileInput.addEventListener('change', () => {
    if (els.fileInput.files[0]) selectFile(els.fileInput.files[0]);
  });
  els.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    els.dropzone.classList.add('drag');
  });
  els.dropzone.addEventListener('dragleave', () => els.dropzone.classList.remove('drag'));
  els.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    els.dropzone.classList.remove('drag');
    if (e.dataTransfer.files[0]) selectFile(e.dataTransfer.files[0]);
  });
  els.convertBtn.addEventListener('click', convert);
  els.resetBtn.addEventListener('click', reset);
  els.againBtn.addEventListener('click', reset);
  els.quality.addEventListener('input', () => {
    els.qualityValue.textContent = els.quality.value;
  });
}

wireEvents();
boot();
