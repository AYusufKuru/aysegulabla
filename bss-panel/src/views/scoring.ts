import type { AppState, BlockId, CompanyId, Computed, Seed } from "../types"
import { BLOCKS, COMPANIES, fmt, to100 } from "../lib/engine"
import { esc } from "../lib/dom"

export function scoringView(
  seed: Seed,
  state: AppState,
  computed: Computed,
  query: string,
  blockFilter: BlockId | "all",
  openNotes: Set<number>,
): string {
  const q = query.trim().toLowerCase()
  const filters = [
    `<button type="button" class="pill ${blockFilter === "all" ? "on" : ""}" data-block="all">Tümü</button>`,
    ...BLOCKS.map((b) => {
      const name = seed.blocks.find((x) => x.id === b)?.name ?? b
      return `<button type="button" class="pill pill-${b} ${blockFilter === b ? "on" : ""}" data-block="${b}">${esc(name)}</button>`
    }),
  ].join("")

  const groups = seed.subgroups
    .filter((s) => blockFilter === "all" || s.block === blockFilter)
    .map((sub) => {
      const inds = seed.indicators.filter((i) => {
        if (i.subId !== sub.id) return false
        if (!q) return true
        return (
          i.code.toLowerCase().includes(q) ||
          i.name.toLowerCase().includes(q) ||
          i.reason.toLowerCase().includes(q)
        )
      })
      if (!inds.length) return ""
      const blockName = seed.blocks.find((b) => b.id === sub.block)?.name ?? sub.block
      const rows = inds
        .map((ind) => {
          const sc = state.scores[ind.id]
          const cm = state.comments[ind.id]
          const chips = (co: CompanyId) =>
            [1, 2, 3, 4, 5]
              .map(
                (n) =>
                  `<button type="button" class="chip ${sc[co] === n ? "on" : ""}" data-ind="${ind.id}" data-co="${co}" data-v="${n}">${n}</button>`,
              )
              .join("")
          const scale = (co: CompanyId) => fmt(to100(sc[co]), 0)
          return `
            <article class="ind-row" data-open="0">
              <div class="ind-main">
                <button type="button" class="more" data-toggle="${ind.id}" aria-label="Gerekçe ve not">${openNotes.has(ind.id) ? "–" : "+"}</button>
                <div class="ind-id">
                  <code>${esc(ind.code)}</code>
                  <strong>${esc(ind.name)}</strong>
                </div>
                ${COMPANIES.map(
                  (co) => `
                  <div class="score-cell ${co.toLowerCase()}">
                    <div class="chips">${chips(co)}</div>
                    <small>${scale(co)}</small>
                  </div>`,
                ).join("")}
              </div>
              <div class="ind-extra" id="extra-${ind.id}" ${openNotes.has(ind.id) ? "" : "hidden"}>
                <p class="reason">${esc(ind.reason)}</p>
                <div class="notes">
                  ${seed.companies
                    .map(
                      (co) => `
                    <label>${esc(co.name)} notu
                      <textarea data-note="${ind.id}" data-co="${co.id}" rows="3">${esc(cm[co.id])}</textarea>
                    </label>`,
                    )
                    .join("")}
                </div>
              </div>
            </article>`
        })
        .join("")
      return `
        <section class="sub-block">
          <header class="sub-h" data-block="${sub.block}">
            <span class="blk">${esc(blockName)}</span>
            <h3>${esc(sub.name)}</h3>
            <em>${inds.length} gösterge</em>
          </header>
          <div class="ind-head">
            <span></span>
            <span>Gösterge</span>
            ${seed.companies.map((c) => `<span class="h-${c.id.toLowerCase()}">${esc(c.name)}</span>`).join("")}
          </div>
          ${rows}
        </section>`
    })
    .join("")

  const s1 = computed.scenarios.S1
  return `
    <header class="page-head">
      <div>
        <p class="eyebrow">Elle giriş</p>
        <h1>İşletme puanları</h1>
        <p class="lede">Her gösterge için 1–5 arası puan seçin. 100’lük skala, ağırlıklar ve BSS otomatik hesaplanır.</p>
      </div>
      <div class="live-strip">
        ${seed.companies
          .map(
            (c) =>
              `<div class="live ${c.id.toLowerCase()}"><span>${esc(c.name)}</span><b>${fmt(s1[c.id].bss)}</b></div>`,
          )
          .join("")}
      </div>
    </header>
    <div class="toolbar">
      <label class="search">
        <span>Ara</span>
        <input type="search" id="q" placeholder="Gösterge, kod veya gerekçe…" value="${esc(query)}" />
      </label>
      <div class="pills">${filters}</div>
    </div>
    <div class="legend-scale">1 zayıf · 3 orta · 5 güçlü · 100’lük skala otomatik</div>
    ${groups || `<p class="empty">Eşleşen gösterge yok.</p>`}
  `
}
