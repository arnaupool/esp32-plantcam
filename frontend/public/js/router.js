const routes = [
  { pattern: /^#\/login$/, view: renderLogin },
  { pattern: /^#\/dashboard$/, view: renderDashboard },
  { pattern: /^#\/devices\/([^/]+)\/(photos|timelapses|settings)$/, view: renderDevice },
  { pattern: /^#\/devices\/([^/]+)$/, view: renderDevice },
];

function resolveRoute() {
  const root = document.getElementById("app");
  const hash = location.hash || "#/dashboard";

  if (hash !== "#/login" && !Api.getToken()) {
    location.hash = "#/login";
    return;
  }
  if (hash === "#/login" && Api.getToken()) {
    location.hash = "#/dashboard";
    return;
  }

  // Un visor abierto no debe sobrevivir a un cambio de pantalla.
  document.querySelectorAll(".lightbox").forEach((el) => el.remove());
  document.body.style.overflow = "";

  for (const route of routes) {
    const match = hash.match(route.pattern);
    if (match) {
      route.view(root, ...match.slice(1));
      return;
    }
  }
  location.hash = "#/dashboard";
}

window.addEventListener("hashchange", resolveRoute);
window.addEventListener("DOMContentLoaded", resolveRoute);
