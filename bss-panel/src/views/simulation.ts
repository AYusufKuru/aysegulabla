/**
 * =============================================================================
 *  1000 İHTİMAL SAYFASI — SUNUM REHBERİ
 *  Dosya: views/simulation.ts
 * =============================================================================
 *
 *  Bu dosya ne işe yarar? (tek cümle)
 *    Kenar menüdeki “1000 ihtimal” ekranını çizer. Yani gördüğün kartlar,
 *    grafikler ve 1000 satırlık tablo buradan üretilir.
 *
 *  Hesap burada yapılmaz.
 *    Sayıları lib/simulation.ts üretir. Bu dosya sadece “şu sayıyı şu
 *    kutuya yaz” der. Renkler style.css’tedir.
 *
 *  Kim hangi dosyayı yazar?
 *    seed.json              Firma adları (Ceylanpınar, Karacabey, Gözlü)
 *    views/scoring.ts       Puanlama sayfası — 1–5 notlar orada girilir
 *    lib/store.ts           Girilen puanları tarayıcıda saklar
 *    lib/ahp.ts             Rastgele AHP ağırlığı (Tümü butonu ile aynı)
 *    lib/engine.ts          BSS / SS / blok hesabı (Excel satır 92–97)
 *    lib/simulation.ts      1000 kez rastgele dene, ortalama, σ, histogram
 *    lib/dom.ts             Yazıdaki özel karakterleri güvenli basar
 *    style.css              Renk, punto, boşluk
 *    main.ts                Sayfa açılınca bu fonksiyonu çağırır
 *
 *  Aşağıdaki tırnaklı metinler ekranda yazı olarak durur.
 *  ${...} içine girenler ise başka yerden gelen SAYILARDIR.
 *
 *  Fonksiyon sırası (sunumda yukarıdan aşağı anlat):
 *    simulationView  tüm sayfa
 *    talk            mavi açıklama kutusu
 *    statsTable      ortalama / σ / min / max tablosu
 *    scoreTable      1000 satırlık büyük liste
 *    histSvg         BSS dağılım grafiği
 *    winBars         kim kaç kez birinci
 *    blockBars       Çevre–Sosyal–Yönetişim–FO çubukları
 *    sparkSvg        BSS’nin 1000 denemedeki çizgisi
 *
 *  3 örnek Excel:
 *    Buton “3 örneği Excel indir”. Sayılar lib/simExport.ts.
 *    Denemeler 1, 500, 1000 (lib/simulation.ts sampleTrialNumbers).
 * =============================================================================
 */

import type { CompanyId, Seed, SimulationFirmScores, SimulationTrial } from "../types" // kalıplar
import { COMPANIES, fmt } from "../lib/engine" // ["CYL","KRC","GZL"] ve 72,50 yazımı
import {
  firstPlaceCounts, // kaç kez birinci
  histogram, // BSS kovaları
  sampleSeries, // her 10. BSS
  summarizeTrials, // min max ortalama σ
  TRIAL_COUNT, // 1000
} from "../lib/simulation"
import { esc } from "../lib/dom" // HTML kaçış

/** İşletme kodu → CSS rengi (cyl / krc / gzl). */
const CO_CLASS: Record<string, string> = { CYL: "cyl", KRC: "krc", GZL: "gzl" }

/**
 * 1000’lik tablonun kolon tanımı.
 * key   = SimulationFirmScores içindeki alan adı.
 * label = kısa başlık (FO, SS Sag. — uzun yazı kaydırıyordu).
 * title = fareyle üzerine gelince çıkan tam ad.
 */
const METRICS: { key: keyof SimulationFirmScores; label: string; title: string }[] = [
  { key: "bss", label: "BSS", title: "Özet BSS (satır 92)" },
  { key: "ss", label: "SS", title: "Senaryolar SS (satır 92)" },
  { key: "environment", label: "Çevre", title: "E blok skoru" },
  { key: "social", label: "Sosyal", title: "S blok skoru" },
  { key: "governance", label: "Yönetişim", title: "G blok skoru" },
  { key: "fo", label: "FO", title: "Finans ve Operasyon" },
  { key: "ssCheck", label: "SS Sag.", title: "SS Sağlama (satır 97)" },
]

