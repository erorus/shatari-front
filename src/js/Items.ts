// Methods to handle item data, independent of any prices.

// Imports

import {querySelector as qs} from "./utils";
import {ITEM_PET_CAGE} from "./constants";

import Auctions from "./Auctions";
import Categories from "./Categories";
import {registerCallback as registerLocaleCallback, getCurrent as getCurrentLocale, Locale} from "./Locales";
import Progress from "./Progress";
import Search from "./Search";
import * as Types from "./Types";

// Types

type Suffix = {
    bonus: number|null;
    name: string;
    searchName?: string;
}

type VendorSellClass = ItemClass.Weapon|ItemClass.Armor;

// Enums

export const enum IconSize {
    Large = 'large',
    Medium = 'medium',
    //Small = 'small',
}

export const enum ItemClass {
    Consumable = 0,
    Weapon = 2,
    Gem = 3,
    Armor = 4,
    Miscellaneous = 15,
    BattlePet = 17,
    WowToken = 18,
    Profession = 19,
}

export const enum ItemSubclass {
    BattlePetCompanion = 0,
    MiscellaneousPet = 2,
}

export const enum Modifier {
    BattlePetQuality = 2, // This totally isn't what modifier 2 means, but I want to store quality and they don't have a mod for that.
    BattlePetSpecies = 3,
    BattlePetBreed = 4,
    BattlePetLevel = 5,
    BattlePetCreatureDisplayID = 6,
    TypeTimewalkerLevel = 9,
    TypeCraftingStat1 = 29,
    TypeCraftingStat2 = 30,
    TypeCraftingQuality = 38,
}

export const enum SearchMode {
    Normal,
    Suggestions,
    Favorites,
}

// Constants

export const ClassesEquipment = [
    ItemClass.Armor,
    ItemClass.Weapon,
    ItemClass.Profession,
];

// A map of breed ID => abbreviated label
const BREEDS: Record<number, string> = {
    "3": "B/B",
    "4": "P/P",
    "5": "S/S",
    "6": "H/H",
    "7": "H/P",
    "8": "P/S",
    "9": "H/S",
    "10": "P/B",
    "11": "S/B",
    "12": "H/B",
};

// A map of fancy characters -> normalized characters, for searches.
const NORMALIZATION_MAP: Record<string, string> = {
    // Apostrophes and single quotes
    '‘': "'", '’': "'", '‛': "'", '‚': "'", 'ʼ': "'", 'ʻ': "'", 'ʽ': "'", 'ʾ': "'", 'ʿ': "'",
    // Double quotes
    '“': '"', '”': '"', '„': '"', '«': '"', '»': '"',
    // Dashes
    '–': '-', '—': '-', '−': '-',
    // Ellipsis
    '…': '...',
    // Whitespace normalizations
    '\u00A0': ' ', // Non-breaking space
    '\u3000': ' ', // Full-width space (used in zh, ja, ko);
};

// Module variables

type ModuleVars = {
    items: Record<Types.ItemID, Types.UnnamedItem>;
    names: Record<Types.ItemID, string>;
    searchNames: Record<Types.ItemID, string>;
    suffixes: Record<Types.SuffixID, Suffix>;
    battlePets: Record<Types.BattlePetSpeciesID, Types.BattlePetSpecies>;
    battlePetNames: Record<Types.BattlePetSpeciesID, string>;
    searchBattlePetNames: Record<Types.BattlePetSpeciesID, string>;
    vendor: {quality: number[]} & Record<VendorSellClass, number[]>;
}

const my: ModuleVars = {
    items: {},
    names: {},
    searchNames: {},

    suffixes: {},

    battlePets: {},
    battlePetNames: {},
    searchBattlePetNames: {},

    vendor: {
        quality: [],
        "2": [],
        "4": [],
    },
};

// Functions

/**
 * Returns the full URL to an icon image.
 */
export function getIconUrl(iconName: string, size: IconSize) {
    return `https://wow.zamimg.com/images/wow/icons/${size}/${iconName}.jpg`;
}

