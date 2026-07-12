type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallState = {
  canPrompt: boolean;
  isInstalled: boolean;
  canShowManualHint: boolean;
};

export type UpdateCheckResult = "unsupported" | "up-to-date" | "update-ready" | "error";

const installListeners = new Set<(state: InstallState) => void>();
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let appInstalled = false;
let installEventsInitialized = false;
let serviceWorkerRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export function initializePwaEvents() {
  if (installEventsInitialized || typeof window === "undefined") return;
  installEventsInitialized = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
    notifyInstallListeners();
  });

  window.addEventListener("appinstalled", () => {
    appInstalled = true;
    deferredInstallPrompt = null;
    notifyInstallListeners();
  });
}

export function getPwaInstallState(): InstallState {
  const isInstalled = isInstalledDisplayMode() || appInstalled;
  return {
    canPrompt: Boolean(deferredInstallPrompt) && !isInstalled,
    isInstalled,
    canShowManualHint: !deferredInstallPrompt && !isInstalled,
  };
}

export function subscribePwaInstallState(listener: (state: InstallState) => void): () => void {
  installListeners.add(listener);
  listener(getPwaInstallState());
  return () => {
    installListeners.delete(listener);
  };
}

export async function promptPwaInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const promptEvent = deferredInstallPrompt;
  if (!promptEvent) return "unavailable";

  deferredInstallPrompt = null;
  notifyInstallListeners();

  await promptEvent.prompt();
  const choice = await promptEvent.userChoice;
  notifyInstallListeners();
  return choice.outcome;
}

export function registerPwaServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (serviceWorkerRegistrationPromise) return serviceWorkerRegistrationPromise;

  serviceWorkerRegistrationPromise = (async () => {
    if (!("serviceWorker" in navigator)) return null;
    if (!window.isSecureContext) return null;
    if (import.meta.env.DEV) return null;

    try {
      return await navigator.serviceWorker.register("/sw.js");
    } catch (error) {
      console.warn("Service worker registration failed", error);
      return null;
    }
  })();

  return serviceWorkerRegistrationPromise;
}

export async function checkForPwaUpdate(): Promise<UpdateCheckResult> {
  if (!("serviceWorker" in navigator)) return "unsupported";

  try {
    const registration = await getServiceWorkerRegistration();
    if (!registration) return "unsupported";
    if (registration.waiting) return "update-ready";

    const updateResult = waitForUpdate(registration);
    await registration.update();
    return await updateResult;
  } catch (error) {
    console.warn("PWA update check failed", error);
    return "error";
  }
}

export async function applyPwaUpdate(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;

  const registration = await getServiceWorkerRegistration();
  const waitingWorker = registration?.waiting;
  if (!waitingWorker) return false;

  await new Promise<void>((resolve) => {
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      resolve();
    };
    const onControllerChange = () => finish();

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    window.setTimeout(finish, 4000);
  });

  window.location.reload();
  return true;
}

function notifyInstallListeners() {
  const state = getPwaInstallState();
  installListeners.forEach((listener) => listener(state));
}

function isInstalledDisplayMode(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    nav.standalone === true
  );
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  const registered = await registerPwaServiceWorker();
  if (registered) return registered;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

function waitForUpdate(registration: ServiceWorkerRegistration): Promise<UpdateCheckResult> {
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId: number | null = null;

    const finish = (result: UpdateCheckResult) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      registration.removeEventListener("updatefound", onUpdateFound);
      resolve(result);
    };

    const watchWorker = (worker: ServiceWorker) => {
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed") {
          finish(registration.waiting ? "update-ready" : "up-to-date");
        }
      });
    };

    const onUpdateFound = () => {
      const worker = registration.installing;
      if (worker) watchWorker(worker);
    };

    registration.addEventListener("updatefound", onUpdateFound);
    if (registration.installing) watchWorker(registration.installing);

    timeoutId = window.setTimeout(() => {
      finish(registration.waiting ? "update-ready" : "up-to-date");
    }, 5000);
  });
}
