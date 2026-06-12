const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const form = document.getElementById('scheduleForm');
const labelInput = document.getElementById('scheduleLabel');
const messageInput = document.getElementById('triggerMessage');
const dayPicker = document.getElementById('dayPicker');
const hourGrid = document.getElementById('hourGrid');
const minuteGrid = document.getElementById('minuteGrid');
const previewEl = document.getElementById('preview');
const schedulesEl = document.getElementById('schedules');
const logsEl = document.getElementById('logs');
const statusEl = document.getElementById('status');
const engineEl = document.getElementById('engineStatus');

const modelSelect = document.getElementById('modelSelect');

const selectedDays = new Set();
const selectedHours = new Set();
const selectedMinutes = new Set();

let saveTimer = null;
function debounceSaveConfig() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    window.claudeCron.setConfig({
      message: messageInput.value || 'hi',
      model: modelSelect.value,
    });
  }, 400);
}

messageInput.addEventListener('input', debounceSaveConfig);
modelSelect.addEventListener('change', debounceSaveConfig);

DAY_ORDER.forEach(d => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = DAY_NAMES[d];
  btn.dataset.day = d;
  btn.addEventListener('click', () => {
    selectedDays.has(d) ? selectedDays.delete(d) : selectedDays.add(d);
    btn.classList.toggle('active', selectedDays.has(d));
    updatePreview();
  });
  dayPicker.append(btn);
});

for (let h = 0; h < 24; h++) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = String(h).padStart(2, '0');
  btn.dataset.hour = h;
  btn.addEventListener('click', () => {
    selectedHours.has(h) ? selectedHours.delete(h) : selectedHours.add(h);
    btn.classList.toggle('active', selectedHours.has(h));
    updatePreview();
  });
  hourGrid.append(btn);
}

for (let m = 0; m < 60; m += 5) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = ':' + String(m).padStart(2, '0');
  btn.dataset.minute = m;
  btn.addEventListener('click', () => {
    selectedMinutes.has(m) ? selectedMinutes.delete(m) : selectedMinutes.add(m);
    btn.classList.toggle('active', selectedMinutes.has(m));
    updatePreview();
  });
  minuteGrid.append(btn);
}

function syncPickers() {
  dayPicker.querySelectorAll('button').forEach(b =>
    b.classList.toggle('active', selectedDays.has(Number(b.dataset.day)))
  );
  hourGrid.querySelectorAll('button').forEach(b =>
    b.classList.toggle('active', selectedHours.has(Number(b.dataset.hour)))
  );
  minuteGrid.querySelectorAll('button').forEach(b =>
    b.classList.toggle('active', selectedMinutes.has(Number(b.dataset.minute)))
  );
  updatePreview();
}

function nextRuns(days, hours, minutes, count) {
  const result = [];
  const now = new Date();
  const sortedH = [...hours].sort((a, b) => a - b);
  const sortedM = [...minutes].sort((a, b) => a - b);
  for (let d = 0; d < 8 && result.length < count; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    if (!days.has(date.getDay())) continue;
    for (const h of sortedH) {
      for (const m of sortedM) {
        const t = new Date(date);
        t.setHours(h, m, 0, 0);
        if (t <= now) continue;
        result.push(t);
        if (result.length >= count) return result;
      }
    }
  }
  return result;
}

function updatePreview() {
  if (!selectedDays.size || !selectedHours.size || !selectedMinutes.size) {
    previewEl.textContent = '';
    return;
  }
  const runs = nextRuns(selectedDays, selectedHours, selectedMinutes, 4);
  if (!runs.length) {
    previewEl.textContent = '';
    return;
  }
  const fmt = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', hour: '2-digit', minute: '2-digit',
  });
  previewEl.textContent = 'Next: ' + runs.map(r => fmt.format(r)).join('  →  ');
}

document.querySelectorAll('[data-quick]').forEach(btn => {
  btn.addEventListener('click', () => {
    switch (btn.dataset.quick) {
      case 'weekdays':
        selectedDays.clear();
        [1, 2, 3, 4, 5].forEach(d => selectedDays.add(d));
        break;
      case 'weekend':
        selectedDays.clear();
        [0, 6].forEach(d => selectedDays.add(d));
        break;
      case 'alldays':
        for (let d = 0; d < 7; d++) selectedDays.add(d);
        break;
      case 'business':
        selectedHours.clear();
        for (let h = 9; h <= 17; h++) selectedHours.add(h);
        break;
      case 'allhours':
        for (let h = 0; h < 24; h++) selectedHours.add(h);
        break;
      case 'clearhours':
        selectedHours.clear();
        break;
      case 'on-hour':
        selectedMinutes.clear();
        selectedMinutes.add(0);
        break;
      case 'every15':
        selectedMinutes.clear();
        [0, 15, 30, 45].forEach(m => selectedMinutes.add(m));
        break;
      case 'every30':
        selectedMinutes.clear();
        [0, 30].forEach(m => selectedMinutes.add(m));
        break;
      case 'clearminutes':
        selectedMinutes.clear();
        break;
    }
    syncPickers();
  });
});

