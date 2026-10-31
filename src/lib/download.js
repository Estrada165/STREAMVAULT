// Guardar una imagen (por ejemplo, el QR de pago) en el dispositivo.
// 1) En celular usa "Compartir → Guardar imagen" si el navegador lo permite (queda en la galería).
// 2) Si no, la descarga como archivo.
// 3) Si el servidor de la imagen no deja descargarla, la abre en otra pestaña para guardarla manualmente.
export async function saveImage(url, filename = 'qr.png') {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) throw new Error('fetch')
    const blob = await res.blob()
    const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
    const name = filename.replace(/\.\w+$/, '') + '.' + ext
    const file = new File([blob], name, { type: blob.type || 'image/png' })
    const mobile = window.matchMedia?.('(pointer: coarse)').matches
    if (mobile && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return 'shared' } catch (e) { if (e?.name === 'AbortError') return 'cancelled' }
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = name
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    return 'downloaded'
  } catch {
    window.open(url, '_blank', 'noopener')
    return 'opened'
  }
}
