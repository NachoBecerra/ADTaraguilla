/**
 * Manda los avisos al móvil a través de la web.
 *
 * Sin dependencias, como el resto de la sincronización: corre en GitHub sin
 * instalar nada. Lo usan la sincronización y `avisar.mjs`, que es quien los
 * manda en producción después de publicar.
 */

export async function mandarAvisos(avisos, { log = console.log, aviso = console.warn } = {}) {
  if (!avisos?.length) return;

  const secreto = process.env.AVISOS_SECRETO;
  const sitio = process.env.SITIO_URL;
  if (!secreto || !sitio) {
    aviso(`${avisos.length} aviso(s) sin mandar: falta AVISOS_SECRETO o SITIO_URL`);
    return;
  }

  try {
    const r = await fetch(`${sitio}/api/avisar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-avisos-secreto": secreto },
      body: JSON.stringify({ avisos }),
    });
    const cuerpo = await r.json().catch(() => ({}));
    if (!r.ok) {
      aviso(`Avisos: la web respondió ${r.status}`);
      return;
    }
    log(`Avisos: ${avisos.length} novedad(es), ${cuerpo.enviados ?? 0} enviado(s)`);
  } catch (e) {
    // Que fallen los avisos no debe tumbar nada
    aviso(`Avisos: no se han podido mandar (${e.message})`);
  }
}
