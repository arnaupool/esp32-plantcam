const API_BASE = "/api";

async function errorMessage(res) {
  try {
    const data = await res.json();
    if (typeof data.detail === "string") return data.detail;
  } catch {
    // respuesta sin JSON
  }
  return `Error ${res.status}`;
}

const Api = {
  getToken() {
    return localStorage.getItem("plantcam_token");
  },
  setToken(token) {
    localStorage.setItem("plantcam_token", token);
  },
  clearToken() {
    localStorage.removeItem("plantcam_token");
  },

  // Petición autenticada. Un 401 significa sesión caducada: se vuelve al login.
  async request(path, { method = "GET", body, query } = {}) {
    const url = new URL(API_BASE + path, location.origin);
    for (const [key, value] of Object.entries(query || {})) {
      if (value !== undefined && value !== null) url.searchParams.set(key, value);
    }
    const headers = { Authorization: `Bearer ${Api.getToken()}` };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.status === 401) {
      Api.clearToken();
      location.hash = "#/login";
      throw new Error("La sesión ha caducado");
    }
    if (!res.ok) throw new Error(await errorMessage(res));
    return res;
  },

  async json(path, options) {
    return (await Api.request(path, options)).json();
  },

  async login(username, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error("Usuario o contraseña incorrectos");
    Api.setToken((await res.json()).access_token);
  },

  listDevices() {
    return Api.json("/devices");
  },
  getDevice(id) {
    return Api.json(`/devices/${id}`);
  },
  updateDevice(id, payload) {
    return Api.json(`/devices/${id}`, { method: "PATCH", body: payload });
  },
  listPhotos(deviceId, start, end) {
    return Api.json(`/devices/${deviceId}/photos`, {
      query: { start: start.toISOString(), end: end.toISOString() },
    });
  },
  deletePhoto(deviceId, photoId) {
    return Api.request(`/devices/${deviceId}/photos/${photoId}`, { method: "DELETE" });
  },
  deletePhotos(deviceId, ids) {
    return Api.json(`/devices/${deviceId}/photos/delete`, { method: "POST", body: { ids } });
  },
  listTimelapses(deviceId) {
    return Api.json("/timelapses", { query: { device_id: deviceId } });
  },
  deleteTimelapse(id) {
    return Api.request(`/timelapses/${id}`, { method: "DELETE" });
  },
  createTimelapse(deviceId, dateFrom, dateTo, fps) {
    return Api.json("/timelapses", {
      method: "POST",
      body: { device_id: deviceId, date_from: dateFrom, date_to: dateTo, fps },
    });
  },

  // Las imágenes y vídeos necesitan la cabecera de autenticación, así que no sirve un <img src>:
  // se descargan y se convierten en una URL local.
  async objectUrl(path, query) {
    const res = await Api.request(path, { query });
    return URL.createObjectURL(await res.blob());
  },
};

// Caché de miniaturas y fotos ya descargadas. La rotación va en la clave: si cambia, se piden de nuevo.
const ImageCache = {
  MAX: 400,
  urls: new Map(),

  photo(device, photoId, size) {
    const key = `${device.id}/${photoId}/${size}/${device.rotation}`;
    if (!this.urls.has(key)) {
      const promise = Api.objectUrl(`/devices/${device.id}/photos/${photoId}/image`, { size });
      promise.catch(() => this.urls.delete(key));
      this.urls.set(key, promise);
      this.trim();
    }
    return this.urls.get(key);
  },

  trim() {
    while (this.urls.size > this.MAX) {
      const [oldestKey, promise] = this.urls.entries().next().value;
      this.urls.delete(oldestKey);
      promise.then((url) => URL.revokeObjectURL(url)).catch(() => {});
    }
  },
};
