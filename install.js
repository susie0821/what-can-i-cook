// Makes the site installable as an app: registers the service worker (for offline use)
// and shows an "Install app" button where the browser supports installing.

const installButton = document.getElementById("install-button");
const installHint = document.getElementById("install-hint");
let installPrompt = null;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {
    // Without it the app still works; it just can't open offline.
  });
}

const isInstalled =
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
// iPhones and iPads have no install prompt; installing is done from the Share menu.
const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent);

if (!isInstalled && isAppleMobile) {
  installHint.textContent = "Install as an app: tap Share, then “Add to Home Screen”.";
  installHint.hidden = false;
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!installPrompt) {
    return;
  }
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  installButton.hidden = true;
});

window.addEventListener("appinstalled", () => {
  installButton.hidden = true;
  installHint.hidden = true;
});
