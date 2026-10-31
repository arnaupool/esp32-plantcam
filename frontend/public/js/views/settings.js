const RESOLUTIONS = [
  ["VGA", "VGA, 640 x 480"],
  ["SVGA", "SVGA, 800 x 600"],
  ["XGA", "XGA, 1024 x 768"],
  ["SXGA", "SXGA, 1280 x 1024"],
  ["UXGA", "UXGA, 1600 x 1200 (recomendada)"],
  ["QSXGA", "QSXGA, 2560 x 1920 (5 MP, pesa el triple)"],
];

const ROTATIONS = [
  [0, "Sin girar"],
  [90, "90° a la derecha"],
  [180, "180° (boca abajo)"],
  [270, "90° a la izquierda"],
];

const RETENTIONS = [
  [7, "1 semana"],
  [14, "2 semanas"],
  [30, "1 mes"],
  [60, "2 meses"],
  [90, "3 meses"],
  [180, "6 meses"],
  [365, "1 año"],
  ["", "No borrar nunca"],
];

function options(list, selected) {
  return list
    .map(([value, label]) => `<option value="${value}" ${String(value) === String(selected) ? "selected" : ""}>${label}</option>`)
    .join("");
}

// Si el valor guardado no está en la lista (puesto por la API), se añade para no perderlo al guardar.
function retentionChoices(current) {
  if (current == null || RETENTIONS.some(([days]) => days === current)) return RETENTIONS;
  return [[current, `${current} días`], ...RETENTIONS];
}

function renderSettings(slot, device, onSaved) {
  slot.innerHTML = `
    <form class="card card-pad" id="settings-form">
      <section class="form-section">
        <h2>General</h2>
        <div class="form-grid">
          <label class="field"><span>Nombre</span><input name="name" value="${esc(device.name)}" required /></label>
          <label class="field"><span>Alimentación</span>
            <select name="power_mode">
              ${options([["mains", "Enchufado"], ["battery", "Batería (duerme entre fotos)"]], device.power_mode)}
            </select>
          </label>
        </div>
        <label class="switch" style="margin-top:1rem">
          <input type="checkbox" name="is_active" ${device.is_active ? "checked" : ""} />
          Hacer fotos (si lo desactivas, el dispositivo sigue conectado pero no dispara)
        </label>
      </section>

      <section class="form-section">
        <h2>Fotos</h2>
        <div class="form-grid">
          <label class="field"><span>Una foto cada (minutos)</span>
            <input type="number" name="interval_minutes" min="1" step="1" value="${Math.max(1, Math.round(device.interval_seconds / 60))}" required />
          </label>
          <label class="field"><span>Desde las</span><input type="time" name="schedule_start" value="${device.schedule_start.slice(0, 5)}" required /></label>
          <label class="field"><span>Hasta las</span><input type="time" name="schedule_end" value="${device.schedule_end.slice(0, 5)}" required /></label>
          <label class="field"><span>Resolución</span>
            <select name="resolution">${options(RESOLUTIONS, device.resolution)}</select>
          </label>
          <label class="field"><span>Girar la imagen</span>
            <select name="rotation">${options(ROTATIONS, device.rotation)}</select>
            <span class="hint">Si la cámara está montada de lado. Se aplica al ver las fotos y en los timelapses; la foto original no se toca.</span>
          </label>
        </div>
      </section>

      <section class="form-section">
        <h2>Timelapses automáticos</h2>
        <label class="switch">
          <input type="checkbox" name="auto_daily_timelapse" ${device.auto_daily_timelapse ? "checked" : ""} />
          Uno cada día, a las 00:05, con las fotos del día anterior
        </label>
        <label class="switch" style="margin-top:0.75rem">
          <input type="checkbox" name="auto_weekly_timelapse" ${device.auto_weekly_timelapse ? "checked" : ""} />
          Uno cada semana, los domingos a las 00:15
        </label>
        <p class="muted" style="margin:0.6rem 0 0;font-size:0.85rem">
          Desde la pestaña Timelapses siempre puedes generar uno a mano. Los vídeos no se borran solos.
        </p>
      </section>

      <section class="form-section">
        <h2>Borrado automático de fotos</h2>
        <div class="form-grid">
          <label class="field"><span>Borrar las fotos con más de</span>
            <select name="retention_days">${options(retentionChoices(device.retention_days), device.retention_days ?? "")}</select>
            <span class="hint">Cada noche a la 01:00. Los timelapses ya generados se conservan.</span>
          </label>
        </div>
        <p class="muted" style="margin:0.6rem 0 0;font-size:0.85rem">
          Ahora guarda ${device.photo_count === 1 ? "1 foto" : `${device.photo_count} fotos`}, ${fmtBytes(device.photos_bytes)}.
          Para borrar fotos concretas, pestaña Fotos, Seleccionar.
        </p>
      </section>

      <div class="form-actions">
        <button class="btn" type="submit">Guardar</button>
        <span class="muted">El dispositivo aplica los cambios en su próxima foto.</span>
      </div>
    </form>
  `;

  const form = document.getElementById("settings-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      const updated = await Api.updateDevice(device.id, {
        name: form.name.value.trim(),
        power_mode: form.power_mode.value,
        is_active: form.is_active.checked,
        interval_seconds: Number(form.interval_minutes.value) * 60,
        schedule_start: form.schedule_start.value + ":00",
        schedule_end: form.schedule_end.value + ":00",
        resolution: form.resolution.value,
        rotation: Number(form.rotation.value),
        auto_daily_timelapse: form.auto_daily_timelapse.checked,
        auto_weekly_timelapse: form.auto_weekly_timelapse.checked,
        retention_days: form.retention_days.value ? Number(form.retention_days.value) : null,
      });
      toast("Ajustes guardados");
      onSaved(updated);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      button.disabled = false;
    }
  });
}
