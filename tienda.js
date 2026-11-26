// ==========================================
// 1. CONFIGURACIÓN Y VALIDACIÓN DE SESIÓN
// ==========================================
const RAWG_API_KEY = "ef6bf8af61e24c71836fb551facaee69";
const RAWG_BASE_URL = "https://api.rawg.io/api";
const STORAGE_CATALOGO = "catalogo_gamestore_v1";
const STORAGE_CARRITO = "carrito_gamestore_v1";

const sesion = JSON.parse(sessionStorage.getItem("sesionActiva"));
if (!sesion) {
  window.location.href = "index.html";
}

const esAdmin = sesion.rol === "admin";
let catalogo = [];
let carrito = JSON.parse(sessionStorage.getItem(STORAGE_CARRITO)) || [];

// ==========================================
// 2. INICIALIZACIÓN DE INTERFAZ Y CATÁLOGO
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  configurarNavbarPorRol();
  await cargarCatalogoInicial();
  llenarSelectGeneros();
  renderizarJuegos(catalogo);
  actualizarVistaCarrito();
  registrarEventos();
});

function configurarNavbarPorRol() {
  document.getElementById("infoUsuario").textContent =
    `${sesion.nombre} (${sesion.rol.toUpperCase()})`;

  if (esAdmin) {
    document.getElementById("btnAbrirImportar").classList.remove("d-none");
    document.getElementById("btnRestablecerAPI").classList.remove("d-none");
  } else {
    document.getElementById("btnVerCarrito").classList.remove("d-none");
  }
}

async function cargarCatalogoInicial() {
  const guardado = localStorage.getItem(STORAGE_CATALOGO);
  if (guardado) {
    catalogo = JSON.parse(guardado);
    return;
  }

  // Si es la primera vez, traemos 12 juegos populares desde RAWG
  try {
    const res = await fetch(`${RAWG_BASE_URL}/games?key=${RAWG_API_KEY}&page_size=12`);
    const data = await res.json();

    catalogo = data.results.map((juego) => formatearJuegoRAWG(juego));
    guardarCatalogo();
  } catch (error) {
    console.error("Error al conectar con RAWG:", error);
    document.getElementById("contenedorJuegos").innerHTML =
      `<div class="alert alert-danger">No se pudo conectar con RAWG API. Verifica tu API Key.</div>`;
  }
}

function formatearJuegoRAWG(juego, precioCustom = null, stockCustom = null) {
  // Generamos un precio base realista según calificación si no se especifica
  const precioBase = precioCustom ?? (juego.rating >= 4.2 ? 999 : 599);
  return {
    id: juego.id,
    nombre: juego.name,
    imagen: juego.background_image || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='340'><rect width='100%' height='100%' fill='%23222'/><text x='50%' y='50%' fill='%23aaa' font-size='24' text-anchor='middle'>Sin Imagen</text></svg>",
    rating: juego.rating || 0,
    lanzamiento: juego.released || "N/A",
    generos: juego.genres ? juego.genres.map((g) => g.name) : ["General"],
    plataformas: juego.platforms
      ? juego.platforms.slice(0, 3).map((p) => p.platform.name).join(", ")
      : "PC",
    precio: Number(precioBase),
    stock: stockCustom !== null ? Number(stockCustom) : 10
  };
}

function guardarCatalogo() {
  localStorage.setItem(STORAGE_CATALOGO, JSON.stringify(catalogo));
}

// ==========================================
// 3. RENDERIZADO DE TARJETAS SEGÚN ROL
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

    const botonesAccion = esAdmin
      ? `
        <div class="d-flex gap-2 mt-auto">
          <button class="btn btn-outline-info btn-sm w-50" onclick="abrirModalEditar(${juego.id})">Editar</button>
          <button class="btn btn-outline-danger btn-sm w-50" onclick="eliminarJuego(${juego.id})">Eliminar</button>
        </div>`
      : `
        <button class="btn btn-warning btn-sm w-100 mt-auto fw-semibold"
          ${juego.stock <= 0 ? "disabled" : ""}
          onclick="agregarAlCarrito(${juego.id})">
          ${juego.stock > 0 ? "Agregar al carrito" : "Agotado"}
        </button>`;

    col.innerHTML = `
      <div class="card bg-secondary bg-opacity-10 border-secondary text-light h-100">
        <img src="${juego.imagen}" class="card-img-top" alt="${juego.nombre}" style="height: 165px; object-fit: cover;">
        <div class="card-body d-flex flex-column">
          <div class="d-flex justify-content-between align-items-start mb-1">
            <span class="badge bg-primary">${juego.generos[0] || "Juego"}</span>
            <span class="badge bg-dark border border-secondary">⭐ ${juego.rating}</span>
          </div>
          <h6 class="card-title fw-bold mb-1">${juego.nombre}</h6>
          <p class="small text-white-50 mb-2">${juego.plataformas}</p>
          <div class="d-flex justify-content-between align-items-center mb-3">
            <span class="fs-5 fw-bold text-success">$${juego.precio} MXN</span>
            <span class="small text-white-50">Stock: ${juego.stock}</span>
          </div>
          ${botonesAccion}
        </div>
      </div>
    `;
    contenedor.appendChild(col);
  });
}