/** İstatistik tablosundaki satır adları (uzun hali). */
const STAT_LABELS: Record<keyof SimulationFirmScores, string> = {
  bss: "BSS",
  ss: "SS",
  environment: "Çevre",
  social: "Sosyal",
  governance: "Yönetişim",
  fo: "Finans ve Operasyon",
  ssCheck: "SS Sağlama",
}

/** Blok ortalaması grafiğinde çizilecek dört eksen. */
const BLOCKS_CHART: { key: keyof SimulationFirmScores; label: string }[] = [
  { key: "environment", label: "Çevre" },
  { key: "social", label: "Sosyal" },
  { key: "governance", label: "Yönetişim" },
  { key: "fo", label: "FO" },
]

/**
 * Sayfanın tamamını ekrana yazar. main.ts burayı çağırır.
 *
 * Gelenler:
 *   seed    = Excel’den kopyalanmış firma listesi (seed.json)
 *   trials  = 1000 deneme. Henüz hesaplanmadıysa boş.
 *             Üreten yer: lib/simulation.ts → runThousandTrials
 *             Çağıran yer: main.ts
 *   busy    = “şu an hesaplıyorum” işareti. true ise buton kilitlenir.
 *
 * Ekranda sırayla ne çıkar?
 *   1) Üst başlık: “1000 rastgele ihtimal” ve “denemeyi üret” butonu
 *   2) Mavi kutular (01–08) — sunum cümleleri, talk() ile
 *   3) Üç firma kartı — ortalama BSS, min, max, σ
 *   4) Grafikler — dağılım, birinci payı, bloklar, seyir
 *   5) Tanımlayıcı istatistik tablosu
 *   6) 1000 satırlık deneme listesi
 */
