function todayIso() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

async function loadThumbnails(deviceId, photos, grid) {
  for (const photo of photos) {
    const cell = document.createElement("div");
    cell.textContent = "…";
    cell.style.cssText = "aspect-ratio:1;background:#eee;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:0.75rem;color:#888;";
    grid.appendChild(cell);

    try {
      const url = await Api.getPhotoImageUrl(deviceId, photo.id);
      cell.textContent = "";
      const img = document.createElement("img");
      img.src = url;
      img.title = new Date(photo.captured_at + "Z").toLocaleString();
      img.style.cssText = "width:100%;height:100%;object-fit:cover;";
      cell.appendChild(img);
    } catch {
      cell.textContent = "Error";
    }
  }
}

async function renderGallery(root, deviceId) {
  const initialDate = todayIso();

  root.innerHTML = `
    <div class="topbar">
      <h1>Galería</h1>
      <a href="#/dashboard" class="link-button">← Volver</a>
    </div>
    <div class="card">
      <label style="display:flex;flex-direction:column;gap:0.3rem;max-width:220px;margin-bottom:1rem;">
        Fecha
        <input type="date" id="gallery-date" value="${initialDate}" />
      </label>
      <div id="gallery-status"></div>
      <div id="gallery-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.5rem;"></div>
    </div>
  `;

  const grid = document.getElementById("gallery-grid");
  const status = document.getElementById("gallery-status");
  const dateInput = document.getElementById("gallery-date");

  async function load() {
    grid.innerHTML = "";
    status.textContent = "Cargando...";
    try {
      const photos = await Api.listPhotos(deviceId, dateInput.value);
      status.textContent = photos.length === 0 ? "Sin fotos para esta fecha." : "";
      await loadThumbnails(deviceId, photos, grid);
    } catch (err) {
      if (err.message === "UNAUTHORIZED") {
        Api.clearToken();
        location.hash = "#/login";
        return;
      }
      status.textContent = err.message;
    }
  }

  dateInput.addEventListener("change", load);
  await load();
}
