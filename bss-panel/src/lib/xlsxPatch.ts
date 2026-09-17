/**
 * xlsxPatch.ts — .xlsx aslında ZIP + XML’dir.
 * Bu dosya şablonu açar, hücre yazar, tekrar ZIP’ler.
 * Tez hesabı burada değil; sadece dosya formatı. Asıl sayı engine.ts’dedir.
 *
 * colA1(1)="A", colA1(27)="AA" — Excel sütun adı.
 * setNumber / setText XML içindeki <c r="M4"> hücresini değiştirir.
 * crc32 + zipStore: indirilen dosyanın ZIP bütünlüğü (Excel’in açabilmesi için).
 */
const enc = new TextEncoder()
const dec = new TextDecoder()

function styleAttr(attrs: string): string {
  const m = attrs.match(/\ss="[^"]*"/)
  return m ? m[0] : ""
}

function xmlText(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

/** 1 → A, 27 → AA. Excel sütun adı. 26’lık sayı sistemi (A=1 … Z=26). */
export function colA1(col: number): string {
  let n = col
  let s = ""
  while (n > 0) {
    const m = (n - 1) % 26 // 0=A … 25=Z
    s = String.fromCharCode(65 + m) + s // 65 = "A"
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function cellPattern(ref: string): RegExp {
  return new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>([\\s\\S]*?)</c>)`)
}

/** Hücreye sayı yaz (ör. M4 = 3). */
export function setNumber(xml: string, ref: string, value: number): string {
  const next = Number.isInteger(value) ? String(value) : String(value)
  const re = cellPattern(ref)
  if (!re.test(xml)) return xml
  return xml.replace(re, (_m, attrs: string) => {
    return `<c r="${ref}"${styleAttr(attrs)} t="n"><v>${next}</v></c>`
  })
}

export function setText(xml: string, ref: string, value: string): string {
  const re = cellPattern(ref)
  if (!re.test(xml)) return xml
  const t = xmlText(value)
  const space = /^\s|\s$|\n|\t/.test(value) ? ` xml:space="preserve"` : ""
  return xml.replace(re, (_m, attrs: string) => {
    return `<c r="${ref}"${styleAttr(attrs)} t="inlineStr"><is><t${space}>${t}</t></is></c>`
  })
}

export function sheetFiles(workbookXml: string, relsXml: string): Record<string, string> {
  const rels: Record<string, string> = {}
  for (const m of relsXml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const attrs = m[1]
    const id = attrs.match(/\bId="([^"]+)"/)?.[1]
    const target = attrs.match(/\bTarget="([^"]+)"/)?.[1]
    if (id && target) rels[id] = target
  }
  const out: Record<string, string> = {}
  for (const m of workbookXml.matchAll(/<sheet name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    let target = (rels[m[2]] ?? "").replace(/^\//, "")
    if (!target) continue
    if (!target.startsWith("xl/")) target = `xl/${target.replace(/^\.\.\//, "")}`
    out[m[1]] = target.replace(/\/{2,}/g, "/")
  }
  return out
}

export function patchWorkbookView(xml: string): string {
  return xml
    .replace(/firstSheet="\d+"/, 'firstSheet="21"')
    .replace(/<definedNames>[\s\S]*?<\/definedNames>/, "")
}

function u16le(n: number): Uint8Array {
  const b = new Uint8Array(2)
  new DataView(b.buffer).setUint16(0, n, true)
  return b
}

function u32le(n: number): Uint8Array {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, n, true)
  return b
}

function concat(parts: Uint8Array[]): Uint8Array {
  const n = parts.reduce((s, p) => s + p.length, 0)
  const out = new Uint8Array(n)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

function crc32(data: Uint8Array): number {
  let c = ~0
  for (let i = 0; i < data.length; i++) {
    c ^= data[i]
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
  }
  return ~c >>> 0
}

function zipStore(files: Record<string, Uint8Array>): Uint8Array {
  const now = new Date()
  const dosTime =
    ((now.getHours() & 31) << 11) | ((now.getMinutes() & 63) << 5) | (Math.floor(now.getSeconds() / 2) & 31)
  const dosDate =
    (((now.getFullYear() - 1980) & 127) << 9) | (((now.getMonth() + 1) & 15) << 5) | (now.getDate() & 31)

  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  const names = Object.keys(files).filter((n) => !n.endsWith("/"))

  for (const name of names) {
    const data = files[name]
    const nameBytes = enc.encode(name)
    const crc = crc32(data)
    const local = concat([
      u32le(0x04034b50),
      u16le(20),
      u16le(0x800),
      u16le(0),
      u16le(dosTime),
      u16le(dosDate),
      u32le(crc),
      u32le(data.length),
      u32le(data.length),
      u16le(nameBytes.length),
      u16le(0),
      nameBytes,
      data,
    ])
    locals.push(local)
    centrals.push(
      concat([
        u32le(0x02014b50),
        u16le(20),
        u16le(20),
        u16le(0x800),
        u16le(0),
        u16le(dosTime),
        u16le(dosDate),
        u32le(crc),
        u32le(data.length),
        u32le(data.length),
        u16le(nameBytes.length),
        u16le(0),
        u16le(0),
        u16le(0),
        u16le(0),
        u32le(0),
        u32le(offset),
        nameBytes,
      ]),
    )
    offset += local.length
  }

  const centralDir = concat(centrals)
  return concat([
    ...locals,
    centralDir,
    u32le(0x06054b50),
    u16le(0),
    u16le(0),
    u16le(names.length),
    u16le(names.length),
    u32le(centralDir.length),
    u32le(offset),
    u16le(0),
  ])
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(data.byteLength)
  new Uint8Array(copy).set(data)
  return copy
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([toArrayBuffer(data)]).stream().pipeThrough(new DecompressionStream("deflate-raw"))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function unzip(buf: Uint8Array): Promise<Record<string, Uint8Array>> {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const files: Record<string, Uint8Array> = {}
  let o = 0
  while (o + 30 <= buf.length) {
    const sig = view.getUint32(o, true)
    if (sig === 0x02014b50 || sig === 0x06054b50 || sig === 0x06064b50) break
    if (sig !== 0x04034b50) throw new Error("Excel şablonu okunamadı")
    const flags = view.getUint16(o + 6, true)
    const method = view.getUint16(o + 8, true)
    let comp = view.getUint32(o + 18, true)
    const nameLen = view.getUint16(o + 26, true)
    const extraLen = view.getUint16(o + 28, true)
    const name = dec.decode(buf.subarray(o + 30, o + 30 + nameLen)).replace(/\\/g, "/")
    let dataStart = o + 30 + nameLen + extraLen
    if (flags & 8) {
      throw new Error("Excel şablonu desteklenmeyen zip biçiminde")
    }
    const payload = buf.subarray(dataStart, dataStart + comp)
    if (!name.endsWith("/")) {
      if (method === 0 || payload.length === 0) files[name] = payload.slice()
      else if (method === 8) files[name] = await inflateRaw(payload)
      else throw new Error(`Zip sıkıştırma desteklenmiyor (${method})`)
    }
    o = dataStart + comp
  }
  return files
}

/** public/tez-sablon.xlsx dosyasını indirip ZIP olarak aç. */
export async function loadTemplateZip(): Promise<Record<string, Uint8Array>> {
  const url = `${import.meta.env.BASE_URL}tez-sablon.xlsx`
  const res = await fetch(url)
  if (!res.ok) throw new Error("Excel şablonu bulunamadı")
  return unzip(new Uint8Array(await res.arrayBuffer()))
}

export function saveTemplateZip(files: Record<string, Uint8Array>, filename: string): void {
  const out = zipStore(files)
  const blob = new Blob([toArrayBuffer(out)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function readXml(files: Record<string, Uint8Array>, path: string): string {
  const data = files[path] ?? files[`/${path}`] ?? files[path.replace(/^\//, "")]
  if (!data) throw new Error(`Şablonda ${path} yok`)
  return dec.decode(data)
}

export function writeXml(files: Record<string, Uint8Array>, path: string, xml: string): void {
  files[path] = enc.encode(xml)
}
