const { invoke } = window.__TAURI__.core;

async function updateTray() {
  const res = await fetch("https://packagist.org/packages/melios/page-builder/stats.json");
  const data = await res.json();
  const total = data.downloads.total;
  await invoke("set_tray_title", { title: String(total) });
}

updateTray();
setInterval(updateTray, 60000);
