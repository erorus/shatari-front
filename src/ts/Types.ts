export type PlainObject = Record<string, any>;
export type BattlePetSpeciesID = number;
export type ClassID = number;
export type ConnectedRealmID = number;
export type InventoryType = number;
export type ItemID = number;
export type ItemKeyString = string;
export type SuffixID = number;
// Expressed in coppers.
export type Money = number;
export type RealmID = number;
// "us" or "eu", etc.
export type Region = string;
export type StatID = number;
export type SubclassID = number;
// A UNIX timestamp, in milliseconds.
export type Timestamp = number;

export type ArbitrageLine = {
    min: Money;
    realms: number;
}
export type Auction = {
    price: Money;
    quantity: number;
}
export type AuctionDetail = {
    bonuses: number[];
    modifiers: Record<number, number>;
    price: Money;
    // List of unique tertiary stat IDs
    stats: number[];
}
export type BattlePetStats = {
    power: number;
    stamina: number;
    speed: number;
}
export type BattlePetSpecies = BattlePetStats & {
    display: number;
    expansion: number;
    icon: string;
    npc: number;
    side?: number;
    type: number;
}
export type ConnectedRealm = {
    region: Region;
    id: ConnectedRealmID;
    canonical: Realm;
    secondary: Realm[];
}
export type DealsPrices = {
    regionMedian: Money;
    dealPrice: Money;
}
export type DealsState = {
    items: Record<ItemKeyString, DealsPrices>;
}
export type ItemKey = {
    itemId: ItemID;
    itemLevel: number;
    itemSuffix: SuffixID;
}
export type Item = UnnamedItem & {
    battlePetStats?: BattlePetStats;
    battlePetType?: number;
    bonusLevel: number;
    bonusSuffix: SuffixID;
    id: ItemID;
    name: string;
    npc?: number;
}
export type ItemState = {
    // A list of distinct prices and quantities, ordered by price ascending
    auctions: Auction[];
    // A list of summary prices by day, order by snapshot ascending
    daily: SummaryLine[];
    item: Item;
    realm: Realm;
    // The cheapest price when this item was last seen
    price: Money;
    // How many were available when this was last seen
    quantity: number;
    // The last snapshot when this item was seen
    snapshot: Timestamp;
    // A list of summary prices, order by snapshot ascending
    snapshots: SummaryLine[];
    // A list of prices and bonus information, ordered by price ascending
    specifics: AuctionDetail[];
}
export type PricedItem = Item & {
    price: Money;
    quantity: number;
    regionMedian?: Money;
    snapshot: Timestamp;
}
export type Realm = {
    category: string;
    connectedId: ConnectedRealmID;
    id: RealmID;
    name: string;
    nativeName?: string;
    population: number;
    populationName: string;
    region: Region;
    slug: string;
}
export type RealmState = {
    realm: Realm;
    // The timestamp of the most recent snapshot
    snapshot: Timestamp;
    // The timestamp when we last checked for a new snapshot
    lastCheck: Timestamp;
    // An array of snapshot timestamps, in ascending order
    snapshots: Timestamp[];
    summary: Record<ItemKeyString, SummaryLine>;
    variants: Record<ItemID, Array<ItemKeyString>>;
    speciesVariants: Record<BattlePetSpeciesID, Array<ItemKeyString>>;
    bonusStatItems: Record<StatID, Array<ItemKeyString>>;
}
export type RegionState = {
    region: Region;
    arbitrage: Record<ItemKeyString, ArbitrageLine>;
    arbitrageVariants: Record<ItemID, Array<ItemKeyString>>;
    arbitrageSpeciesVariants: Record<BattlePetSpeciesID, Array<ItemKeyString>>;
    items: Record<ItemKeyString, Money>;
}
export type SummaryLine = {
    // When this item was last seen
    snapshot: Timestamp;
    // The cheapest price when it was last seen
    price: Money;
    // The total quantity available when it was last seen
    quantity: number;
}
export type TokenState = {
    region: Region;
    price: Money;
    // When the token price last changed
    snapshot: Timestamp;
    // An array of prices, order by snapshot ascending
    snapshots: SummaryLine[];
}
export type UnnamedItem = {
    bop?: boolean;
    class: number;
    craftingQualityId?: number;
    display?: number;
    expansion: number;
    extraFilters?: number[];
    icon: string;
    inventoryType?: InventoryType;
    itemLevel?: number;
    quality: number;
    reqLevel?: number;
    side?: number;
    skill?: number;
    slots?: number;
    squishEra?: number;
    squishedItemLevel?: number;
    stack?: number;
    subclass: number;
    vendorBuy?: number;
    vendorSell?: number;
    vendorSellBase?: 2|4;
    vendorSellFactor?: number;
}