export function simulationView(
  seed: Seed,
  trials: SimulationTrial[] | null,
  busy: boolean,
): string {
  // Deneme sayısı. trials yoksa 0. ?? 0 = “solda değer yoksa 0 yaz”.
  const count = trials?.length ?? 0

  // Bekleme kutusu. class sim-wait → style.css. busy ise .on (dönen halka).
  // TRIAL_COUNT lib/simulation.ts’de export const 1000.
  let body = `
    <!-- div: tam genişlik kutu. i: boş halka (CSS animasyonu). p: durum yazısı. -->
    <div class="sim-wait ${busy ? "on" : ""}">
      <i></i>
      <p>${busy ? `${TRIAL_COUNT} rastgele AHP dünyası hesaplanıyor…` : "Tablo henüz yok."}</p>
    </div>`

  // trials doluysa asıl içerik üretilir; boşsa yukarıdaki bekleme kutusu kalır.
  if (trials && trials.length) {
    // summary = her firma × her metrik için min / max / ortalama / σ
    const summary = summarizeTrials(trials)
    // wins = { CYL: 412, KRC: 301, GZL: 287 } gibi birinci sayıları
    const wins = firstPlaceCounts(trials)
    // allBss = üç firmanın 1000’er BSS’si, tek dizi (3000 sayı). Histogram ölçeği için.
    const allBss = COMPANIES.flatMap((co) => trials.map((t) => t.companies[co].bss))
    const lo = Math.min(...allBss) // tüm BSS’lerin en küçüğü
    const hi = Math.max(...allBss) // tüm BSS’lerin en büyüğü

    /**
     * Üç firma kartı.
     * .map her işletme için bir <article> üretir.
     * .join("") üç kartı yan yana yapıştırır.
     */
    const cards = seed.companies
      .map((c) => {
        const s = summary[c.id] // bu firmanın tüm metrik özeti
        const span = s.bss.max - s.bss.min || 1 // BSS açıklığı; 0 olmasın diye || 1
        // Şerit, global lo–hi skalasında konumlanır (üç kart aynı cetveli paylaşır).
        const left = ((s.bss.min - lo) / (hi - lo || 1)) * 100
        const width = (span / (hi - lo || 1)) * 100
        const meanX = ((s.bss.mean - lo) / (hi - lo || 1)) * 100
        const winPct = (wins[c.id] / trials.length) * 100 // birinci olma %
        return `
          <!-- article: tek firma kartı. class sim-card + cyl/krc/gzl → style.css renk -->
          <article class="sim-card ${CO_CLASS[c.id]}">
            <!-- header: üst satır. span = seed.json şirket adı. em = sabit etiket -->
            <header>
              <span>${esc(c.name)}</span>
              <em>BSS ortalama</em>
            </header>
            <!-- b: büyük sayı. s.bss.mean ← lib/simulation.ts summarizeTrials → minMaxMean -->
            <b>${fmt(s.bss.mean)}</b>
            <!-- sim-range: min–max şeridi. i = dolu kısım, em = ortalama çizgisi. konum JS’de hesaplandı. -->
            <div class="sim-range" title="min–max şeridi, çizgi ortalama">
              <i style="left:${left}%;width:${width}%"></i>
              <em style="left:${meanX}%"></em>
            </div>
            <!-- ul/li: dört istatistik. min max std ← summarizeTrials. 1.sıra ← firstPlaceCounts -->
            <ul>
              <li>min <strong>${fmt(s.bss.min)}</strong></li>
              <li>max <strong>${fmt(s.bss.max)}</strong></li>
              <li>σ <strong>${fmt(s.bss.std)}</strong></li>
              <li>1. sıra <strong>%${fmt(winPct, 1)}</strong></li>
            </ul>
          </article>`
      })
      .join("")

    // Gövdeyi kuruyoruz. ${talk(...)} mavi sunum kutusunu yapıştırır.
    // <h3>...</h3> panelin büyük başlığıdır (sabit yazı, hesap değil).
    // <span class="hint"> sağdaki küçük soluk yazıdır (yine sabit etiket).
    // ${histSvg / winBars / ...} o panelin grafiğini başka fonksiyondan getirir.
    body = `
      <!-- talk(): bu dosyada. <p class="sim-talk"> basar. Metin sabit, hesap değil. -->
      ${talk(
        "01",
        "Değerler nasıl oluşuyor?",
        "Puanlama sayfasındaki 1–5 skorlar sabit alınır. Her denemede AHP “Tümü” butonu gibi 19 matris rastgele ağırlık alır; engine.ts S1 ile BSS, SS, bloklar ve SS Sağlama hesaplanır. Kayıtlı AHP değişmez.",
      )}
      ${talk(
        "02",
        "Firma özeti",
        "1000 denemenin BSS ortalaması, min–max şeridi, standart sapması ve kaç kez birinci olduğu kartlarda toplanır.",
      )}
      <!-- section: kart grubu. cards yukarıda seed.companies döngüsünden. -->
      <section class="sim-cards">${cards}</section>
      <!-- section: grafik ızgarası (style.css .sim-charts) -->
      <section class="sim-charts">
        <!-- article.panel: beyaz kart. class panel → style.css (dashboard ile aynı kutu). -->
        <article class="panel sim-panel">
          <!-- panel-h: başlık satırı (h3 solda, hint sağda). -->
          <div class="panel-h">
            <!-- h3: panel başlığı. Metin sabit: “BSS dağılımı”. -->
            <h3>BSS dağılımı</h3>
            <!-- span.hint: soluk yardımcı yazı, style.css .hint. Sayı hesap değil, sabit etiket. -->
            <span class="hint">1000 deneme · 24 kova</span>
          </div>
          ${talk(
            "03",
            "Histogram",
            "Üç işletmenin 1000 BSS değeri 24 kovaya bölünür. Yüksek çubuk, o aralıkta daha çok deneme düştüğünü gösterir.",
          )}
          <!-- histSvg(): bu dosya. Kovalar lib/simulation.ts histogram(). BSS ← engine.compute S1. -->
          ${histSvg(seed, trials, lo, hi)}
        </article>
        <article class="panel sim-panel">
          <div class="panel-h">
            <h3>Birinci olma payı</h3>
            <span class="hint">En yüksek BSS</span>
          </div>
          ${talk(
            "04",
            "Sıralama sayımı",
            "Her denemede BSS’si en büyük işletme bir puan alır. Çubuk, 1000 dünyada birinci olma yüzdesidir.",
          )}
          <!-- winBars(): bu dosya. wins ← lib/simulation.ts firstPlaceCounts. -->
          ${winBars(seed, wins, trials.length)}
        </article>
        <article class="panel sim-panel sim-span">
          <div class="panel-h">
            <h3>Blok ortalamaları</h3>
            <span class="hint">Çevre · Sosyal · Yönetişim · FO</span>
          </div>
          ${talk(
            "05",
            "Senaryolar alt tablosu",
            "Özet’teki radar ve Senaryolar sayfasının E / S / G / FO satırlarıyla aynı blok skorlarıdır. Burada 1000 denemenin ortalaması çizilir.",
          )}
          <!-- blockBars(): bu dosya. summary[co].environment.mean ← summarizeTrials (lib/simulation.ts). -->
          ${blockBars(seed, summary)}
        </article>
        <article class="panel sim-panel sim-span">
          <div class="panel-h">
            <h3>BSS seyri</h3>
            <span class="hint">Her 10. deneme · üç işletme</span>
          </div>
          ${talk(
            "06",
            "Özet BSS’nin zaman çizgisi",
            "Özet sayfasındaki büyük BSS, 1000 rastgele ağırlık setinde nasıl oynar onu gösterir. Her 10. deneme alınır ki çizgi okunaklı kalsın.",
          )}
          <!-- sparkSvg(): bu dosya. Noktalar lib/simulation.ts sampleSeries. BSS ← Özet kartıyla aynı S1.bss. -->
          ${sparkSvg(seed, trials)}
        </article>
        <article class="panel sim-panel sim-span">
          <div class="panel-h">
            <!-- h3: üçüncü düzey başlık. Metin sabit, “Tanımlayıcı istatistik”. -->
            <h3>Tanımlayıcı istatistik</h3>
            <!-- hint: sağdaki küçük yazı. Ortalama/σ/min/max burada HESAPLANMAZ; sadece etiket.
                 Asıl sayılar aşağıda statsTable → summarizeTrials (lib/simulation.ts) → minMaxMean. -->
            <span class="hint">Ortalama · σ (Excel STDEV.S) · min · max</span>
          </div>
          ${talk(
            "07",
            "Sapma tablosu",
            "Her metrik için ortalama, örneklem standart sapması (n−1, Excel STDEV.S), min ve max hesaplanır. σ küçükse rastgele AHP o skoru az oynatır.",
          )}
          <!-- statsTable(): bu dosya. seed.companies ← seed.json. summary ← lib/simulation.ts. fmt ← lib/engine.ts. -->
          ${statsTable(seed, summary)}
        </article>
      </section>
      <article class="panel sim-table-panel">
        <div class="panel-h">
          <h3>Deneme tablosu</h3>
          <span class="hint">BSS = SS · satır 92–97</span>
        </div>
        ${talk(
          "08",
          "1000 satırlık liste",
          "Her satır bir rastgele AHP dünyasıdır. Kolonlar Özet BSS ile Senaryolar alt tablosundaki SS, Çevre, Sosyal, Yönetişim, FO ve SS Sağlama ile aynıdır. BSS ile SS aynı formüldür.",
        )}
        ${talk(
          "09",
          "3 örnek Excel",
          "1000 satırın hepsini tek tek açmak zor. İlk, orta ve son denemenin (1, 500, 1000) tüm değişkenleri Excel’e yazılır: 1–5 puan, rastgele AHP, yerel/global ağırlık, BSS katkısı. Sağ üstteki “3 örneği Excel indir” butonu.",
        )}
        <!-- scoreTable(): bu dosya. trials ← main.ts runThousandTrials (lib/simulation.ts).
             1–5 puan views/scoring.ts → store.ts state.scores. Ağırlık lib/ahp.ts randomUpper. -->
        ${scoreTable(seed, trials)}
      </article>`
  }

  // simulationView’in return’ü: başlık şeridi + yukarıda kurulan body.
  return `
    <!-- header.page-head: sayfa üst şeridi (style.css). Sol metin, sağ sayaç + buton. -->
    <header class="page-head">
      <div>
        <!-- p.eyebrow: küçük mavi üst yazı, sabit. -->
        <p class="eyebrow">Monte Carlo</p>
        <!-- h1: sayfa başlığı. TRIAL_COUNT ← lib/simulation.ts export const. -->
        <h1>${TRIAL_COUNT} rastgele ihtimal</h1>
        <!-- p.lede: giriş cümlesi, sabit. -->
        <p class="lede">Sunum notları her grafiğin üstündedir. 1–5 puan Puanlama’dan gelir; ağırlıklar her satırda rastgele üretilir.</p>
      </div>
      <!-- head-meta: sağdaki üç kutu. count = trials.length (main.ts’de üretilen dizi). -->
      <div class="head-meta">
        <div><b>${count || "—"}</b><span>deneme</span></div>
        <div><b>3</b><span>işletme</span></div>
        <div class="sim-actions">
          <!-- button#sim-run: tıklanınca main.ts simTrials’ı sıfırlar, runThousandTrials yeniden çalışır. -->
          <button type="button" class="sim-run" id="sim-run" ${busy ? "disabled" : ""}>${busy ? "Hesaplanıyor…" : `${TRIAL_COUNT} denemeyi üret`}</button>
          <!-- button#sim-sample-dl: 1, 500, 1000 numaralı denemenin tüm değişkenlerini Excel indirir (lib/simExport.ts). -->
          <button type="button" class="sim-dl" id="sim-sample-dl" ${busy || !count ? "disabled" : ""}>3 örneği Excel indir</button>
        </div>
      </div>
    </header>
    ${body}
  `
}

