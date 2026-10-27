# excalidraw-clases (fork para tutorías)

Fork de [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) con una función extra: **Importar PDF** (menú hamburguesa → _Importar PDF_). Cada página se renderiza a imagen y se coloca en el canvas, lista para rayar encima con el estudiante.

La colaboración en vivo usa los servidores oficiales de Excalidraw (cifrado de extremo a extremo intacto): no hay que configurar nada.

## Desarrollo local

```bash
yarn install
yarn start   # http://localhost:3000
```

## Deploy en Vercel (5 pasos)

1. En Vercel → _Add New Project_ → importa `excalidraw-clases`.
2. Framework: **Vite** (autodetectado). No cambies build/output (`vercel.json` ya define `outputDirectory: excalidraw-app/build`).
3. Variables de entorno: ninguna obligatoria para uso básico. La colaboración apunta por defecto a los servidores oficiales.
4. Deploy.
5. Verifica: abre la URL, menú → _Importar PDF_ (prueba con un PDF de 5 y de 20 páginas), e inicia una sesión _Live collaboration_ en dos navegadores.

## Historial por alumno (local, sin nube)

Panel de clase → pestaña **Historial**. Todo vive en IndexedDB (`clases-db/historial`) de **este navegador + esta URL**:

- Usa siempre la misma URL y el mismo perfil (localhost ≠ Vercel).
- Pulsa **No borrar al cerrar** para pedir persistencia al navegador.
- Autosave de **Última sesión** cada 30s + al cerrar: si se cierra sin guardar con nombre, la recuperas desde el banner amarillo.
- Respaldo: **Descargar** por pizarra (`.excalidraw`), **Exportar todo** (JSON) e **Importar respaldo / Abrir .excalidraw** para migrar de PC.

## Asistente IA (OpenRouter, BYOK)

Panel de clase → pestaña **IA**. Pega tu API key de OpenRouter (solo vive en `localStorage` de tu navegador, nunca va al repo). Modelo por defecto `deepseek/deepseek-chat`, editable. Elige grado, tema, cantidad y dificultad → **Generar ejercicios** → **Insertar** uno o todos al canvas. El solucionario queda colapsado en el panel, no se inserta.

## Tools

- **Cursor lápiz ✏️**: solo estética, con toggle.
- **Temporizador ⏱**: fases Objetivo 5′ / Ejemplo 15′ / Práctica 10′ o minutos libres, con pitido al terminar.

## Ficha de sesión 📋

Panel de clase → pestaña **Ficha**: Estudiante, Materia (libre), Tema(s), Sesión # (manual) y Fecha (auto, editable). **Insertar encabezado** lo pone fijo arriba de la pizarra (tarjeta azul, se mueve en bloque y sale en el PNG/PDF). **Guardar pizarra con ficha** la archiva detallada (`Pizarra_Estudiante_S3_Materia_fecha.excalidraw`). **Nueva sesión desde ficha** guarda autosave, limpia e inserta encabezado fresco.

## Notas

- Límite de importación: 50 MB y 30 primeras páginas por PDF.
- `pdfjs-dist` se carga de forma perezosa (solo al importar), no afecta la carga inicial.
- Rama de la función: `feature/pdf-import`.

## Páginas de clase 📄 (estilo Zoom Whiteboard / OneNote)

Barra inferior centrada, sobre la pizarra (no tapa el canvas ni la
toolbar). Declara `data-viewport-ui="bottom"` para que el salto
descuente su altura solo. Solo muestra páginas con nombre.

- **Crear las 4 de clase**: Teoría, Ejemplos, Ejercicios y
  Soluciones. Si alguna ya existe, no se duplica. Crea en lote con
  una sola navegación final (sin 4 saltos encadenados).
- **+ Nueva**: escribe un nombre y crea otra página cuando haga falta.
- **Tocar una página**: salta a ella en pantalla completa.
- **← Anterior / Siguiente →**: pasa de página en orden. Sin
  selección, → va a la primera y ← a la última.
- **✎**: cambia el nombre de una página (Enter guarda, Esc cancela).
- La barra se oculta con la × y se muestra con la píldora
  "📄 Páginas" o desde el menú hamburguesa → **📄 Páginas**.
- Respeta `prefers-reduced-motion` (salto sin animación si el
  sistema lo pide).

Las páginas se guardan con la pizarra (igual que el resto de la escena),
así que también quedan en el Historial y en el `.excalidraw` exportado.
Saltar de página mueve solo tu vista; no fuerza la vista de los demás
en una sesión colaborativa. Código nuevo, sin tocar los features
existentes: `excalidraw-app/components/clases/paginas.ts` y
`excalidraw-app/components/clases/PanelPaginas.tsx`.
