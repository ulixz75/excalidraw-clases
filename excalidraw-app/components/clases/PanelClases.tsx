import { useCallback, useEffect, useRef, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { REGLAS } from "./datosReglas";
import { FIGURAS } from "./datosFiguras";
import {
  insertarSkeletons,
  insertarTexto,
  origenViewport,
  pantallaAScena,
} from "./insertar";
import {
  asegurarPersistencia,
  borrarPizarra,
  borrarUltimaSesion,
  cargarPizarra,
  descargarPizarra,
  descargarRespaldoTodo,
  diagnosticoAlmacenamiento,
  errorAmigable,
  exportarTodo,
  guardarPizarra,
  guardarUltimaSesion,
  importarEscenaDesdeObjeto,
  importarRespaldoTodo,
  listarPizarras,
  obtenerRegistro,
  obtenerUltimaSesion,
} from "./historial";

import type { EstadoAlmacenamiento, PizarraGuardada } from "./historial";

/** Evento para abrir/cerrar el panel desde el menú principal. */
export const PANEL_EVENT = "excalidraw-clases:panel";
const DROP_MIME = "application/x-clase-item";

type Tab = "reglas" | "figuras" | "tools" | "historial";

interface ItemArrastrable {
  kind: "regla" | "figura";
  titulo: string;
  texto?: string;
  color?: string;
  figuraId?: string;
}

type PresetState = Pick<
  AppState,
  | "activeTool"
  | "currentItemStrokeColor"
  | "currentItemStrokeWidthKey"
  | "currentItemOpacity"
  | "currentItemFontSize"
>;

const NEUTRO = {
  currentItemStrokeColor: "#1e1e1e",
  currentItemStrokeWidthKey: "medium",
  currentItemOpacity: 100,
  currentItemFontSize: 20,
} as const;

const PRESETS: Array<{
  id: string;
  nombre: string;
  hint: string;
  appState: PresetState;
}> = [
  {
    id: "resaltador",
    nombre: "Resaltador",
    hint: "Lápiz grueso amarillo",
    appState: {
      ...NEUTRO,
      activeTool: {
        type: "freedraw",
        customType: null,
        locked: false,
        fromSelection: false,
        lastActiveTool: null,
      },
      currentItemStrokeColor: "#eab308",
      currentItemStrokeWidthKey: "bold",
      currentItemOpacity: 60,
    },
  },
  {
    id: "texto-grande",
    nombre: "Texto grande",
    hint: "Títulos legibles",
    appState: {
      ...NEUTRO,
      activeTool: {
        type: "text",
        customType: null,
        locked: false,
        fromSelection: false,
        lastActiveTool: null,
      },
      currentItemFontSize: 36,
    },
  },
  {
    id: "lapiz-fino",
    nombre: "Lápiz fino",
    hint: "Trazo preciso negro",
    appState: {
      ...NEUTRO,
      activeTool: {
        type: "freedraw",
        customType: null,
        locked: false,
        fromSelection: false,
        lastActiveTool: null,
      },
      currentItemStrokeWidthKey: "thin",
    },
  },
  {
    id: "goma",
    nombre: "Goma",
    hint: "Borrar",
    appState: {
      ...NEUTRO,
      activeTool: {
        type: "eraser",
        customType: null,
        locked: false,
        fromSelection: false,
        lastActiveTool: null,
      },
    },
  },
];

const panelStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  width: 320,
  height: "100vh",
  background: "#fff",
  borderLeft: "1px solid #e5e7eb",
  boxShadow: "-4px 0 16px rgba(0,0,0,0.08)",
  zIndex: 9000,
  display: "flex",
  flexDirection: "column",
  fontFamily: "system-ui, sans-serif",
};

const tabStyle = (activa: boolean): React.CSSProperties => ({
  flex: 1,
  padding: "8px 4px",
  fontSize: 12,
  fontWeight: activa ? 700 : 400,
  background: activa ? "#eff6ff" : "transparent",
  color: activa ? "#1d4ed8" : "#4b5563",
  border: "none",
  borderBottom: activa ? "2px solid #1d4ed8" : "2px solid transparent",
  cursor: "pointer",
});

