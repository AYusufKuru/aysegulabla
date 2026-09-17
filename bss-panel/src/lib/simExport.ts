/**
 * simExport.ts — 1000 denemenin 3 örneğini Excel’e yazar.
 *
 * Hangi 3 deneme?  lib/simulation.ts → sampleTrialNumbers → 1, 500, 1000
 * Sayılar nereden? Aynı denemenin rastgele AHP’si + Puanlama’daki 1–5.
 * Ekran çizmez. İndirme butonunu main.ts bağlar.
 *
 * Sayfalar:
 *   Okuma              bu dosyayı nasıl okursun
 *   Ozet               üç firmanın BSS / SS / blok / SS Sağlama
 *   AnaBlok            E S G FO ağırlıkları (S1)
 *   AltGrup            alt grup yerel ağırlıkları
 *   Gostergeler        88 göstergenin tüm ara değişkenleri
 *   AHP_Agirlik        19 matrisin yerel ağırlık + CR
 *   AHP_Matris         her karşılaştırma hücresi a_ij
 */
import type { AppState, CompanyId, Seed, SimulationSample } from "../types"
import { buildFull } from "./ahp"
import { COMPANIES, compute } from "./engine"
import { colA1, saveTemplateZip } from "./xlsxPatch"

type Cell = string | number | null
type Sheet = { name: string; rows: Cell[][] }

const enc = new TextEncoder()

