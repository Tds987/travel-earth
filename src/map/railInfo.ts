// Traveler notes per Shinkansen line, keyed by the MLIT (Japanese) line name.
// Times are the fastest regular service, approximate; check the booking sites.

export type BookingLink = { label: string; href: string }

export type ShinkansenInfo = {
  route: string
  fastest: string
  note?: string
  booking: BookingLink[]
}

const SMART_EX = { label: 'SmartEX (book online)', href: 'https://smart-ex.jp/en/' }
const JR_EAST = {
  label: 'JR East (book online)',
  href: 'https://www.eki-net.com/en/jreast-train-reservation/',
}
const JR_WEST = {
  label: 'JR West (book online)',
  href: 'https://www.westjr.co.jp/global/en/ticket/',
}
const JR_KYUSHU = {
  label: 'JR Kyushu (book online)',
  href: 'https://train.yoyaku.jrkyushu.co.jp/jr/en/',
}
const JR_PASS = { label: 'Japan Rail Pass', href: 'https://japanrailpass.net/en/' }

const NOZOMI_NOTE =
  'Nozomi and Mizuho are covered by the Japan Rail Pass only with an extra supplement; Hikari and Sakura need none.'

export const SHINKANSEN: Record<string, ShinkansenInfo> = {
  東海道新幹線: {
    route: 'Tokyo · Shinagawa · Shin-Yokohama · Odawara · Nagoya · Kyoto · Shin-Osaka',
    fastest: 'Tokyo → Shin-Osaka about 2 h 25 min (Nozomi)',
    note: `Sit on the right (seat E) heading west for Mt. Fuji. ${NOZOMI_NOTE}`,
    booking: [SMART_EX, JR_PASS],
  },
  山陽新幹線: {
    route: 'Shin-Osaka · Shin-Kobe · Himeji · Okayama · Hiroshima · Kokura · Hakata',
    fastest: 'Shin-Osaka → Hakata about 2 h 25 min (Nozomi / Mizuho)',
    note: `Your Koshien → Fukuoka Series hop. Himeji Castle is a 1-minute walk from Himeji station if you break the trip. ${NOZOMI_NOTE}`,
    booking: [SMART_EX, JR_WEST, JR_PASS],
  },
  九州新幹線: {
    route: 'Hakata · Kurume · Kumamoto · Kagoshima-Chuo',
    fastest: 'Hakata → Kagoshima-Chuo about 1 h 20 min (Mizuho)',
    booking: [SMART_EX, JR_KYUSHU, JR_PASS],
  },
  西九州新幹線: {
    route: 'Takeo-Onsen · Ureshino-Onsen · Shin-Omura · Isahaya · Nagasaki',
    fastest: 'Hakata → Nagasaki about 1 h 25 min (Relay Kamome to Takeo-Onsen, then Kamome)',
    booking: [JR_KYUSHU, JR_PASS],
  },
  東北新幹線: {
    route: 'Tokyo · Ueno · Omiya · Utsunomiya · Sendai · Morioka · Shin-Aomori',
    fastest: 'Tokyo → Shin-Aomori about 3 h (Hayabusa)',
    note: 'Change at Utsunomiya for Nikko; Yamagata and Akita mini-shinkansen branch off this line.',
    booking: [JR_EAST, JR_PASS],
  },
  北海道新幹線: {
    route: 'Shin-Aomori · Okutsugaru-Imabetsu · Kikonai · Shin-Hakodate-Hokuto',
    fastest: 'Tokyo → Shin-Hakodate-Hokuto about 4 h (Hayabusa)',
    note: 'Goes under the sea through the Seikan Tunnel. For Sapporo, change to the Hokuto limited express.',
    booking: [JR_EAST, JR_PASS],
  },
  上越新幹線: {
    route: 'Tokyo · Omiya · Takasaki · Echigo-Yuzawa · Nagaoka · Niigata',
    fastest: 'Tokyo → Niigata about 1 h 40 min (Toki)',
    booking: [JR_EAST, JR_PASS],
  },
  北陸新幹線: {
    route: 'Tokyo · Omiya · Karuizawa · Nagano · Toyama · Kanazawa · Fukui · Tsuruga',
    fastest: 'Tokyo → Kanazawa about 2 h 30 min (Kagayaki)',
    note: 'Kanazawa for Omicho Market and Bourdain’s Yamanoo.',
    booking: [JR_EAST, JR_WEST, JR_PASS],
  },
}

/** Google Maps transit directions as the universal fallback for times. */
export const transitLink = (place: string) =>
  `https://www.google.com/maps/dir/?api=1&travelmode=transit&destination=${encodeURIComponent(place)}`
