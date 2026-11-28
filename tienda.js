// ==========================================
// CONFIGURACIÓN Y SEGURIDAD DE SESIÓN
// ==========================================
const RAWG_API_KEY = "PEGA_AQUI_TU_API_KEY_DE_RAWG";
const RAWG_BASE_URL = "https://api.rawg.io/api";
const STORAGE_CATALOGO = "catalogo_gamestore_v1";
const STORAGE_CARRITO = "carrito_gamestore_v1";
const IMAGEN_FALLBACK = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='340'><rect width='100%' height='100%' fill='%23222'/><text x='50%' y='50%' fill='%23aaa' font-size='24' text-anchor='middle'>Sin Imagen</text></svg>";

function obtenerSesionValida() {
  try {
    const raw = sessionStorage.getItem("sesionActiva");
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !["admin", "comprador"].includes(data.rol)) return null;
    return data;
  } catch {
    return null;
  }
}

let sesion = obtenerSesionValida();
if (!sesion) {
  window.location.replace("index.html");
}

// Revalida sesión si el usuario usa el botón Atrás/Adelante del navegador (bfcache)
window.addEventListener("pageshow", () => {
  sesion = obtenerSesionValida();
  if (!sesion) {
    window.location.replace("index.html");
  }
});

function tieneRol(rolEsperado) {
  const actual = obtenerSesionValida();
  return actual && actual.rol === rolEsperado;
}

function escaparHTML(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const esAdmin = tieneRol("admin");
let catalogo = [];
let carrito = JSON.parse(sessionStorage.getItem(STORAGE_CARRITO)) || [];

// ==========================================
// INICIALIZACIÓN DE INTERFAZ Y CATÁLOGO
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  if (!sesion) return;
  configurarNavbarPorRol();
  await cargarCatalogoInicial();
  llenarSelectGeneros();
  renderizarJuegos(catalogo);
  actualizarVistaCarrito();
  registrarEventos();
});

function configurarNavbarPorRol() {
  const badge = document.getElementById("infoUsuario");
  badge.textContent = `${sesion.nombre} (${sesion.rol.toUpperCase()})`;

  if (esAdmin) {
    document.getElementById("btnAbrirImportar").classList.remove("d-none");
    document.getElementById("btnRestablecerAPI").classList.remove("d-none");
    document.getElementById("btnVerCarrito").classList.add("d-none");
  } else {
    document.getElementById("btnVerCarrito").classList.remove("d-none");
    document.getElementById("btnAbrirImportar").classList.add("d-none");
    document.getElementById("btnRestablecerAPI").classList.add("d-none");
  }
}

async function cargarCatalogoInicial() {
  const guardado = localStorage.getItem(STORAGE_CATALOGO);
  if (guardado) {
    catalogo = JSON.parse(guardado);
    return;
  }

  try {
    const res = await fetch(`${RAWG_BASE_URL}/games?key=${RAWG_API_KEY}&page_size=12`);
    const data = await res.json();

    catalogo = (data.results || []).map((juego) => formatearJuegoRAWG(juego));
    guardarCatalogo();
  } catch (error) {
    console.error("Error al conectar con RAWG:", error);
    document.getElementById("contenedorJuegos").innerHTML =
      `<div class="alert alert-danger" role="alert">No se pudo conectar con RAWG API. Verifica tu API Key.</div>`;
  }
}

function formatearJuegoRAWG(juego, precioCustom = null, stockCustom = null) {
  const precioBase = precioCustom ?? (juego.rating >= 4.2 ? 999 : 599);
  return {
    id: Number(juego.id),
    nombre: String(juego.name || "Título sin nombre"),
    imagen: juego.background_image || IMAGEN_FALLBACK,
    rating: Number(juego.rating) || 0,
    lanzamiento: String(juego.released || "N/A"),
    generos: Array.isArray(juego.genres) && juego.genres.length > 0
      ? juego.genres.map((g) => g.name)
      : ["General"],
    plataformas: Array.isArray(juego.platforms) && juego.platforms.length > 0
      ? juego.platforms.slice(0, 3).map((p) => p.platform.name).join(", ")
      : "PC",
    precio: Math.max(0, Number(precioBase) || 0),
    stock: Math.max(0, Number(stockCustom !== null ? stockCustom : 10) || 0)
  };
}

