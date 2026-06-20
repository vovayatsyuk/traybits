const { invoke } = window.__TAURI__.core;

// const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const DEFAULT_CODE = `export default async () => {
  const res = await fetch("https://packagist.org/packages/psr/log/stats.json");
  const data = await res.json();
  return new Intl.NumberFormat().format(data.downloads.total)
}
`;

let intervalId = null;

async function updateTray(fn) {
  const title = await fn();
  if (typeof title !== "string") throw new Error("Function must return a string");
  invoke("set_tray_title", { title });
  return title;
}

async function startPolling(fn, timeout) {
  clearInterval(intervalId);
  const result = await updateTray(fn);
  intervalId = setInterval(() => updateTray(fn), timeout * 1000);
  return result;
}

async function createFn(code) {
  // return new AsyncFunction(code);
  const blob = new Blob([code], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const mod = await import(/* @vite-ignore */ url);
  URL.revokeObjectURL(url);
  if (typeof mod.default !== "function") throw new Error("Script must export default function");
  return mod.default;
}

const code = localStorage.getItem("traybits_code") ?? DEFAULT_CODE;
const timeout = localStorage.getItem("traybits_timeout") ?? 60;

(async () => {
  startPolling(await createFn(code), timeout);
})();

const textarea = document.getElementById("code");
const timeoutInput = document.getElementById("timeout");

textarea.value = code;
timeoutInput.value = timeout;

document.getElementById("save").addEventListener("click", async () => {
  const statusEl = document.getElementById("status");
  const seconds = Math.max(1, parseInt(timeoutInput.value) || 60);

  timeoutInput.value = seconds;

  if (!textarea.value.trim()) {
    textarea.value = DEFAULT_CODE;
  }

  statusEl.classList.remove("text-red-500")
  localStorage.setItem("traybits_code", textarea.value);
  localStorage.setItem("traybits_timeout", seconds);

  try {
    statusEl.textContent = await startPolling(await createFn(textarea.value), seconds);
    setTimeout(() => statusEl.textContent = "", 3000);
  } catch (e) {
    statusEl.textContent = e.message;
    statusEl.classList.add("text-red-500")
  }
});
