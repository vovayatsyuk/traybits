import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import * as Runner from './runner.js';

const DEFAULT_CODE = `export default async () => {
  return 'Traybits'
}
`;

const tabsEl = document.getElementById('tabs');
const panelsEl = document.getElementById('panels');
const emptyEl = document.getElementById('empty');
const templateEl = document.getElementById('panel-template');
const statusEl = document.getElementById('status');

function loadSnippets() {
  const raw = localStorage.getItem('traybits_snippets');
  if (raw) {
    return JSON.parse(raw);
  }

  const list = [{
    id: crypto.randomUUID(),
    name: 'Snippet 1',
    code: localStorage.getItem('traybits_code') ?? DEFAULT_CODE,
    timeout: parseInt(localStorage.getItem('traybits_timeout')) || 60,
    enabled: true,
  }];
  localStorage.setItem('traybits_snippets', JSON.stringify(list));
  localStorage.removeItem('traybits_code');
  localStorage.removeItem('traybits_timeout');
  return list;
}

function loadSettings() {
  return { separator: '\u2000·\u2000', ...JSON.parse(localStorage.getItem('traybits_settings') ?? '{}') };
}

let snippets = loadSnippets(),
    draft = structuredClone(snippets),
    activeId = draft[0]?.id,
    runners = createRunners(snippets),
    panels = new Map(),
    settings = loadSettings(),
    settingsDraft = structuredClone(settings),
    settingsOpen = true;

function createRunners(snippets) {
  return new Map(snippets.map(s => [s.id, Runner.create(s)]));
}

function syncTray() {
  invoke('set_tray_title', { title: Runner.render(runners, settings.separator) });
}

function createPanel(snippet) {
  const root = templateEl.content.firstElementChild.cloneNode(true);
  const panel = {
    root,
    name: root.querySelector('.name'),
    enabled: root.querySelector('.enabled'),
    code: root.querySelector('.code'),
    timeout: root.querySelector('.timeout'),
  };

  panel.name.value = snippet.name;
  panel.enabled.checked = snippet.enabled;
  panel.code.value = snippet.code;
  panel.timeout.value = snippet.timeout;

  panel.name.addEventListener('input', () => {
    snippet.name = panel.name.value;
    const label = tabsEl.children[draft.indexOf(snippet)]?.querySelector('span');
    if (label) {
      label.textContent = snippet.name || 'Snippet';
    }
  });

  panel.enabled.addEventListener('input', () => {
    snippet.enabled = panel.enabled.checked;
    renderTabs();
  });

  panel.code.addEventListener('input', () => {
    snippet.code = panel.code.value;
  });

  panel.timeout.addEventListener('input', () => {
    snippet.timeout = parseInt(panel.timeout.value) || 60;
  });

  panelsEl.append(root);
  panels.set(snippet.id, panel);
  return panel;
}

function deleteSnippet(snippet) {
  const index = draft.indexOf(snippet);
  draft.splice(index, 1);
  panels.get(snippet.id).root.remove();
  panels.delete(snippet.id);
  if (snippet.id === activeId) {
    activeId = (draft[index] ?? draft[index - 1])?.id;
  }
  renderTabs();
  renderPanels();
}

