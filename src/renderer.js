const form = document.getElementById('scheduleForm');
const input = document.getElementById('scheduleAt');
const statusEl = document.getElementById('status');
const schedulesEl = document.getElementById('schedules');
const logsEl = document.getElementById('logs');
const runNow = document.getElementById('runNow');
const openLogin = document.getElementById('openLogin');

function setStatus(text, tone = '') {
  statusEl.textContent = text;
  statusEl.dataset.tone = tone;
}

function formatTime(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function empty(text) {
  const node = document.createElement('p');
  node.className = 'empty';
  node.textContent = text;
  return node;
}

function renderSchedules(schedules) {
  schedulesEl.replaceChildren();
  if (!schedules.length) {
    schedulesEl.append(empty('No schedules yet.'));
    return;
  }
  schedules.forEach(schedule => {
    const item = document.createElement('article');
    item.className = 'item';
    const body = document.createElement('div');
    const title = document.createElement('strong');
    const meta = document.createElement('span');
    const remove = document.createElement('button');
    title.textContent = formatTime(schedule.at);
    meta.textContent = `${schedule.status} · message "${schedule.message}"`;
    remove.textContent = 'Delete';
    remove.type = 'button';
    remove.className = 'link-button';
    remove.addEventListener('click', async () => {
      await act(() => window.claudeCron.deleteSchedule(schedule.id), 'Schedule deleted.');
    });
    body.append(title, meta);
    item.append(body, remove);
    schedulesEl.append(item);
  });
}

function renderLogs(logs) {
  logsEl.replaceChildren();
  if (!logs.length) {
    logsEl.append(empty('No runs yet.'));
    return;
  }
  logs.forEach(log => {
    const item = document.createElement('article');
    item.className = 'item';
    const body = document.createElement('div');
    const title = document.createElement('strong');
    const meta = document.createElement('span');
    title.textContent = `${log.status} · ${formatTime(log.finishedAt || log.startedAt)}`;
    meta.textContent = log.error || log.source;
    body.append(title, meta);
    item.append(body);
    logsEl.append(item);
  });
}

function render(data) {
  renderSchedules(data.schedules || []);
  renderLogs(data.logs || []);
}

async function act(fn, done) {
  try {
    setStatus('Working...');
    render(await fn());
    setStatus(done, 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

function defaultScheduleTime() {
  const next = new Date(Date.now() + 10 * 60 * 1000);
  next.setSeconds(0, 0);
  const local = new Date(next.getTime() - next.getTimezoneOffset() * 60000);
  input.value = local.toISOString().slice(0, 16);
}

form.addEventListener('submit', event => {
  event.preventDefault();
  act(() => window.claudeCron.createSchedule({ at: input.value }), 'Schedule registered.');
});

runNow.addEventListener('click', () => {
  act(() => window.claudeCron.runNow(), 'Message sent.');
});

openLogin.addEventListener('click', async () => {
  try {
    setStatus('Opening Brave...');
    await window.claudeCron.openLogin();
    setStatus('Login to Claude in the opened Brave window.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
});

defaultScheduleTime();
window.claudeCron.load().then(render).catch(error => setStatus(error.message, 'error'));
