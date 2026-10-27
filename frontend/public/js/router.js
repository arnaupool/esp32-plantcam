const routes = [
  { pattern: /^#\/login$/, view: renderLogin },
  { pattern: /^#\/dashboard$/, view: renderDashboard },
  { pattern: /^#\/devices\/([^/]+)$/, view: renderDeviceSettings },
  { pattern: /^#\/devices\/([^/]+)\/photos$/, view: renderGallery },
  { pattern: /^#\/devices\/([^/]+)\/timelapses$/, view: renderTimelapses },
];

function resolveRoute() {
  const root = document.getElementById("app");
  let hash = location.hash || "#/dashboard";

  if (hash !== "#/login" && !Api.getToken()) {
    location.hash = "#/login";
    return;
  }
  if (hash === "#/login" && Api.getToken()) {
    location.hash = "#/dashboard";
    return;
  }

  for (const route of routes) {
    const match = hash.match(route.pattern);
    if (match) {
      route.view(root, ...match.slice(1));
      return;
    }
  }

  renderLogin(root);
}

window.addEventListener("hashchange", resolveRoute);
window.addEventListener("DOMContentLoaded", resolveRoute);