/**
 * Ekranda mavi bir açıklama kutusu basar.
 * no = “01”, title = kısa başlık, text = sunum cümlesi.
 * Hepsi sabit metindir; başka dosyadan sayı çekmez.
 * esc: lib/dom.ts — tırnak ve özel harfler sayfayı bozmasın diye.
 */
function talk(no: string, title: string, text: string): string {
  // p.sim-talk: mavi kutu (style.css). b = numara, strong = başlık, geri kalan cümle.
  // esc ← lib/dom.ts ( < > & tırnak kırılmasın).
  return `<p class="sim-talk"><b>${esc(no)}</b><span><strong>${esc(title)}</strong> ${esc(text)}</span></p>`
}

/**
 * “Tanımlayıcı istatistik” tablosunu çizer.
 *
 * Excel gibi düşünün: satırlar göstergeler (BSS, SS, Çevre…),
 * sütunlar üç firma ve her birinde Ort. / σ / Min / Max.
 *
 * Firma adları ........ seed.json (seed.companies)
 * Ort. σ Min Max sayıları ... lib/simulation.ts → summarizeTrials → minMaxMean
 * Sayıyı 72,50 yazmak ... lib/engine.ts → fmt
 * Satırın Türkçe adı ...... STAT_LABELS (bu dosyada, biraz yukarıda)
 *
 * headCos   = üstteki firma adları (her ad 4 sütunu kaplar)
 * headStats = Ort. σ Min Max yazıları (üç kez tekrar)
 * rows      = 7 gösterge × 12 sayı
 */
