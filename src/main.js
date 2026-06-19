const { invoke } = window.__TAURI__.core;

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const STORAGE_KEY = "numbrays_user_code";
const FREQ_KEY = "numbrays_frequency";
const DEFAULT_CODE = `const res = await fetch("https://packagist.org/packages/psr/log/stats.json");
const data = await res.json();
return new Intl.NumberFormat().format(data.downloads.total)`;

let intervalId = null;

async function updateTray(fn) {
  const title = await fn();
  if (typeof title !== "string") throw new Error("Script must return a string");
  invoke("set_tray_title", { title });
  return title;
}

async function startPolling(fn, frequency) {
  clearInterval(intervalId);
  const result = await updateTray(fn);
  intervalId = setInterval(() => updateTray(fn), frequency * 1000);
  return result;
}

const code = localStorage.getItem(STORAGE_KEY) ?? DEFAULT_CODE;
const frequency = localStorage.getItem(FREQ_KEY) ?? 60;
const textarea = document.getElementById("code");
const freqInput = document.getElementById("frequency");

startPolling(new AsyncFunction(code), frequency);
textarea.value = code;
freqInput.value = localStorage.getItem(FREQ_KEY) ?? 60;

document.getElementById("save").addEventListener("click", async () => {
  const statusEl = document.getElementById("status");
  const seconds = Math.max(1, parseInt(freqInput.value) || 60);

  freqInput.value = seconds;

  if (!textarea.value.trim()) {
    textarea.value = DEFAULT_CODE;
  }

  statusEl.classList.remove("text-red-500")
  localStorage.setItem(STORAGE_KEY, textarea.value);
  localStorage.setItem(FREQ_KEY, seconds);

  try {
    statusEl.textContent = await startPolling(new AsyncFunction(textarea.value), seconds);
    setTimeout(() => statusEl.textContent = "", 3000);
  } catch (e) {
    statusEl.textContent = e.message;
    statusEl.classList.add("text-red-500")
  }
});
