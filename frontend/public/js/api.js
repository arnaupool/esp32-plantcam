const API_BASE = "/api";

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
  async login(username, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error("Credenciales incorrectas");
    const data = await res.json();
    Api.setToken(data.access_token);
  },
  async listDevices() {
    const res = await fetch(`${API_BASE}/devices`, {
      headers: { Authorization: `Bearer ${Api.getToken()}` },
    });
    if (res.status === 401) throw new Error("UNAUTHORIZED");
    if (!res.ok) throw new Error("No se pudo cargar los dispositivos");
    return res.json();
  },
  async getDevice(id) {
    const res = await fetch(`${API_BASE}/devices/${id}`, {
      headers: { Authorization: `Bearer ${Api.getToken()}` },
    });
    if (res.status === 401) throw new Error("UNAUTHORIZED");
    if (!res.ok) throw new Error("No se pudo cargar el dispositivo");
    return res.json();
  },
  async listPhotos(deviceId, isoDate) {
    const url = new URL(`${API_BASE}/devices/${deviceId}/photos`, location.origin);
    if (isoDate) url.searchParams.set("photo_date", isoDate);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${Api.getToken()}` },
    });
    if (res.status === 401) throw new Error("UNAUTHORIZED");
    if (!res.ok) throw new Error("No se pudo cargar las fotos");
    return res.json();
  },
  async getPhotoImageUrl(deviceId, photoId) {
    const res = await fetch(`${API_BASE}/devices/${deviceId}/photos/${photoId}/image`, {
      headers: { Authorization: `Bearer ${Api.getToken()}` },
    });
    if (!res.ok) throw new Error("No se pudo cargar la imagen");
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
  async listTimelapses(deviceId) {
    const res = await fetch(`${API_BASE}/timelapses?device_id=${deviceId}`, {
      headers: { Authorization: `Bearer ${Api.getToken()}` },
    });
    if (res.status === 401) throw new Error("UNAUTHORIZED");
    if (!res.ok) throw new Error("No se pudo cargar los timelapses");
    return res.json();
  },
  async createTimelapse(deviceId, dateFrom, dateTo, fps) {
    const res = await fetch(`${API_BASE}/timelapses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Api.getToken()}`,
      },
      body: JSON.stringify({ device_id: deviceId, date_from: dateFrom, date_to: dateTo, fps }),
    });
    if (res.status === 401) throw new Error("UNAUTHORIZED");
    if (!res.ok) throw new Error("No se pudo generar el timelapse");
    return res.json();
  },
  async getTimelapseVideoUrl(timelapseId) {
    const res = await fetch(`${API_BASE}/timelapses/${timelapseId}/video`, {
      headers: { Authorization: `Bearer ${Api.getToken()}` },
    });
    if (!res.ok) throw new Error("No se pudo cargar el vídeo");
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
  async updateDevice(id, payload) {
    const res = await fetch(`${API_BASE}/devices/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Api.getToken()}`,
      },
      body: JSON.stringify(payload),
    });
    if (res.status === 401) throw new Error("UNAUTHORIZED");
    if (!res.ok) throw new Error("No se pudo guardar los ajustes");
    return res.json();
  },
};