// ==========================================
// 4. FILTROS Y BÚSQUEDA LOCAL
// ==========================================
function llenarSelectGeneros() {
  const select = document.getElementById("selectGenero");
  const generosUnicos = new Set();
  catalogo.forEach((j) => j.generos.forEach((g) => generosUnicos.add(g)));

  select.innerHTML = `<option value="todos">Todos los géneros</option>`;
  generosUnicos.forEach((genero) => {
    select.innerHTML += `<option value="${genero}">${genero}</option>`;
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
// 5. FUNCIONES EXCLUSIVAS DE ADMIN (CRUD + RAWG)
// ==========================================
async function buscarEnRAWG() {
  const query = document.getElementById("inputBuscarRAWG").value.trim();
  if (!query) return;

  const contenedor = document.getElementById("resultadosRAWG");
  contenedor.innerHTML = `<p class="text-center">Buscando en RAWG...</p>`;

  try {
    const res = await fetch(
      `${RAWG_BASE_URL}/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(query)}&page_size=6`
    );
    const data = await res.json();
    contenedor.innerHTML = "";

    data.results.forEach((juego) => {
      const yaExiste = catalogo.some((item) => item.id === juego.id);
      const col = document.createElement("div");
      col.className = "col-md-6";
      col.innerHTML = `
        <div class="card bg-secondary bg-opacity-25 border-secondary text-light p-2">
          <div class="d-flex gap-2 align-items-center">
            <img src="${juego.background_image || ""}" style="width: 75px; height: 55px; object-fit: cover;" class="rounded">
            <div class="flex-grow-1 overflow-hidden">
              <div class="fw-bold text-truncate">${juego.name}</div>
              <small class="text-white-50">⭐ ${juego.rating} | ${juego.released || "N/A"}</small>
            </div>
            <button class="btn btn-sm ${yaExiste ? "btn-secondary" : "btn-success"}"
              ${yaExiste ? "disabled" : ""}
              onclick='importarJuegoRAWG(${JSON.stringify(juego).replace(/'/g, "&apos;")})'>
              ${yaExiste ? "En tienda" : "Importar"}
            </button>
          </div>
        </div>
      `;
      contenedor.appendChild(col);
    });
  } catch (error) {
    contenedor.innerHTML = `<p class="text-danger">Error al buscar en RAWG.</p>`;
  }
}

function importarJuegoRAWG(juegoRAWG) {
  const nuevoJuego = formatearJuegoRAWG(juegoRAWG, 799, 15);
  catalogo.unshift(nuevoJuego);
  guardarCatalogo();
  llenarSelectGeneros();
  filtrarCatalogo();
  buscarEnRAWG(); // Actualiza estado del botón a "En tienda"
}

function abrirModalEditar(id) {
  const juego = catalogo.find((j) => j.id === id);
  if (!juego) return;

  document.getElementById("editId").value = juego.id;
  document.getElementById("tituloModalEditar").textContent = `Editar: ${juego.nombre}`;
  document.getElementById("editPrecio").value = juego.precio;
  document.getElementById("editStock").value = juego.stock;

  new bootstrap.Modal(document.getElementById("modalEditarJuego")).show();
}

function eliminarJuego(id) {
  if (!confirm("¿Eliminar este videojuego del catálogo?")) return;
  catalogo = catalogo.filter((j) => j.id !== id);
  guardarCatalogo();
  llenarSelectGeneros();
  filtrarCatalogo();
}

// ==========================================
// 6. FUNCIONES EXCLUSIVAS DE COMPRADOR (CARRITO)
// ==========================================
function agregarAlCarrito(id) {
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
        <div class="fw-bold">${item.nombre}</div>
        <small class="text-white-50">$${item.precio} MXN x ${item.cantidad}</small>
      </div>
      <div class="d-flex align-items-center gap-2">
        <span class="fw-bold text-success">$${item.precio * item.cantidad}</span>
        <button class="btn btn-sm btn-outline-danger" onclick="quitarDelCarrito(${item.id})">✕</button>
      </div>
    </div>
  `).join("");
}

function quitarDelCarrito(id) {
  carrito = carrito.filter((item) => item.id !== id);
  guardarCarrito();
  actualizarVistaCarrito();
}

function confirmarCompra() {
  if (carrito.length === 0) return;

  // Descontamos el stock real en el catálogo compartido
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
  alert("✅ ¡Compra realizada con éxito! El inventario se ha actualizado.");
}

function guardarCarrito() {
  sessionStorage.setItem(STORAGE_CARRITO, JSON.stringify(carrito));
}

// ==========================================
// 7. EVENTOS GENERALES
// ==========================================
function registrarEventos() {
  document.getElementById("inputBuscador").addEventListener("input", filtrarCatalogo);
  document.getElementById("selectGenero").addEventListener("change", filtrarCatalogo);

  document.getElementById("btnCerrarSesion").addEventListener("click", () => {
    sessionStorage.removeItem("sesionActiva");
    window.location.href = "index.html";
  });

  // Eventos Admin
  document.getElementById("btnBuscarRAWG").addEventListener("click", buscarEnRAWG);
  document.getElementById("formEditarJuego").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = Number(document.getElementById("editId").value);
    const juego = catalogo.find((j) => j.id === id);
    if (juego) {
      juego.precio = Number(document.getElementById("editPrecio").value);
      juego.stock = Number(document.getElementById("editStock").value);
      guardarCatalogo();
      filtrarCatalogo();
    }
    bootstrap.Modal.getInstance(document.getElementById("modalEditarJuego")).hide();
  });

  document.getElementById("btnRestablecerAPI").addEventListener("click", async () => {
    localStorage.removeItem(STORAGE_CATALOGO);
    await cargarCatalogoInicial();
    llenarSelectGeneros();
    filtrarCatalogo();
  });

  // Eventos Comprador
  document.getElementById("btnVaciarCarrito").addEventListener("click", () => {
    carrito = [];
    guardarCarrito();
    actualizarVistaCarrito();
  });
  document.getElementById("btnConfirmarCompra").addEventListener("click", confirmarCompra);
}