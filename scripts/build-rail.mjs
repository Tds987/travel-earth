// Build the train layers from MLIT N02 railway data (国土数値情報 鉄道データ, 2024).
//
//   node scripts/build-rail.mjs <dir containing sections.json, stations.json>
//
// Source JSON: https://github.com/braylon-jamon-dunn/mlit-json (processed N02-2024).
// Output: public/rail/{shinkansen,jr,other}.json, loaded only when the Trains layer is on.
// Data credit (required by MLIT terms): 「国土数値情報（鉄道データ）」（国土交通省）
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2]
if (!dir) throw new Error('Usage: node scripts/build-rail.mjs <mlit-json data dir>')
const sections = JSON.parse(readFileSync(join(dir, 'sections.json'), 'utf8'))
const stations = JSON.parse(readFileSync(join(dir, 'stations.json'), 'utf8'))
const out = new URL('../public/rail/', import.meta.url)
mkdirSync(out, { recursive: true })

const JR_OPERATORS = {
  北海道旅客鉄道: 'JR Hokkaido',
  東日本旅客鉄道: 'JR East',
  東海旅客鉄道: 'JR Central',
  西日本旅客鉄道: 'JR West',
  四国旅客鉄道: 'JR Shikoku',
  九州旅客鉄道: 'JR Kyushu',
}

const OPERATORS = {
  ...JR_OPERATORS,
  東京地下鉄: 'Tokyo Metro',
  東京都: 'Toei (Tokyo)',
  大阪市高速電気軌道: 'Osaka Metro',
  京都市: 'Kyoto Municipal Subway',
  福岡市: 'Fukuoka City Subway',
  札幌市: 'Sapporo Municipal Subway',
  名古屋市: 'Nagoya Municipal Subway',
  横浜市: 'Yokohama Municipal Subway',
  神戸市: 'Kobe Municipal Subway',
  仙台市: 'Sendai City Subway',
  阪急電鉄: 'Hankyu',
  阪神電気鉄道: 'Hanshin',
  京阪電気鉄道: 'Keihan',
  近畿日本鉄道: 'Kintetsu',
  南海電気鉄道: 'Nankai',
  小田急電鉄: 'Odakyu',
  京王電鉄: 'Keio',
  東急電鉄: 'Tokyu',
  西武鉄道: 'Seibu',
  東武鉄道: 'Tobu',
  京成電鉄: 'Keisei',
  京浜急行電鉄: 'Keikyu',
  相模鉄道: 'Sotetsu',
  名古屋鉄道: 'Meitetsu',
  西日本鉄道: 'Nishitetsu',
  広島電鉄: 'Hiroden (Hiroshima trams)',
  江ノ島電鉄: 'Enoden',
  箱根登山鉄道: 'Hakone Tozan Railway',
  富士山麓電気鉄道: 'Fujikyu Railway',
  叡山電鉄: 'Eizan Railway',
  京福電気鉄道: 'Randen (Keifuku)',
  嵯峨野観光鉄道: 'Sagano Scenic Railway',
  沖縄都市モノレール: 'Yui Rail (Okinawa monorail)',
  東京モノレール: 'Tokyo Monorail',
  ゆりかもめ: 'Yurikamome',
  首都圏新都市鉄道: 'Tsukuba Express',
  東京臨海高速鉄道: 'Rinkai Line',
  北大阪急行電鉄: 'Kita-Osaka Kyuko',
  大阪モノレール: 'Osaka Monorail',
  高野山電気鉄道: 'Koyasan cable car',
  長崎電気軌道: 'Nagasaki trams',
  熊本市: 'Kumamoto trams',
  鹿児島市: 'Kagoshima trams',
  函館市: 'Hakodate trams',
  富山地方鉄道: 'Toyama Chiho Railway',
  黒部峡谷鉄道: 'Kurobe Gorge Railway',
  アルピコ交通: 'Alpico (Kamikochi line)',
  しなの鉄道: 'Shinano Railway',
  IRいしかわ鉄道: 'IR Ishikawa Railway',
  のと鉄道: 'Noto Railway',
}

