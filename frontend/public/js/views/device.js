const DEVICE_TABS = [
  ["photos", "Fotos"],
  ["timelapses", "Timelapses"],
  ["settings", "Ajustes"],
];

async function renderDevice(root, deviceId, tab = "photos") {
  if (!DEVICE_TABS.some(([key]) => key === tab)) tab = "photos";
  const page = renderShell(root);
  page.innerHTML = `<p class="muted">Cargando...</p>`;

  let device;
  try {
    device = await Api.getDevice(deviceId);
  } catch (err) {
    page.innerHTML = `<a class="back" href="#/dashboard">${ICONS.left} Dispositivos</a><p class="error">${esc(err.message)}</p>`;
    return;
  }

  function drawHeader() {
    document.getElementById("device-head").innerHTML = `
      <a class="back" href="#/dashboard">${ICONS.left.replace("<svg", '<svg width="16" height="16"')} Dispositivos</a>
      <div class="page-head">
        <div>
          <h1>${esc(device.name)}</h1>
          <div class="sub">${statusPill(device)}${
            device.last_seen_at ? ` <span class="muted">visto ${relativeTime(parseUtc(device.last_seen_at))}</span>` : ""
          }</div>
        </div>
      </div>`;
  }

  page.innerHTML = `
    <div id="device-head"></div>
    <nav class="tabs">${DEVICE_TABS.map(
      ([key, label]) => `<a href="#/devices/${device.id}/${key}" class="${key === tab ? "active" : ""}">${label}</a>`
    ).join("")}</nav>
    <div id="tab-slot"></div>
  `;
  drawHeader();

  const slot = document.getElementById("tab-slot");
  if (tab === "timelapses") await renderTimelapses(slot, device);
  else if (tab === "settings")
    renderSettings(slot, device, (updated) => {
      device = updated;
      drawHeader();
    });
  else await renderPhotos(slot, device);
}
