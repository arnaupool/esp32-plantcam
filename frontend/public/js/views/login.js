function renderLogin(root) {
  root.innerHTML = `
    <div class="login-wrap">
      <div class="card login-card">
        <div class="brand">${ICONS.leaf}<span>PlantCam</span></div>
        <p class="sub">Timelapses de tus plantas</p>
        <form id="login-form">
          <label class="field"><span>Usuario</span>
            <input name="username" autocomplete="username" required autofocus />
          </label>
          <label class="field"><span>Contraseña</span>
            <input type="password" name="password" autocomplete="current-password" required />
          </label>
          <button class="btn" type="submit">Entrar</button>
          <div class="error" id="login-error" role="alert"></div>
        </form>
      </div>
    </div>
  `;

  const form = document.getElementById("login-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = form.querySelector("button");
    const errorEl = document.getElementById("login-error");
    errorEl.textContent = "";
    button.disabled = true;
    try {
      await Api.login(form.username.value.trim(), form.password.value);
      location.hash = "#/dashboard";
    } catch (err) {
      errorEl.textContent = err.message;
      button.disabled = false;
    }
  });
}
