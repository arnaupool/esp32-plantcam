function shiftDay(isoDate, days) {
  const [start] = dayRange(isoDate);
  start.setDate(start.getDate() + days);
  return localIsoDate(start);
}

async function renderPhotos(slot, device) {
  let day = localIsoDate(new Date());
  if (device.last_photo_at) day = localIsoDate(parseUtc(device.last_photo_at));

  slot.innerHTML = `
    <div class="toolbar">
      <button class="btn btn-ghost btn-icon" id="day-prev" title="Día anterior">${ICONS.left}</button>
      <input type="date" id="day-input" aria-label="Día" />
      <button class="btn btn-ghost btn-icon" id="day-next" title="Día siguiente">${ICONS.right}</button>
      <button class="btn btn-ghost btn-small" id="day-today">Hoy</button>
      <span class="count" id="photo-count"></span>
    </div>
    <div class="day-label" id="day-label"></div>
    <div id="photos-slot"></div>
  `;

  const input = document.getElementById("day-input");
  const photosSlot = document.getElementById("photos-slot");
  let observer;

  async function load() {
    input.value = day;
    const [start, end] = dayRange(day);
    document.getElementById("day-label").textContent = capitalize(fmtLongDate.format(start));
    document.getElementById("day-next").disabled = day >= localIsoDate(new Date());
    document.getElementById("photo-count").textContent = "";
    photosSlot.innerHTML = `<p class="muted">Cargando...</p>`;
    observer?.disconnect();

    let photos;
    try {
      // Del servidor llegan de la más reciente a la más antigua; aquí se muestran en orden del día.
      photos = (await Api.listPhotos(device.id, start, end)).reverse();
    } catch (err) {
      photosSlot.innerHTML = `<p class="error">${esc(err.message)}</p>`;
      return;
    }

    document.getElementById("photo-count").textContent =
      photos.length === 1 ? "1 foto" : `${photos.length} fotos`;
    if (photos.length === 0) {
      photosSlot.innerHTML = `<div class="empty">No hay fotos de este día.</div>`;
      return;
    }

    const tileClass = isPortrait(device) ? "photo-tile portrait" : "photo-tile";
    photosSlot.innerHTML = `<div class="photo-grid">${photos
      .map((p, i) => {
        const takenAt = parseUtc(p.captured_at);
        return `<button class="${tileClass}" data-lazy data-index="${i}" title="${fmtTimeSeconds.format(takenAt)}">
                  <span class="time">${fmtTime.format(takenAt)}</span>
                </button>`;
      })
      .join("")}</div>`;

    photosSlot.querySelectorAll(".photo-tile").forEach((tile) =>
      tile.addEventListener("click", () => openLightbox(device, photos, Number(tile.dataset.index)))
    );
    observer = lazyLoadImages(photosSlot, async (tile) => {
      const photo = photos[Number(tile.dataset.index)];
      try {
        const url = await ImageCache.photo(device, photo.id, "thumb");
        tile.insertAdjacentHTML("afterbegin", `<img src="${url}" alt="" />`);
      } catch {
        // la miniatura que falla se queda en gris; el visor lo vuelve a intentar
      }
    });
  }

  document.getElementById("day-prev").addEventListener("click", () => ((day = shiftDay(day, -1)), load()));
  document.getElementById("day-next").addEventListener("click", () => ((day = shiftDay(day, 1)), load()));
  document.getElementById("day-today").addEventListener("click", () => ((day = localIsoDate(new Date())), load()));
  input.addEventListener("change", () => {
    if (input.value) {
      day = input.value;
      load();
    }
  });

  await load();
}
