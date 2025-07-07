const scriptRel = /* @__PURE__ */ (function detectScriptRel() {
	const relList = typeof document !== "undefined" && document.createElement("link").relList;
	return relList && relList.supports && relList.supports("modulepreload") ? "modulepreload" : "preload";
})();const assetsURL = function(dep) { return "/"+dep };const seen = {};const __vitePreload = function preload(baseModule, deps, importerUrl) {
	let promise = Promise.resolve();
	if (true               && deps && deps.length > 0) {
		document.getElementsByTagName("link");
		const cspNonceMeta = document.querySelector("meta[property=csp-nonce]");
		const cspNonce = cspNonceMeta?.nonce || cspNonceMeta?.getAttribute("nonce");
		function allSettled(promises$2) {
			return Promise.all(promises$2.map((p$1) => Promise.resolve(p$1).then((value$1) => ({
				status: "fulfilled",
				value: value$1
			}), (reason) => ({
				status: "rejected",
				reason
			}))));
		}
		promise = allSettled(deps.map((dep) => {
			dep = assetsURL(dep);
			if (dep in seen) return;
			seen[dep] = true;
			const isCss = dep.endsWith(".css");
			const cssSelector = isCss ? "[rel=\"stylesheet\"]" : "";
			if (document.querySelector(`link[href="${dep}"]${cssSelector}`)) return;
			const link = document.createElement("link");
			link.rel = isCss ? "stylesheet" : scriptRel;
			if (!isCss) link.as = "script";
			link.crossOrigin = "";
			link.href = dep;
			if (cspNonce) link.setAttribute("nonce", cspNonce);
			document.head.appendChild(link);
			if (isCss) return new Promise((res, rej) => {
				link.addEventListener("load", res);
				link.addEventListener("error", () => rej(/* @__PURE__ */ new Error(`Unable to preload CSS for ${dep}`)));
			});
		}));
	}
	function handlePreloadError(err$2) {
		const e$1 = new Event("vite:preloadError", { cancelable: true });
		e$1.payload = err$2;
		window.dispatchEvent(e$1);
		if (!e$1.defaultPrevented) throw err$2;
	}
	return promise.then((res) => {
		for (const item of res || []) {
			if (item.status !== "rejected") continue;
			handlePreloadError(item.reason);
		}
		return baseModule().catch(handlePreloadError);
	});
};

function limitNumber(num, min, max) {
  return Math.min(max, Math.max(num, min));
}

function epsilonEquals(a, b) {
  return Math.abs(a - b) < 0.00000001;
}

function distanceNeededToAchieveSpeed(
  currentSpeed,
  targetSpeed,
  acceleration,
) {
  // v² = u² + 2a * d
  const requiredDistance =
    (Math.pow(targetSpeed, 2) - Math.pow(currentSpeed, 2)) / (2 * acceleration);
  return requiredDistance;
}

function accelerationNeededToAchieveChangeDistance(
  currentSpeed,
  targetSpeed,
  distance,
) {
  // v² = u² + 2a * d
  const requiredAcceleration =
    0.5 * ((Math.pow(targetSpeed, 2) - Math.pow(currentSpeed, 2)) / distance);
  return requiredAcceleration;
}

async function getCodeObjFromCode(code) {
  // Use vite-ignore comment to suppress warning about dynamic import
  const obj = await __vitePreload(() => import(
    /* @vite-ignore */ `data:text/javascript,${encodeURIComponent(code.trim())}`
  ),true              ?[]:void 0);
  if (typeof obj.update !== "function") {
    throw "Code must contain an update function";
  }
  return obj;
}


// Random number utilities (replacing lodash)
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Array utilities (replacing lodash)
function range(start, end) {
  if (arguments.length === 1) {
    end = start;
    start = 0;
  }
  const result = [];
  for (let i = start; i < end; i++) {
    result.push(i);
  }
  return result;
}

// Throttle implementation (replacing lodash)
function throttle(func, wait) {
  let timeout;
  let previous = 0;

  return function throttled() {
    const now = Date.now();
    const remaining = wait - (now - previous);
    const context = this;
    const args = arguments;

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      func.apply(context, args);
    } else if (!timeout) {
      timeout = setTimeout(() => {
        previous = Date.now();
        timeout = null;
        func.apply(context, args);
      }, remaining);
    }
  };
}

export { accelerationNeededToAchieveChangeDistance, distanceNeededToAchieveSpeed, epsilonEquals, getCodeObjFromCode, limitNumber, randomInt, range, throttle };