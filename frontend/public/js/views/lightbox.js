// Visor a pantalla completa. Flechas del teclado o deslizar para cambiar de foto, Esc para cerrar.
function openLightbox(device, photos, startIndex) {
  let index = startIndex;
  const overlay = document.createElement("div");
  overlay.className = "lightbox";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.innerHTML = `
    <div class="lb-bar">
      <div class="lb-info">
        <div class="lb-date"></div>
        <div class="lb-sub"></div>
      </div>
      <a class="btn btn-ghost btn-icon" id="lb-download" title="Descargar">${ICONS.download}</a>
      <button class="btn btn-ghost btn-icon" id="lb-close" title="Cerrar (Esc)">${ICONS.close}</button>
    </div>
    <div class="lb-stage">
      <button class="lb-nav lb-prev" title="Anterior">${ICONS.left}</button>
      <span class="lb-loading">Cargando...</span>
      <img alt="" />
      <button class="lb-nav lb-next" title="Siguiente">${ICONS.right}</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  const img = overlay.querySelector("img");
  const loading = overlay.querySelector(".lb-loading");
  const prevBtn = overlay.querySelector(".lb-prev");
  const nextBtn = overlay.querySelector(".lb-next");
  const download = overlay.querySelector("#lb-download");

  async function show(i) {
    index = i;
    const photo = photos[index];
    const takenAt = parseUtc(photo.captured_at);
    overlay.querySelector(".lb-date").textContent = capitalize(fmtLongDate.format(takenAt));
    overlay.querySelector(".lb-sub").textContent =
      `${fmtTimeSeconds.format(takenAt)}  ·  ${index + 1} de ${photos.length}  ·  ${Math.round(photo.file_size / 1024)} KB`;
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === photos.length - 1;

    img.style.opacity = "0.35";
    loading.hidden = false;
    try {
      const url = await ImageCache.photo(device, photo.id, "full");
      if (index !== i) return;  // ya se pasó a otra foto mientras cargaba
      img.src = url;
      img.alt = `Foto del ${fmtLongDate.format(takenAt)} a las ${fmtTime.format(takenAt)}`;
      download.href = url;
      download.download = `plantcam_${localIsoDate(takenAt)}_${fmtTime.format(takenAt).replace(":", "")}.jpg`;
    } catch {
      loading.textContent = "No se pudo cargar la foto";
      return;
    }
    img.style.opacity = "1";
    loading.hidden = true;

    // Precarga de las vecinas para que pasar de foto sea inmediato.
    for (const j of [index - 1, index + 1]) {
      if (photos[j]) ImageCache.photo(device, photos[j].id, "full").catch(() => {});
    }
  }

  const prev = () => index > 0 && show(index - 1);
  const next = () => index < photos.length - 1 && show(index + 1);

  function close() {
    document.removeEventListener("keydown", onKey);
    document.body.style.overflow = "";
    overlay.remove();
  }

  function onKey(e) {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") prev();
    else if (e.key === "ArrowRight") next();
  }

  let touchStartX = null;
  const stage = overlay.querySelector(".lb-stage");
  stage.addEventListener("pointerdown", (e) => (touchStartX = e.clientX));
  stage.addEventListener("pointerup", (e) => {
    if (touchStartX === null) return;
    const dx = e.clientX - touchStartX;
    touchStartX = null;
    if (Math.abs(dx) > 50) (dx > 0 ? prev : next)();
  });
  stage.addEventListener("click", (e) => {
    if (e.target === stage) close();
  });

  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);
  overlay.querySelector("#lb-close").addEventListener("click", close);
  document.addEventListener("keydown", onKey);

  show(index);
}
