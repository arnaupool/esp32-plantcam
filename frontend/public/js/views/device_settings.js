const RESOLUTIONS = ["VGA", "SVGA", "XGA", "SXGA", "UXGA", "QSXGA"];

async function renderDeviceSettings(root, deviceId) {
  root.innerHTML = `
    <div class="topbar">
      <h1>Ajustes</h1>
      <a href="#/dashboard" class="link-button">← Volver</a>
    </div>
    <div class="card"><div id="settings-slot">Cargando...</div></div>
  `;

  const slot = document.getElementById("settings-slot");

  let device;
  try {
    device = await Api.getDevice(deviceId);
  } catch (err) {
    if (err.message === "UNAUTHORIZED") {
      Api.clearToken();
      location.hash = "#/login";
      return;
    }
    slot.innerHTML = `<p class="error">${err.message}</p>`;
    return;
  }

  slot.innerHTML = `
    <form id="settings-form">
      <label>Nombre
        <input name="name" value="${device.name}" required />
      </label>
      <label>Modo de energía
        <select name="power_mode">
          <option value="mains" ${device.power_mode === "mains" ? "selected" : ""}>Enchufado</option>
          <option value="battery" ${device.power_mode === "battery" ? "selected" : ""}>Batería (deep sleep)</option>
        </select>
      </label>
      <label>Intervalo entre fotos (segundos)
        <input type="number" name="interval_seconds" min="10" value="${device.interval_seconds}" required />
      </label>
      <label>Ventana horaria: inicio
        <input type="time" name="schedule_start" value="${device.schedule_start.slice(0, 5)}" required />
      </label>
      <label>Ventana horaria: fin
        <input type="time" name="schedule_end" value="${device.schedule_end.slice(0, 5)}" required />
      </label>
      <label>Resolución
        <select name="resolution">
          ${RESOLUTIONS.map((r) => `<option value="${r}" ${device.resolution === r ? "selected" : ""}>${r}</option>`).join("")}
        </select>
      </label>
      <label>
        <input type="checkbox" name="is_active" ${device.is_active ? "checked" : ""} /> Activo
      </label>
      <button type="submit">Guardar</button>
      <div class="error" id="settings-error"></div>
      <div id="settings-ok" style="color:#1e6b3c;font-size:0.9rem;"></div>
    </form>
  `;

  const form = document.getElementById("settings-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("settings-error");
    const okEl = document.getElementById("settings-ok");
    errorEl.textContent = "";
    okEl.textContent = "";

    const payload = {
      name: form.name.value.trim(),
      power_mode: form.power_mode.value,
      interval_seconds: parseInt(form.interval_seconds.value, 10),
      schedule_start: form.schedule_start.value + ":00",
      schedule_end: form.schedule_end.value + ":00",
      resolution: form.resolution.value,
      is_active: form.is_active.checked,
    };

    try {
      await Api.updateDevice(deviceId, payload);
      okEl.textContent = "Guardado.";
    } catch (err) {
      if (err.message === "UNAUTHORIZED") {
        Api.clearToken();
        location.hash = "#/login";
        return;
      }
      errorEl.textContent = err.message;
    }
  });
}
