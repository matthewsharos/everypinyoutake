/** Shared catalog conventions. Preserve unknown facts rather than inventing values. */
export class MetadataValidationError extends Error {}

const ORIGINS: Record<string, string> = {
  "wdi": "Walt Disney Imagineering (WDI)",
  "walt disney imagineering": "Walt Disney Imagineering (WDI)",
  "wdi walt disney imagineering": "Walt Disney Imagineering (WDI)",
  "walt disney imagineering wdi": "Walt Disney Imagineering (WDI)",
  "dec": "Disney Employee Center (DEC)",
  "disney employee center": "Disney Employee Center (DEC)",
  "disney employee center dec": "Disney Employee Center (DEC)",
  "wdcs": "Disney Employee Center (DEC)",
  "wdcs dec": "Disney Employee Center (DEC)",
  "the walt disney company store": "Disney Employee Center (DEC)",
  "walt disney company store": "Disney Employee Center (DEC)",
  "dec wdcs": "Disney Employee Center (DEC)",
  "the walt disney company store wdcs": "Disney Employee Center (DEC)",
  "walt disney company store wdcs": "Disney Employee Center (DEC)",
  "dssh": "Disney Studio Store Hollywood (DSSH)",
  "dsf": "Disney Studio Store Hollywood (DSSH)",
  "dssh dsf": "Disney Studio Store Hollywood (DSSH)",
  "disney studio store hollywood": "Disney Studio Store Hollywood (DSSH)",
  "disney studio store hollywood soda fountain": "Disney Studio Store Hollywood (DSSH)",
  "dssh disney studio store hollywood": "Disney Studio Store Hollywood (DSSH)",
  "dsf disney soda fountain": "Disney Studio Store Hollywood (DSSH)",
  "disney soda fountain": "Disney Studio Store Hollywood (DSSH)",
  "dsf dssh": "Disney Studio Store Hollywood (DSSH)",
  "disney soda fountain dsf": "Disney Studio Store Hollywood (DSSH)",
  "disney studio store hollywood dsf dssh": "Disney Studio Store Hollywood (DSSH)",
  "disney studio store hollywood dssh": "Disney Studio Store Hollywood (DSSH)",
  "wdw": "Walt Disney World",
  "wdw walt disney world": "Walt Disney World",
  "walt disney world": "Walt Disney World",
  "walt disney world wdw": "Walt Disney World",
  "dlr": "Disneyland Resort",
  "dlr disneyland california": "Disneyland Resort",
  "disneyland resort": "Disneyland Resort",
  "disneyland california": "Disneyland Resort",
  "disneyland resort dlr": "Disneyland Resort",
  "dlp": "Disneyland Paris",
  "dlp disneyland paris": "Disneyland Paris",
  "dlrp": "Disneyland Paris",
  "disneyland paris": "Disneyland Paris",
  "disneyland resort paris": "Disneyland Paris",
  "dlrp disneyland resort paris": "Disneyland Paris",
  "hkdl": "Hong Kong Disneyland",
  "hkdl hong kong disneyland": "Hong Kong Disneyland",
  "hong kong disneyland": "Hong Kong Disneyland",
  "sdr": "Shanghai Disney Resort",
  "sdr shanghai disney resort": "Shanghai Disney Resort",
  "sdr shanghai disneyland": "Shanghai Disney Resort",
  "shdl": "Shanghai Disney Resort",
  "shanghai disney resort": "Shanghai Disney Resort",
  "shanghai disneyland": "Shanghai Disney Resort",
  "tdr": "Tokyo Disney Resort",
  "tdr tokyo disney resort": "Tokyo Disney Resort",
  "tokyo disney resort japan": "Tokyo Disney Resort",
  "tokyo disney resort": "Tokyo Disney Resort",
  "tokyo disneyland resort": "Tokyo Disney Resort",
  "japan": "Tokyo Disney Resort",
  "japan tdl jds jdr tds tdr": "Tokyo Disney Resort",
  "ds disney shopping": "Disney Store",
  "dc disney catalog": "Disney Store",
  "dis disney store d23": "Disney Store",
  "disney catalog": "Disney Store",
  "disney store": "Disney Store",
  "disney store us": "Disney Store",
  "walt disney store": "Disney Store",
  "dis": "Disney Store",
  "dis disney store": "Disney Store",
  "shopdisney": "Disney Store",
  "disney store uk": "Disney Store",
  "disney store japan": "Disney Store",
  "dsuk": "Disney Store",
  "dsj": "Disney Store",
  "jds": "Disney Store",
  "jdm": "Disney Store",
  "japan disney mall": "Disney Store",
  "dsuk disney store uk": "Disney Store",
  "dsj disney store japan": "Disney Store",
  "disney shopping": "Disney Store",
  "disneyshopping com": "Disney Store",
  "disney catalog us": "Disney Store",
  "da": "Disney Auctions",
  "da disney auctions": "Disney Auctions",
  "disney auctions": "Disney Auctions",
  "disney auctions da": "Disney Auctions",
  "disneyauctions": "Disney Auctions",
  "disneyauctions com": "Disney Auctions",
  "disney auctions p i n s": "Disney Auctions",
  "da p i n s": "Disney Auctions",
  "da disney auctions pins": "Disney Auctions",
  "d a": "Disney Auctions",
  "dcl": "Disney Cruise Line",
  "dcl disney cruise line": "Disney Cruise Line",
  "disney cruise line": "Disney Cruise Line",
  "dlp disneyland paris japan tdl jds jdr tds tdr": "Multiple Disney locations",
  "multiple disney locations": "Multiple Disney locations",
  "multiple": "Multiple Disney locations",
  "multiple sources wdw dlr etc": "Multiple Disney locations",
  "pink a la mode": "Pink a la Mode",
  "palm": "Pink a la Mode",
  "mii monogram m i i palm pink a la mode": "Pink a la Mode",
  "palm pink a la mode mii monogram m i i": "Pink a la Mode",
  "monogram pink a la mode": "Pink a la Mode",
  "disney pins blog": "Disney Pins Blog",
  "dpb": "Disney Pins Blog",
  "d23": "D23",
  "d23 disney 23": "D23",
  "d23 disney 23 fan club": "D23",
  "disney fan club": "D23",
  "dfc": "D23",
  "d23 disney fan club": "D23",
  "lfly loungefly": "Loungefly",
  "loungefly": "Loungefly",
  "wdfm walt disney family museum": "Walt Disney Family Museum",
  "walt disney family museum": "Walt Disney Family Museum",
  "artland acme": "Artland / ACME",
  "artland": "Artland / ACME",
  "acme": "Artland / ACME",
  "acme artland": "Artland / ACME",
  "mii monogram m i i": "Monogram",
  "monogram": "Monogram",
  "boxlunch hot topic other": "BoxLunch / Hot Topic",
  "boxlunch hot topic": "BoxLunch / Hot Topic",
  "disney movie rewards": "Disney Movie Insiders / Rewards",
  "disney movie insiders": "Disney Movie Insiders / Rewards",
  "dmr": "Disney Movie Insiders / Rewards",
  "dmi": "Disney Movie Insiders / Rewards",
  "disney movie insiders rewards": "Disney Movie Insiders / Rewards",
  "world of disney nyc": "World of Disney — New York City",
  "world of disney new york city": "World of Disney — New York City",
  "wod nyc": "World of Disney — New York City"
};
const compact = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();
const key = (value: string) => value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function normalizeOrigin(value: unknown): string | null {
  const text = compact(value);
  return text ? ORIGINS[key(text)] ?? text : null;
}

