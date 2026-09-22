// Asistente IA vía OpenRouter (BYOK: la key vive solo en tu navegador).
// Sin servidor propio: el fetch va directo del browser a OpenRouter.

export const MODELO_DEFAULT = "deepseek/deepseek-chat";

const CLAVE_KEY = "clases:openrouter-key";
const MODELO_KEY = "clases:openrouter-modelo";

export function leerClave(): string {
  try {
    return localStorage.getItem(CLAVE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function guardarClave(key: string): void {
  try {
    if (key.trim()) {
      localStorage.setItem(CLAVE_KEY, key.trim());
    } else {
      localStorage.removeItem(CLAVE_KEY);
    }
  } catch {
    // best-effort
  }
}

export function leerModelo(): string {
  try {
    return localStorage.getItem(MODELO_KEY) || MODELO_DEFAULT;
  } catch {
    return MODELO_DEFAULT;
  }
}

export function guardarModelo(modelo: string): void {
  try {
    localStorage.setItem(MODELO_KEY, modelo.trim() || MODELO_DEFAULT);
  } catch {
    // best-effort
  }
}

export interface PeticionEjercicios {
  grado: string;
  tema: string;
  cantidad: number;
  dificultad: "fácil" | "media" | "difícil";
  conSolucionario: boolean;
}

export interface ResultadoEjercicios {
  ejercicios: string[];
  soluciones: string[];
  textoCrudo: string;
}

const SISTEMA = `Eres docente de matemáticas de grados 7-12 (Puerto Rico / Common Core).
Devuelves ejercicios en español, claros y listos para resolver en pizarra.
Formato estricto:
1. <ejercicio>
2. <ejercicio>
...
Si se pide solucionario, al final agrega un bloque exactamente así:
SOLUCIONES:
1. <respuesta breve con procedimiento en 1 línea>
2. <respuesta breve>
Sin introducciones ni despedidas. Usa notación simple (x², √, π, ½) que se lea en texto plano.`;

export async function generarEjercicios(
  peticion: PeticionEjercicios,
  apiKey: string,
  modelo: string,
): Promise<ResultadoEjercicios> {
  const key = apiKey.trim();
  if (!key) {
    throw new Error("Pega tu API key de OpenRouter primero.");
  }
  if (!peticion.tema.trim()) {
    throw new Error("Escribe el tema (ej. ecuaciones lineales).");
  }
  const user = [
    `Grado ${peticion.grado}. Tema: ${peticion.tema.trim()}.`,
    `Cantidad: ${peticion.cantidad}. Dificultad: ${peticion.dificultad}.`,
    peticion.conSolucionario
      ? "Incluye el bloque SOLUCIONES: al final."
      : "Sin solucionario, solo los ejercicios numerados.",
  ].join(" ");

  let resp: Response;
  try {
    resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          typeof window !== "undefined" ? window.location.origin : "",
        "X-Title": "excalidraw-clases",
      },
      body: JSON.stringify({
        model: modelo.trim() || MODELO_DEFAULT,
        messages: [
          { role: "system", content: SISTEMA },
          { role: "user", content: user },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });
  } catch {
    throw new Error("Sin conexión a OpenRouter. Revisa tu internet.");
  }

  if (!resp.ok) {
    if (resp.status === 401 || resp.status === 403) {
      throw new Error("Key inválida o sin permiso (revisa OpenRouter).");
    }
    if (resp.status === 429) {
      throw new Error(
        "Límite de OpenRouter alcanzado. Espera e intenta de nuevo.",
      );
    }
    let detalle = "";
    try {
      const data = (await resp.json()) as {
        error?: { message?: string };
        message?: string;
      };
      detalle = data?.error?.message || data?.message || "";
    } catch {
      // ignorar
    }
    throw new Error(
      detalle
        ? `OpenRouter error ${resp.status}: ${detalle}`
        : `OpenRouter error ${resp.status}.`,
    );
  }

  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const texto = data?.choices?.[0]?.message?.content?.trim() ?? "";
  if (!texto) {
    throw new Error("Respuesta vacía del modelo. Intenta de nuevo.");
  }
  return { ...parsearRespuesta(texto), textoCrudo: texto };
}

/** Separa ejercicios numerados y bloque SOLUCIONES: (tolerante al formato). */
export function parsearRespuesta(texto: string): {
  ejercicios: string[];
  soluciones: string[];
} {
  const lineas = texto.split("\n").map((l) => l.trim());
  const idxSol = lineas.findIndex((l) => /^soluciones\s*:?$/i.test(l));
  const bloqueEj = idxSol === -1 ? lineas : lineas.slice(0, idxSol);
  const bloqueSol = idxSol === -1 ? [] : lineas.slice(idxSol + 1);
  const num = /^\d+\s*[.)\-:]\s*(.+)$/;
  const ejercicios = bloqueEj
    .map((l) => l.match(num)?.[1]?.trim() ?? "")
    .filter(Boolean);
  const soluciones = bloqueSol
    .map((l) => l.match(num)?.[1]?.trim() ?? "")
    .filter(Boolean);
  // fallback: si el modelo no numeró, usa líneas no vacías como ejercicios
  if (ejercicios.length === 0) {
    const fallback = bloqueEj.filter(
      (l) => l.length > 0 && !/^soluciones/i.test(l),
    );
    return { ejercicios: fallback, soluciones };
  }
  return { ejercicios, soluciones };
}
