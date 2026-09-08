import type { AppState, Computed, Seed } from "../types"
import { closestSaaty, SAATY } from "../lib/ahp"
import { fmt, fmtPct } from "../lib/engine"
import { crBadge, esc } from "../lib/dom"

export function ahpView(seed: Seed, state: AppState, computed: Computed, selectedId: string): string {
  const selected = seed.matrices.find((m) => m.id === selectedId) ?? seed.matrices[0]
  const upper = state.matrices[selected.id]
  const res = computed.matrix[selected.id]
  const n = selected.labels.length

  const nav = ["Ana blok", "Alt grup", "Gösterge"]
    .map((group) => {
      const items = seed.matrices
        .filter((m) => m.group === group)
        .map((m) => {
          const r = computed.matrix[m.id]
          return `<button type="button" class="mat-item ${m.id === selected.id ? "on" : ""} ${r.consistent ? "" : "warn"}" data-matrix="${m.id}">
            <span>${esc(m.title)}</span>
            ${crBadge(r.cr, r.consistent, true)}
          </button>`
        })
        .join("")
      return `<div class="mat-group"><p>${group}</p>${items}</div>`
    })
    .join("")

  const options = (current: number) =>
    SAATY.map((o) => {
      const sel = Math.abs(closestSaaty(current) - o.value) < 1e-9 ? "selected" : ""
      return `<option value="${o.value}" ${sel}>${o.label}</option>`
    }).join("")

  let grid = `<thead><tr><th></th>${selected.labels.map((l, idx) => `<th title="${esc(selected.labelsFull[idx] ?? l)}">${esc(l)}</th>`).join("")}<th>Ağırlık</th></tr></thead><tbody>`
  for (let i = 0; i < n; i++) {
    grid += `<tr><th title="${esc(selected.labelsFull[i])}">${esc(selected.labels[i])}</th>`
    for (let j = 0; j < n; j++) {
      if (i === j) {
        grid += `<td class="diag">1</td>`
      } else if (i < j) {
        const v = upper[i][j - i - 1]
        grid += `<td><select data-mi="${selected.id}" data-i="${i}" data-j="${j}">${options(v)}</select></td>`
      } else {
        const v = upper[j][i - j - 1]
        const rec = v > 0 ? 1 / v : 1
        grid += `<td class="rec">${rec >= 1 ? fmt(rec, rec % 1 ? 2 : 0) : `1/${fmt(1 / rec, 0)}`}</td>`
      }
    }
    grid += `<td class="w">${fmtPct(res.weights[i])}</td></tr>`
  }
  grid += `</tbody>`

  return `
    <header class="page-head">
      <div>
        <p class="eyebrow">AHP</p>
        <h1>İkili karşılaştırmalar</h1>
        <p class="lede">Sarı hücreler Excel’deki giriş alanıdır. Alt üçgen, yerel ağırlık, λmax, CI ve CR otomatik üretilir.</p>
      </div>
      <div class="ahp-stats">
        ${crBadge(res.cr, res.consistent)}
        <div class="stat"><span>λmax</span><b>${fmt(res.lambdaMax, 3)}</b></div>
        <div class="stat"><span>CI</span><b>${fmt(res.ci, 3)}</b></div>
      </div>
    </header>
    <div class="ahp-layout">
      <aside class="mat-nav">${nav}</aside>
      <article class="panel matrix-panel">
        <div class="panel-h">
          <h3>${esc(selected.title)}</h3>
          <span class="hint">Satır, sütuna göre ne kadar önemli?</span>
        </div>
        <div class="table-wrap"><table class="ahp-table">${grid}</table></div>
      </article>
    </div>
  `
}
