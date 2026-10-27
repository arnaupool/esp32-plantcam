function isOnline(device) {
  if (!device.last_seen_at) return false;
  const lastSeen = new Date(device.last_seen_at + "Z");
  const staleAfterMs = Math.max(device.interval_seconds * 3, 900) * 1000;
  return Date.now() - lastSeen.getTime() < staleAfterMs;
}

async function renderDashboard(root) {
  root.innerHTML = `
    <div class="topbar">
      <h1>Dispositivos</h1>
      <button class="link-button" id="logout-btn">Cerrar sesión</button>
    </div>
    <div class="card"><div id="devices-slot">Cargando...</div></div>
  `;

  document.getElementById("logout-btn").addEventListener("click", () => {
    Api.clearToken();
    location.hash = "#/login";
  });

  const slot = document.getElementById("devices-slot");

  try {
    const devices = await Api.listDevices();
    if (devices.length === 0) {
      slot.innerHTML = "<p>Todavía no hay dispositivos dados de alta.</p>";
      return;
    }

    slot.innerHTML = `
      <ul class="device-list">
        ${devices
          .map((d) => {
            const online = isOnline(d);
            return `
              <li class="device-row">
                <span>${d.name}</span>
                <span>
                  <span class="badge ${online ? "online" : "offline"}">${online ? "En línea" : "Sin conexión"}</span>
                  <a href="#/devices/${d.id}/photos">Galería</a>
                  <a href="#/devices/${d.id}/timelapses">Timelapses</a>
                  <a href="#/devices/${d.id}">Ajustes</a>
                </span>
              </li>
            `;
          })
          .join("")}
      </ul>
    `;
  } catch (err) {
    if (err.message === "UNAUTHORIZED") {
      Api.clearToken();
      location.hash = "#/login";
      return;
    }
    slot.innerHTML = `<p class="error">${err.message}</p>`;
  }
}
