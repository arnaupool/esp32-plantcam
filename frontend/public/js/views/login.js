function renderLogin(root) {
  root.innerHTML = `
    <div class="card" style="max-width:320px;margin:4rem auto;">
      <h1>PlantCam</h1>
      <form id="login-form">
        <input type="text" name="username" placeholder="Usuario" autocomplete="username" required />
        <input type="password" name="password" placeholder="Contraseña" autocomplete="current-password" required />
        <button type="submit">Entrar</button>
        <div class="error" id="login-error"></div>
      </form>
    </div>
  `;

  const form = document.getElementById("login-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = form.username.value.trim();
    const password = form.password.value;
    const errorEl = document.getElementById("login-error");
    errorEl.textContent = "";

    try {
      await Api.login(username, password);
      location.hash = "#/dashboard";
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}
