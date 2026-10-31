// Mensaje claro cuando falta ejecutar un SQL en Supabase
export function rpcError(err, sql = '010') {
  const m = err?.message || String(err || '')
  if (/could not find the function|function .* does not exist|schema cache/i.test(m)) return `Falta ejecutar el SQL ${sql} en Supabase.`
  return m
}
