import type { Computed, Seed } from "../types"
import { BLOCKS, fmt } from "../lib/engine"
import { crBadge, esc } from "../lib/dom"

const CO_CLASS: Record<string, string> = { CYL: "cyl", KRC: "krc", GZL: "gzl" }

export function dashboardView(seed: Seed, computed: Computed): string {
  const s1 = computed.scenarios.S1
  const rank = computed.ranking.S1

  const cards = seed.companies
    .map((co) => {
      const r = s1[co.id]
      const place = rank.indexOf(co.id) + 1
      return `
        <article class="co-card ${CO_CLASS[co.id]} place-${place}">
          <div class="co-top">
            <div class="rank">${place}</div>
            <div>
              <div class="co-kicker">${place === 1 ? "Önde" : place === 2 ? "İkinci" : "Üçüncü"}</div>
              <h2>${esc(co.name)}</h2>
              <p class="muted">${esc(co.region)}</p>
            </div>
          </div>
          <div class="bss">${fmt(r.bss)}<span>BSS</span></div>
          <div class="mini-bars">
            ${BLOCKS.map((b) => {
              const v = r.blocks[b]
              return `<div class="mini b-${b}"><span>${b}</span><i style="width:${v}%"></i><b>${fmt(v, 1)}</b></div>`
            }).join("")}
          </div>
        </article>`
    })
    .join("")

  const gaps = seed.indicators
    .map((ind) => {
      const sc = [computed.scale[ind.id].CYL, computed.scale[ind.id].KRC, computed.scale[ind.id].GZL]
      const spread = Math.max(...sc) - Math.min(...sc)
      return { ind, spread }
    })
    .filter((x) => x.spread >= 50)
    .sort((a, b) => b.spread - a.spread)
    .slice(0, 6)

  const radar = radarSvg(seed, computed)

  return `
    <header class="page-head">
      <div>
        <p class="eyebrow">Özet</p>
        <h1>Bütünleşik sürdürülebilirlik</h1>
        <p class="lede">Puan veya AHP değerini değiştirdiğiniz anda BSS, blok skorları ve sıralama yenilenir.</p>
      </div>
      <div class="head-meta">
        <div><b>88</b><span>gösterge</span></div>
        <div><b>3</b><span>işletme</span></div>
        <div><b>10</b><span>senaryo</span></div>
      </div>
    </header>

    <section class="cards-3">${cards}</section>

    <section class="split">
      <article class="panel">
        <div class="panel-h">
          <h3>Ana blok profili</h3>
          <span class="hint">Yeni AHP · 100’lük skala</span>
        </div>
        ${radar}
        <div class="legend">
          ${seed.companies.map((c) => `<span class="lg ${CO_CLASS[c.id]}">${esc(c.name)}</span>`).join("")}
        </div>
      </article>
      <article class="panel">
        <div class="panel-h">
          <h3>Yeni AHP ağırlıkları</h3>
          <span class="hint">Ana blok yerel ağırlık</span>
        </div>
        ${BLOCKS.map((b) => {
          const name = seed.blocks.find((x) => x.id === b)?.name ?? b
          const w = computed.wBlockNew[b]
          return `<div class="wrow"><span>${esc(name)}</span><div class="track"><i style="width:${w * 100}%"></i></div><b>${fmtPctSafe(w)}</b></div>`
        }).join("")}
        <p class="foot-note">Makale seti: ${BLOCKS.map((b) => `${b} ${fmtPctSafe(computed.wBlockArt[b])}`).join(" · ")}</p>
      </article>
    </section>

    <section class="split">
      <article class="panel">
        <div class="panel-h">
          <h3>Tutarlılık</h3>
          ${crBadge(
            computed.matrix.blocks_new.cr,
            computed.matrix.blocks_new.consistent,
          )}
        </div>
        ${
          computed.crAlerts.length
            ? `<ul class="alerts">${computed.crAlerts
                .map(
                  (a) =>
                    `<li><strong>${esc(a.title)}</strong>${crBadge(a.cr, false, true)}</li>`,
                )
                .join("")}</ul>`
            : `<p class="ok-line">19 matrisin tamamı eşik altında · CR ≤ 0,10</p>`
        }
        <p class="foot-note">Saaty kuralı: CR 0,10’un üstündeyse ikili karşılaştırmalar gözden geçirilmeli.</p>
      </article>
      <article class="panel">
        <div class="panel-h">
          <h3>En büyük işletme farkları</h3>
          <span class="hint">100’lük skalada ≥ 50 puan</span>
        </div>
        ${
          gaps.length
            ? `<ul class="gap-list">${gaps
                .map(
                  (g) =>
                    `<li><code>${esc(g.ind.code)}</code><span>${esc(g.ind.name)}</span><b>${fmt(g.spread, 0)}</b></li>`,
                )
                .join("")}</ul>`
            : `<p class="ok-line">Belirgin skor ayrışması yok.</p>`
        }
      </article>
    </section>
  `
}

function fmtPctSafe(n: number): string {
  return `${(n * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}%`
}

function radarSvg(seed: Seed, computed: Computed): string {
  const cx = 160
  const cy = 150
  const r = 108
  const axes = BLOCKS
  const pts = (co: string) =>
    axes
      .map((b, i) => {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 4
        const v = computed.scenarios.S1[co as "CYL"].blocks[b] / 100
        const x = cx + Math.cos(ang) * r * v
        const y = cy + Math.sin(ang) * r * v
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(" ")

  const grid = [0.25, 0.5, 0.75, 1]
    .map((g) => {
      const p = axes
        .map((_, i) => {
          const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 4
          return `${(cx + Math.cos(ang) * r * g).toFixed(1)},${(cy + Math.sin(ang) * r * g).toFixed(1)}`
        })
        .join(" ")
      return `<polygon points="${p}" class="grid" />`
    })
    .join("")

  const labels = axes
    .map((b, i) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 4
      const x = cx + Math.cos(ang) * (r + 26)
      const y = cy + Math.sin(ang) * (r + 26)
      const name = seed.blocks.find((x) => x.id === b)?.name ?? b
      return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${esc(name)}</text>`
    })
    .join("")

  const spokes = axes
    .map((_, i) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 4
      const x = cx + Math.cos(ang) * r
      const y = cy + Math.sin(ang) * r
      return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="spoke" />`
    })
    .join("")

  const dots = (co: "CYL" | "KRC" | "GZL") =>
    axes
      .map((b, i) => {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 4
        const v = computed.scenarios.S1[co].blocks[b] / 100
        const x = cx + Math.cos(ang) * r * v
        const y = cy + Math.sin(ang) * r * v
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" class="dot ${co.toLowerCase()}" />`
      })
      .join("")

  return `
    <svg class="radar" viewBox="0 0 320 300" role="img" aria-label="Blok profili">
      ${grid}
      ${spokes}
      <polygon points="${pts("CYL")}" class="poly cyl" />
      <polygon points="${pts("KRC")}" class="poly krc" />
      <polygon points="${pts("GZL")}" class="poly gzl" />
      ${dots("CYL")}${dots("KRC")}${dots("GZL")}
      ${labels}
    </svg>`
}
