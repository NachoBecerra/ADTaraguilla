/**
 * Escritura en el repositorio desde el panel.
 *
 * El editor no necesita cuenta de GitHub: quien firma los commits es el club,
 * con un único token guardado en el servidor. Se usa la API de datos de Git
 * (blobs → árbol → commit) en vez de la de contenidos, para que subir veinte
 * fotos sea UN commit y no veinte, que además dispararía veinte despliegues.
 */

const API = "https://api.github.com";

type Archivo = {
  ruta: string;
  /** Texto plano o binario ya codificado en base64. */
  contenido: string;
  binario?: boolean;
};

function ajustes() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token) throw new Error("Falta la variable de entorno GITHUB_TOKEN");
  if (!repo) throw new Error("Falta la variable de entorno GITHUB_REPO");
  return { token, repo, rama: process.env.GITHUB_RAMA || "main" };
}

async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const { token } = ajustes();

  const respuesta = await fetch(`${API}${ruta}`, {
    ...opciones,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...opciones.headers,
    },
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new Error(`GitHub ${respuesta.status} en ${ruta}: ${detalle.slice(0, 300)}`);
  }
  return respuesta.json() as Promise<T>;
}

/**
 * Escribe y borra archivos en un único commit.
 *
 * Va todo junto a propósito: al editar una entrada de galería suelen cambiar
 * a la vez el JSON y algún archivo de imagen, y separarlo en dos commits
 * dispararía dos despliegues y dejaría un instante con los datos y las fotos
 * descuadrados.
 */
export async function commitear(
  cambios: { escribir?: Archivo[]; eliminar?: string[] },
  mensaje: string,
): Promise<string> {
  const archivos = cambios.escribir ?? [];
  const aBorrar = cambios.eliminar ?? [];
  if (archivos.length === 0 && aBorrar.length === 0) {
    throw new Error("No hay ningún cambio que guardar");
  }
  const { repo, rama } = ajustes();

  // 1. Dónde está ahora la rama
  const ref = await pedir<{ object: { sha: string } }>(
    `/repos/${repo}/git/ref/heads/${rama}`,
  );
  const commitBase = await pedir<{ tree: { sha: string } }>(
    `/repos/${repo}/git/commits/${ref.object.sha}`,
  );

  // 2. Un blob por archivo
  const blobs = await Promise.all(
    archivos.map(async (a) => {
      const blob = await pedir<{ sha: string }>(`/repos/${repo}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({
          content: a.contenido,
          encoding: a.binario ? "base64" : "utf-8",
        }),
      });
      return { path: a.ruta, mode: "100644", type: "blob", sha: blob.sha };
    }),
  );

  // 3. Árbol nuevo colgando del anterior, y commit encima
  const arbol = await pedir<{ sha: string }>(`/repos/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: commitBase.tree.sha,
      // sha a null en la API de árboles significa "quita este archivo"
      tree: [
        ...blobs,
        ...aBorrar.map((ruta) => ({ path: ruta, mode: "100644", type: "blob", sha: null })),
      ],
    }),
  });

  const commit = await pedir<{ sha: string }>(`/repos/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: mensaje,
      tree: arbol.sha,
      parents: [ref.object.sha],
    }),
  });

  // 4. Mover la rama al commit nuevo
  await pedir(`/repos/${repo}/git/refs/heads/${rama}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha }),
  });

  return commit.sha;
}

/** Nombres de los archivos de una carpeta del repositorio. */
export async function listarCarpeta(ruta: string): Promise<string[]> {
  const { repo, rama } = ajustes();
  try {
    const datos = await pedir<{ name: string; type: string }[]>(
      `/repos/${repo}/contents/${encodeURI(ruta)}?ref=${rama}`,
    );
    return datos.filter((f) => f.type === "file").map((f) => f.name);
  } catch {
    return [];
  }
}

/** Contenido actual de un archivo del repositorio, o null si no existe. */
export async function leerArchivo(ruta: string): Promise<string | null> {
  const { repo, rama } = ajustes();
  try {
    const datos = await pedir<{ content: string }>(
      `/repos/${repo}/contents/${encodeURI(ruta)}?ref=${rama}`,
    );
    return Buffer.from(datos.content, "base64").toString("utf8");
  } catch {
    return null;
  }
}
