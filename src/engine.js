const { randomUUID } = require('crypto');

const TICK_MS = 30_000;
const MAX_RETRIES = 3;
const BACKOFF = [30_000, 90_000, 270_000];

let locked = false;
let timer = null;
let retry = null;
let exhausted = new Set();
let deps = null;

function pad(v) {
  return String(v).padStart(2, '0');
}

function slotKey() {
  const n = new Date();
  return {
    day: n.getDay(),
    hour: n.getHours(),
    minute: n.getMinutes(),
    key: `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}T${pad(n.getHours())}:${pad(n.getMinutes())}`,
  };
}

async function run(slot, source) {
  if (locked) return;
  locked = true;
  const startedAt = new Date().toISOString();
  try {
    await deps.execute();
    deps.store.markSlotDone(slot);
    deps.store.appendRunLog({
      id: randomUUID(), slot, source, status: 'success',
      startedAt, finishedAt: new Date().toISOString(),
    });
    retry = null;
    exhausted.delete(slot);
  } catch (err) {
    const attempt = (retry?.slot === slot ? retry.attempt : 0) + 1;
    if (attempt <= MAX_RETRIES) {
      retry = { slot, attempt, retryAt: Date.now() + BACKOFF[attempt - 1] };
    } else {
      retry = null;
      exhausted.add(slot);
    }
    deps.store.appendRunLog({
      id: randomUUID(), slot, source, status: 'failed',
      error: err.message,
      startedAt, finishedAt: new Date().toISOString(),
    });
  } finally {
    locked = false;
    deps.notify?.();
  }
}

async function tick() {
  if (locked) return;
  if (retry && Date.now() >= retry.retryAt) {
    await run(retry.slot, 'retry');
    return;
  }
  if (retry) return;
  const { day, hour, key } = slotKey();
  for (const k of exhausted) {
    if (k !== key) exhausted.delete(k);
  }
  if (deps.store.isSlotDone(key)) return;
  if (exhausted.has(key)) return;
  const schedules = deps.store.readSchedules();
  const match = schedules.some(
    s => s.enabled !== false && s.days.includes(day) && s.hours.includes(hour)
  );
  if (!match) return;
  await run(key, 'schedule');
}

function start(config) {
  deps = config;
  timer = setInterval(tick, TICK_MS);
  setTimeout(tick, 3000);
}

function stop() {
  clearInterval(timer);
  timer = null;
}

function status() {
  return { locked, retry: retry ? { ...retry } : null };
}

module.exports = { start, stop, tick, status };
