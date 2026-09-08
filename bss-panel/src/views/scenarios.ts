import type { Computed, Seed } from "../types"
import { COMPANIES, SCENARIOS, fmt } from "../lib/engine"
import { esc } from "../lib/dom"

const CO_CLASS: Record<string, string> = { CYL: "cyl", KRC: "krc", GZL: "gzl" }

export function scenariosView(seed: Seed, computed: Computed): string {
  const rows = SCENARIOS.map((sc) => {
    const rank = computed.ranking[sc.id]
    const cells = COMPANIES.map((co) => {
      const v = computed.scenarios[sc.id][co].bss
      const first = rank[0] === co
      return `<td class="${first ? "win" : ""}">${fmt(v)}</td>`
    }).join("")
    const order = rank
      .map((id) => seed.companies.find((c) => c.id === id)?.name ?? id)
      .join(" → ")
    return `<tr class="${sc.id === "S1" ? "is-base" : ""}">
      <th><b>${esc(sc.id)}</b> ${esc(sc.name)}<small>${esc(sc.mix)}</small></th>
      ${cells}
      <td class="order">${esc(order)}</td>
    </tr>`
  }).join("")

  const s1 = computed.scenarios.S1
  const blockRows = seed.blocks
    .map((b) => {
      return `<tr>
        <th>${esc(b.name)}</th>
        ${COMPANIES.map((co) => `<td>${fmt(s1[co].blocks[b.id])}</td>`).join("")}
      </tr>`
    })
    .join("")

  return `
    <header class="page-head">
      <div>
        <p class="eyebrow">Duyarlılık</p>
        <h1>Senaryolar ve skorlar</h1>
        <p class="lede">Aynı 1–5 puanlar, farklı ağırlık varsayımlarıyla otomatik yeniden hesaplanır. Sıralama anında güncellenir.</p>
      </div>
    </header>
    <article class="panel">
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
        <span class="hint">Blok içi 100’lük skala</span>
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
