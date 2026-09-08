export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }
    return map[c]
  })
}

export function crValue(cr: number): string {
  return cr.toLocaleString("tr-TR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}

export function crBadge(cr: number, consistent: boolean, compact = false): string {
  const cls = consistent ? "ok" : "bad"
  const label = consistent ? "Tutarlı" : "Eşik aşıldı"
  const pct = Math.min(100, Math.max(4, (cr / 0.1) * 100))
  if (compact) {
    return `<span class="cr-pill ${cls}"><i></i><b>${crValue(cr)}</b><em>${label}</em></span>`
  }
  return `
    <div class="cr-chip ${cls}" title="Saaty eşiği: CR ≤ 0,10">
      <span class="cr-led"></span>
      <span class="cr-copy">
        <small>Tutarlılık oranı</small>
        <strong>${crValue(cr)}</strong>
      </span>
      <span class="cr-state">${label}</span>
      <span class="cr-meter" aria-hidden="true"><i style="width:${pct.toFixed(1)}%"></i></span>
    </div>`
}
