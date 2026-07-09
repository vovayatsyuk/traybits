async function createFn(code) {
  const blob = new Blob([code], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const mod = await import(/* @vite-ignore */ url);
  URL.revokeObjectURL(url);
  if (typeof mod.default !== 'function') throw new Error('Script must export default function');
  return mod.default;
}

export function create(snippet) {
  return {
    id: snippet.id,
    snippet,
    fn: null,
    resting: false,
    working: false,
    lastResult: null,
    lastError: null,
  };
}

export async function run(runner) {
  if (runner.working) {
    return runner;
  }

  runner.working = true;
  try {
    if (!runner.fn) { runner.fn = await createFn(runner.snippet.code) }
    const title = await runner.fn();
    if (typeof title !== 'string') throw new Error('Function must return a string');
    runner.lastResult = title;
    runner.lastError = null;
  } catch (e) {
    runner.lastError = e.message;
  } finally {
    runner.working = false;
  }
  return runner;
}

export async function runIfReady(runner) {
  if (runner.resting || runner.working) {
    return null;
  }

  if (runner.snippet.timeout > 1) {
    runner.resting = true;
    setTimeout(() => runner.resting = false, runner.snippet.timeout * 1000);
  }

  return run(runner);
}

export function render(runners) {
  return [...runners.values()]
    .filter(r => r.snippet.enabled)
    .map(r => r.lastError ? '⚠' : r.lastResult)
    .filter(Boolean)
    .join(' | ');
}
