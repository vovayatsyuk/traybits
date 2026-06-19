const { invoke } = window.__TAURI__.core;

const STORAGE_KEY = "numbrays_user_code";
const FREQ_KEY = "numbrays_frequency";
const DEFAULT_CODE = `const res = await fetch("https://packagist.org/packages/psr/log/stats.json");
const data = await res.json();
return new Intl.NumberFormat().format(data.downloads.total)`;

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

let intervalId = null;

function loadCode() {
  return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_CODE;
}

async function updateTray() {
  const title = await new AsyncFunction(loadCode())();
  if (typeof title !== "string") {
    throw new Error("Script must return a string");
  }
  invoke("set_tray_title", { title });
  return title;
}

function startPolling() {
  clearInterval(intervalId);
  intervalId = setInterval(updateTray, (parseInt(localStorage.getItem(FREQ_KEY)) || 60) * 1000);
}

document.addEventListener("DOMContentLoaded", () => {
  updateTray();
  startPolling();

  const textarea = document.getElementById("user-code");
  const freqInput = document.getElementById("frequency");
  const statusEl = document.getElementById("status");

  textarea.value = loadCode();
  freqInput.value = localStorage.getItem(FREQ_KEY) ?? 60;

  document.getElementById("save-btn").addEventListener("click", async () => {
    const seconds = Math.max(1, parseInt(freqInput.value) || 60);

    freqInput.value = seconds;

    if (!textarea.value.trim()) {
      textarea.value = DEFAULT_CODE;
    }

    localStorage.setItem(STORAGE_KEY, textarea.value);
    localStorage.setItem(FREQ_KEY, seconds);
    try {
      statusEl.textContent = await updateTray();
      statusEl.className = "success";
      startPolling();
      setTimeout(() => {
        statusEl.textContent = "";
      }, 3000);
    } catch (e) {
      statusEl.textContent = e.message;
      statusEl.className = "error";
    }
  });
});