function renderTabs() {
  tabsEl.replaceChildren(...draft.map(s => {
    const tab = document.createElement('div');
    tab.className = 'group cursor-default rounded-md px-3 py-2 text-sm flex items-center gap-2'
      + (s.id === activeId && !settingsOpen ? ' bg-gray-100 dark:bg-zinc-800' : ' hover:bg-gray-50 dark:hover:bg-zinc-800/50')
      + (s.enabled ? '' : ' opacity-50');

    const label = document.createElement('span');
    label.className = 'truncate flex-1';
    label.textContent = s.name || 'Snippet';
    tab.append(label);

    if (runners.get(s.id)?.lastError) {
      const dot = document.createElement('span');
      dot.className = 'size-1.5 shrink-0 rounded-full bg-red-500';
      tab.append(dot);
    }

    const RING = 2 * Math.PI * 10.5; // circumference of the r=10.5 progress circle
    const del = document.createElement('button');
    del.className = 'invisible w-0 group-hover:w-6 group-hover:visible relative flex size-6 shrink-0 items-center justify-center text-zinc-400 hover:text-red-500';
    del.title = 'Hold to delete';
    del.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
      <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
    <svg class="absolute inset-0 size-full" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"
              stroke-dasharray="${RING}" stroke-dashoffset="${RING}" transform="rotate(-90 12 12)"/>
    </svg>`;

    const ring = del.querySelector('circle');
    let holdTimer;

    del.addEventListener('pointerdown', e => {
      e.stopPropagation();
      e.preventDefault();
      ring.style.transition = `stroke-dashoffset 1200ms linear`;
      ring.style.strokeDashoffset = '0';
      holdTimer = setTimeout(() => deleteSnippet(s), 1200+200);
    });

    const cancelHold = () => {
      clearTimeout(holdTimer);
      ring.style.transition = 'stroke-dashoffset 300ms ease-out';
      ring.style.strokeDashoffset = RING;
    };
    del.addEventListener('pointerup', cancelHold);
    del.addEventListener('pointerleave', cancelHold);
    del.addEventListener('click', e => e.stopPropagation());
    tab.append(del);

    tab.addEventListener('click', () => {
      activeId = s.id;
      settingsOpen = false;
      renderTabs();
      renderPanels();
    });
    return tab;
  }));
}

function renderPanels() {
  const hasContent = draft.length || settingsOpen;
  panelsEl.classList.toggle('hidden', !hasContent);
  emptyEl.classList.toggle('hidden', !!hasContent);
  emptyEl.classList.toggle('flex', !hasContent);

  settingsPanelEl.classList.toggle('flex', settingsOpen);
  settingsPanelEl.classList.toggle('hidden', !settingsOpen);
  settingsBtn.classList.toggle('bg-gray-100', settingsOpen);
  settingsBtn.classList.toggle('dark:bg-zinc-800', settingsOpen);

  for (const [id, panel] of panels) {
    const active = id === activeId && !settingsOpen;
    panel.root.classList.toggle('flex', active);
    panel.root.classList.toggle('hidden', !active);
  }
  renderStatus();
}

function renderStatus() {
  const runner = settingsOpen ? null : runners.get(activeId);
  statusEl.classList.toggle('text-red-500', !!runner?.lastError);
  statusEl.textContent = runner ? (runner.lastError ?? runner.lastResult ?? '') : '';
}

document.getElementById('add').addEventListener('click', () => {
  const snippet = {
    id: crypto.randomUUID(),
    name: `Snippet ${draft.length + 1}`,
    code: DEFAULT_CODE,
    timeout: 60,
    enabled: true,
  };
  draft.push(snippet);
  createPanel(snippet);
  activeId = snippet.id;
  settingsOpen = false;
  renderTabs();
  renderPanels();
});

const settingsBtn = document.getElementById('settings');
const settingsPanelEl = document.getElementById('settings-panel');
const separatorEl = document.getElementById('separator');

for (const input of separatorEl.querySelectorAll('input')) {
  input.checked = input.value === settingsDraft.separator;
  input.addEventListener('change', () => settingsDraft.separator = input.value);
}

settingsBtn.addEventListener('click', () => {
  settingsOpen = true;
  renderTabs();
  renderPanels();
});

document.getElementById('save').addEventListener('click', async () => {
  for (const snippet of draft) {
    snippet.timeout = Math.max(1, parseInt(snippet.timeout) || 60);
    snippet.name = snippet.name.trim() || 'Snippet';
    if (!snippet.code.trim()) {
      snippet.code = DEFAULT_CODE;
    }

    // only write back changed values — assigning .value resets the undo history
    const panel = panels.get(snippet.id);
    if (panel.name.value !== snippet.name) panel.name.value = snippet.name;
    if (panel.code.value !== snippet.code) panel.code.value = snippet.code;
    if (panel.timeout.value !== String(snippet.timeout)) panel.timeout.value = snippet.timeout;
  }
  renderTabs();

  snippets = structuredClone(draft);
  localStorage.setItem('traybits_snippets', JSON.stringify(snippets));

  settings = structuredClone(settingsDraft);
  localStorage.setItem('traybits_settings', JSON.stringify(settings));

  runners = createRunners(snippets);

  await Promise.allSettled(enabledRunners().map(Runner.run));
  syncTray();
  renderTabs();

  const failed = [...runners.values()].find(r => r.lastError);
  statusEl.classList.toggle('text-red-500', !!failed);
  statusEl.textContent = failed
    ? `${failed.snippet.name}: ${failed.lastError}`
    : Runner.render(runners, settings.separator);
});

function enabledRunners() {
  return [...runners.values()].filter(r => r.snippet.enabled);
}

listen('tick', async () => {
  const results = await Promise.all(enabledRunners().map(Runner.runIfReady));
  if (results.some(Boolean)) {
    syncTray();
  }
});

listen('refresh', async () => {
  await Promise.all(enabledRunners().map(Runner.run));
  syncTray();
});

listen('restart', async () => {
  runners.forEach(r => r.fn = null);
  await Promise.all(enabledRunners().map(Runner.run));
  syncTray();
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

draft.forEach(createPanel);
renderTabs();
renderPanels();