const LINES = {
  東海道新幹線: 'Tokaido Shinkansen',
  山陽新幹線: 'Sanyo Shinkansen',
  九州新幹線: 'Kyushu Shinkansen',
  西九州新幹線: 'Nishi-Kyushu Shinkansen',
  東北新幹線: 'Tohoku Shinkansen',
  北海道新幹線: 'Hokkaido Shinkansen',
  上越新幹線: 'Joetsu Shinkansen',
  北陸新幹線: 'Hokuriku Shinkansen',
  山手線: 'Yamanote Line',
  中央線: 'Chuo Line',
  総武線: 'Sobu Line',
  京葉線: 'Keiyo Line',
  東海道線: 'Tokaido Line',
  東北線: 'Tohoku Line',
  高崎線: 'Takasaki Line',
  常磐線: 'Joban Line',
  横須賀線: 'Yokosuka Line',
  武蔵野線: 'Musashino Line',
  南武線: 'Nambu Line',
  横浜線: 'Yokohama Line',
  根岸線: 'Negishi Line',
  青梅線: 'Ome Line',
  成田線: 'Narita Line',
  伊東線: 'Ito Line',
  日光線: 'Nikko Line',
  上越線: 'Joetsu Line',
  信越線: 'Shinetsu Line',
  奥羽線: 'Ou Line (Yamagata/Akita Shinkansen)',
  田沢湖線: 'Tazawako Line (Akita Shinkansen)',
  大糸線: 'Oito Line',
  篠ノ井線: 'Shinonoi Line',
  中央本線: 'Chuo Main Line',
  関西線: 'Kansai Line',
  大阪環状線: 'Osaka Loop Line',
  桜島線: 'Sakurajima Line (Universal City)',
  福知山線: 'Fukuchiyama Line',
  山陽線: 'Sanyo Line',
  山陰線: 'San’in Line',
  奈良線: 'Nara Line',
  湖西線: 'Kosei Line',
  北陸線: 'Hokuriku Line',
  紀勢線: 'Kisei Line',
  阪和線: 'Hanwa Line',
  関西空港線: 'Kansai Airport Line',
  片町線: 'Gakkentoshi Line',
  東西線: 'Tozai Line',
  宇野線: 'Uno Line',
  瀬戸大橋線: 'Seto-Ohashi Line',
  鹿児島線: 'Kagoshima Line',
  長崎線: 'Nagasaki Line',
  日豊線: 'Nippo Line',
  唐津線: 'Karatsu Line',
  筑肥線: 'Chikuhi Line (to Karatsu)',
  函館線: 'Hakodate Line',
  千歳線: 'Chitose Line',
  室蘭線: 'Muroran Line',
  銀座線: 'Ginza Line',
  丸ノ内線: 'Marunouchi Line',
  日比谷線: 'Hibiya Line',
  千代田線: 'Chiyoda Line',
  有楽町線: 'Yurakucho Line',
  半蔵門線: 'Hanzomon Line',
  南北線: 'Namboku Line',
  副都心線: 'Fukutoshin Line',
  浅草線: 'Asakusa Line',
  三田線: 'Mita Line',
  新宿線: 'Shinjuku Line',
  大江戸線: 'Oedo Line',
  御堂筋線: 'Midosuji Line',
  谷町線: 'Tanimachi Line',
  四つ橋線: 'Yotsubashi Line',
  千日前線: 'Sennichimae Line',
  堺筋線: 'Sakaisuji Line',
  烏丸線: 'Karasuma Line',
  空港線: 'Airport Line',
  箱崎線: 'Hakozaki Line',
  七隈線: 'Nanakuma Line',
  本線: 'Main Line',
}