/**
 * Returns the Item record for the item with the given key on the given/current realm.
 */
export function getItemByKey(itemKey: Types.ItemKey): Types.Item|null {
    let item = my.items[itemKey.itemId];
    if (!item) {
        return null;
    }

    let newItem: Types.Item = {
        ...item,
        id: itemKey.itemId,
        bonusLevel: itemKey.itemLevel,
        bonusSuffix: itemKey.itemSuffix,
        name: my.names[itemKey.itemId],
    };

    if (itemKey.itemId !== ITEM_PET_CAGE) {
        return newItem;
    }

    // Battle pets only below.

    let speciesId = itemKey.itemLevel;
    let species = my.battlePets[speciesId];
    if (!species) {
        return null;
    }

    newItem.name = my.battlePetNames[speciesId];

    // Overwrite the pet cage UnnamedItem vars
    newItem.display = species.display;
    newItem.icon = species.icon;
    newItem.side = species.side || 0;

    // Add our own pet-specific properties to the Item
    newItem.npc = species.npc;
    newItem.battlePetType = species.type;
    newItem.battlePetStats = {
        power: species.power,
        stamina: species.stamina,
        speed: species.speed,
    };

    return newItem;
}

/**
 * Returns the localized name suffix for the given suffix ID.
 */
export function getSuffix(itemId: Types.ItemID, suffixId: Types.SuffixID): Suffix|undefined {
    if (itemId === ITEM_PET_CAGE) {
        return {
            name: BREEDS[suffixId] || ('Breed ' + suffixId),
            bonus: null
        };
    }

    return my.suffixes[suffixId];
}

/**
 * Returns the vendor sell price of the given item in coppers.
 */
export function getVendorSellPrice(item: Types.Item): Types.Money {
    if (item.vendorSell != null) {
        return item.vendorSell;
    }
    if (item.vendorSellFactor != null) {
        const baseClass: VendorSellClass = item.vendorSellBase ?? item['class'];
        if (baseClass in my.vendor) {
            const levelMap = my.vendor[baseClass];
            const level = item.bonusLevel || item.squishedItemLevel || item.itemLevel || -1;
            const baseFactor = levelMap[level] ?? 0;
            const qualityFactor = my.vendor.quality[item.quality] ?? 0;

            return Math.floor(item.vendorSellFactor * baseFactor * qualityFactor);
        }
    }

    return 0;
}

/**
 * Fetches the item list data.
 */
export async function init() {
    await Promise.all([
        fetchItemIds(),
        fetchItemNames(getCurrentLocale()),
        fetchItemSuffixes(getCurrentLocale()),
        fetchBattlePets(),
        fetchBattlePetNames(getCurrentLocale()),
        fetchVendor(),
    ]);

    registerLocaleCallback(onLocaleChange);
}

/**
 * Turns an item key string into an item key object.
 *
 * @param {ItemKeyString} itemKeyString
 * @return {ItemKey}
 */
export function parseKey(itemKeyString: Types.ItemKeyString): Types.ItemKey {
    const parts = itemKeyString.split('-');

    return {
        itemId: parseInt(parts[0] || '0'),
        itemLevel: parseInt(parts[1] || '0'),
        itemSuffix: parseInt(parts[2] || '0'),
    };
}

/**
 * Performs a search depending on the UI state, and returns item objects that match.
 */
