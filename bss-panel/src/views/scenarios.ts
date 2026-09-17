/**
 * scenarios.ts — Excel “Senaryolar ve Skorlar” + AHP ve BSS satır 92–97.
 *
 * Aynı 1–5 puan, on farklı ağırlık karışımı (S1–S10).
 * Toplam puan: ağırlıksız 1–5 toplamı.
 * SS: bss (satır 92). SS Sağlama: ssCheck (satır 97).
 *
 * sc burada senaryo (S1, S2, …), puan değil.
 */
import type { Computed, Seed } from "../types"
import { COMPANIES, SCENARIOS, fmt } from "../lib/engine"
import { esc } from "../lib/dom"

const CO_CLASS: Record<string, string> = { CYL: "cyl", KRC: "krc", GZL: "gzl" }

export function scenariosView(seed: Seed, computed: Computed): string {
  const s1 = computed.scenarios.S1 // Yeni AHP özeti

  // Üst tablo: üç satır × üç işletme.
  const summaryRows = [
    { label: "Toplam puan", hint: "88 gösterge · 1–5 toplamı", cells: COMPANIES.map((co) => fmt(computed.totalRaw[co], 0)) },
    { label: "SS", hint: "Satır 92 · Yeni AHP bütünleşik skor", cells: COMPANIES.map((co) => fmt(s1[co].bss)) },
    { label: "SS Sağlama", hint: "Satır 97 · blok × ana blok ağırlığı", cells: COMPANIES.map((co) => fmt(s1[co].ssCheck)) },
  ]
    .map(
      (row) => `<tr>
        <th>${esc(row.label)}<small>${esc(row.hint)}</small></th>
        ${row.cells.map((v) => `<td>${v}</td>`).join("")}
      </tr>`,
    )
    .join("")

  // S1–S10 gövdesi. rank[0] birincidir → "win" hücresi.
  const rows = SCENARIOS.map((sc) => {
    const rank = computed.ranking[sc.id]
    const cells = COMPANIES.map((co) => {
      const r = computed.scenarios[sc.id][co]
      const first = rank[0] === co
      return `<td class="${first ? "win" : ""}">${fmt(r.bss)}<small>SS Sağlama ${fmt(r.ssCheck)}</small></td>`
    }).join("")
    // ["GZL","KRC","CYL"] → "Gözlü → Karacabey → Ceylanpınar"
    const order = rank
      .map((id) => seed.companies.find((c) => c.id === id)?.name ?? id)
      .join(" → ")
    return `<tr class="${sc.id === "S1" ? "is-base" : ""}">
      <th><b>${esc(sc.id)}</b> ${esc(sc.name)}<small>${esc(sc.mix)}</small></th>
      ${cells}
      <td class="order">${esc(order)}</td>
    </tr>`
  }).join("")

  // Excel satır 92–97 düzeni: SS, E, S, G, FO, SS Sağlama.
  const blockRows = [
    `<tr>
      <th>SS<small>Satır 92</small></th>
      ${COMPANIES.map((co) => `<td>${fmt(s1[co].bss)}</td>`).join("")}
    </tr>`,
    ...seed.blocks.map(
      (b) => `<tr>
        <th>${esc(b.name)}</th>
        ${COMPANIES.map((co) => `<td>${fmt(s1[co].blocks[b.id])}</td>`).join("")}
      </tr>`,
    ),
    `<tr>
      <th>SS Sağlama<small>Satır 97</small></th>
      ${COMPANIES.map((co) => `<td>${fmt(s1[co].ssCheck)}</td>`).join("")}
    </tr>`,
  ].join("")

  return `
    <header class="page-head">
      <div>
        <p class="eyebrow">Duyarlılık</p>
        <h1>Senaryolar ve skorlar</h1>
        <p class="lede">Toplam puan ham 1–5 toplamıdır. SS, Excel AHP ve BSS satır 92’dir; SS Sağlama satır 97 kontrolüdür.</p>
      </div>
    </header>
    <article class="panel">
      <div class="panel-h">
        <h3>Özet skorlar</h3>
        <span class="hint">Yeni AHP · üç işletme</span>
      </div>
      <div class="table-wrap">
        <table class="scen-table">
          <thead>
            <tr>
              <th></th>
              ${seed.companies.map((c) => `<th class="${CO_CLASS[c.id]}">${esc(c.name)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>${summaryRows}</tbody>
        </table>
      </div>
    </article>
    <article class="panel">
      <div class="panel-h">
        <h3>Senaryo SS</h3>
        <span class="hint">Satır 92 · altında SS Sağlama</span>
      </div>
      <div class="table-wrap">
        <table class="scen-table">
          <thead>
            <tr>
              <th>Senaryo</th>
              ${seed.companies.map((c) => `<th class="${CO_CLASS[c.id]}">${esc(c.name)}</th>`).join("")}
              <th>Sıra</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </article>
    <article class="panel">
      <div class="panel-h">
        <h3>Yeni AHP’ye göre ana blok skorları</h3>
        <span class="hint">Excel satır 92–97 düzeni</span>
      </div>
      <div class="table-wrap">
        <table class="scen-table">
          <thead>
            <tr>
              <th>Blok</th>
              ${seed.companies.map((c) => `<th>${esc(c.name)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>${blockRows}</tbody>
        </table>
      </div>
    </article>
  `
}