function statsTable(seed: Seed, summary: ReturnType<typeof summarizeTrials>): string {
  // Firma adı, 4 istatistik kolonunu kaplar.
  const headCos = seed.companies
    .map((c) => `<th class="${CO_CLASS[c.id]}" colspan="4">${esc(c.name)}</th>`)
    .join("")
  // Her firma için dört alt başlık. c sadece CSS rengi için.
  const headStats = seed.companies
    .map(
      (c) =>
        `<th class="${CO_CLASS[c.id]}">Ort.</th><th class="${CO_CLASS[c.id]}">σ</th><th class="${CO_CLASS[c.id]}">Min</th><th class="${CO_CLASS[c.id]}">Max</th>`,
    )
    .join("")
  // Dış map: 7 gösterge satırı. İç map: 3 firma hücresi.
  const rows = METRICS.map((m) => {
    const cells = COMPANIES.map((co) => {
      const s = summary[co][m.key] // örn. summary.CYL.bss → { mean, std, min, max }
      return `<td>${fmt(s.mean)}</td><td class="sim-std">${fmt(s.std)}</td><td>${fmt(s.min)}</td><td>${fmt(s.max)}</td>`
    }).join("")
    return `<tr><th>${esc(STAT_LABELS[m.key])}</th>${cells}</tr>`
  }).join("")
  return `
    <!-- table-wrap: taşanı kaydırır (style.css). table.sim-stat: istatistik tablosu. -->
    <div class="table-wrap">
      <table class="sim-stat">
        <!-- thead: iki başlık satırı. rowspan=2 ilk hücre iki satırı kaplar. -->
        <thead>
          <tr>
            <th rowspan="2">Gösterge</th>
            <!-- headCos: firma adları, seed.json companies, her biri 4 kolon (Ort σ Min Max). -->
            ${headCos}
          </tr>
          <tr>${headStats}</tr>
        </thead>
        <!-- tbody: 7 satır. Sayılar summary.mean/std/min/max ← lib/simulation.ts minMaxMean.
             fmt ← lib/engine.ts (Türkçe 72,50). STAT_LABELS bu dosyada. -->
        <tbody>${rows}</tbody>
      </table>
    </div>`
}

