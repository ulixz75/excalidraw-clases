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

## Notas

- Límite de importación: 50 MB y 30 primeras páginas por PDF.
- `pdfjs-dist` se carga de forma perezosa (solo al importar), no afecta la carga inicial.
- Rama de la función: `feature/pdf-import`.