export async function search(searchMode: SearchMode): Promise<Types.Item[]> {
    const result: Types.Item[] = [];

    const arbitrage = Search.isArbitrageMode();
    const forSuggestions = searchMode === SearchMode.Suggestions;
    const favoritesOnly = searchMode === SearchMode.Favorites;
    const favorites = favoritesOnly ? Search.getFavorites() : [];
    const seenNames: Record<string, boolean> = {};
    const classId = Categories.getClassId();
    const subClassIds = Categories.getSubClassIds();
    const invTypes = Categories.getInvTypes();
    const extraFilters = Categories.getExtraFilters();

    let itemVariants: Record<number, Types.ItemKeyString[]> = {};
    let speciesVariants: Record<number, Types.ItemKeyString[]> = {};
    if (arbitrage) {
        const regionState = await Auctions.getRegionState();
        itemVariants = regionState.arbitrageVariants;
        speciesVariants = regionState.arbitrageSpeciesVariants;
    } else {
        const realmState = await Auctions.getRealmState();
        itemVariants = realmState.variants;
        speciesVariants = realmState.speciesVariants;
    }
    const useVariants = !(qs('.main .search-bar .filter [name="transmog-mode"]') as HTMLInputElement).checked;

    const idList: Types.ItemID[] = [];
    const wordExpressions: RegExp[] = [];
    const searchBox = (qs('.main .search-bar input[type="text"]') as HTMLInputElement);

    let query = searchBox.value;
    // Trim whitespace.
    query = query.replace(/^\s+|\s+$/g, '');
    if (/^[\d ,]+$/.test(query)) {
        const idSet: Set<Types.ItemID> = new Set();
        query.match(/\d+/g)?.forEach(idString => idSet.add(+idString));
        if (idSet.size) {
            query = '';
            idList.push(...idSet);
        }
    }
    if (/^\[[\w\W]+\]$/.test(query)) {
        // Query was wrapped in brackets, like in a displayed itemlink. Remove the brackets.
        query = query.slice(1, -1);

        // Remove some simple UI escape sequences: textures, texture atlas, protected strings.
        query = query.replace(/\|[TAK][^|]*?\|./g, '');

        // Remove coloring.
        query = query.replace(/\|c[0-9A-Fa-f]{8}/g, '');
        query = query.replace(/\|cn[^|:]+?:/g, '');
        query = query.replace(/\|r/g, '');

        // Remove word wrap hints.
        query = query.replace(/\|[Ww]/g, '');

        // Trim whitespace again.
        query = query.replace(/^\s+|\s+$/g, '');
    }
    query = normalizeForSearch(query);
    // Split the query by whitespace, add a regex for each non-empty word string.
    query.split(/\s+/)
        .filter(word => word.length > 0)
        .forEach(word => wordExpressions.push(new RegExp('(?:^|\\s)\\W*' + escapeRegExp(word), 'iu')));

    const validRarity = [];
    {
        const rarityFrom = qs('.main .search-bar .filter select.rarity[name="rarity-from"]') as HTMLSelectElement;
        const rarityTo = qs('.main .search-bar .filter select.rarity[name="rarity-to"]') as HTMLSelectElement;
        const minRarity = parseInt(rarityFrom.options[rarityFrom.selectedIndex].value);
        const maxRarity = parseInt(rarityTo.options[rarityTo.selectedIndex].value);
        for (let rarity = minRarity; rarity <= maxRarity; rarity++) {
            validRarity.push(rarity);
        }
    }

    let minLevel: number|undefined;
    let maxLevel: number|undefined;
    {
        const minLevelString = (/^\d+$/.exec((qs('.main .search-bar input[name="level-min"]') as HTMLInputElement).value) || [])[0];
        const maxLevelString = (/^\d+$/.exec((qs('.main .search-bar input[name="level-max"]') as HTMLInputElement).value) || [])[0];
        if (minLevelString !== undefined) {
            minLevel = parseInt(minLevelString);
        }
        if (maxLevelString !== undefined) {
            maxLevel = parseInt(maxLevelString);
        }
    }

    let expansion: number|undefined;
    {
        const expansionSelect = qs('.main .filter select.expansion') as HTMLSelectElement;
        const selected = expansionSelect.options[expansionSelect.selectedIndex].value;
        if (selected !== '') {
            expansion = parseInt(selected);
        }
    }

    let usePetCage: boolean = false;

    for (let idString in my.items) {
        if (!my.items.hasOwnProperty(idString)) {
            continue;
        }
        const id = +idString;
        if (idList.length && !idList.includes(id)) {
            continue;
        }

        let item = my.items[id];
        if (classId !== undefined && item['class'] !== classId) {
            continue;
        }
        if (id === ITEM_PET_CAGE) {
            // Handle that later.
            usePetCage = true;
            continue;
        }
        if (expansion && item.expansion !== expansion) {
            continue;
        }
        if (subClassIds !== undefined && !subClassIds.includes(item.subclass)) {
            continue;
        }
        if (invTypes !== undefined && (item.inventoryType == null || !invTypes.includes(item.inventoryType))) {
            continue;
        }
        if (extraFilters !== undefined && !(item.extraFilters || []).some(value => extraFilters.includes(value))) {
            continue;
        }
        if (!validRarity.includes(item.quality)) {
            continue;
        }
        switch (item['class']) {
            case ItemClass.Consumable:
                if (minLevel !== undefined && item.reqLevel && item.reqLevel < minLevel) {
                    continue;
                }
                if (maxLevel !== undefined && item.reqLevel && item.reqLevel > maxLevel) {
                    continue;
                }
                break;

            case ItemClass.Weapon:
            case ItemClass.Armor:
            case ItemClass.Profession:
                if (useVariants) {
                    // Normally we'll check item level for each variant.
                    break;
                }

            // Check the item level of the base item, not the variant.
            // falls through
            case ItemClass.Gem: {
                const itemLevel = item.squishedItemLevel ?? item.itemLevel;
                if (minLevel !== undefined && itemLevel != null && itemLevel < minLevel) {
                    continue;
                }
                if (maxLevel !== undefined && itemLevel != null && itemLevel > maxLevel) {
                    continue;
                }
                break;
            }
        }

        let variants: Types.ItemKeyString[];
        if (!useVariants) {
            // Not using any variants, just bare item IDs.
            variants = [stringifyKeyParts(id, 0, 0)];
        } else {
            if (itemVariants[id]) {
                variants = itemVariants[id].slice(0);
            } else {
                variants = [
                    stringifyKeyParts(
                        id,
                        ClassesEquipment.includes(item['class']) ? (item.squishedItemLevel ?? item.itemLevel ?? 0) : 0,
                        0,
                    ),
                ];
            }

            if (forSuggestions && variants.length > 1) {
                // Strip out item levels. We won't be looking up these key strings anyway.
                for (let index = 0; index < variants.length; index++) {
                    let itemKey = parseKey(variants[index]);
                    variants[index] = stringifyKeyParts(itemKey.itemId, 0, itemKey.itemSuffix);
                }
                // Now get a unique list.
                variants.sort();
                for (let index = 1; index < variants.length; index++) {
                    if (variants[index] === variants[index - 1]) {
                        variants.splice(index--, 1);
                    }
                }
            }
        }

        if (favoritesOnly) {
            variants = variants.filter(keyString => favorites.includes(keyString));
        }

        variants.forEach(keyString => {
            const itemKey = parseKey(keyString);

            if (itemKey.itemLevel) {
                if (minLevel !== undefined && itemKey.itemLevel < minLevel) {
                    return;
                }
                if (maxLevel !== undefined && itemKey.itemLevel > maxLevel) {
                    return;
                }
            }

            let searchName = my.searchNames[itemKey.itemId] ?? my.names[itemKey.itemId] ?? '';
            if (itemKey.itemSuffix) {
                const suffix = getSuffix(itemKey.itemId, itemKey.itemSuffix);
                if (suffix) {
                    searchName += ' ' + (suffix.searchName ?? suffix.name);
                }
            }

            let foundAllWords: boolean = true;
            for (let regex, x = 0; foundAllWords && (regex = wordExpressions[x]); x++) {
                foundAllWords = regex.test(searchName);
            }
            if (!foundAllWords) {
                return;
            }

            if (forSuggestions) {
                if (seenNames[searchName]) {
                    return;
                }
                seenNames[searchName] = true;
            }

            const newItem: Types.Item = {
                ...item,
                id: id,
                name: my.names[id],
                bonusLevel: itemKey.itemLevel,
                bonusSuffix: itemKey.itemSuffix,
            };
            result.push(newItem);
        });
    }

    if (usePetCage) {
        let item = my.items[ITEM_PET_CAGE];
        for (let speciesIdString in my.battlePets) {
            if (!my.battlePets.hasOwnProperty(speciesIdString)) {
                continue;
            }
            const speciesId = +speciesIdString;
            let species = my.battlePets[speciesId];

            if (expansion && species.expansion !== expansion) {
                continue;
            }
            if (subClassIds !== undefined && !subClassIds.includes(species.type)) {
                continue;
            }

            let variants;
            if (!useVariants || forSuggestions) {
                // Not selecting by breed, just species.
                variants = [stringifyKeyParts(ITEM_PET_CAGE, speciesId, 0)];
            } else {
                if (speciesVariants[speciesId]) {
                    variants = speciesVariants[speciesId].slice(0);
                } else {
                    variants = [stringifyKeyParts(ITEM_PET_CAGE, speciesId, 0)];
                }
            }

            if (favoritesOnly) {
                variants = variants.filter(keyString => favorites.includes(keyString));
            }

            variants.forEach(keyString => {
                const itemKey = parseKey(keyString);

                let searchName =
                    my.searchBattlePetNames[itemKey.itemLevel] ??
                    my.battlePetNames[itemKey.itemLevel] ?? '';

                let foundAllWords: boolean = true;
                for (let regex, x = 0; foundAllWords && (regex = wordExpressions[x]); x++) {
                    foundAllWords = regex.test(searchName);
                }
                if (!foundAllWords) {
                    return;
                }

                if (forSuggestions) {
                    if (seenNames[searchName]) {
                        return;
                    }
                    seenNames[searchName] = true;
                }

                const newItem: Types.Item = {
                    // Start with UnnamedItem
                    ...item,

                    // Add required Item properties
                    id: ITEM_PET_CAGE,
                    name: my.battlePetNames[speciesId],
                    bonusLevel: itemKey.itemLevel,
                    bonusSuffix: itemKey.itemSuffix,

                    // Overwrite the pet cage UnnamedItem vars
                    display: species.display,
                    icon: species.icon,
                    side: species.side ?? 0,

                    // Add our own pet-specific properties to the Item
                    npc: species.npc,
                    battlePetType: species.type,
                    battlePetStats: {
                        power: species.power,
                        stamina: species.stamina,
                        speed: species.speed,
                    },
                };
                result.push(newItem);
            });
        }
    }

    return result;
}

