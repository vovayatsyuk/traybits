import Alpine from 'alpinejs';
import sort from '@alpinejs/sort';
import { listen } from '@tauri-apps/api/event';
import * as Runner from './runner.js';
import register from './app.js';

// Window top border is only needed on macOS
if (navigator.userAgent.includes('Mac')) {
  document.body.classList.add('border-t');
}

window.Alpine = Alpine;
Alpine.plugin(sort);
register(Alpine);
Alpine.start();

const app = Alpine.store('app');

listen('tick', async () => {
  const results = await Promise.all(app.enabledRunners.map(Runner.runIfReady));
  if (results.some(Boolean)) {
    app.syncTray();
  }
});

listen('close', () => app.resetDraft());

listen('refresh', async () => {
  await Promise.all(app.enabledRunners.map(Runner.run));
  app.syncTray();
});

listen('restart', async () => {
  app.runners.forEach(r => r.fn = null);
  await Promise.all(app.enabledRunners.map(Runner.run));
  app.syncTray();
});

// WebKitGTK doesn't bind Ctrl+Z/Ctrl+Shift+Z to the editor's undo/redo commands
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) {
    return;
  }
  const key = e.key.toLowerCase();
  if (key === 'z') {
    e.preventDefault();
    document.execCommand(e.shiftKey ? 'redo' : 'undo');
  } else if (key === 'y') {
    e.preventDefault();
    document.execCommand('redo');
  }
});