/**
 * 1000 satırlık büyük liste. Sayfanın asıl veri tablosu.
 *
 * Her satır = “AHP ağırlıklarını rastgele at, BSS’yi bir kez hesapla”.
 * 1000 satır = aynı iş 1000 kez.
 *
 * Sütunlar (soldan sağa):
 *   #  sonra Ceylanpınar’ın 7 sayısı, Karacabey’in 7’si, Gözlü’nün 7’si.
 *   7 sayı: BSS, SS, Çevre, Sosyal, Yönetişim, FO, SS Sağlama
 *   BSS ile SS aynı formüldür (Excel satır 92). İki ad, tek sonuç.
 *
 * Sayılar nereden?
 *   1–5 puan ........ Puanlama sayfası (views/scoring.ts → lib/store.ts)
 *   AHP ağırlığı .... lib/ahp.ts (rastgele), lib/simulation.ts toplar
 *   BSS / blok ...... lib/engine.ts compute
 *   Satıra çevirme .. lib/simulation.ts packFirm
 *   1000’lik dizi ... lib/simulation.ts runThousandTrials (main.ts çağırır)
 *   Firma adları .... seed.json
 */
function scoreTable(seed: Seed, trials: SimulationTrial[]): string {
  // <col> etiketleri: önce # sütunu, sonra 3 firma × 7 metrik = 21 sütun.
  // İç map METRICS kadar <col class="sim-col"> basar; dış map bunu 3 kez tekrarlar.
  const colgroup = `<colgroup><col class="sim-col-n" />${seed.companies
    .map(
      () => METRICS.map(() => `<col class="sim-col" />`).join(""),
    )
    .join("")}</colgroup>`

  // Üst başlık: firma adı, 7 metriği birden kaplar (colspan).
  const headCompanies = seed.companies
    .map(
      (c) =>
        `<th class="sim-co ${CO_CLASS[c.id]}" colspan="${METRICS.length}">${esc(c.name)}</th>`,
    )
    .join("")

  // Alt başlık: her firmanın 7 kısa etiketi.
  // ci > 0 && mi === 0 → Karacabey ve Gözlü’nün ilk kolonuna dikey ayırıcı (sim-split).
  const headMetrics = seed.companies
    .map((c, ci) =>
      METRICS.map(
        (m, mi) =>
          `<th class="sim-metric ${CO_CLASS[c.id]}${ci > 0 && mi === 0 ? " sim-split" : ""}" title="${esc(m.title)}">${esc(m.label)}</th>`,
      ).join(""),
    )
    .join("")

  // Gövde matrisi: 1000 satır.
  // t = bir deneme { n, companies: { CYL, KRC, GZL } }
  // r = o denemede o firmanın 7 sayısı
  // r[m.key] = örn. r.bss, r.environment
  const rows = trials
    .map((t) => {
      const cells = COMPANIES.map((co, ci) => {
        const r = t.companies[co]
        return METRICS.map(
          (m, mi) =>
            `<td class="${CO_CLASS[co]}${ci > 0 && mi === 0 ? " sim-split" : ""}">${fmt(r[m.key])}</td>`,
        ).join("")
      }).join("")
      return `<tr><th>${t.n}</th>${cells}</tr>`
    })
    .join("")

  return `
    <!-- sim-wrap: 1000 satırı kaydırılabilir kutu. table.sim-table: asıl veri matrisi. -->
    <div class="table-wrap sim-wrap">
      <table class="sim-table">
        <!-- colgroup: sütun genişlikleri. # = sim-col-n, diğerleri sim-col (style.css). -->
        ${colgroup}
        <thead>
          <tr>
            <!-- th.sim-n rowspan=2: deneme numarası, iki başlık satırını kaplar. -->
            <th rowspan="2" class="sim-n">#</th>
            <!-- headCompanies: Ceylanpınar / Karacabey / Gözlü — seed.json, her biri 7 kolon. -->
            ${headCompanies}
          </tr>
          <!-- headMetrics: BSS SS Çevre … METRICS bu dosyada. title = tam ad (fare ipucu). -->
          <tr>${headMetrics}</tr>
        </thead>
        <!-- tbody: 1000 <tr>. t.n deneme no. Hücreler t.companies[co][metric]
             ← packFirm (lib/simulation.ts) ← engine.ts compute S1. -->
        <tbody>${rows}</tbody>
      </table>
    </div>`
}

