function deviceCard(device) {
  const lastPhoto = device.last_photo_at
    ? `Última foto ${relativeTime(parseUtc(device.last_photo_at))}, a las ${fmtTime.format(parseUtc(device.last_photo_at))}`
    : "Todavía sin fotos";
  const every = Math.round(device.interval_seconds / 60);
  const schedule = `${device.schedule_start.slice(0, 5)} a ${device.schedule_end.slice(0, 5)}`;

  return `
    <article class="card device-card">
      <a class="cover${isPortrait(device) ? " portrait" : ""}" href="#/devices/${device.id}/photos" ${device.last_photo_id ? `data-lazy data-photo="${device.last_photo_id}"` : ""} data-device="${device.id}">
        <div class="placeholder">${device.last_photo_id ? "Cargando..." : "Sin fotos todavía"}</div>
      </a>
      <div class="body">
        <div class="title-row">
          <h2>${esc(device.name)}</h2>
          ${statusPill(device)}
        </div>
        <div class="meta">${lastPhoto}</div>
        <div class="meta">Cada ${every} min, de ${schedule}</div>
        <div class="actions">
          <a class="btn btn-small" href="#/devices/${device.id}/photos">Fotos</a>
          <a class="btn btn-ghost btn-small" href="#/devices/${device.id}/timelapses">Timelapses</a>
          <a class="btn btn-ghost btn-small" href="#/devices/${device.id}/settings">Ajustes</a>
        </div>
      </div>
    </article>
  `;
}

async function renderDashboard(root) {
  const page = renderShell(root);
  page.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Dispositivos</h1>
        <div class="sub" id="devices-sub">Cargando...</div>
      </div>
    </div>
    <div id="devices-slot"></div>
  `;

  const slot = document.getElementById("devices-slot");
  let devices;
  try {
    devices = await Api.listDevices();
  } catch (err) {
    slot.innerHTML = `<p class="error">${esc(err.message)}</p>`;
    return;
  }

  const online = devices.filter(isOnline).length;
  document.getElementById("devices-sub").textContent =
    devices.length === 0 ? "Ninguno dado de alta" : `${devices.length} en total, ${online} en línea`;

  if (devices.length === 0) {
    slot.innerHTML = `<div class="empty">Todavía no hay dispositivos. Enciende un ESP32 con el firmware de PlantCam y aparecerá aquí solo.</div>`;
    return;
  }

  const byId = Object.fromEntries(devices.map((d) => [d.id, d]));
  slot.innerHTML = `<div class="device-grid">${devices.map(deviceCard).join("")}</div>`;
  lazyLoadImages(slot, async (cover) => {
    const device = byId[cover.dataset.device];
    try {
      const url = await ImageCache.photo(device, cover.dataset.photo, "thumb");
      cover.innerHTML = `<img src="${url}" alt="Última foto de ${esc(device.name)}" />`;
    } catch {
      cover.querySelector(".placeholder").textContent = "No se pudo cargar la foto";
    }
  });
}