export const PanelClases: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI;
}> = ({ excalidrawAPI }) => {
  const [abierto, setAbierto] = useState(false);
  const [tab, setTab] = useState<Tab>("reglas");
  const [gradoIdx, setGradoIdx] = useState(2);
  const [alumno, setAlumno] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [pizarras, setPizarras] = useState<PizarraGuardada[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null);
  const [almacen, setAlmacen] = useState<EstadoAlmacenamiento | null>(null);
  const [ultimaSesion, setUltimaSesion] = useState<{
    alumno: string;
    fechaISO: string;
    numElementos: number;
  } | null>(null);
  const importarTodoRef = useRef<HTMLInputElement>(null);
  const importarEscenaRef = useRef<HTMLInputElement>(null);
  const alumnoRef = useRef("");
  alumnoRef.current = alumno;
  const cascadaRef = useRef(0);

  useEffect(() => {
    const toggle = () => setAbierto((v) => !v);
    window.addEventListener(PANEL_EVENT, toggle);
    return () => window.removeEventListener(PANEL_EVENT, toggle);
  }, []);

  const refrescarHistorial = useCallback(async () => {
    try {
      setErrorHistorial(null);
      setPizarras(await listarPizarras());
    } catch (e) {
      setErrorHistorial(errorAmigable(e));
    }
  }, []);

  const refrescarDiagnostico = useCallback(async () => {
    try {
      setAlmacen(await diagnosticoAlmacenamiento());
    } catch {
      // best-effort
    }
    try {
      const ultima = await obtenerUltimaSesion();
      setUltimaSesion(ultima ? ultima.meta : null);
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    if (abierto && tab === "historial") {
      refrescarHistorial();
      refrescarDiagnostico();
    }
  }, [abierto, tab, refrescarHistorial, refrescarDiagnostico]);

  // Autosave de la sesión actual cada 30s + al cerrar, para recuperar
  // la pizarra si se cierra el browser sin guardar con nombre.
  useEffect(() => {
    const guardar = () => {
      try {
        void guardarUltimaSesion(excalidrawAPI, alumnoRef.current);
      } catch {
        // best-effort
      }
    };
    const id = window.setInterval(guardar, 30000);
    window.addEventListener("beforeunload", guardar);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("beforeunload", guardar);
    };
  }, [excalidrawAPI]);

  const mostrarAviso = (texto: string) => {
    setAviso(texto);
    setTimeout(() => setAviso(null), 3000);
  };

  const siguienteCascada = () => {
    cascadaRef.current = (cascadaRef.current + 1) % 8;
    return cascadaRef.current * 40;
  };

  const pegarRegla = useCallback(
    (
      gradoColor: string,
      titulo: string,
      texto: string,
      at?: { x: number; y: number },
    ) => {
      const bloque = `${titulo.toUpperCase()}\n${texto}`;
      if (at) {
        insertarSkeletons(
          excalidrawAPI,
          [
            {
              type: "text",
              text: bloque,
              fontSize: 24,
              strokeColor: gradoColor,
            } as never,
          ],
          at.x,
          at.y,
        );
      } else {
        const d = siguienteCascada();
        insertarTexto(excalidrawAPI, bloque, {
          fontSize: 24,
          strokeColor: gradoColor,
          dx: d,
          dy: d,
        });
      }
    },
    [excalidrawAPI],
  );

  const pegarFigura = useCallback(
    (figuraId: string, at?: { x: number; y: number }) => {
      const figura = FIGURAS.find((f) => f.id === figuraId);
      if (!figura) {
        return;
      }
      const skeletons = figura.construir();
      if (at) {
        insertarSkeletons(excalidrawAPI, skeletons, at.x, at.y);
      } else {
        const { x, y } = origenViewport(excalidrawAPI);
        const d = siguienteCascada();
        insertarSkeletons(excalidrawAPI, skeletons, x + d, y + d);
      }
      mostrarAviso(`${figura.nombre} insertada.`);
    },
    [excalidrawAPI],
  );

  // Drop de tarjetas del panel sobre el canvas (con posicionamiento)
  useEffect(() => {
    if (!abierto) {
      return;
    }
    const alArrastrar = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes(DROP_MIME)) {
        e.preventDefault();
      }
    };
    const alSoltar = (e: DragEvent) => {
      const raw = e.dataTransfer?.getData(DROP_MIME);
      if (!raw) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      try {
        const item = JSON.parse(raw) as ItemArrastrable;
        const at = pantallaAScena(excalidrawAPI, e.clientX, e.clientY);
        if (item.kind === "regla" && item.texto) {
          pegarRegla(item.color || "#1e1e1e", item.titulo, item.texto, at);
        } else if (item.kind === "figura" && item.figuraId) {
          pegarFigura(item.figuraId, at);
        }
      } catch {
        // payload inválido: ignorar
      }
    };
    document.addEventListener("dragover", alArrastrar, true);
    document.addEventListener("drop", alSoltar, true);
    return () => {
      document.removeEventListener("dragover", alArrastrar, true);
      document.removeEventListener("drop", alSoltar, true);
    };
  }, [abierto, excalidrawAPI, pegarRegla, pegarFigura]);

  const iniciarArrastre = (e: React.DragEvent, item: ItemArrastrable) => {
    e.dataTransfer.setData(DROP_MIME, JSON.stringify(item));
    e.dataTransfer.effectAllowed = "copy";
  };

  const aplicarPreset = (preset: typeof PRESETS[number]) => {
    excalidrawAPI.updateScene({
      appState: { ...preset.appState },
    });
    mostrarAviso(`${preset.nombre} activado.`);
  };

  const handleGuardar = async () => {
    if (!alumno.trim()) {
      mostrarAviso("Escribe el nombre del alumno primero.");
      return;
    }
    try {
      const meta = await guardarPizarra(excalidrawAPI, alumno.trim());
      setAlumno("");
      refrescarHistorial();
      mostrarAviso(`Pizarra de ${meta.alumno} guardada.`);
    } catch (e) {
      mostrarAviso(errorAmigable(e));
    }
  };

  const handlePersistencia = async () => {
    const ok = await asegurarPersistencia();
    await refrescarDiagnostico();
    mostrarAviso(
      ok ? "Persistencia activada." : "El navegador no concedió persistencia.",
    );
  };

  const handleRecuperarUltima = async () => {
    try {
      const ultima = await obtenerUltimaSesion();
      if (!ultima) {
        mostrarAviso("No hay última sesión.");
        return;
      }
      await cargarPizarra(excalidrawAPI, "ultima-sesion");
      mostrarAviso("Última sesión recuperada.");
    } catch (e) {
      mostrarAviso(errorAmigable(e));
    }
  };

  const handleDescartarUltima = async () => {
    await borrarUltimaSesion();
    setUltimaSesion(null);
  };

  const handleExportarTodo = async () => {
    try {
      descargarRespaldoTodo(await exportarTodo());
      mostrarAviso("Respaldo descargado.");
    } catch (e) {
      mostrarAviso(errorAmigable(e));
    }
  };

  const leerArchivo = (file: File): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        try {
          resolve(JSON.parse(String(r.result)));
        } catch {
          reject(new Error("Archivo JSON inválido."));
        }
      };
      r.onerror = () => reject(new Error("No se pudo leer el archivo."));
      r.readAsText(file);
    });

  if (!abierto) {
    return null;
  }

  const grado = REGLAS[gradoIdx];
  const pizarrasFiltradas = pizarras.filter((p) =>
    `${p.alumno}`.toLowerCase().includes(busqueda.toLowerCase()),
  );

  return (
    <div style={panelStyle}>
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <strong style={{ fontSize: 14 }}>Panel de clase</strong>
        <button
          onClick={() => setAbierto(false)}
          style={{
            border: "none",
            background: "transparent",
            fontSize: 18,
            cursor: "pointer",
            color: "#6b7280",
          }}
          aria-label="Cerrar panel"
        >
          ×
        </button>
      </div>
      <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb" }}>
        <button
          style={tabStyle(tab === "reglas")}
          onClick={() => setTab("reglas")}
        >
          Reglas
        </button>
        <button
          style={tabStyle(tab === "figuras")}
          onClick={() => setTab("figuras")}
        >
          Figuras
        </button>
        <button
          style={tabStyle(tab === "tools")}
          onClick={() => setTab("tools")}
        >
          Tools
        </button>
        <button
          style={tabStyle(tab === "historial")}
          onClick={() => setTab("historial")}
        >
          Historial
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {tab === "reglas" && (
          <div>
            <select
              value={gradoIdx}
              onChange={(e) => setGradoIdx(Number(e.target.value))}
              style={{
                width: "100%",
                padding: 8,
                marginBottom: 10,
                borderRadius: 8,
                border: "1px solid #d1d5db",
              }}
            >
              {REGLAS.map((g, i) => (
                <option key={g.grado} value={i}>
                  Grado {g.grado} — {g.nombre}
                </option>
              ))}
            </select>
            {grado.temas.map((tema) => (
              <div key={tema.titulo} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    background: grado.color,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "6px 10px",
                    borderRadius: "8px 8px 0 0",
                  }}
                >
                  {tema.titulo}
                </div>
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderTop: "none",
                    borderRadius: "0 0 8px 8px",
                    padding: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {tema.reglas.map((regla, ri) => (
                    <div
                      key={ri}
                      draggable
                      onDragStart={(e) =>
                        iniciarArrastre(e, {
                          kind: "regla",
                          titulo: `${grado.nombre} · ${tema.titulo}`,
                          texto: regla,
                          color: grado.color,
                        })
                      }
                      onClick={() => {
                        pegarRegla(
                          grado.color,
                          `${grado.nombre} · ${tema.titulo}`,
                          regla,
                        );
                        mostrarAviso(
                          "Regla insertada (o arrástrala al punto exacto).",
                        );
                      }}
                      title="Clic para insertar o arrastra al canvas"
                      style={{
                        fontSize: 12,
                        background: "#f9fafb",
                        border: "1px dashed #d1d5db",
                        borderRadius: 6,
                        padding: "6px 8px",
                        cursor: "grab",
                      }}
                    >
                      {regla}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "figuras" && (
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            {FIGURAS.map((figura) => (
              <div
                key={figura.id}
                draggable
                onDragStart={(e) =>
                  iniciarArrastre(e, {
                    kind: "figura",
                    titulo: figura.nombre,
                    figuraId: figura.id,
                  })
                }
                onClick={() => pegarFigura(figura.id)}
                title="Clic para insertar o arrastra al canvas"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  background: "#f9fafb",
                  border: "1px dashed #d1d5db",
                  borderRadius: 8,
                  padding: "14px 8px",
                  cursor: "grab",
                  textAlign: "center",
                }}
              >
                {figura.nombre}
              </div>
            ))}
          </div>
        )}

        {tab === "tools" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => aplicarPreset(preset)}
                style={{
                  textAlign: "left",
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: "10px 12px",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {preset.nombre}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  {preset.hint}
                </div>
              </button>
            ))}
            <p style={{ fontSize: 11, color: "#6b7280" }}>
              Los presets cambian el tool activo y su estilo de un toque.
            </p>
          </div>
        )}

        {tab === "historial" && (
          <div>
            {almacen && (
              <div
                style={{
                  fontSize: 11,
                  color: almacen.disponible ? "#065f46" : "#b91c1c",
                  background: almacen.disponible ? "#ecfdf5" : "#fef2f2",
                  border: `1px solid ${
                    almacen.disponible ? "#a7f3d0" : "#fecaca"
                  }`,
                  borderRadius: 8,
                  padding: "8px 10px",
                  marginBottom: 10,
                }}
              >
                <div>
                  {almacen.disponible ? "✓" : "⚠"} {almacen.mensaje}
                </div>
                <div style={{ marginTop: 4, color: "#6b7280" }}>
                  {almacen.origen}
                  {almacen.usoMB !== null &&
                    almacen.quotaMB !== null &&
                    ` · ${almacen.usoMB}/${almacen.quotaMB} MB`}
                  {almacen.disponible && !almacen.persistido && (
                    <button
                      onClick={handlePersistencia}
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        fontWeight: 700,
                        background: "#fff",
                        border: "1px solid #a7f3d0",
                        borderRadius: 6,
                        padding: "2px 8px",
                        cursor: "pointer",
                      }}
                    >
                      No borrar al cerrar
                    </button>
                  )}
                </div>
                <div style={{ marginTop: 4, color: "#6b7280" }}>
                  El historial vive en este navegador + esta URL. Si cambias de
                  perfil o de URL (localhost vs Vercel), verás lista vacía.
                </div>
              </div>
            )}
            {errorHistorial && (
              <div
                style={{
                  fontSize: 11,
                  color: "#b91c1c",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  padding: "8px 10px",
                  marginBottom: 10,
                }}
              >
                ⚠ {errorHistorial}
              </div>
            )}
            {ultimaSesion && (
              <div
                style={{
                  fontSize: 12,
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: 8,
                  padding: "8px 10px",
                  marginBottom: 10,
                }}
              >
                <div style={{ fontWeight: 700 }}>
                  Última sesión sin guardar: {ultimaSesion.alumno}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  {ultimaSesion.fechaISO.slice(0, 16).replace("T", " ")} ·{" "}
                  {ultimaSesion.numElementos} elementos (autosave 30s)
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button
                    onClick={handleRecuperarUltima}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      background: "#1d4ed8",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      padding: "4px 10px",
                      cursor: "pointer",
                    }}
                  >
                    Recuperar
                  </button>
                  <button
                    onClick={handleDescartarUltima}
                    style={{
                      fontSize: 11,
                      background: "#fff",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      padding: "4px 10px",
                      cursor: "pointer",
                    }}
                  >
                    Descartar
                  </button>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <input
                value={alumno}
                onChange={(e) => setAlumno(e.target.value)}
                placeholder="Nombre del alumno"
                style={{
                  flex: 1,
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  fontSize: 12,
                }}
              />
              <button
                onClick={handleGuardar}
                style={{
                  background: "#1d4ed8",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Guardar
              </button>
            </div>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar alumno…"
              style={{
                width: "100%",
                padding: 8,
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 12,
                marginBottom: 10,
                boxSizing: "border-box",
              }}
            />
            {pizarrasFiltradas.length === 0 && (
              <p style={{ fontSize: 12, color: "#6b7280" }}>
                Sin pizarras guardadas todavía.
              </p>
            )}
            {pizarrasFiltradas.map((p) => (
              <div
                key={p.key}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: 8,
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>{p.alumno}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  {p.fechaISO.slice(0, 16).replace("T", " ")} · {p.numElementos}{" "}
                  elementos
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button
                    onClick={async () => {
                      try {
                        await cargarPizarra(excalidrawAPI, p.key);
                        mostrarAviso("Pizarra cargada.");
                      } catch (e) {
                        mostrarAviso(errorAmigable(e));
                      }
                    }}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      border: "1px solid #bfdbfe",
                      borderRadius: 6,
                      padding: "4px 8px",
                      cursor: "pointer",
                    }}
                  >
                    Abrir
                  </button>
                  <button
                    onClick={() =>
                      descargarPizarra(p, () => obtenerRegistro(p.key))
                    }
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      background: "#f9fafb",
                      color: "#374151",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      padding: "4px 8px",
                      cursor: "pointer",
                    }}
                  >
                    Descargar
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`¿Borrar pizarra de ${p.alumno}?`)) {
                        try {
                          await borrarPizarra(p.key);
                          refrescarHistorial();
                        } catch (e) {
                          mostrarAviso(errorAmigable(e));
                        }
                      }
                    }}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      background: "#fef2f2",
                      color: "#b91c1c",
                      border: "1px solid #fecaca",
                      borderRadius: 6,
                      padding: "4px 8px",
                      cursor: "pointer",
                    }}
                  >
                    Borrar
                  </button>
                </div>
              </div>
            ))}
            <div
              style={{
                borderTop: "1px solid #e5e7eb",
                marginTop: 12,
                paddingTop: 10,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700 }}>
                Respaldo (para cambiar de navegador/PC)
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  onClick={handleExportarTodo}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: "#f9fafb",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    padding: "4px 8px",
                    cursor: "pointer",
                  }}
                >
                  Exportar todo
                </button>
                <button
                  onClick={() => importarTodoRef.current?.click()}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: "#f9fafb",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    padding: "4px 8px",
                    cursor: "pointer",
                  }}
                >
                  Importar respaldo
                </button>
                <button
                  onClick={() => importarEscenaRef.current?.click()}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: "#f9fafb",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    padding: "4px 8px",
                    cursor: "pointer",
                  }}
                >
                  Abrir .excalidraw
                </button>
              </div>
              <input
                ref={importarTodoRef}
                type="file"
                accept="application/json,.json"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) {
                    return;
                  }
                  try {
                    const n = await importarRespaldoTodo(
                      await leerArchivo(file),
                    );
                    refrescarHistorial();
                    mostrarAviso(`Respaldo importado: ${n} pizarras.`);
                  } catch (err) {
                    mostrarAviso(errorAmigable(err));
                  }
                }}
              />
              <input
                ref={importarEscenaRef}
                type="file"
                accept="application/json,.excalidraw,.json"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) {
                    return;
                  }
                  try {
                    const datos = (await leerArchivo(file)) as {
                      elements?: unknown[];
                      files?: Record<string, unknown>;
                    };
                    if (
                      confirm(
                        "Esto reemplaza el canvas actual. ¿Abrir el archivo?",
                      )
                    ) {
                      const n = importarEscenaDesdeObjeto(excalidrawAPI, datos);
                      mostrarAviso(`Archivo abierto (${n} elementos).`);
                    }
                  } catch (err) {
                    mostrarAviso(errorAmigable(err));
                  }
                }}
              />
              <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>
                Tip: usa Descargar por pizarra o Exportar todo antes de limpiar
                el navegador.
              </p>
            </div>
          </div>
        )}
      </div>

      {aviso && (
        <div
          style={{
            padding: "8px 12px",
            background: "#03045e",
            color: "#fff",
            fontSize: 12,
            textAlign: "center",
          }}
        >
          {aviso}
        </div>
      )}
    </div>
  );
};
