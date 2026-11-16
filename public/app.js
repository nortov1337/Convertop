const $ = (sel) => document.querySelector(sel);

const els = {
  langSwitch: $('#langSwitch'),
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
const LANG_KEY = 'convertop.lang';

const STRINGS = {
  en: {
    title: 'Convertop — file converter',
    heroA: 'Convert files',
    heroB: 'instantly',
    heroSub: 'Images, audio, video, documents, data and archives — no software to install',
    dropTitle: 'Drop a file here',
    dropSub: 'or click to browse',
    reset: 'Reset',
    quality: 'Quality',
    convert: 'Convert',
    converting: 'Converting…',
    processing: 'Processing file…',
    done: 'Done',
    download: 'Download file',
    again: 'Convert another',
    archive: 'Archive',
    language: 'Language',
    sizeUnits: ['B', 'KB', 'MB', 'GB'],
    serverUnreachable: 'Could not reach the server',
    unknownFormat: 'Unknown format',
    errorStatus: (status) => `Error ${status}`,
  },
  ru: {
    title: 'Convertop — конвертер файлов',
    heroA: 'Конвертируйте файлы',
    heroB: 'мгновенно',
    heroSub: 'Изображения, аудио, видео, документы, данные и архивы — без установки программ',
    dropTitle: 'Перетащите файл сюда',
    dropSub: 'или нажмите, чтобы выбрать',
    reset: 'Сбросить',
    quality: 'Качество',
    convert: 'Конвертировать',
    converting: 'Конвертация…',
    processing: 'Обработка файла…',
    done: 'Готово',
    download: 'Скачать файл',
    again: 'Конвертировать ещё',
    archive: 'Архив',
    language: 'Язык',
    sizeUnits: ['Б', 'КБ', 'МБ', 'ГБ'],
    serverUnreachable: 'Не удалось связаться с сервером',
    unknownFormat: 'Неизвестный формат',
    errorStatus: (status) => `Ошибка ${status}`,
  },
};

let lang = detectLang();
let currentFile = null;
let currentTarget = null;
let currentExt = null;
let categoryLabels = {};

function detectLang() {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved in STRINGS) return saved;
  return (navigator.language ?? '').toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

function t(key) {
  return STRINGS[lang][key];
}

function localeHeader() {
  return { 'Accept-Language': lang };
}

function humanSize(bytes) {
  const [b, kb, mb, gb] = t('sizeUnits');
  if (bytes < 1024) return `${bytes} ${b}`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${kb}`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} ${mb}`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} ${gb}`;
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

function applyLocale() {
  document.documentElement.lang = lang;
  document.title = t('title');
  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const btn of els.langSwitch.querySelectorAll('.lang-btn')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.lang === lang));
  }
  els.langSwitch.setAttribute('aria-label', t('language'));
  if (els.convertBtn.classList.contains('loading')) {
    els.convertBtn.querySelector('.btn-label').textContent = t('converting');
  }
  if (currentFile) els.fileMeta.textContent = humanSize(currentFile.size);
}

async function setLang(next) {
  lang = next;
  localStorage.setItem(LANG_KEY, lang);
  applyLocale();
  await boot();
  if (currentExt) await loadTargets(currentExt);
}

async function boot() {
  try {
    const res = await fetch('/api/formats', { headers: localeHeader() });
    const data = await res.json();
    categoryLabels = Object.fromEntries((data.categories ?? []).map((c) => [c.id, c.label]));
  } catch {
    setStatus(els.status, t('serverUnreachable'), true);
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
  currentExt = ext;
  els.targets.innerHTML = '';
  els.qualityRow.classList.add('hidden');
  try {
    const res = await fetch(`/api/targets?from=${encodeURIComponent(ext)}`, { headers: localeHeader() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('unknownFormat'));
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
    for (const item of list) {
      buttons.push(`<button class="target-btn" data-ext="${item.ext}">${item.label}</button>`);
    }
  }

  if (data.action) {
    buttons.push(`<div class="target-group-label">${t('archive')}</div>`);
    buttons.push(`<button class="target-btn" data-ext="${data.action.id}">${data.action.label}</button>`);
  }

  els.targets.innerHTML = buttons.join('');

  const showQuality = MEDIA_CATEGORIES.has(data.category);
  els.targets.querySelectorAll('.target-btn').forEach((btn, i) => {
    btn.style.animationDelay = `${i * 24}ms`;
    if (btn.dataset.ext === currentTarget) {
      btn.classList.add('active');
      els.qualityRow.classList.toggle('hidden', !showQuality);
    }
    btn.addEventListener('click', () => {
      els.targets.querySelectorAll('.target-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentTarget = btn.dataset.ext;
      els.convertBtn.disabled = false;
      els.qualityRow.classList.toggle('hidden', !showQuality);
    });
  });
}

async function convert() {
  if (!currentFile || !currentTarget) return;
  els.convertBtn.disabled = true;
  els.convertBtn.classList.add('loading');
  els.convertBtn.querySelector('.btn-label').textContent = t('converting');
  els.status.classList.remove('hidden');
  setStatus(els.status, t('processing'));

  const form = new FormData();
  form.append('file', currentFile);
  form.append('to', currentTarget);
  if (!els.qualityRow.classList.contains('hidden')) {
    form.append('quality', els.quality.value);
  }

  try {
    const res = await fetch('/api/convert', { method: 'POST', body: form, headers: localeHeader() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || t('errorStatus')(res.status));
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
    els.convertBtn.querySelector('.btn-label').textContent = t('convert');
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
  currentExt = null;
  els.fileInput.value = '';
  els.convertPanel.classList.add('hidden');
  els.resultPanel.classList.add('hidden');
}

function wireEvents() {
  els.langSwitch.addEventListener('click', (e) => {
    const btn = e.target.closest('.lang-btn');
    if (btn && btn.dataset.lang !== lang) setLang(btn.dataset.lang);
  });
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

applyLocale();
wireEvents();
boot();
