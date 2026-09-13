import type { AppState, Computed, Seed } from "../types"
import { closestSaaty, SAATY } from "../lib/ahp"
import { fmt } from "../lib/engine"
import { crBadge, esc } from "../lib/dom"
import { weightPct } from "./weights"

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

  const options = (current: number) => {
    const closest = closestSaaty(current)
    const exact = Math.abs(closest - current) < 1e-6
    const extra = exact
      ? ""
      : `<option value="${current}" selected>${fmt(current, 2)} — ağırlıktan</option>`
    return (
      extra +
      SAATY.map((o) => {
        const sel = !extra && Math.abs(closest - o.value) < 1e-9 ? "selected" : ""
        return `<option value="${o.value}" ${sel}>${o.label}</option>`
      }).join("")
    )
  }

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
    const pct = weightPct(res.weights[i] ?? 0)
    grid += `<td class="w"><label class="wpct wpct-table"><input type="number" min="1" max="99" step="0.1" value="${pct}" data-w-matrix="${esc(selected.id)}" data-w-index="${i}" /><span>%</span></label></td></tr>`
  }
  grid += `</tbody>`

  return `
    <header class="page-head">
      <div>
        <p class="eyebrow">AHP</p>
        <h1>İkili karşılaştırmalar</h1>
        <p class="lede">İkili karşılaştırmayı veya sağdaki yerel ağırlığı değiştirin. Ağırlık girilince matris tutarlı oranlara çekilir; λmax, CI ve CR yenilenir.</p>
      </div>
      <div class="ahp-stats">
        ${crBadge(res.cr, res.consistent)}
        <div class="stat"><span>λmax</span><b>${fmt(res.lambdaMax, 3)}</b></div>
        <div class="stat"><span>CI</span><b>${fmt(res.ci, 3)}</b></div>
      </div>
    </header>
    <div class="ahp-rand" role="group" aria-label="Rastgele ağırlık">
      <button type="button" data-random="all">Tümü</button>
      <button type="button" data-random="inds">Göstergeler (wk)</button>
      <button type="button" data-random="subs">Alt gruplar</button>
      <button type="button" data-random="blocks">Ana bloklar</button>
    </div>
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
