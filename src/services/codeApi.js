const SERVER = "http://localhost:3001";

/**
 * Lê um arquivo do disco e retorna o conteúdo.
 */
export async function readFile(filePath) {
  const res = await fetch(`${SERVER}/read-file`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filePath }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

/**
 * Lista arquivos de código em uma pasta.
 */
export async function listFiles(dirPath, depth = 2) {
  const res = await fetch(`${SERVER}/list-files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dirPath, depth }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}