function guardarCatalogo() {
  localStorage.setItem(STORAGE_CATALOGO, JSON.stringify(catalogo));
}

// ==========================================
//  RENDERIZADO DE TARJETAS SEGÚN ROL
// ==========================================
function renderizarJuegos(lista) {
  const contenedor = document.getElementById("contenedorJuegos");
  contenedor.innerHTML = "";

  if (lista.length === 0) {
    contenedor.innerHTML = `<p class="text-center text-white-50">No se encontraron videojuegos.</p>`;
    return;
  }

  lista.forEach((juego) => {
    const col = document.createElement("div");
    col.className = "col-sm-6 col-md-4 col-lg-3";

    const nombreSeguro = escaparHTML(juego.nombre);
    const generoSeguro = escaparHTML(juego.generos[0] || "Juego");
    const plataformasSeguras = escaparHTML(juego.plataformas);
    const imagenSegura = escaparHTML(juego.imagen);

    const botonesAccion = esAdmin
      ? `
        <div class="d-flex gap-2 mt-auto">
          <button type="button" class="btn btn-outline-info btn-sm w-50" onclick="abrirModalEditar(${juego.id})">Editar</button>
          <button type="button" class="btn btn-outline-danger btn-sm w-50" onclick="eliminarJuego(${juego.id})">Eliminar</button>
        </div>`
      : `
        <button type="button" class="btn btn-warning btn-sm w-100 mt-auto fw-semibold"
          ${juego.stock <= 0 ? "disabled" : ""}
          onclick="agregarAlCarrito(${juego.id})">
          ${juego.stock > 0 ? "Agregar al carrito" : "Agotado"}
        </button>`;

    col.innerHTML = `
      <article class="card bg-secondary bg-opacity-10 border-secondary text-light h-100">
        <img src="${imagenSegura}" class="card-img-top" alt="Portada de ${nombreSeguro}" style="height: 165px; object-fit: cover;">
        <div class="card-body d-flex flex-column">
          <div class="d-flex justify-content-between align-items-start mb-1">
            <span class="badge bg-primary">${generoSeguro}</span>
            <span class="badge bg-dark border border-secondary">⭐ ${juego.rating}</span>
          </div>
          <h3 class="card-title fs-6 fw-bold mb-1">${nombreSeguro}</h3>
          <p class="small text-white-50 mb-2">${plataformasSeguras}</p>
          <div class="d-flex justify-content-between align-items-center mb-3">
            <span class="fs-5 fw-bold text-success">$${juego.precio} MXN</span>
            <span class="small text-white-50">Stock: ${juego.stock}</span>
          </div>
          ${botonesAccion}
        </div>
      </article>
    `;
    contenedor.appendChild(col);
  });
}

// ==========================================
// FILTROS Y BÚSQUEDA LOCAL
// ==========================================
function llenarSelectGeneros() {
  const select = document.getElementById("selectGenero");
  const generosUnicos = new Set();
  catalogo.forEach((j) => j.generos.forEach((g) => generosUnicos.add(g)));

  select.innerHTML = `<option value="todos">Todos los géneros</option>`;
  generosUnicos.forEach((genero) => {
    const gSeguro = escaparHTML(genero);
    select.innerHTML += `<option value="${gSeguro}">${gSeguro}</option>`;
  });
}

function filtrarCatalogo() {
  const texto = document.getElementById("inputBuscador").value.trim().toLowerCase();
  const genero = document.getElementById("selectGenero").value;

  const filtrados = catalogo.filter((juego) => {
    const coincideNombre = juego.nombre.toLowerCase().includes(texto);
    const coincideGenero = genero === "todos" || juego.generos.includes(genero);
    return coincideNombre && coincideGenero;
  });

  renderizarJuegos(filtrados);
}