/**
 * BSS dağılım grafiği (histogram).
 * Düşünce: 1000 BSS’yi 24 rafa koy. Hangi rafta daha çok deneme varsa
 * o çubuk daha uzun. Üç firma yan yana, aynı ölçekte.
 *
 * Kovaları sayan fonksiyon: lib/simulation.ts → histogram
 * BSS’nin kendisi:          lib/engine.ts → compute (S1)
 * lo / hi (en küçük / büyük): bu dosyada, üç firmanın tüm BSS’lerinden
 */
function histSvg(seed: Seed, trials: SimulationTrial[], lo: number, hi: number): string {
  const bins = 24
  const series = COMPANIES.map((co) => ({
    co,
    h: histogram(
      trials.map((t) => t.companies[co].bss), // bu firmanın 1000 BSS’si
      bins,
      lo,
      hi,
    ),
  }))
  const peak = Math.max(...series.flatMap((s) => s.h.counts), 1)
  const w = 520 // svg genişliği
  const ht = 168 // svg yüksekliği
  const pad = { l: 8, r: 8, t: 10, b: 28 } // kenar boşlukları
  const iw = w - pad.l - pad.r // çizilebilir iç genişlik
  const ih = ht - pad.t - pad.b // çizilebilir iç yükseklik
  const bw = iw / bins // bir kovanın taban genişliği
  const bars = series
    .map((s, si) =>
      s.h.counts
        .map((c, i) => {
          const bh = (c / peak) * ih // çubuk boyu
          const x = pad.l + i * bw + si * (bw / 3.4) + 1 // kova + firma kayması
          const y = pad.t + ih - bh // SVG’de y yukarıdan ölçülür
          return `<rect class="sim-h ${s.co.toLowerCase()}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw / 3.6).toFixed(1)}" height="${bh.toFixed(1)}" rx="1.2" />`
        })
        .join(""),
    )
    .join("")
  return `
    <!-- svg: vektör tuval. viewBox ölçüleri w×ht. rect çubukları bars’tan.
         histogram() ← lib/simulation.ts. lo/hi bu dosyada allBss min/max. -->
    <svg class="sim-svg" viewBox="0 0 ${w} ${ht}" role="img" aria-label="BSS dağılımı">
      ${bars}
      <!-- text.sim-axis: alt ölçek yazıları. fmt ← lib/engine.ts. -->
      <text x="${pad.l}" y="${ht - 8}" class="sim-axis">${fmt(lo, 0)}</text>
      <text x="${w / 2}" y="${ht - 8}" class="sim-axis" text-anchor="middle">BSS</text>
      <text x="${w - pad.r}" y="${ht - 8}" class="sim-axis" text-anchor="end">${fmt(hi, 0)}</text>
    </svg>
    <!-- legend: renk anahtarı. c.name ← seed.json. .lg.cyl rengi style.css. -->
    <div class="legend">${seed.companies.map((c) => `<span class="lg ${CO_CLASS[c.id]}">${esc(c.name)}</span>`).join("")}</div>`
}

/**
 * “Birinci olma payı” çubukları.
 * Her denemede BSS’si en yüksek işletme 1 puan alır.
 * Sayımı yapan: lib/simulation.ts → firstPlaceCounts
 * Firma adı: seed.json
 */
function winBars(seed: Seed, wins: Record<CompanyId, number>, total: number): string {
  return `<div class="sim-wins">${seed.companies
    .map((c) => {
      const pct = (wins[c.id] / total) * 100
      return `
        <!-- sim-win: bir firma satırı. i width = yüzde (CSS çubuğu). -->
        <div class="sim-win ${CO_CLASS[c.id]}">
          <span>${esc(c.name)}</span>
          <div class="sim-win-track"><i style="width:${pct.toFixed(1)}%"></i></div>
          <b>${wins[c.id]}</b>
          <small>%${fmt(pct, 1)}</small>
        </div>`
    })
    .join("")}</div>`
}

/**
 * Çevre / Sosyal / Yönetişim / FO ortalama çubukları.
 * Senaryolar sayfasının alt tablosuyla aynı dört skor; burada 1000
 * denemenin ORTALAMASI çizilir.
 *
 * Yükseklik: summary[firma][blok].mean
 *            ← lib/simulation.ts summarizeTrials
 */
