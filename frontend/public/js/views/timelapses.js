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
          <span class="muted" id="generate-status"></span>
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
      list.innerHTML = `<div class="empty">Aún no hay timelapses. Se generan solos cada noche (diario) y los domingos (semanal), o puedes crear uno arriba.</div>`;
      return;
    }

    list.innerHTML = `<div class="tl-list">${timelapses
      .map((t) => {
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
              </div>
            </div>
          </article>`;
      })
      .join("")}</div>`;

    list.querySelectorAll(".tl-item").forEach((item) => {
      const timelapse = timelapses.find((t) => String(t.id) === item.dataset.id);
      item.querySelectorAll("[data-action]").forEach((button) =>
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            const url = await Api.objectUrl(`/timelapses/${timelapse.id}/video`);
            if (button.dataset.action === "download") {
              const a = document.createElement("a");
              a.href = url;
              a.download = `plantcam_${timelapse.type}_${timelapse.date_from}_${timelapse.date_to}.mp4`;
              a.click();
              button.disabled = false;
            } else {
              item.insertAdjacentHTML("beforeend", `<video src="${url}" controls autoplay playsinline></video>`);
              button.remove();
            }
          } catch (err) {
            toast(err.message, "error");
            button.disabled = false;
          }
        })
      );
    });
  }

  const form = document.getElementById("generate-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = form.querySelector("button");
    const status = document.getElementById("generate-status");
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
      status.textContent = "";
    }
  });

  await load();
}