/**
 * Serializes an item key's parts into a short string.
 */
export function stringifyKeyParts(itemId: Types.ItemID, itemLevel: number, itemSuffix: Types.SuffixID): Types.ItemKeyString {
    let result = `${itemId}`;
    if (itemLevel) {
        result += `-${itemLevel}`;
        if (itemSuffix) {
            result += `-${itemSuffix}`;
        }
    }

    return result;
}

/**
 * Escapes a string for use in a regex.
 */
function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

/**
 * Fetches the list of battle pet names and stores it locally.
 */
async function fetchBattlePetNames(locale: Locale) {
    const response = await Progress.fetch(`json/battlepets.${locale}.json`, {mode: 'same-origin'});
    if (!response.ok) {
        throw 'Cannot get list of battle pet names!';
    }

    my.battlePetNames = await response.json();
    my.searchBattlePetNames = getSearchNames(my.battlePetNames);
}

/**
 * Fetches the list of battle pets and stores it locally.
 */
async function fetchBattlePets() {
    const response = await Progress.fetch('json/battlepets.json', {mode: 'same-origin'});
    if (!response.ok) {
        throw 'Cannot get list of battle pets!';
    }

    my.battlePets = await response.json();

    for (let id in my.battlePets) {
        if (my.battlePets.hasOwnProperty(id) && !my.battlePets[id].icon) {
            my.battlePets[id].icon = 'inv_misc_questionmark';
        }
    }
}