function xmlText(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function sheetXml(rows: Cell[][]): string {
  const body = rows
    .map((row, ri) => {
      const r = ri + 1
      const cells = row
        .map((v, ci) => {
          if (v === null || v === undefined || v === "") return ""
          const ref = `${colA1(ci + 1)}${r}`
          if (typeof v === "number") {
            const n = Number.isFinite(v) ? v : 0
            return `<c r="${ref}" t="n"><v>${n}</v></c>`
          }
          return `<c r="${ref}" t="inlineStr"><is><t>${xmlText(String(v))}</t></is></c>`
        })
        .join("")
      return `<row r="${r}">${cells}</row>`
    })
    .join("")
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border/></borders>
  <cellStyleXfs count="1"><xf/></cellStyleXfs>
  <cellXfs count="1"><xf/></cellXfs>
</styleSheet>`

function workbookFiles(sheets: Sheet[]): Record<string, Uint8Array> {
  const sheetRels = sheets
    .map((_, i) => {
      const id = i + 1
      return `<Relationship Id="rId${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${id}.xml"/>`
    })
    .join("")
  const stylesId = sheets.length + 1
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRels}<Relationship Id="rId${stylesId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`

  const wbSheets = sheets
    .map((s, i) => `<sheet name="${xmlText(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join("")
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${wbSheets}</sheets></workbook>`

  const overrides = sheets
    .map((_, i) => {
      const id = i + 1
      return `<Override PartName="/xl/worksheets/sheet${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    })
    .join("")
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${overrides}
</Types>`

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": enc.encode(types),
    "_rels/.rels": enc.encode(rootRels),
    "xl/workbook.xml": enc.encode(workbook),
    "xl/_rels/workbook.xml.rels": enc.encode(wbRels),
    "xl/styles.xml": enc.encode(STYLES_XML),
  }
  sheets.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = enc.encode(sheetXml(s.rows))
  })
  return files
}

function coName(seed: Seed, id: CompanyId): string {
  return seed.companies.find((c) => c.id === id)?.name ?? id
}

function blockName(seed: Seed, id: string): string {
  return seed.blocks.find((b) => b.id === id)?.name ?? id
}

function subName(seed: Seed, id: string): string {
  return seed.subgroups.find((s) => s.id === id)?.name ?? id
}

/** 3 örnek denemenin tüm ara değişkenlerini Excel sayfalarına dizer. */
export function buildSampleSheets(seed: Seed, live: AppState, samples: SimulationSample[]): Sheet[] {
  const okuma: Cell[][] = [
    ["1000 ihtimal — 3 örnek deneme"],
    ["Bu dosya, o an üretilen 1000 denemenin ilk / orta / son satırıdır (1, 500, 1000). Yeni zar atılmaz."],
    ["1–5 puan üç denemede de aynıdır (Puanlama sayfası). Değişen tek şey rastgele AHP ağırlıklarıdır."],
    ["Hesap S1 (Yeni AHP) ile yapılır: BSS = SS = Excel satır 92, bloklar 93–96, SS Sağlama 97."],
    [],
    ["Sayfa", "İçinde ne var"],
    ["Ozet", "Her deneme × her firma: BSS, SS, Çevre, Sosyal, Yönetişim, FO, SS Sağlama, sıra"],
    ["AnaBlok", "S1 ana blok ağırlıkları (E/S/G/FO), λmax, CI, CR"],
    ["AltGrup", "Alt grup yerel ağırlıkları (blok içinde toplamı 1)"],
    ["Gostergeler", "88 gösterge: 1–5, 100’lük, yerel, global, BSS katkısı, blok katkısı"],
    ["AHP_Agirlik", "19 matrisin her satır etiketi için yerel ağırlık + tutarlılık"],
    ["AHP_Matris", "Her karşılaştırmanın a_ij değeri (köşegen 1, alt üçgen 1/üst)"],
    [],
    ["Deneme no", ...samples.map((s) => s.n)],
  ]

  const ozet: Cell[][] = [
    [
      "Deneme",
      "FirmaKodu",
      "Firma",
      "BSS",
      "SS",
      "Cevre",
      "Sosyal",
      "Yonetisim",
      "FO",
      "SS_Saglama",
      "Sira",
    ],
  ]
  const anaBlok: Cell[][] = [
    ["Deneme", "W_Cevre", "W_Sosyal", "W_Yonetisim", "W_FO", "lambdaMax", "CI", "CR", "Tutarli"],
  ]
  const altGrup: Cell[][] = [["Deneme", "BlokKodu", "Blok", "AltGrupId", "AltGrup", "YerelAgirlik"]]
  const gostergeler: Cell[][] = [
    [
      "Deneme",
      "GostergeNo",
      "Kod",
      "Ad",
      "Blok",
      "AltGrup",
      "CYL_1_5",
      "KRC_1_5",
      "GZL_1_5",
      "CYL_100luk",
      "KRC_100luk",
      "GZL_100luk",
      "W_AnaBlok",
      "W_AltGrup",
      "W_Gosterge",
      "YerelAgirlik",
      "GlobalAgirlik",
      "CYL_BSS_katki",
      "KRC_BSS_katki",
      "GZL_BSS_katki",
      "CYL_blok_katki",
      "KRC_blok_katki",
      "GZL_blok_katki",
    ],
  ]
  const ahpAgirlik: Cell[][] = [
    [
      "Deneme",
      "MatrisId",
      "MatrisAd",
      "Tur",
      "n",
      "lambdaMax",
      "CI",
      "CR",
      "Tutarli",
      "Sira",
      "Etiket",
      "YerelAgirlik",
    ],
  ]
  const ahpMatris: Cell[][] = [
    ["Deneme", "MatrisId", "MatrisAd", "SatirNo", "SutunNo", "SatirEtiket", "SutunEtiket", "a_ij"],
  ]

  for (const sample of samples) {
    const computed = compute(seed, {
      scores: live.scores,
      comments: live.comments,
      matrices: sample.matrices,
    })
    const s1 = computed.scenarios.S1
    const rank = computed.ranking.S1
    const blocksAh = computed.matrix.blocks_new

    for (const co of COMPANIES) {
      const r = s1[co]
      ozet.push([
        sample.n,
        co,
        coName(seed, co),
        r.bss,
        r.bss,
        r.blocks.E,
        r.blocks.S,
        r.blocks.G,
        r.blocks.FO,
        r.ssCheck,
        rank.indexOf(co) + 1,
      ])
    }

    anaBlok.push([
      sample.n,
      computed.wBlockNew.E,
      computed.wBlockNew.S,
      computed.wBlockNew.G,
      computed.wBlockNew.FO,
      blocksAh.lambdaMax,
      blocksAh.ci,
      blocksAh.cr,
      blocksAh.consistent ? "evet" : "hayir",
    ])

    for (const sub of seed.subgroups) {
      altGrup.push([
        sample.n,
        sub.block,
        blockName(seed, sub.block),
        sub.id,
        sub.name,
        computed.wSub[sub.id] ?? 0,
      ])
    }

    for (const ind of seed.indicators) {
      const sc = live.scores[ind.id] ?? ind.scores
      const scale = computed.scale[ind.id]
      const wBlock = computed.wBlockNew[ind.block]
      const wSub = computed.wSub[ind.subId] ?? 0
      const wInd = computed.wInd[ind.id] ?? 0
      const local = wSub * wInd
      const global = wBlock * local
      gostergeler.push([
        sample.n,
        ind.id,
        ind.code,
        ind.name,
        blockName(seed, ind.block),
        subName(seed, ind.subId),
        sc.CYL,
        sc.KRC,
        sc.GZL,
        scale.CYL,
        scale.KRC,
        scale.GZL,
        wBlock,
        wSub,
        wInd,
        local,
        global,
        scale.CYL * global,
        scale.KRC * global,
        scale.GZL * global,
        scale.CYL * local,
        scale.KRC * local,
        scale.GZL * local,
      ])
    }

    for (const m of seed.matrices) {
      const ah = computed.matrix[m.id]
      const upper = sample.matrices[m.id] ?? m.upper
      const full = buildFull(upper)
      for (let i = 0; i < m.labels.length; i++) {
        ahpAgirlik.push([
          sample.n,
          m.id,
          m.title,
          m.kind,
          ah.n,
          ah.lambdaMax,
          ah.ci,
          ah.cr,
          ah.consistent ? "evet" : "hayir",
          i + 1,
          m.labelsFull[i] ?? m.labels[i],
          ah.weights[i] ?? 0,
        ])
      }
      for (let i = 0; i < full.length; i++) {
        for (let j = 0; j < full[i].length; j++) {
          ahpMatris.push([
            sample.n,
            m.id,
            m.title,
            i + 1,
            j + 1,
            m.labelsFull[i] ?? m.labels[i],
            m.labelsFull[j] ?? m.labels[j],
            full[i][j],
          ])
        }
      }
    }
  }

  return [
    { name: "Okuma", rows: okuma },
    { name: "Ozet", rows: ozet },
    { name: "AnaBlok", rows: anaBlok },
    { name: "AltGrup", rows: altGrup },
    { name: "Gostergeler", rows: gostergeler },
    { name: "AHP_Agirlik", rows: ahpAgirlik },
    { name: "AHP_Matris", rows: ahpMatris },
  ]
}

/** Tarayıcıda .xlsx indir. Dosya adı tarihlidir. */
export function downloadSampleTrials(seed: Seed, live: AppState, samples: SimulationSample[]): void {
  if (!samples.length) return
  const sheets = buildSampleSheets(seed, live, samples)
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")
  const ns = samples.map((s) => s.n).join("-")
  saveTemplateZip(workbookFiles(sheets), `bss-1000-ornek-deneme-${ns}-${stamp}.xlsx`)
}
