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

function options(list, selected) {
  return list
    .map(([value, label]) => `<option value="${value}" ${String(value) === String(selected) ? "selected" : ""}>${label}</option>`)
    .join("");
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
