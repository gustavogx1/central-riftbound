/** Só aceita caminhos do próprio site como destino depois do login (evita redirecionar para fora). */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next.slice(0, 500);
}
