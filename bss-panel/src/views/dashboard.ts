/**
 * dashboard.ts — Özet sayfası HTML’i.
 *
 * Bu dosya hesap yapmaz; engine.ts’nin ürettiği computed paketini
 * okuyup ekrana çevirir. main.ts sayfa “Özet” iken dashboardView() çağırır.
 *
 * Kısa sözlük (TypeScript / JavaScript):
 *   const x = ...  → x’e bir kez değer ver; sonra değişmez.
 *   let x = ...    → x sonradan değiştirilebilir.
 *   function f()   → iş yapan kutu. Çağırınca içindeki kod çalışır.
 *   return ...     → fonksiyonun dışarı verdiği sonuç. Burada çoğu yerde HTML metni.
 *   .map(...)      → listedeki her eleman için yeni bir değer üret (Excel’de her satıra formül gibi).
 *   .filter(...)   → listeden koşulu sağlayanları tut, diğerlerini at.
 *   .sort(...)     → listeyi sırala.
 *   .slice(0, 6)   → listenin ilk 6 elemanını al.
 *   .join("")      → dizi elemanlarını tek metinde birleştir.
 *   (x) => ...     → “ok fonksiyonu”: x gelince sağdaki işi yap.
 */

import type { Computed, Seed } from "../types"
import { BLOCKS, fmt } from "../lib/engine"
import { crBadge, esc } from "../lib/dom"
import { weightEditor } from "./weights"

/** İşletme kodu → CSS sınıfı (kart rengi). Record = “anahtar–değer sözlüğü”. */
const CO_CLASS: Record<string, string> = { CYL: "cyl", KRC: "krc", GZL: "gzl" }

/**
 * Özet sayfasının HTML metnini üretir.
 * seed: Excel’den gelen sabit liste (işletme, gösterge adları).
 * computed: o anki ağırlık ve puanlarla hesaplanmış BSS / blok / CR.
 */