/**
 * Fetches the list of item IDs and stores it locally.
 */
async function fetchItemIds() {
    let unboundResponse;
    let boundResponse;

    [unboundResponse, boundResponse] = await Promise.all([
        Progress.fetch('json/items.unbound.json', {mode: 'same-origin'}),
        Progress.fetch('json/items.bound.json', {mode: 'same-origin'}),
    ]);

    if (!unboundResponse.ok) {
        throw 'Cannot get list of item IDs!';
    }
    my.items = await unboundResponse.json();
    if (boundResponse.ok) {
        Object.assign(my.items, await boundResponse.json());
    }

    for (let id in my.items) {
        if (!my.items.hasOwnProperty(id)) {
            continue;
        }
        let item = my.items[id];
        if (!item.icon) {
            item.icon = 'inv_misc_questionmark';
        }
        if (item['class'] === ItemClass.Miscellaneous && item.subclass === ItemSubclass.MiscellaneousPet) {
            item['class'] = ItemClass.BattlePet;
            item.subclass = ItemSubclass.BattlePetCompanion;
        }
    }
}

/**
 * Fetches the list of item names and stores it locally.
 */
async function fetchItemNames(locale: Locale) {
    let unboundResponse;
    let boundResponse;

    [unboundResponse, boundResponse] = await Promise.all([
        Progress.fetch(`json/names.unbound.${locale}.json`, {mode: 'same-origin'}),
        Progress.fetch(`json/names.bound.${locale}.json`, {mode: 'same-origin'}),
    ]);

    if (!unboundResponse.ok) {
        throw 'Cannot get list of item names!';
    }

    my.names = await unboundResponse.json();
    if (boundResponse.ok) {
        Object.assign(my.names, await boundResponse.json());
    }
    my.searchNames = getSearchNames(my.names);
}