function setStatus(text, tone) {
  statusEl.textContent = text;
  statusEl.dataset.tone = tone || '';
}

function updateEngine(state) {
  if (!state) return;
  if (state.locked) {
    engineEl.textContent = 'Running';
    engineEl.dataset.tone = 'active';
  } else if (state.retry) {
    const sec = Math.max(0, Math.round((state.retry.retryAt - Date.now()) / 1000));
    engineEl.textContent = 'Retry ' + state.retry.attempt + '/3 in ' + sec + 's';
    engineEl.dataset.tone = 'retry';
  } else {
    engineEl.textContent = 'Idle';
    engineEl.dataset.tone = '';
  }
}

function formatTime(iso) {
  if (!iso) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(iso));
}

function describeDays(days) {
  if (days.length === 7) return 'Every day';
  const wd = [1, 2, 3, 4, 5];
  const we = [0, 6];
  if (days.length === 5 && wd.every(d => days.includes(d))) return 'Weekdays';
  if (days.length === 2 && we.every(d => days.includes(d))) return 'Weekend';
  return DAY_ORDER.filter(d => days.includes(d)).map(d => DAY_NAMES[d]).join(', ');
}

function describeTimes(hours, minutes) {
  const mins = minutes && minutes.length ? minutes : [0];
  const times = [];
  for (const h of hours) {
    for (const m of mins) {
      times.push(String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'));
    }
  }
  if (times.length <= 8) return times.join(', ');
  return times.slice(0, 7).join(', ') + ' +' + (times.length - 7) + ' more';
}

function renderSchedules(schedules) {
  schedulesEl.replaceChildren();
  if (!schedules.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'No schedules yet.';
    schedulesEl.append(p);
    return;
  }
  schedules.forEach(s => {
    const card = document.createElement('article');
    card.className = 'schedule-card' + (s.enabled === false ? ' disabled' : '');

    const header = document.createElement('div');
    header.className = 'schedule-header';
    const title = document.createElement('strong');
    title.textContent = s.label || 'Untitled';
    const actions = document.createElement('div');
    actions.className = 'schedule-actions';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = s.enabled === false ? 'btn-sm btn-enable' : 'btn-sm btn-disable';
    toggle.textContent = s.enabled === false ? 'Enable' : 'Disable';
    toggle.addEventListener('click', () => act(() => window.claudeCron.toggleSchedule(s.id)));

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn-sm btn-delete';
    del.textContent = 'Delete';
    del.addEventListener('click', () => act(() => window.claudeCron.deleteSchedule(s.id)));

    actions.append(toggle, del);
    header.append(title, actions);

    const summary = document.createElement('p');
    summary.className = 'schedule-summary';
    summary.textContent = describeDays(s.days) + ' at ' + describeTimes(s.hours, s.minutes);

    card.append(header, summary);
    schedulesEl.append(card);
  });
}

function renderLogs(logs) {
  logsEl.replaceChildren();
  if (!logs.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'No runs yet.';
    logsEl.append(p);
    return;
  }
  logs.slice(0, 30).forEach(log => {
    const item = document.createElement('div');
    item.className = 'log-item';
    item.dataset.status = log.status;
    const dot = document.createElement('span');
    dot.className = 'log-dot';
    const text = document.createElement('span');
    text.className = 'log-text';
    text.textContent = log.source + ' · ' + formatTime(log.finishedAt || log.startedAt);
    item.append(dot, text);
    if (log.error) {
      const err = document.createElement('span');
      err.className = 'log-error';
      err.textContent = log.error;
      item.append(err);
    }
    logsEl.append(item);
  });
}

function render(data) {
  renderSchedules(data.schedules || []);
  renderLogs(data.logs || []);
  updateEngine(data.engine);
  if (data.config) {
    if (document.activeElement !== messageInput) {
      messageInput.value = data.config.message || 'hi';
    }
    if (document.activeElement !== modelSelect) {
      modelSelect.value = data.config.model || 'Haiku';
    }
  }
}

async function act(fn) {
  try {
    setStatus('Working...');
    render(await fn());
    setStatus('Done.', 'success');
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

function resetForm() {
  labelInput.value = '';
  selectedDays.clear();
  selectedHours.clear();
  selectedMinutes.clear();
  syncPickers();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  await act(() => window.claudeCron.createSchedule({
    label: labelInput.value,
    days: [...selectedDays],
    hours: [...selectedHours],
    minutes: [...selectedMinutes],
  }));
  resetForm();
});

document.getElementById('openLogin').addEventListener('click', async () => {
  try {
    setStatus('Opening Brave...');
    await window.claudeCron.openLogin();
    setStatus('Login to Claude in the opened Brave window.', 'success');
  } catch (err) {
    setStatus(err.message, 'error');
  }
});

document.getElementById('runNow').addEventListener('click', () => {
  act(() => window.claudeCron.runNow());
});

window.claudeCron.onStateUpdate(render);
window.claudeCron.load().then(render).catch(err => setStatus(err.message, 'error'));

setInterval(async () => {
  try { updateEngine(await window.claudeCron.engineStatus()); } catch (_) {}
}, 10_000);
