import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const DEFAULT_CODE = `export default async () => {
  const res = await fetch("https://packagist.org/packages/psr/log/stats.json");
  const data = await res.json();
  return new Intl.NumberFormat().format(data.downloads.total)
}
`;

const codeEl = document.getElementById('code');
const timeoutEl = document.getElementById('timeout');

let resting = false,
    working = false,
    timeout = localStorage.getItem('traybits_timeout') ?? 60,
    code = localStorage.getItem('traybits_code') ?? DEFAULT_CODE,
    fn;

codeEl.value = code;
timeoutEl.value = timeout;

async function updateTray() {
  if (!fn) { fn = await createFn(code) }
  const title = await fn();
  if (typeof title !== 'string') throw new Error('Function must return a string');
  invoke('set_tray_title', { title });
  return title;
}

async function createFn(code) {
  const blob = new Blob([code], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const mod = await import(/* @vite-ignore */ url);
  URL.revokeObjectURL(url);
  if (typeof mod.default !== 'function') throw new Error('Script must export default function');
  return mod.default;
}

document.getElementById('save').addEventListener('click', async () => {
  const statusEl = document.getElementById('status');
  const seconds = Math.max(1, parseInt(timeoutEl.value) || 60);

  statusEl.textContent = '';
  timeoutEl.value = seconds;

  if (!codeEl.value.trim()) {
    codeEl.value = DEFAULT_CODE;
  }

  statusEl.classList.remove('text-red-500')
  localStorage.setItem('traybits_code', codeEl.value);
  localStorage.setItem('traybits_timeout', seconds);

  try {
    fn = await createFn(codeEl.value);
    resting = false;
    timeout = seconds;
    statusEl.textContent = await updateTray();
  } catch (e) {
    statusEl.textContent = e.message;
    statusEl.classList.add('text-red-500')
  }
});

listen('tick', async event => {
  if (resting || working) {
    return;
  }

  if (timeout > 1) {
    resting = true;
    setTimeout(() => resting = false, timeout * 1000);
  }

  try {
    working = true;
    await updateTray();
  } finally {
    working = false;
  }
});

listen('refresh', async event => {
  try {
    working = true;
    await updateTray();
  } finally {
    working = false;
  }
});