/**
 * Fetches the list of item names and stores it locally.
 */
async function fetchItemSuffixes(locale: Locale) {
    const response = await Progress.fetch(`json/name-suffixes.${locale}.json`, {mode: 'same-origin'});
    if (!response.ok) {
        throw 'Cannot get list of item suffixes!';
    }

    my.suffixes = await response.json();
    Object.values(my.suffixes).forEach(suffix => {
        const searchName = normalizeForSearch(suffix.name);
        if (searchName !== suffix.name) {
            suffix.searchName = searchName;
        }
    });
}

/**
 * Fetches the list of vendor sell data and stores it locally.
 */
async function fetchVendor() {
    const response = await Progress.fetch('json/vendor.json', {mode: 'same-origin'});
    if (!response.ok) {
        throw 'Cannot get vendor pricing data!';
    }

    my.vendor = await response.json();
}

/**
 * Returns a sparse map which is a copy of $map but where the normalized $map value differs from the $map value.
 */
function getSearchNames(map: Record<string, string>): Record<string, string> {
    const result: Record<string, string> = {};
    Object.entries(map).forEach(([key, value]) => {
        const normalized = normalizeForSearch(value);
        if (normalized !== value) {
            result[key] = normalized;
        }
    });

    return result;
}

/**
 * Normalizes a string to convert common substitutions (left/right single/double quotes, dashes, etc) to more
 * standard ASCII characters (apostrophe, double quote, hyphen).
 */
const normalizeForSearch = (fancy: string) => fancy.replace(
    /[‘’‛‚ʼʻʽʾʿ“”„«»–—−…\u00A0\u3000]/g,
    match => NORMALIZATION_MAP[match] ?? match,
).normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Called when the user changes their preferred locale, this fetches new names for items and pets.
 */
async function onLocaleChange(locale: Locale) {
    await Promise.all([
        fetchBattlePetNames(locale),
        fetchItemNames(locale),
        fetchItemSuffixes(locale),
    ]);
}

