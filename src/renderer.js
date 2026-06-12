const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const form = document.getElementById('scheduleForm');
const labelInput = document.getElementById('scheduleLabel');
const messageInput = document.getElementById('triggerMessage');
const dayPicker = document.getElementById('dayPicker');
const hourGrid = document.getElementById('hourGrid');
const schedulesEl = document.getElementById('schedules');
const logsEl = document.getElementById('logs');
const statusEl = document.getElementById('status');
const engineEl = document.getElementById('engineStatus');

let saveTimer = null;
messageInput.addEventListener('input', () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    window.claudeCron.setConfig({ message: messageInput.value || 'hi' });
  }, 600);
});

const selectedDays = new Set();
const selectedHours = new Set();

DAY_ORDER.forEach(d => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = DAY_NAMES[d];
  btn.dataset.day = d;
  btn.addEventListener('click', () => {
    selectedDays.has(d) ? selectedDays.delete(d) : selectedDays.add(d);
    btn.classList.toggle('active', selectedDays.has(d));
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
  });
  hourGrid.append(btn);
}

function syncPickers() {
  dayPicker.querySelectorAll('button').forEach(b =>
    b.classList.toggle('active', selectedDays.has(Number(b.dataset.day)))
  );
  hourGrid.querySelectorAll('button').forEach(b =>
    b.classList.toggle('active', selectedHours.has(Number(b.dataset.hour)))
  );
}

document.querySelectorAll('[data-quick]').forEach(btn => {
  btn.addEventListener('click', () => {
    switch (btn.dataset.quick) {
      case 'weekdays':
        [1, 2, 3, 4, 5].forEach(d => selectedDays.add(d));
        [0, 6].forEach(d => selectedDays.delete(d));
        break;
      case 'weekend':
        [0, 6].forEach(d => selectedDays.add(d));
        [1, 2, 3, 4, 5].forEach(d => selectedDays.delete(d));
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
    engineEl.textContent = `Retry ${state.retry.attempt}/3 in ${sec}s`;
    engineEl.dataset.tone = 'retry';
  } else {
    engineEl.textContent = 'Idle';
    engineEl.dataset.tone = '';
  }
}

function formatTime(iso) {
  if (!iso) return '-';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
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
    title.textContent = s.label;
    const actions = document.createElement('div');
    actions.className = 'schedule-actions';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'toggle-btn';
    toggle.textContent = s.enabled === false ? 'Enable' : 'Disable';
    toggle.addEventListener('click', () => act(() => window.claudeCron.toggleSchedule(s.id)));

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'link-button';
    del.textContent = 'Delete';
    del.addEventListener('click', () => act(() => window.claudeCron.deleteSchedule(s.id)));

    actions.append(toggle, del);
    header.append(title, actions);

    const days = document.createElement('div');
    days.className = 'schedule-days';
    DAY_ORDER.forEach(d => {
      const badge = document.createElement('span');
      badge.className = 'day-badge' + (s.days.includes(d) ? ' on' : '');
      badge.textContent = DAY_NAMES[d];
      days.append(badge);
    });

    const hours = document.createElement('div');
    hours.className = 'schedule-hours';
    s.hours.forEach(h => {
      const badge = document.createElement('span');
      badge.className = 'hour-badge';
      badge.textContent = String(h).padStart(2, '0');
      hours.append(badge);
    });

    card.append(header, days, hours);
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
    const item = document.createElement('article');
    item.className = 'item';
    item.dataset.status = log.status;
    const body = document.createElement('div');
    const line1 = document.createElement('strong');
    line1.textContent = `${log.status} · ${log.source}`;
    const line2 = document.createElement('span');
    line2.textContent = log.error || formatTime(log.finishedAt || log.startedAt);
    body.append(line1, line2);
    item.append(body);
    logsEl.append(item);
  });
}

function render(data) {
  renderSchedules(data.schedules || []);
  renderLogs(data.logs || []);
  updateEngine(data.engine);
  if (data.config && document.activeElement !== messageInput) {
    messageInput.value = data.config.message || 'hi';
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
  syncPickers();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  await act(() => window.claudeCron.createSchedule({
    label: labelInput.value,
    days: [...selectedDays],
    hours: [...selectedHours],
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
