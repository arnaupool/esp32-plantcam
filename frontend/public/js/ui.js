const ICONS = {
  leaf: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17 3C10 3 5 7 5 14c0 2 .6 3.8 1.6 5.3L4.3 21.7l1.4 1.4 2.3-2.3C9.4 21.6 11 22 13 22c6 0 8-6 8-12V3h-4Zm-4 17c-1.4 0-2.7-.3-3.8-.9l6.5-6.4-1.4-1.4-6.4 6.4A7.6 7.6 0 0 1 7 14c0-5.3 3.6-8.6 10-9h2v5c0 5.3-1.6 10-6 10Z"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};

// Botón que pide un segundo clic en 4 segundos antes de una acción irreversible, en lugar de un diálogo del
// navegador. `armedLabel` es el texto mientras espera la confirmación.
function confirmButton(button, armedLabel, action) {
  let armedTimer = null;
  let originalHtml = null;
  const disarm = () => {
    clearTimeout(armedTimer);
    armedTimer = null;
    if (originalHtml !== null) button.innerHTML = originalHtml;
    button.classList.replace("btn-danger", "btn-ghost");
  };
  button.addEventListener("click", async () => {
    if (!armedTimer) {
      originalHtml = button.innerHTML;
      button.textContent = armedLabel;
      button.classList.replace("btn-ghost", "btn-danger");
      armedTimer = setTimeout(disarm, 4000);
      return;
    }
    disarm();
    button.disabled = true;
    try {
      await action();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      button.disabled = false;
    }
  });
  return disarm;
}

function fmtBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1).replace(".", ",")} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2).replace(".", ",")} GB`;
}

// Todo texto que venga del servidor (nombres de dispositivo, mensajes) pasa por aquí antes de ir a innerHTML.
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Las fechas del servidor van en UTC sin zona.
function parseUtc(value) {
  return new Date(value.endsWith("Z") ? value : value + "Z");
}

const fmtTime = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" });
const fmtTimeSeconds = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const fmtLongDate = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fmtShortDate = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });
const fmtRelative = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

// "miércoles, 28 de octubre" -> "Miércoles, 28 de octubre" (CSS capitalize pondría "De" en mayúscula).
function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function relativeTime(date) {
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return "hace un momento";
  if (abs < 3600) return fmtRelative.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return fmtRelative.format(Math.round(seconds / 3600), "hour");
  return fmtRelative.format(Math.round(seconds / 86400), "day");
}

// "YYYY-MM-DD" en hora local (no en UTC, que a medianoche da el día anterior o el siguiente).
function localIsoDate(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dayRange(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return [new Date(y, m - 1, d), new Date(y, m - 1, d + 1)];
}

function isOnline(device) {
  if (!device.last_seen_at) return false;
  const staleAfterMs = Math.max(device.interval_seconds * 3, 900) * 1000;
  return Date.now() - parseUtc(device.last_seen_at).getTime() < staleAfterMs;
}

function statusPill(device) {
  if (!device.is_active) return '<span class="pill warn">Pausado</span>';
  return isOnline(device) ? '<span class="pill ok">En línea</span>' : '<span class="pill off">Sin conexión</span>';
}

function isPortrait(device) {
  return device.rotation === 90 || device.rotation === 270;
}

let toastTimer;
function toast(message, kind = "ok") {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.className = `toast show ${kind === "error" ? "error" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = "toast"), 2600);
}

// Barra superior común a todas las pantallas con sesión iniciada. Devuelve el contenedor de la página.
function renderShell(root) {
  root.innerHTML = `
    <header class="appbar">
      <div class="appbar-inner">
        <a class="brand" href="#/dashboard">${ICONS.leaf}<span>PlantCam</span></a>
        <div class="spacer"></div>
        <button class="btn btn-ghost btn-small" id="logout-btn">Salir</button>
      </div>
    </header>
    <main class="page" id="page"></main>
  `;
  document.getElementById("logout-btn").addEventListener("click", () => {
    Api.clearToken();
    location.hash = "#/login";
  });
  return document.getElementById("page");
}

// Carga las imágenes de un contenedor solo cuando se acercan a la pantalla.
function lazyLoadImages(container, loader) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        loader(entry.target);
      }
    },
    { rootMargin: "300px" }
  );
  container.querySelectorAll("[data-lazy]").forEach((el) => observer.observe(el));
  return observer;
}
