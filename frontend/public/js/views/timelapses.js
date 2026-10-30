const TIMELAPSE_STATUS = {
  pending: ["Pendiente", "warn"],
  processing: ["Procesando", "warn"],
  done: ["Listo", "ok"],
  failed: ["Falló", "off"],
};
const TIMELAPSE_TYPE = { daily: "Diario", weekly: "Semanal", manual: "Manual" };

function timelapseRange(t) {
  const from = fmtShortDate.format(dayRange(t.date_from)[0]);
  if (t.date_from === t.date_to) return from;
  return `${from} a ${fmtShortDate.format(dayRange(t.date_to)[0])}`;
}

function timelapseItem(t) {
  const [label, kind] = TIMELAPSE_STATUS[t.status] || [t.status, ""];
  const ready = t.status === "done";
  return `
    <article class="card tl-item" data-id="${t.id}">
      <div class="tl-head">
        <span class="pill plain">${TIMELAPSE_TYPE[t.type] || esc(t.type)}</span>
        <span class="range">${timelapseRange(t)}</span>
        <span class="muted">${t.fps} fps</span>
        <span class="pill ${kind}">${label}</span>
        <div class="actions">
          ${ready ? `<button class="btn btn-small" data-action="play">Ver</button>
                     <button class="btn btn-ghost btn-small" data-action="download">Descargar</button>` : ""}
          <button class="btn btn-ghost btn-small" data-action="delete">Borrar</button>
        </div>
      </div>
    </article>`;
}

// Ver y Cerrar: el vídeo se descarga al abrirlo y se libera al cerrarlo.
function bindPlay(item, timelapse, button) {
  let videoUrl = null;
  button.addEventListener("click", async () => {
    const open = item.querySelector("video");
    if (open) {
      open.remove();
      URL.revokeObjectURL(videoUrl);
      button.textContent = "Ver";
      return;
    }
    button.disabled = true;
    try {
      videoUrl = await Api.objectUrl(`/timelapses/${timelapse.id}/video`);
      item.insertAdjacentHTML("beforeend", `<video src="${videoUrl}" controls autoplay playsinline></video>`);
      button.textContent = "Cerrar";
    } catch (err) {
      toast(err.message, "error");
    } finally {
      button.disabled = false;
    }
  });
}

function bindDownload(timelapse, button) {
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const url = await Api.objectUrl(`/timelapses/${timelapse.id}/video`);
      const a = document.createElement("a");
      a.href = url;
      a.download = `plantcam_${timelapse.type}_${timelapse.date_from}_${timelapse.date_to}.mp4`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      button.disabled = false;
    }
  });
}

// Borrar pide un segundo clic en 4 segundos, en lugar de un diálogo del navegador.
function bindDelete(timelapse, button, onDeleted) {
  let armedTimer = null;
  button.addEventListener("click", async () => {
    if (!armedTimer) {
      button.textContent = "¿Borrar? Pulsa otra vez";
      button.classList.replace("btn-ghost", "btn-danger");
      armedTimer = setTimeout(() => {
        armedTimer = null;
        button.textContent = "Borrar";
        button.classList.replace("btn-danger", "btn-ghost");
      }, 4000);
      return;
    }
    clearTimeout(armedTimer);
    button.disabled = true;
    try {
      await Api.deleteTimelapse(timelapse.id);
      toast("Timelapse borrado");
      onDeleted();
    } catch (err) {
      toast(err.message, "error");
      button.disabled = false;
    }
  });
}

async function renderTimelapses(slot, device) {
  const today = localIsoDate(new Date());
  slot.innerHTML = `
    <section class="card card-pad" style="margin-bottom:1.25rem">
      <h2 style="margin-bottom:1rem">Generar un timelapse</h2>
      <form id="generate-form">
        <div class="form-grid">
          <label class="field"><span>Desde</span><input type="date" name="date_from" value="${today}" max="${today}" required /></label>
          <label class="field"><span>Hasta</span><input type="date" name="date_to" value="${today}" max="${today}" required /></label>
          <label class="field"><span>Fotogramas por segundo</span><input type="number" name="fps" value="24" min="1" max="60" required /></label>
        </div>
        <div class="form-actions">
          <button class="btn" type="submit">Generar ahora</button>
          <span class="muted" id="generate-status">Solo entran las fotos dentro del horario del dispositivo.</span>
        </div>
      </form>
    </section>
    <h2 style="margin-bottom:0.75rem">Generados</h2>
    <div id="tl-slot"></div>
  `;

  const list = document.getElementById("tl-slot");

  async function load() {
    list.innerHTML = `<p class="muted">Cargando...</p>`;
    let timelapses;
    try {
      timelapses = await Api.listTimelapses(device.id);
    } catch (err) {
      list.innerHTML = `<p class="error">${esc(err.message)}</p>`;
      return;
    }
    if (timelapses.length === 0) {
      const auto = [device.auto_daily_timelapse && "cada noche (diario)", device.auto_weekly_timelapse && "los domingos (semanal)"]
        .filter(Boolean)
        .join(" y ");
      list.innerHTML = `<div class="empty">Aún no hay timelapses. ${
        auto ? `Se generan solos ${auto}, o` : "Los automáticos están desactivados en Ajustes;"
      } puedes crear uno arriba.</div>`;
      return;
    }

    list.innerHTML = `<div class="tl-list">${timelapses.map(timelapseItem).join("")}</div>`;
    list.querySelectorAll(".tl-item").forEach((item) => {
      const timelapse = timelapses.find((t) => String(t.id) === item.dataset.id);
      const play = item.querySelector('[data-action="play"]');
      const download = item.querySelector('[data-action="download"]');
      if (play) bindPlay(item, timelapse, play);
      if (download) bindDownload(timelapse, download);
      bindDelete(timelapse, item.querySelector('[data-action="delete"]'), load);
    });
  }

  const form = document.getElementById("generate-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = form.querySelector("button");
    const status = document.getElementById("generate-status");
    const hint = status.textContent;
    button.disabled = true;
    status.textContent = "Generando, puede tardar un poco...";
    try {
      const t = await Api.createTimelapse(device.id, form.date_from.value, form.date_to.value, Number(form.fps.value));
      toast(t.status === "done" ? "Timelapse listo" : "No había fotos en esas fechas", t.status === "done" ? "ok" : "error");
      await load();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      button.disabled = false;
      status.textContent = hint;
    }
  });

  await load();
}