export function dashboardView(seed: Seed, computed: Computed): string {
  // S1 = “Yeni AHP” senaryosu. s1.CYL.bss = Ceylanpınar’ın bütünleşik skoru.
  const s1 = computed.scenarios.S1
  // ranking.S1 = BSS’ye göre işletme sırası, örn. ["GZL","KRC","CYL"].
  const rank = computed.ranking.S1

  /**
   * Üç işletme kartının HTML’i.
   * seed.companies.map(...) her işletme için bir <article> üretir.
   * return `...` o kartın HTML’ini verir; map bitince üç parça .join("") ile yapıştırılır.
   */
  const cards = seed.companies
    .map((co) => {
      // co = o an işlenen işletme (id, name, region).
      const r = s1[co.id] // o işletmenin S1 sonucu: bss, ssCheck, blocks
      // indexOf sıradaki yeri 0’dan sayar; +1 ile 1., 2., 3. olur.
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
              // b = "E" | "S" | "G" | "FO". v = o bloğun 0–100 skoru.
              const v = r.blocks[b]
              // Çubuk genişliği yüzde: style="width:72%" gibi.
              return `<div class="mini b-${b}"><span>${b}</span><i style="width:${v}%"></i><b>${fmt(v, 1)}</b></div>`
            }).join("")}
          </div>
        </article>`
    })
    .join("")

  /**
   * “En büyük işletme farkları” listesi.
   *
   * Adımlar (Excel’de düşününce):
   *  1) Her gösterge için üç işletmenin 100’lük skorunu al (computed.scale).
   *  2) spread = en yüksek − en düşük (işletmeler arası açıklık).
   *  3) filter: spread ≥ 50 olanları tut (küçük farklar listelenmez).
   *  4) sort: büyük açıklıktan küçüğe.
   *  5) slice(0, 6): en fazla 6 satır.
   */
  const gaps = seed.indicators
    .map((ind) => {
      // sc = bu göstergenin Ceylanpınar / Karacabey / Gözlü 100’lük puanları.
      // Örnek: [0, 50, 100] → biri zayıf, biri orta, biri güçlü.
      const sc = [computed.scale[ind.id].CYL, computed.scale[ind.id].KRC, computed.scale[ind.id].GZL]
      // ...sc diziyi tek tek sayıya açar. max−min = açıklık.
      const spread = Math.max(...sc) - Math.min(...sc)
      // map’in return’ü: gösterge + açıklık. Sonraki filter bunu kullanır.
      return { ind, spread }
    })
    // x burada { ind, spread }. Koşul doğruysa satır kalır, yanlışsa atılır.
    .filter((x) => x.spread >= 50)
    // b.spread - a.spread > 0 ise b öne geçer (büyükten küçüğe).
    .sort((a, b) => b.spread - a.spread)
    .slice(0, 6)

  // Radar SVG metni (aşağıdaki radarSvg fonksiyonu).
  const radar = radarSvg(seed, computed)

  // Bu return dashboardView’in çıktısıdır: sayfanın tüm HTML’i.
  return `
    <header class="page-head">
      <div>
        <p class="eyebrow">Özet</p>
        <h1>Bütünleşik sürdürülebilirlik</h1>
        <p class="lede">Puan, AHP veya yerel ağırlığı değiştirdiğiniz anda BSS, blok skorları ve sıralama yenilenir.</p>
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
        <div class="legend chart-legend">
          ${seed.companies.map((c) => `<span class="lg ${CO_CLASS[c.id]}">${esc(c.name)}</span>`).join("")}
        </div>
      </article>
      <article class="panel">
        <div class="panel-h">
          <h3>Ana blok yerel ağırlıkları</h3>
          <span class="hint">Toplam %100 · Yeni AHP</span>
        </div>
        ${weightEditor(
          "blocks_new",
          BLOCKS.map((b) => seed.blocks.find((x) => x.id === b)?.name ?? b),
          BLOCKS.map((b) => computed.wBlockNew[b]),
        )}
        <p class="foot-note">Bir değeri değiştirince diğerleri orantılı ayarlanır. Makale seti: ${BLOCKS.map((b) => `${b} ${fmtPctSafe(computed.wBlockArt[b])}`).join(" · ")}</p>
      </article>
    </section>

    <section class="panel sub-weights">
      <div class="panel-h">
        <h3>Alt grup yerel ağırlıkları</h3>
        <span class="hint">Her blok kendi içinde %100</span>
      </div>
      <div class="sub-w-grid">
        ${seed.matrices
          // Sadece alt grup matrisleri (ana blok ve gösterge matrisleri değil).
          .filter((m) => m.kind === "subs")
          .map((m) => {
            const blockName = seed.blocks.find((b) => b.id === m.block)?.name ?? m.block ?? ""
            return `<div class="sub-w">
              <p class="sub-w-h">${esc(blockName)}</p>
              ${weightEditor(m.id, m.labels, computed.matrix[m.id].weights)}
            </div>`
          })
          .join("")}
      </div>
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
          // crAlerts boş değilse uyarı listesi; boşsa “hepsi tutarlı” yazısı.
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

/** 0,253 → "25,3%". n*100 ile orandan yüzdeye. */
function fmtPctSafe(n: number): string {
  return `${(n * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}%`
}

/**
 * 4 eksenli radar: E / S / G / FO.
 * Her eksende işletmenin blok skoru (0–100) merkeze uzaklığı belirler.
 * 100 → dairenin kenarı, 0 → merkez.
 *
 * Açı: ilk eksen yukarı (−90°), sonra her seferinde 90° (2π/4).
 * x = cx + cos(açı) * r * (skor/100)
 * y = cy + sin(açı) * r * (skor/100)
 */
function radarSvg(seed: Seed, computed: Computed): string {
  const cx = 160 // yatay merkez
  const cy = 150 // dikey merkez
  const r = 108 // tam skor (100) iken yarıçap
  const axes = BLOCKS

  // Bir işletmenin dört köşe noktasını "x,y x,y ..." metnine çevirir (SVG polygon).
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

  // 25 / 50 / 75 / 100 halkaları (ızgara).
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
