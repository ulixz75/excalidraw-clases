// Panel de páginas de clase (estilo Zoom Whiteboard / OneNote).
//
// Solo páginas: una lista con nombres, un clic para saltar a la página
// en pantalla completa, y botones para crear páginas nuevas. No se
// menciona "frame" en pantalla: esa palabra solo vive en paginas.ts.
//
// Ubicación: barra inferior centrada (no tapa el canvas ni la toolbar).
// Declara `data-viewport-ui="bottom"` para que `setViewport({ ui: true })`
// descuente su altura solo. Diseño sobrio de herramienta de trabajo:
// glassmorphism ligero + hover lift discreto (<200ms), sin neón/glitch.
//
// Aditivo: no modifica ningún feature existente. Se muestra/oculta
// desde el menú hamburguesa (evento PAGINAS_EVENT) y con la ×.

import { useCallback, useEffect, useRef, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  crearPagina,
  crearPaginasClase,
  irAPagina,
  listarPaginas,
  PAGINAS_CLASE,
  renombrarPagina,
} from "./paginas";
import type { Pagina } from "./paginas";

/** Evento para abrir/cerrar el panel desde el menú hamburguesa. */
export const PAGINAS_EVENT = "excalidraw-clases:paginas";

// ---------------------------------------------------------------------------
// Estilos (sobrios: herramienta de clase, no landing)
// ---------------------------------------------------------------------------

const ANCHO_MAX_BARRA = 760;

const barraStyle: React.CSSProperties = {
  position: "fixed",
  left: "50%",
  transform: "translateX(-50%)",
  bottom: 16,
  width: `min(${ANCHO_MAX_BARRA}px, calc(100vw - 24px))`,
  maxHeight: "32vh",
  overflowY: "auto",
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  boxShadow: "0 8px 28px rgba(0,0,0,0.12)",
  zIndex: 7000,
  fontFamily: "system-ui, sans-serif",
  padding: "10px 12px 12px",
};

const pildoraStyle: React.CSSProperties = {
  position: "fixed",
  left: "50%",
  transform: "translateX(-50%)",
  bottom: 16,
  zIndex: 7000,
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  background: "rgba(255,255,255,0.95)",
  boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
  fontSize: 14,
  cursor: "pointer",
  transition: "transform 150ms ease, box-shadow 150ms ease",
};

const chipStyle = (activa: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  flex: "0 0 auto",
  textAlign: "left",
  padding: "7px 10px",
  border: activa ? "2px solid #1d4ed8" : "1px solid #e5e7eb",
  borderRadius: 999,
  background: activa ? "#eff6ff" : "#fff",
  color: "#1e1e1e",
  fontSize: 13,
  fontWeight: activa ? 700 : 400,
  cursor: "pointer",
  transition: "transform 150ms ease, box-shadow 150ms ease",
});

