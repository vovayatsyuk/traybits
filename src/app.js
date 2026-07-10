import { invoke } from '@tauri-apps/api/core';
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';
import * as Runner from './runner.js';

const DEFAULT_CODE = `export default async () => {
  return 'Traybits'
}
`;

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

export default function register(Alpine) {
  Alpine.store('app', {
    snippets: [],
    draft: [],
    activeId: null,
    runners: new Map(),
    settings: {},
    settingsOpen: true,
    saveMessage: null,
    autostart: false,

    init() {
      const snippets = loadSnippets();
      this.snippets = snippets;
      this.draft = structuredClone(snippets);
      this.settings = loadSettings();
      this.runners = new Map(snippets.map(s => [s.id, Runner.create(s)]));
      isEnabled().then(v => { this.autostart = v; });
    },

    async setAutostart(value) {
      try {
        value ? await enable() : await disable();
        this.autostart = value;
      } catch (e) {
        this.autostart = await isEnabled(); // revert to real state on failure
      }
    },

    get enabledRunners() {
      return [...this.runners.values()].filter(r => r.snippet.enabled);
    },

    get status() {
      if (this.saveMessage) {
        return this.saveMessage;
      }
      const runner = this.runners.get(this.activeId);
      return { text: runner?.lastError ?? runner?.lastResult ?? '', error: !!runner?.lastError };
    },

    syncTray() {
      invoke('set_tray_title', { title: Runner.render(this.runners, this.settings.separator) });
    },

    openSettings() {
      this.settingsOpen = true;
      this.activeId = null;
      this.saveMessage = null;
    },

    saveSettings() {
      localStorage.setItem('traybits_settings', JSON.stringify(this.settings));
      this.syncTray();
    },

    isSnippetActive(id) {
      return id === this.activeId;
    },

    selectSnippet(id) {
      this.activeId = id;
      this.settingsOpen = false;
      this.saveMessage = null;
    },

    addSnippet() {
      const snippet = {
        id: crypto.randomUUID(),
        name: `Snippet ${this.draft.length + 1}`,
        code: DEFAULT_CODE,
        timeout: 60,
        enabled: true,
      };
      this.draft.unshift(snippet);
      this.selectSnippet(snippet.id);
    },

    removeSnippet(id) {
      const index = this.draft.findIndex(s => s.id === id);
      this.draft.splice(index, 1);
      if (id === this.activeId) {
        this.activeId = (this.draft[index] ?? this.draft[index - 1])?.id;
      }
      this.saveMessage = null;
    },

    reorderSnippet(id, position) {
      const from = this.draft.findIndex(s => s.id === id);
      this.draft.splice(position, 0, ...this.draft.splice(from, 1));

      // Persist the saved list in the new order — draft may hold unsaved edits
      const order = new Map(this.draft.map((s, i) => [s.id, i]));
      this.snippets.sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity));
      localStorage.setItem('traybits_snippets', JSON.stringify(this.snippets));
      this.runners = new Map(this.snippets.map(s => [s.id, this.runners.get(s.id)]));
      this.syncTray();
    },

    async saveSnippets() {
      for (const snippet of this.draft) {
        snippet.timeout = Math.max(1, parseInt(snippet.timeout) || 60);
        snippet.name = snippet.name.trim() || 'Snippet';
        if (!snippet.code.trim()) {
          snippet.code = DEFAULT_CODE;
        }
      }

      const snippetsJson = JSON.stringify(this.draft);
      localStorage.setItem('traybits_snippets', snippetsJson);
      this.snippets = JSON.parse(snippetsJson);

      this.runners = new Map(this.snippets.map(s => [s.id, Runner.create(s)]));

      await Promise.allSettled(this.enabledRunners.map(Runner.run));
      this.syncTray();

      const failed = [...this.runners.values()].find(r => r.lastError);
      this.saveMessage = failed
        ? { text: `${failed.snippet.name}: ${failed.lastError}`, error: true }
        : { text: Runner.render(this.runners, this.settings.separator), error: false };
    },
  });

  Alpine.directive('hold', (el, { expression }, { evaluate, cleanup }) => {
    const ring = el.querySelector('circle');
    let holdTimer;

    el.addEventListener('pointerdown', e => {
      e.stopPropagation();
      e.preventDefault();
      ring.style.transition = `stroke-dashoffset 1200ms linear`;
      ring.style.strokeDashoffset = '0';
      holdTimer = setTimeout(() => evaluate(expression), 1200 + 200);
    });

    const cancelHold = () => {
      clearTimeout(holdTimer);
      ring.style.transition = 'stroke-dashoffset 300ms ease-out';
      ring.style.strokeDashoffset = 2 * Math.PI * 10.5;
    };
    el.addEventListener('pointerup', cancelHold);
    el.addEventListener('pointerleave', cancelHold);
    el.addEventListener('click', e => e.stopPropagation());

    cleanup(() => clearTimeout(holdTimer));
  });
}