function blockBars(
  seed: Seed,
  summary: ReturnType<typeof summarizeTrials>,
): string {
  const w = 640
  const ht = 188
  const pad = { l: 36, r: 12, t: 12, b: 28 }
  const groups = BLOCKS_CHART.length // 4
  const gw = (w - pad.l - pad.r) / groups // bir grup genişliği
  const barW = 16 // tek çubuk eni
  const gap = 6 // çubuklar arası
  const cluster = COMPANIES.length * barW + (COMPANIES.length - 1) * gap
  const ih = ht - pad.t - pad.b
  const rects = BLOCKS_CHART.map((b, gi) => {
    const gx = pad.l + gi * gw + (gw - cluster) / 2 // grubu ortaya al
    const bars = COMPANIES.map((co, ci) => {
      const v = summary[co][b.key].mean
      const bh = (v / 100) * ih
      const x = gx + ci * (barW + gap)
      const y = pad.t + ih - bh
      return `<rect class="sim-h ${co.toLowerCase()}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW}" height="${bh.toFixed(1)}" rx="3">
        <title>${esc(seed.companies.find((c) => c.id === co)?.name ?? co)} ${esc(b.label)} ${fmt(v)}</title>
      </rect>`
    }).join("")
    const labelX = pad.l + gi * gw + gw / 2
    return `${bars}<text x="${labelX.toFixed(1)}" y="${ht - 8}" class="sim-axis" text-anchor="middle">${esc(b.label)}</text>`
  }).join("")
  // Yatay ızgara: 25, 50, 75, 100 çizgileri (skala 0–100).
  const grid = [25, 50, 75, 100]
    .map((g) => {
      const y = pad.t + ih - (g / 100) * ih
      return `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" class="sim-grid" /><text x="${pad.l - 6}" y="${y + 3}" class="sim-axis" text-anchor="end">${g}</text>`
    })
    .join("")
  return `
    <!-- svg: 4 blok grubu. grid = 25/50/75/100 çizgileri. rects = 4×3 çubuk.
         Yükseklik summary[co][blok].mean ← lib/simulation.ts summarizeTrials. -->
    <svg class="sim-svg" viewBox="0 0 ${w} ${ht}" role="img" aria-label="Blok ortalamaları">
      ${grid}
      ${rects}
    </svg>
    <div class="legend">${seed.companies.map((c) => `<span class="lg ${CO_CLASS[c.id]}">${esc(c.name)}</span>`).join("")}</div>`
}

/**
 * BSS seyri: Özet sayfasındaki büyük BSS, 1000 rastgele ağırlıkta
 * nasıl oynuyor, onu çizgiyle gösterir.
 * 1000 nokta kalabalık durur; her 10. deneme alınır (~100 nokta).
 *
 * Noktaları seyrelten: lib/simulation.ts → sampleSeries
 */
function sparkSvg(seed: Seed, trials: SimulationTrial[]): string {
  const w = 640
  const ht = 148
  const pad = { l: 8, r: 8, t: 10, b: 18 }
  const iw = w - pad.l - pad.r
  const ih = ht - pad.t - pad.b
  const series = COMPANIES.map((co) => sampleSeries(trials, co, 10))
  const all = series.flat()
  const min = Math.min(...all)
  const max = Math.max(...all)
  const span = max - min || 1
  const n = series[0].length
  if (n < 2) return `<p class="empty">Yeterli deneme yok.</p>`
  const paths = series
    .map((vals, si) => {
      const d = vals
        .map((v, i) => {
          const x = pad.l + (i / (n - 1)) * iw
          const y = pad.t + ih - ((v - min) / span) * ih
          return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
        })
        .join(" ")
      const co = COMPANIES[si]
      return `<path class="sim-spark ${co.toLowerCase()}" d="${d}" fill="none" />`
    })
    .join("")
  return `
    <!-- svg: üç path (CYL/KRC/GZL). sampleSeries ← lib/simulation.ts (her 10. deneme).
         chart-legend: kehribar / mavi / teal (style.css --chart-*). -->
    <svg class="sim-svg" viewBox="0 0 ${w} ${ht}" role="img" aria-label="BSS seyri">
      ${paths}
    </svg>
    <div class="legend chart-legend">${seed.companies.map((c) => `<span class="lg ${CO_CLASS[c.id]}">${esc(c.name)}</span>`).join("")}</div>`
}
