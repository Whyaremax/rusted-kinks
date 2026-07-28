(() => {
  "use strict";

  let api;
  let hookId;
  let observedCalls = 0;
  let lastGlobalName = null;

  function install() {
    if (hookId) {
      return hookId;
    }
    api = globalThis.KDHybrid;
    if (!api) {
      throw new Error(
        "KD Hybrid is not ready; load this example after the KD Hybrid mod",
      );
    }
    hookId = api.registerHook(
      "pathfinding",
      "after",
      (context) => {
        // Read-only observation keeps KD's result and arguments unchanged.
        observedCalls += 1;
        lastGlobalName = context.globalName;
      },
      {
        id: "rusted-kinks.example.pathfinding-observer",
        priority: -100,
      },
    );
    return hookId;
  }

  function dispose() {
    if (!hookId) {
      return false;
    }
    const removed = api?.unregisterHook(hookId) ?? false;
    hookId = undefined;
    api = undefined;
    return removed;
  }

  function status() {
    return Object.freeze({
      installed: Boolean(hookId),
      hookId: hookId ?? null,
      observedCalls,
      lastGlobalName,
    });
  }

  globalThis.KDHybridHookExample = Object.freeze({
    install,
    dispose,
    status,
  });
})();
