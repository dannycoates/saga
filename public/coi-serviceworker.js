/*! coi-serviceworker v0.1.7 - Guido Zuidhof and contributors, licensed under MIT */
/*! Modified: COEP is conditionally applied based on coepEnabled state (persisted in Cache API) */
let coepCredentialless = false;
let coepEnabled = false;
let coepLoaded = false;
const COEP_CACHE_KEY = "coep-enabled-flag";
const COEP_CACHE_URL = "/coep-flag";

async function persistCoepEnabled(value) {
  coepEnabled = value;
  coepLoaded = true;
  const cache = await caches.open(COEP_CACHE_KEY);
  if (value) {
    await cache.put(COEP_CACHE_URL, new Response("1"));
  } else {
    await cache.delete(COEP_CACHE_URL);
  }
}

async function loadCoepEnabled() {
  if (coepLoaded) return;
  const cache = await caches.open(COEP_CACHE_KEY);
  const response = await cache.match(COEP_CACHE_URL);
  coepEnabled = !!response;
  coepLoaded = true;
}

if (typeof window === "undefined") {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (event) =>
    event.waitUntil(loadCoepEnabled().then(() => self.clients.claim())),
  );

  self.addEventListener("message", (ev) => {
    if (!ev.data) {
      return;
    } else if (ev.data.type === "deregister") {
      self.registration
        .unregister()
        .then(() => {
          return self.clients.matchAll();
        })
        .then((clients) => {
          clients.forEach((client) => client.navigate(client.url));
        });
    } else if (ev.data.type === "coepCredentialless") {
      coepCredentialless = ev.data.value;
    } else if (ev.data.type === "coepEnabled") {
      persistCoepEnabled(ev.data.value).then(() => {
        if (ev.ports[0]) {
          ev.ports[0].postMessage({ type: "coepEnabled", done: true });
        }
      });
    }
  });

  self.addEventListener("fetch", function (event) {
    const r = event.request;
    if (r.cache === "only-if-cached" && r.mode !== "same-origin") {
      return;
    }

    event.respondWith(
      loadCoepEnabled()
        .then(() => {
          const request =
            coepCredentialless && coepEnabled && r.mode === "no-cors"
              ? new Request(r, {
                  credentials: "omit",
                })
              : r;
          return fetch(request);
        })
        .then((response) => {
          if (response.status === 0) {
            return response;
          }

          const newHeaders = new Headers(response.headers);
          if (coepEnabled) {
            newHeaders.set(
              "Cross-Origin-Embedder-Policy",
              coepCredentialless ? "credentialless" : "require-corp",
            );
            if (!coepCredentialless) {
              newHeaders.set("Cross-Origin-Resource-Policy", "cross-origin");
            }
          }
          newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          });
        })
        .catch((e) => console.error(e)),
    );
  });
} else {
  (() => {
    const coi = {
      shouldRegister: () => true,
      shouldDeregister: () => false,
      doReload: () => window.location.reload(),
      quiet: false,
      ...window.coi,
    };

    const n = navigator;

    if (n.serviceWorker && n.serviceWorker.controller) {
      if (coi.shouldDeregister()) {
        n.serviceWorker.controller.postMessage({ type: "deregister" });
      }
      // Safari doesn't support credentialless COEP; Chrome and Firefox do
      n.serviceWorker.controller.postMessage({
        type: "coepCredentialless",
        value: !!(window.chrome || window.netscape),
      });
      // Sync coepEnabled state from cookie to service worker
      const coepCookieSet = document.cookie.includes("coepEnabled=1");
      n.serviceWorker.controller.postMessage({
        type: "coepEnabled",
        value: coepCookieSet,
      });
    }

    // If we're already controlled by a service worker, nothing to do.
    // The SW will handle COOP headers. COEP is conditionally applied
    // based on the coepEnabled state synced via postMessage.
    if (n.serviceWorker && n.serviceWorker.controller) return;

    if (window.crossOriginIsolated !== false) return;

    if (!window.isSecureContext) {
      !coi.quiet &&
        console.log(
          "COOP/COEP Service Worker not registered, a secure context is required.",
        );
      return;
    }

    if (n.serviceWorker) {
      n.serviceWorker.register(window.document.currentScript.src).then(
        (registration) => {
          !coi.quiet &&
            console.log(
              "COOP/COEP Service Worker registered",
              registration.scope,
            );

          registration.addEventListener("updatefound", () => {
            !coi.quiet &&
              console.log(
                "Reloading page to make use of updated COOP/COEP Service Worker.",
              );
            coi.doReload();
          });

          // If the registration is active, but it's not controlling the page
          if (registration.active && !n.serviceWorker.controller) {
            !coi.quiet &&
              console.log(
                "Reloading page to make use of COOP/COEP Service Worker.",
              );
            coi.doReload();
          }
        },
        (err) => {
          !coi.quiet &&
            console.error("COOP/COEP Service Worker failed to register:", err);
        },
      );
    }
  })();
}
