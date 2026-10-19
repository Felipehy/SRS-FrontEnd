export type FoundTargets = Record<string, Element | null>;

function isReady(el: Element): boolean {
  if (el.closest('[aria-busy="true"]')) return false;
  if (el.querySelector('[aria-busy="true"]')) return false;
  return el.getClientRects().length > 0;
}

export function findTarget(target: string): Element | null {
  const list = document.querySelectorAll(`[data-tour="${target}"]`);
  for (const el of list) {
    if (isReady(el)) return el;
  }
  return null;
}

export function waitForTargets(targets: string[], timeoutMs: number, signal: AbortSignal): Promise<FoundTargets> {
  return new Promise(resolve => {
    let done = false;
    let observer: MutationObserver | null = null;
    let timer = 0;

    function collect(): { found: FoundTargets; complete: boolean } {
      const found: FoundTargets = {};
      let complete = true;
      for (const target of targets) {
        const el = findTarget(target);
        found[target] = el;
        if (!el) complete = false;
      }
      return { found, complete };
    }

    function finish(found: FoundTargets) {
      if (done) return;
      done = true;
      if (observer) observer.disconnect();
      window.clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve(found);
    }

    function check() {
      const result = collect();
      if (result.complete) finish(result.found);
    }

    function onTimeout() {
      finish(collect().found);
    }

    function onAbort() {
      finish({});
    }

    if (signal.aborted) {
      resolve({});
      return;
    }

    signal.addEventListener("abort", onAbort);
    timer = window.setTimeout(onTimeout, timeoutMs);
    observer = new MutationObserver(check);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-busy", "data-tour", "class", "style"],
    });
    check();
  });
}
