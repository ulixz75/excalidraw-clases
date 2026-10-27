// Páginas de clase (estilo Zoom Whiteboard / OneNote).
//
// Idea para el docente: NO hay que aprender frames, tamaños ni atajos.
// La pantalla muestra páginas con nombre ("Teoría", "Ejemplos"...),
// y tocar una página salta a ella en pantalla completa, sin scroll.
//
// Por dentro, cada página es un frame de Excalidraw: así la página se
// guarda con la pizarra, se exporta y se sincroniza en colaboración
// con el resto de la escena, sin inventar un almacenamiento nuevo.
// Este archivo es el único sitio donde se habla de frames; el panel
// solo habla de páginas.
//
// Este módulo es aditivo: no modifica ningún feature existente
// (Panel de clase, historial, IA, ficha, importar PDF).

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElementSkeleton } from "@excalidraw/element/transform";

import { insertarSkeletons } from "./insertar";

export interface Pagina {
  id: string;
  nombre: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Las 4 páginas de clase que se ofrecen al crear una clase nueva. */
export const PAGINAS_CLASE = [
  "Teoría",
  "Ejemplos",
  "Ejercicios",
  "Soluciones",
] as const;

// Tamaño fijo de página (16:9 aprox. 1600x900) y separación horizontal.
// Fijo a propósito: el docente no configura medidas, solo nombres.
const ANCHO_PAGINA = 1600;
const ALTO_PAGINA = 900;
const SEPARACION = 200;

// Reserva inferior para la barra de páginas (barra ~64px + margen).
// Se combina con `ui: true` para que Excalidraw descuente además
// su propia toolbar. Así la página nunca queda debajo del panel.
const OFFSET_BARRA_INFERIOR = 88;

/** Respeta `prefers-reduced-motion` en la animación de salto. */
function animarSalto(): boolean {
  try {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
}

/** Elementos frame de la escena, ordenados de izquierda a derecha. */
export function listarPaginas(api: ExcalidrawImperativeAPI): Pagina[] {
  const paginas: Pagina[] = [];
  for (const el of api.getSceneElements()) {
    if (el.type !== "frame" || el.isDeleted) {
      continue;
    }
    const nombre = (el as { name?: string | null }).name;
    paginas.push({
      id: el.id,
      nombre: nombre?.trim() ? nombre.trim() : "Página sin nombre",
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
    });
  }
  // Orden de lectura: primero de izquierda a derecha, luego de arriba abajo.
  paginas.sort((a, b) => a.x - b.x || a.y - b.y);
  return paginas;
}

function siguientePosicion(api: ExcalidrawImperativeAPI): {
  x: number;
  y: number;
} {
  const paginas = listarPaginas(api);
  if (paginas.length > 0) {
    const ultima = paginas[paginas.length - 1];
    return { x: ultima.x + ultima.width + SEPARACION, y: ultima.y };
  }
  // Sin páginas todavía: a la derecha de lo que ya haya en la pizarra,
  // o en el origen si la pizarra está vacía.
  let derecha = 0;
  let hayContenido = false;
  for (const el of api.getSceneElements()) {
    if (el.isDeleted) {
      continue;
    }
    hayContenido = true;
    derecha = Math.max(derecha, el.x + el.width);
  }
  return hayContenido ? { x: derecha + SEPARACION, y: 0 } : { x: 0, y: 0 };
}

/**
 * Crea una página nueva con ese nombre y (por defecto) salta a ella.
 * Si el nombre viene vacío, se usa "Página N".
 *
 * @param saltar Si es `false`, crea sin mover el viewport.
 *   Sirve para crear varias en lote con una sola navegación final
 *   (evita 4 animaciones encadenadas que se cancelan entre sí).
 */
export function crearPagina(
  api: ExcalidrawImperativeAPI,
  nombre: string,
  opts?: { saltar?: boolean },
): Pagina | null {
  const existentes = listarPaginas(api);
  const limpio = nombre.trim();
  const titulo = limpio || `Página ${existentes.length + 1}`;
  const { x, y } = siguientePosicion(api);
  const nuevos = insertarSkeletons(
    api,
    [
      {
        type: "frame",
        name: titulo,
        x: 0,
        y: 0,
        width: ANCHO_PAGINA,
        height: ALTO_PAGINA,
      } as unknown as ExcalidrawElementSkeleton,
    ],
    x,
    y,
  );
  const creado = nuevos[0];
  if (!creado) {
    return null;
  }
  // El frame recién creado queda seleccionado por `insertarSkeletons`.
  // Se deselecciona para que el docente dibuje sin mover la página
  // sin querer al primer trazo.
  try {
    api.updateScene({ appState: { selectedElementIds: {} } });
  } catch {
    // best-effort: si falla, la página igual quedó creada
  }
  const pagina: Pagina = {
    id: creado.id,
    nombre: titulo,
    x,
    y,
    width: ANCHO_PAGINA,
    height: ALTO_PAGINA,
  };
  if (opts?.saltar !== false) {
    irAPagina(api, pagina);
  }
  return pagina;
}

/**
 * Crea las 4 páginas de clase que falten (Teoría, Ejemplos, Ejercicios,
 * Soluciones). Las que ya existen, por nombre, no se duplican.
 * Navega una sola vez al final (a la primera creada).
 * Devuelve las páginas creadas en esta llamada.
 */
export function crearPaginasClase(
  api: ExcalidrawImperativeAPI,
): Pagina[] {
  const nombres = new Set(
    listarPaginas(api).map((p) => p.nombre.toLowerCase()),
  );
  const creadas: Pagina[] = [];
  for (const titulo of PAGINAS_CLASE) {
    if (nombres.has(titulo.toLowerCase())) {
      continue;
    }
    // Sin salto individual: una sola navegación al final.
    const pagina = crearPagina(api, titulo, { saltar: false });
    if (pagina) {
      creadas.push(pagina);
      nombres.add(titulo.toLowerCase());
    }
  }
  if (creadas.length > 0) {
    irAPagina(api, creadas[0]);
  }
  return creadas;
}

/**
 * Salta a una página en pantalla completa, sin scroll manual.
 * Devuelve `true` si encontró el frame y lanzó la navegación.
 *
 * Usa `offsets: { ui: true, bottom }` para que la página no quede
 * debajo de la barra inferior ni de la toolbar de Excalidraw.
 * El panel declara `data-viewport-ui="bottom"` y Excalidraw lo mide solo.
 */
export function irAPagina(
  api: ExcalidrawImperativeAPI,
  pagina: Pagina,
): boolean {
  const elemento = api
    .getSceneElements()
    .find((el) => el.id === pagina.id && !el.isDeleted);
  if (!elemento) {
    return false;
  }
  try {
    api.setViewport({
      target: elemento,
      fit: "contain",
      animation: animarSalto(),
      offsets: { ui: true, bottom: OFFSET_BARRA_INFERIOR },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Cambia el nombre de una página. Devuelve `true` si la renombró.
 * Ignora nombres vacíos e ids inexistentes.
 */
export function renombrarPagina(
  api: ExcalidrawImperativeAPI,
  id: string,
  nombre: string,
): boolean {
  const limpio = nombre.trim();
  if (!limpio) {
    return false;
  }
  const elementos = api.getSceneElements();
  const existe = elementos.some((el) => el.id === id && el.type === "frame");
  if (!existe) {
    return false;
  }
  api.updateScene({
    elements: elementos.map((el) =>
      el.id === id && el.type === "frame" ? { ...el, name: limpio } : el,
    ),
  });
  return true;
}
