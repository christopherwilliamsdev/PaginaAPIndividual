const USUARIOS_DEMO = [
  { correo: "admin@gamestore.com", password: "1234", nombre: "Administrador", rol: "admin" },
  { correo: "cliente@gamestore.com", password: "1234", nombre: "Jugador Invitado", rol: "comprador" }
];

document.getElementById("formLogin").addEventListener("submit", (e) => {
  e.preventDefault();

  const correo = document.getElementById("correo").value.trim().toLowerCase();
  const password = document.getElementById("password").value.trim();
  const errorBox = document.getElementById("errorLogin");

  const usuarioValido = USUARIOS_DEMO.find(
    (u) => u.correo === correo && u.password === password
  );

  if (!usuarioValido) {
    errorBox.classList.remove("d-none");
    return;
  }

  // Guardamos la sesión activa
  sessionStorage.setItem("sesionActiva", JSON.stringify({
    nombre: usuarioValido.nombre,
    correo: usuarioValido.correo,
    rol: usuarioValido.rol
  }));

  window.location.href = "tienda.html";
});