const STATIONS_EN = {
  久留米: 'Kurume',
  熊本: 'Kumamoto',
  鹿児島中央: 'Kagoshima-Chuo',
  出水: 'Izumi',
  新玉名: 'Shin-Tamana',
  新水俣: 'Shin-Minamata',
  新大牟田: 'Shin-Omuta',
  新鳥栖: 'Shin-Tosu',
  新八代: 'Shin-Yatsushiro',
  川内: 'Sendai (Kagoshima)',
  筑後船小屋: 'Chikugo-Funagoya',
  博多: 'Hakata (Fukuoka)',
  嬉野温泉: 'Ureshino-Onsen',
  新大村: 'Shin-Omura',
  長崎: 'Nagasaki',
  武雄温泉: 'Takeo-Onsen',
  諫早: 'Isahaya',
  岡山: 'Okayama',
  厚狭: 'Asa',
  広島: 'Hiroshima',
  三原: 'Mihara',
  小倉: 'Kokura',
  新下関: 'Shin-Shimonoseki',
  新岩国: 'Shin-Iwakuni',
  新山口: 'Shin-Yamaguchi',
  新神戸: 'Shin-Kobe',
  新倉敷: 'Shin-Kurashiki',
  新大阪: 'Shin-Osaka',
  新尾道: 'Shin-Onomichi',
  西明石: 'Nishi-Akashi',
  相生: 'Aioi',
  東広島: 'Higashi-Hiroshima',
  徳山: 'Tokuyama',
  姫路: 'Himeji',
  福山: 'Fukuyama',
  芦原温泉: 'Awara-Onsen',
  越前たけふ: 'Echizen-Takefu',
  加賀温泉: 'Kaga-Onsen',
  金沢: 'Kanazawa',
  黒部宇奈月温泉: 'Kurobe-Unazukionsen',
  糸魚川: 'Itoigawa',
  小松: 'Komatsu',
  上越妙高: 'Joetsumyoko',
  新高岡: 'Shin-Takaoka',
  敦賀: 'Tsuruga',
  富山: 'Toyama',
  福井: 'Fukui',
  掛川: 'Kakegawa',
  岐阜羽島: 'Gifu-Hashima',
  京都: 'Kyoto',
  三河安城: 'Mikawa-Anjo',
  三島: 'Mishima',
  小田原: 'Odawara (Hakone)',
  新横浜: 'Shin-Yokohama',
  新富士: 'Shin-Fuji',
  静岡: 'Shizuoka',
  東京: 'Tokyo',
  熱海: 'Atami',
  品川: 'Shinagawa',
  浜松: 'Hamamatsu',
  米原: 'Maibara',
  豊橋: 'Toyohashi',
  名古屋: 'Nagoya',
  浦佐: 'Urasa',
  越後湯沢: 'Echigo-Yuzawa',
  燕三条: 'Tsubame-Sanjo',
  熊谷: 'Kumagaya',
  高崎: 'Takasaki',
  上毛高原: 'Jomo-Kogen',
  新潟: 'Niigata',
  大宮: 'Omiya',
  長岡: 'Nagaoka',
  本庄早稲田: 'Honjo-Waseda',
  いわて沼宮内: 'Iwate-Numakunai',
  くりこま高原: 'Kurikoma-Kogen',
  一ノ関: 'Ichinoseki',
  宇都宮: 'Utsunomiya (for Nikko)',
  郡山: 'Koriyama',
  古川: 'Furukawa',
  七戸十和田: 'Shichinohe-Towada',
  小山: 'Oyama',
  上野: 'Ueno',
  新花巻: 'Shin-Hanamaki',
  新青森: 'Shin-Aomori',
  新白河: 'Shin-Shirakawa',
  水沢江刺: 'Mizusawa-Esashi',
  盛岡: 'Morioka',
  仙台: 'Sendai',
  那須塩原: 'Nasushiobara',
  二戸: 'Ninohe',
  白石蔵王: 'Shiroishi-Zao',
  八戸: 'Hachinohe',
  福島: 'Fukushima',
  北上: 'Kitakami',
  安中榛名: 'Annaka-Haruna',
  軽井沢: 'Karuizawa',
  佐久平: 'Sakudaira',
  上田: 'Ueda',
  長野: 'Nagano',
  飯山: 'Iiyama',
  奥津軽いまべつ: 'Okutsugaru-Imabetsu',
  新函館北斗: 'Shin-Hakodate-Hokuto',
  木古内: 'Kikonai',
}

// Same characters, different line (and reading) for a few operators.
const LINE_BY_OPERATOR = { '神戸市|山手線': 'Seishin-Yamate Line' }