// ==========================================
// FUNCIONES EXCLUSIVAS DE ADMIN (CRUD + RAWG)
// ==========================================
async function buscarEnRAWG() {
  if (!tieneRol("admin")) return;

  const query = document.getElementById("inputBuscarRAWG").value.trim();
  if (!query) return;

  const contenedor = document.getElementById("resultadosRAWG");
  contenedor.innerHTML = `<p class="text-center">Buscando en RAWG...</p>`;

  try {
    const res = await fetch(
      `${RAWG_BASE_URL}/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(query)}&page_size=12&exclude_additions=true`
    );
    const data = await res.json();
    contenedor.innerHTML = "";

    (data.results || []).forEach((juego) => {
      const yaExiste = catalogo.some((item) => item.id === juego.id);
      const nombreSeguro = escaparHTML(juego.name);
      const imgSegura = escaparHTML(juego.background_image || IMAGEN_FALLBACK);

      const col = document.createElement("div");
      col.className = "col-md-6";
      col.innerHTML = `
        <div class="card bg-secondary bg-opacity-25 border-secondary text-light p-2">
          <div class="d-flex gap-2 align-items-center">
            <img src="${imgSegura}" alt="Portada de ${nombreSeguro}" style="width: 75px; height: 55px; object-fit: cover;" class="rounded">
            <div class="flex-grow-1 overflow-hidden">
              <div class="fw-bold text-truncate">${nombreSeguro}</div>
              <small class="text-white-50">⭐ ${juego.rating || 0} | ${escaparHTML(juego.released || "N/A")}</small>
            </div>
            <button type="button" class="btn btn-sm ${yaExiste ? "btn-secondary" : "btn-success"}"
              ${yaExiste ? "disabled" : ""}
              data-import-id="${juego.id}">
              ${yaExiste ? "En tienda" : "Importar"}
            </button>
          </div>
        </div>
      `;

      if (!yaExiste) {
        col.querySelector("[data-import-id]").addEventListener("click", () => {
          importarJuegoRAWG(juego);
        });
      }

      contenedor.appendChild(col);
    });
  } catch (error) {
    contenedor.innerHTML = `<p class="text-danger">Error al buscar en RAWG.</p>`;
  }
}

function importarJuegoRAWG(juegoRAWG) {
  if (!tieneRol("admin")) {
    alert("Acceso denegado: solo el rol Administrador puede importar juegos.");
    return;
  }

  const nuevoJuego = formatearJuegoRAWG(juegoRAWG, 799, 15);
  catalogo.unshift(nuevoJuego);
  guardarCatalogo();
  llenarSelectGeneros();
  filtrarCatalogo();
  buscarEnRAWG();
}

function abrirModalEditar(id) {
  if (!tieneRol("admin")) {
    alert("Acceso denegado: solo el rol Administrador puede editar productos.");
    return;
  }

  const juego = catalogo.find((j) => j.id === id);
  if (!juego) return;

  document.getElementById("editId").value = juego.id;
  document.getElementById("tituloModalEditar").textContent = `Editar: ${juego.nombre}`;
  document.getElementById("editPrecio").value = juego.precio;
  document.getElementById("editStock").value = juego.stock;

  new bootstrap.Modal(document.getElementById("modalEditarJuego")).show();
}

function eliminarJuego(id) {
  if (!tieneRol("admin")) {
    alert("Acceso denegado: solo el rol Administrador puede eliminar productos.");
    return;
  }

  if (!confirm("¿Eliminar este videojuego del catálogo?")) return;
  catalogo = catalogo.filter((j) => j.id !== id);
  guardarCatalogo();
  llenarSelectGeneros();
  filtrarCatalogo();
}

// ==========================================
// FUNCIONES EXCLUSIVAS DE COMPRADOR (CARRITO)
// ==========================================
function agregarAlCarrito(id) {
  if (!tieneRol("comprador")) {
    alert("Esta acción corresponde al rol Comprador.");
    return;
  }

  const juego = catalogo.find((j) => j.id === id);
  if (!juego || juego.stock <= 0) return;

  const itemEnCarrito = carrito.find((item) => item.id === id);
  if (itemEnCarrito) {
    if (itemEnCarrito.cantidad >= juego.stock) {
      alert("No hay más stock disponible de este título.");
      return;
    }
    itemEnCarrito.cantidad++;
  } else {
    carrito.push({
      id: juego.id,
      nombre: juego.nombre,
      precio: juego.precio,
      cantidad: 1
    });
  }

  guardarCarrito();
  actualizarVistaCarrito();
}