export function normalizeEdition(value: unknown): string | null {
  const text = compact(value);
  if (!text) return null;
  if (/^[0-9][0-9,]*$/.test(text)) return Number(text.replace(/,/g, '')) > 0 ? `LE ${Number(text.replace(/,/g, ''))}` : 'LE (size unconfirmed)';
  if (/^(?:open(?: edition)?(?: - OE)?|OE)$/i.test(text)) return 'OE';
  if (/^(?:limited release(?: - LR)?|LR)$/i.test(text)) return 'LR';
  const limited = text.match(/^(?:Limited Edition(?: \(LE\))?\s*(?:of)?\s*[-:]?\s*(?:LE)?|LE)\s*([\d,]+)$/i);
  if (limited) return `LE ${Number(limited[1].replace(/,/g, ''))}`;
  if (/^(?:LE|Limited Edition|Limited Edition - LE)$/i.test(text)) return 'LE (size unconfirmed)';
  return text;
}

/** Only normalize supplied fields, so partial updates cannot erase other metadata. */
export function normalizePinMetadata<T extends Record<string, any>>(input: T): T {
  const output: Record<string, any> = { ...input };
  if ('origin' in input) output.origin = normalizeOrigin(input.origin);
  if ('edition' in input) {
    output.edition = normalizeEdition(input.edition);
    if (output.edition === 'OE' || output.edition === 'LR') output.is_limited_edition = false;
    else if (/^LE(?: |$)/.test(output.edition ?? '')) output.is_limited_edition = true;
  }
  for (const field of ['series', 'external_pin_id', 'external_url']) {
    if (field in input) output[field] = compact(input[field]) || null;
  }
  if ('tags' in input) {
    const tags = compact(input.tags);
    if (tags.length > 800 || /browse (?:pins|our)|open main menu|join free|pin description|sold prices disclaimer|refill your tokens/i.test(tags)) {
      throw new MetadataValidationError('Tags must be short character, movie or theme labels. Remove copied website text.');
    }
    const seen = new Set<string>();
    output.tags = tags.split(/[,;|]/).map(compact).filter(tag => {
      if (tag.length > 80) throw new MetadataValidationError('Each tag must be a short label of 80 characters or fewer.');
      if (!tag || seen.has(tag.toLowerCase())) return false;
      seen.add(tag.toLowerCase());
      return true;
    }).join(', ') || null;
  }
  return output as T;
}