const btnSecundario: React.CSSProperties = {
  flex: "0 0 auto",
  padding: "7px 10px",
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontSize: 13,
  cursor: "pointer",
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export const PanelPaginas: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI;
}> = ({ excalidrawAPI }) => {
  // Visible por defecto para descubrir el feature; se puede ocultar
  // con la × o desde el menú hamburguesa → "📄 Páginas".
  const [abierto, setAbierto] = useState(true);
  const [paginas, setPaginas] = useState<Pagina[]>(() =>
    listarPaginas(excalidrawAPI),
  );
  const [activaId, setActivaId] = useState<string | null>(null);
  const [nueva, setNueva] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoNombre, setEditandoNombre] = useState("");
  const avisoTimer = useRef<number | null>(null);

  // Refresca la lista desde la escena (fuente de verdad: frames).
  // Conserva la selección si la página sigue existiendo.
  const refrescar = useCallback(() => {
    const lista = listarPaginas(excalidrawAPI);
    setPaginas(lista);
    setActivaId((actual) =>
      actual && lista.some((p) => p.id === actual) ? actual : null,
    );
  }, [excalidrawAPI]);

  // Toggle desde el menú hamburguesa.
  useEffect(() => {
    const toggle = () => setAbierto((v) => !v);
    window.addEventListener(PAGINAS_EVENT, toggle);
    return () => window.removeEventListener(PAGINAS_EVENT, toggle);
  }, []);

  // La lista se refresca sola mientras el panel existe: recoge páginas
  // creadas, renombradas o cargadas desde otra pizarra guardada.
  useEffect(() => {
    refrescar();
    const id = window.setInterval(refrescar, 800);
    return () => window.clearInterval(id);
  }, [refrescar]);

  const mostrarAviso = (texto: string) => {
    setAviso(texto);
    if (avisoTimer.current) {
      window.clearTimeout(avisoTimer.current);
    }
    avisoTimer.current = window.setTimeout(() => setAviso(null), 3000);
  };

  // --- Navegación ---

  const saltar = (pagina: Pagina) => {
    const ok = irAPagina(excalidrawAPI, pagina);
    if (ok) {
      setActivaId(pagina.id);
    } else {
      mostrarAviso("No encontré esa página en la pizarra.");
      refrescar();
    }
  };

  const saltarVecina = (paso: 1 | -1) => {
    if (paginas.length === 0) {
      return;
    }
    // Sin selección: → va a la primera, ← va a la última (como OneNote).
    if (!activaId) {
      saltar(paso === 1 ? paginas[0] : paginas[paginas.length - 1]);
      return;
    }
    const idx = paginas.findIndex((p) => p.id === activaId);
    // Si la activa se borró, cae a un extremo según la dirección.
    if (idx === -1) {
      saltar(paso === 1 ? paginas[0] : paginas[paginas.length - 1]);
      return;
    }
    const siguiente = paginas[Math.min(Math.max(idx + paso, 0), paginas.length - 1)];
    if (siguiente) {
      saltar(siguiente);
    }
  };

  // --- Creación ---

  const crearClase = () => {
    const creadas = crearPaginasClase(excalidrawAPI);
    refrescar();
    if (creadas.length === 0) {
      mostrarAviso("Ya tienes las 4 páginas de clase.");
    } else {
      setActivaId(creadas[0].id);
      mostrarAviso(`Creadas: ${creadas.map((p) => p.nombre).join(", ")}.`);
    }
  };

  const crearNueva = () => {
    const pagina = crearPagina(excalidrawAPI, nueva);
    setNueva("");
    refrescar();
    if (pagina) {
      setActivaId(pagina.id);
    } else {
      mostrarAviso("No se pudo crear la página.");
    }
  };

  // --- Renombrado ---

  const guardarNombre = () => {
    if (!editandoId) {
      return;
    }
    const ok = renombrarPagina(excalidrawAPI, editandoId, editandoNombre);
    if (!ok) {
      mostrarAviso("Nombre inválido o página borrada.");
      return;
    }
    setEditandoId(null);
    setEditandoNombre("");
    refrescar();
  };

  // --- Render colapsado (píldora inferior) ---

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        style={pildoraStyle}
        aria-label="Mostrar páginas"
        data-viewport-ui="bottom"
      >
        📄 Páginas{paginas.length > 0 ? ` (${paginas.length})` : ""}
      </button>
    );
  }

  const faltanClase = PAGINAS_CLASE.filter(
    (titulo) =>
      !paginas.some((p) => p.nombre.toLowerCase() === titulo.toLowerCase()),
  );

  return (
    <div style={barraStyle} data-viewport-ui="bottom" role="region" aria-label="Páginas de clase">
      {/* Encabezado */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <strong style={{ fontSize: 14 }}>
          📄 Páginas{" "}
          <span style={{ color: "#6b7280", fontWeight: 400 }}>
            · toca una para saltar, sin scroll
          </span>
        </strong>
        <button
          onClick={() => setAbierto(false)}
          style={{
            border: "none",
            background: "transparent",
            fontSize: 18,
            cursor: "pointer",
            color: "#6b7280",
            lineHeight: 1,
          }}
          aria-label="Ocultar páginas"
          title="Ocultar (menú → 📄 Páginas para mostrar)"
        >
          ×
        </button>
      </div>

      {/* Lista horizontal de páginas */}
      {paginas.length === 0 ? (
        <p style={{ fontSize: 13, color: "#4b5563", margin: "0 0 8px" }}>
          Todavía no hay páginas. Crea las 4 de clase o una página nueva.
        </p>
      ) : (
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 4,
            marginBottom: 8,
          }}
        >
          {paginas.map((pagina, i) => (
            <div key={pagina.id} style={{ flex: "0 0 auto" }}>
              {editandoId === pagina.id ? (
                <span style={{ display: "inline-flex", gap: 6 }}>
                  <input
                    value={editandoNombre}
                    onChange={(e) => setEditandoNombre(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        guardarNombre();
                      }
                      if (e.key === "Escape") {
                        setEditandoId(null);
                      }
                    }}
                    autoFocus
                    style={{
                      width: 140,
                      padding: "7px 8px",
                      border: "1px solid #1d4ed8",
                      borderRadius: 999,
                      fontSize: 13,
                    }}
                    aria-label="Nuevo nombre de la página"
                  />
                  <button
                    onClick={guardarNombre}
                    style={{
                      padding: "7px 10px",
                      borderRadius: 999,
                      border: "none",
                      background: "#1d4ed8",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    OK
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => saltar(pagina)}
                  style={chipStyle(activaId === pagina.id)}
                  title={`Saltar a ${pagina.nombre}`}
                >
                  <span
                    style={{
                      minWidth: 22,
                      height: 22,
                      borderRadius: 999,
                      background: "#03045e",
                      color: "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span>{pagina.nombre}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    title="Cambiar nombre"
                    aria-label={`Cambiar nombre de ${pagina.nombre}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditandoId(pagina.id);
                      setEditandoNombre(pagina.nombre);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        setEditandoId(pagina.id);
                        setEditandoNombre(pagina.nombre);
                      }
                    }}
                    style={{ color: "#6b7280", fontSize: 14, cursor: "pointer" }}
                  >
                    ✎
                  </span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Controles: navegar + crear */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <button
          onClick={() => saltarVecina(-1)}
          disabled={paginas.length === 0}
          style={btnSecundario}
        >
          ← Anterior
        </button>
        <button
          onClick={() => saltarVecina(1)}
          disabled={paginas.length === 0}
          style={btnSecundario}
        >
          Siguiente →
        </button>
        <button
          onClick={crearClase}
          style={{
            padding: "7px 12px",
            borderRadius: 999,
            border: "none",
            background: "#03045e",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Crear las 4 de clase
        </button>
        <span style={{ display: "inline-flex", gap: 6, flex: "1 1 200px" }}>
          <input
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                crearNueva();
              }
            }}
            placeholder="Nombre de la página nueva"
            style={{
              flex: 1,
              minWidth: 0,
              padding: "7px 10px",
              border: "1px solid #e5e7eb",
              borderRadius: 999,
              fontSize: 13,
            }}
            aria-label="Nombre de la página nueva"
          />
          <button
            onClick={crearNueva}
            style={{
              padding: "7px 12px",
              borderRadius: 999,
              border: "none",
              background: "#1d4ed8",
              color: "#fff",
              fontSize: 13,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            + Nueva
          </button>
        </span>
      </div>

      {faltanClase.length > 0 && paginas.length > 0 && (
        <p style={{ fontSize: 12, color: "#6b7280", margin: "8px 0 0" }}>
          Faltan: {faltanClase.join(", ")}.
        </p>
      )}
      {aviso && (
        <p style={{ fontSize: 12, color: "#1d4ed8", margin: "8px 0 0" }}>
          {aviso}
        </p>
      )}
      <p style={{ fontSize: 11, color: "#9ca3af", margin: "8px 0 0" }}>
        Las páginas se guardan con la pizarra. Para borrar una, selecciónala
        en la pizarra y bórrala como cualquier elemento.
      </p>
    </div>
  );
};
