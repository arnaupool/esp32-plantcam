const STATUS_LABELS = {
  pending: "Pendiente",
  processing: "Procesando",
  done: "Listo",
  failed: "Falló",
};

const TYPE_LABELS = { daily: "Diario", weekly: "Semanal", manual: "Manual" };

function todayIsoTl() {
  return new Date().toISOString().slice(0, 10);
}

async function renderTimelapseRow(t, container) {
  const row = document.createElement("li");
  row.className = "device-row";

  const label = document.createElement("span");
  label.textContent = `${TYPE_LABELS[t.type] || t.type} · ${t.date_from} → ${t.date_to}`;

  const right = document.createElement("span");
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = STATUS_LABELS[t.status] || t.status;
  right.appendChild(badge);

  if (t.status === "done") {
    const playBtn = document.createElement("button");
    playBtn.className = "link-button";
    playBtn.textContent = "Ver";
    playBtn.style.marginLeft = "0.5rem";
    playBtn.addEventListener("click", async () => {
      playBtn.textContent = "Cargando...";
      try {
        const url = await Api.getTimelapseVideoUrl(t.id);
        const video = document.createElement("video");
        video.src = url;
        video.controls = true;
        video.style.width = "100%";
        video.style.marginTop = "0.5rem";
        row.appendChild(video);
        playBtn.remove();
      } catch (err) {
        playBtn.textContent = "Error";
      }
    });
    right.appendChild(playBtn);
  }

  row.appendChild(label);
  row.appendChild(right);
  container.appendChild(row);
}

async function renderTimelapses(root, deviceId) {
  root.innerHTML = `
    <div class="topbar">
      <h1>Timelapses</h1>
      <a href="#/dashboard" class="link-button">← Volver</a>
    </div>
    <div class="card">
      <form id="generate-form">
        <label>Desde
          <input type="date" name="date_from" value="${todayIsoTl()}" required />
        </label>
        <label>Hasta
          <input type="date" name="date_to" value="${todayIsoTl()}" required />
        </label>
        <label>FPS
          <input type="number" name="fps" value="24" min="1" max="60" required />
        </label>
        <button type="submit">Generar ahora</button>
        <div class="error" id="generate-error"></div>
      </form>
    </div>
    <div class="card">
      <div id="timelapses-status"></div>
      <ul class="device-list" id="timelapses-list"></ul>
    </div>
  `;

  const list = document.getElementById("timelapses-list");
  const status = document.getElementById("timelapses-status");

  async function load() {
    list.innerHTML = "";
    status.textContent = "Cargando...";
    try {
      const timelapses = await Api.listTimelapses(deviceId);
      status.textContent = timelapses.length === 0 ? "Todavía no hay timelapses." : "";
      for (const t of timelapses) {
        await renderTimelapseRow(t, list);
      }
    } catch (err) {
      if (err.message === "UNAUTHORIZED") {
        Api.clearToken();
        location.hash = "#/login";
        return;
      }
      status.textContent = err.message;
    }
  }

  const form = document.getElementById("generate-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("generate-error");
    errorEl.textContent = "";
    try {
      await Api.createTimelapse(deviceId, form.date_from.value, form.date_to.value, parseInt(form.fps.value, 10));
      await load();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  await load();
}
