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
      <button class="btn btn-ghost btn-small" id="select-toggle">Seleccionar</button>
    </div>
    <div class="toolbar select-bar" id="select-bar" hidden>
      <span id="select-count"></span>
      <button class="btn btn-ghost btn-small" id="select-all">Todas</button>
      <button class="btn btn-ghost btn-small" id="select-none">Ninguna</button>
      <button class="btn btn-ghost btn-small" id="select-delete">${ICONS.trash} Borrar</button>
    </div>
    <div class="day-label" id="day-label"></div>
    <div id="photos-slot"></div>
  `;

  const input = document.getElementById("day-input");
  const photosSlot = document.getElementById("photos-slot");
  const selectBar = document.getElementById("select-bar");
  const selectToggle = document.getElementById("select-toggle");
  const deleteButton = document.getElementById("select-delete");
  let observer;
  let photos = [];
  let selecting = false;
  const selected = new Set();

  function updateSelection() {
    photosSlot.querySelectorAll(".photo-tile").forEach((tile) => {
      tile.classList.toggle("selected", selected.has(photos[Number(tile.dataset.index)].id));
    });
    document.getElementById("select-count").textContent =
      selected.size === 1 ? "1 seleccionada" : `${selected.size} seleccionadas`;
    deleteButton.disabled = selected.size === 0;
  }

  function setSelecting(on) {
    selecting = on;
    selected.clear();
    selectBar.hidden = !on;
    selectToggle.textContent = on ? "Cancelar" : "Seleccionar";
    photosSlot.classList.toggle("selecting", on);
    disarmDelete();
    updateSelection();
  }

  const disarmDelete = confirmButton(deleteButton, "¿Borrar? Pulsa otra vez", async () => {
    const { deleted } = await Api.deletePhotos(device.id, [...selected]);
    toast(deleted === 1 ? "1 foto borrada" : `${deleted} fotos borradas`);
    setSelecting(false);
    await load();
  });

  async function load() {
    input.value = day;
    const [start, end] = dayRange(day);
    document.getElementById("day-label").textContent = capitalize(fmtLongDate.format(start));
    document.getElementById("day-next").disabled = day >= localIsoDate(new Date());
    document.getElementById("photo-count").textContent = "";
    photosSlot.innerHTML = `<p class="muted">Cargando...</p>`;
    observer?.disconnect();
    selected.clear();
    updateSelection();

    try {
      // Del servidor llegan de la más reciente a la más antigua; aquí se muestran en orden del día.
      photos = (await Api.listPhotos(device.id, start, end)).reverse();
    } catch (err) {
      photos = [];
      photosSlot.innerHTML = `<p class="error">${esc(err.message)}</p>`;
      return;
    }

    document.getElementById("photo-count").textContent =
      photos.length === 1 ? "1 foto" : `${photos.length} fotos`;
    selectToggle.disabled = photos.length === 0 && !selecting;
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
                  <span class="check">${ICONS.check}</span>
                </button>`;
      })
      .join("")}</div>`;

    photosSlot.querySelectorAll(".photo-tile").forEach((tile) =>
      tile.addEventListener("click", () => {
        const index = Number(tile.dataset.index);
        if (!selecting) {
          openLightbox(device, photos, index, { onDeleted: load });
          return;
        }
        const id = photos[index].id;
        selected.has(id) ? selected.delete(id) : selected.add(id);
        updateSelection();
      })
    );
    updateSelection();
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

  const goTo = (newDay) => {
    day = newDay;
    load();
  };
  document.getElementById("day-prev").addEventListener("click", () => goTo(shiftDay(day, -1)));
  document.getElementById("day-next").addEventListener("click", () => goTo(shiftDay(day, 1)));
  document.getElementById("day-today").addEventListener("click", () => goTo(localIsoDate(new Date())));
  input.addEventListener("change", () => input.value && goTo(input.value));

  selectToggle.addEventListener("click", () => setSelecting(!selecting));
  document.getElementById("select-all").addEventListener("click", () => {
    photos.forEach((p) => selected.add(p.id));
    updateSelection();
  });
  document.getElementById("select-none").addEventListener("click", () => {
    selected.clear();
    updateSelection();
  });

  await load();
}