function actualizarVistaCarrito() {
  const totalItems = carrito.reduce((acc, item) => acc + item.cantidad, 0);
  const totalDinero = carrito.reduce((acc, item) => acc + item.precio * item.cantidad, 0);

  document.getElementById("contadorCarrito").textContent = totalItems;
  document.getElementById("totalCarrito").textContent = totalDinero;

  const lista = document.getElementById("listaCarrito");
  if (carrito.length === 0) {
    lista.innerHTML = `<p class="text-white-50 text-center my-3">Tu carrito está vacío.</p>`;
    return;
  }

  lista.innerHTML = carrito.map((item) => `
    <div class="d-flex justify-content-between align-items-center border-bottom border-secondary py-2">
      <div>
        <div class="fw-bold">${escaparHTML(item.nombre)}</div>
        <small class="text-white-50">$${item.precio} MXN x ${item.cantidad}</small>
      </div>
      <div class="d-flex align-items-center gap-2">
        <span class="fw-bold text-success">$${item.precio * item.cantidad}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" aria-label="Quitar ${escaparHTML(item.nombre)} del carrito" onclick="quitarDelCarrito(${item.id})">✕</button>
      </div>
    </div>
  `).join("");
}

function quitarDelCarrito(id) {
  if (!tieneRol("comprador")) return;
  carrito = carrito.filter((item) => item.id !== id);
  guardarCarrito();
  actualizarVistaCarrito();
}

function confirmarCompra() {
  if (!tieneRol("comprador")) return;
  if (carrito.length === 0) return;

  carrito.forEach((item) => {
    const juego = catalogo.find((j) => j.id === item.id);
    if (juego) {
      juego.stock = Math.max(0, juego.stock - item.cantidad);
    }
  });

  guardarCatalogo();
  carrito = [];
  guardarCarrito();
  actualizarVistaCarrito();
  filtrarCatalogo();

  bootstrap.Modal.getInstance(document.getElementById("modalCarrito")).hide();
  alert(" ¡Compra realizada con éxito! El inventario se ha actualizado.");
}

function guardarCarrito() {
  sessionStorage.setItem(STORAGE_CARRITO, JSON.stringify(carrito));
}

// ==========================================
// EVENTOS GENERALES
// ==========================================
function registrarEventos() {
  document.getElementById("inputBuscador").addEventListener("input", filtrarCatalogo);
  document.getElementById("selectGenero").addEventListener("change", filtrarCatalogo);

  document.getElementById("btnCerrarSesion").addEventListener("click", () => {
    sessionStorage.removeItem("sesionActiva");
    sessionStorage.removeItem(STORAGE_CARRITO);
    window.location.replace("index.html");
  });

  // Eventos Admin
  document.getElementById("btnBuscarRAWG").addEventListener("click", buscarEnRAWG);
  document.getElementById("inputBuscarRAWG").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      buscarEnRAWG();
    }
  });

  document.getElementById("formEditarJuego").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!tieneRol("admin")) return;

    const id = Number(document.getElementById("editId").value);
    const precio = Math.max(0, Number(document.getElementById("editPrecio").value) || 0);
    const stock = Math.max(0, Number(document.getElementById("editStock").value) || 0);

    const juego = catalogo.find((j) => j.id === id);
    if (juego) {
      juego.precio = precio;
      juego.stock = stock;
      guardarCatalogo();
      filtrarCatalogo();
    }
    bootstrap.Modal.getInstance(document.getElementById("modalEditarJuego")).hide();
  });

  document.getElementById("btnRestablecerAPI").addEventListener("click", async () => {
    if (!tieneRol("admin")) return;
    localStorage.removeItem(STORAGE_CATALOGO);
    await cargarCatalogoInicial();
    llenarSelectGeneros();
    filtrarCatalogo();
  });

  // eveentos del Comprador
  document.getElementById("btnVaciarCarrito").addEventListener("click", () => {
    if (!tieneRol("comprador")) return;
    carrito = [];
    guardarCarrito();
    actualizarVistaCarrito();
  });
  document.getElementById("btnConfirmarCompra").addEventListener("click", confirmarCompra);
}