const shinkansen = (s) => s.line.includes('新幹線')
const kindOf = (s) => (shinkansen(s) ? 'shinkansen' : JR_OPERATORS[s.operator] ? 'jr' : 'other')

// Douglas–Peucker simplification on [lon, lat] points.
function simplify(points, tol) {
  if (points.length < 3) return points
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    const [ax, ay] = points[a]
    const [bx, by] = points[b]
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy) || 1e-12
    let max = 0
    let idx = -1
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * points[i][0] - dx * points[i][1] + bx * ay - by * ax) / len
      if (d > max) {
        max = d
        idx = i
      }
    }
    if (max > tol && idx > 0) {
      keep[idx] = 1
      stack.push([a, idx], [idx, b])
    }
  }
  return points.filter((_, i) => keep[i])
}

// Join sections that share endpoints into longer paths (fewer draw calls).
function chain(paths) {
  const key = (p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`
  const remaining = paths.map((p) => [...p])
  const result = []
  while (remaining.length) {
    let cur = remaining.pop()
    let grown = true
    while (grown) {
      grown = false
      for (let i = 0; i < remaining.length; i++) {
        const p = remaining[i]
        const [s, e] = [key(cur[0]), key(cur[cur.length - 1])]
        const [ps, pe] = [key(p[0]), key(p[p.length - 1])]
        let joined = null
        if (e === ps) joined = [...cur, ...p.slice(1)]
        else if (e === pe) joined = [...cur, ...p.slice(0, -1).reverse()]
        else if (s === pe) joined = [...p, ...cur.slice(1)]
        else if (s === ps) joined = [...p.reverse(), ...cur.slice(1)]
        if (joined) {
          cur = joined
          remaining.splice(i, 1)
          grown = true
          break
        }
      }
    }
    result.push(cur)
  }
  return result
}

const TOLERANCE = { shinkansen: 0.00025, jr: 0.0004, other: 0.0003 }
const round = (n) => Math.round(n * 1e5) / 1e5

const groups = new Map()
for (const s of sections) {
  const id = `${s.operator}|${s.line}`
  if (!groups.has(id)) groups.set(id, { s, paths: [] })
  groups.get(id).paths.push(s.coordinates)
}

const layers = { shinkansen: [], jr: [], other: [] }
let before = 0
let after = 0
for (const [id, { s, paths }] of groups) {
  const kind = kindOf(s)
  const chained = chain(paths).map((p) => simplify(p, TOLERANCE[kind]))
  before += paths.reduce((n, p) => n + p.length, 0)
  after += chained.reduce((n, p) => n + p.length, 0)
  const lineEn =
    LINE_BY_OPERATOR[id] ??
    LINES[s.line] ??
    (s.line.endsWith('線') && !/[぀-ヿ一-龯]/.test(s.line.slice(0, -1))
      ? `${s.line.slice(0, -1)} Line`
      : undefined)
  layers[kind].push({
    id,
    name: s.line,
    ...(lineEn && { nameEn: lineEn }),
    operator: s.operator,
    ...(OPERATORS[s.operator] && { operatorEn: OPERATORS[s.operator] }),
    // flattened [lon, lat, lon, lat, …] per path
    paths: chained.map((p) => p.flatMap(([lon, lat]) => [round(lon), round(lat)])),
  })
}

// Shinkansen stations (deduped by name) for dots + labels.
const seen = new Map()
for (const st of stations) {
  if (!st.line.includes('新幹線') || seen.has(st.name)) continue
  seen.set(st.name, {
    name: st.name,
    ...(STATIONS_EN[st.name] && { nameEn: STATIONS_EN[st.name] }),
    lon: round(st.lng),
    lat: round(st.lat),
  })
}

const credit = '国土数値情報（鉄道データ）（国土交通省） / MLIT Japan, N02 railway data 2024'
for (const [kind, lines] of Object.entries(layers)) {
  const body = { credit, lines, ...(kind === 'shinkansen' && { stations: [...seen.values()] }) }
  writeFileSync(new URL(`${kind}.json`, out), JSON.stringify(body))
  console.log(kind, lines.length, 'lines')
}
console.log(`points ${before} -> ${after}`)
