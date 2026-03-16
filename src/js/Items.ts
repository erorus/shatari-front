import {copyObject as co, querySelector as qs} from "./utils";
import {ITEM_PET_CAGE} from "./constants";

import Auctions from "./Auctions";
import Categories from "./Categories";
import Locales from "./Locales";
import Progress from "./Progress";
import Search from "./Search";
import * as Types from "./Types";

/** @typedef {string} IconSize */

/**
 * @typedef {object} Suffix
 * @property {number|null} bonus
 * @property {string} name
 * @property {string} [searchName]
 */

const BREEDS = {
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

/**
 * @type {Object<string, string>} A map of fancy characters -> normalized characters, for searches.
 */
const NORMALIZATION_MAP = {
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

/**
 * @type {{
 * items: Object.<ItemID, UnnamedItem>,
 * names: Object.<ItemID, string>,
 * searchNames: Object.<ItemID, string>,
 * suffixes: Object.<SuffixID, Suffix>,
 * battlePets: Object.<BattlePetSpeciesID, BattlePetSpecies>,
 * battlePetNames: Object.<BattlePetSpeciesID, string>,
 * searchBattlePetNames: Object.<BattlePetSpeciesID, string>,
 * vendor: {
 *     quality: number[],
 *     2: number[],
 *     4: number[],
 *   },
 * }}
 */
const my = {
    items: {},
    names: {},
    suffixes: {},
    battlePets: {},
    battlePetNames: {},
    vendor: {},

    searchBattlePetNames: {},
    searchNames: {},
};

/**
 * Methods to handle item data, independent of any prices.
 */
const Items = {
    CLASS_CONSUMABLE: 0,
    CLASS_WEAPON: 2,
    CLASS_GEM: 3,
    CLASS_ARMOR: 4,
    CLASS_MISCELLANEOUS: 15,
    CLASS_BATTLE_PET: 17,
    CLASS_WOW_TOKEN: 18,
    CLASS_PROFESSION: 19,

    CLASSES_EQUIPMENT: [
        4, // Armor
        2, // Weapon
        19, // Profession
    ],

    /**
     * Icon sizes.
     *
     * @readonly
     * @enum {IconSize}
     */
    ICON_SIZE: {
        LARGE: 'large',
        MEDIUM: 'medium',
        // SMALL: 'small',
    },

    MODIFIER_BATTLE_PET_QUALITY: 2, // This totally isn't what modifier 2 means, but I want to store quality and they don't have a mod for that.
    MODIFIER_BATTLE_PET_SPECIES: 3,
    MODIFIER_BATTLE_PET_BREED: 4,
    MODIFIER_BATTLE_PET_LEVEL: 5,
    MODIFIER_BATTLE_PET_CREATUREDISPLAYID: 6,
    MODIFIER_TYPE_TIMEWALKER_LEVEL: 9,
    MODIFIER_TYPE_CRAFTING_STAT_1: 29,
    MODIFIER_TYPE_CRAFTING_STAT_2: 30,
    MODIFIER_TYPE_CRAFTING_QUALITY: 38,

    SEARCH_MODE_NORMAL: 0,
    SEARCH_MODE_SUGGESTIONS: 1,
    SEARCH_MODE_FAVORITES: 2,

    SUBCLASS_MISCELLANEOUS_PET: 2,

    /**
     * Returns the full URL to an icon image.
     *
     * @param {string} iconName
     * @param {IconSize} size
     */
    getIconUrl(iconName, size) {
        return 'https://wow.zamimg.com/images/wow/icons/' + size + '/' + iconName + '.jpg';
    },

    /**
     * Returns the Item record for the item with the given key on the given/current realm.
     *
     * @param {ItemKey} itemKey
     * @returns {Item|null}
     */
    getItemByKey(itemKey) {
        let item = my.items[itemKey.itemId];
        if (!item) {
            return null;
        }

        let newItem = {};
        co(newItem, item);

        newItem.id = itemKey.itemId;
        newItem.bonusLevel = itemKey.itemLevel;
        newItem.bonusSuffix = itemKey.itemSuffix;
        newItem.name = my.names[itemKey.itemId];

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
    },

    /**
     * Returns the localized name suffix for the given suffix ID.
     *
     * @param {ItemID} itemId
     * @param {SuffixID} suffixId
     * @return {Suffix|undefined}
     */
    getSuffix(itemId, suffixId) {
        if (itemId === ITEM_PET_CAGE) {
            return {
                name: BREEDS[suffixId] || ('Breed ' + suffixId),
                bonus: null
            };
        }

        return my.suffixes[suffixId];
    },

    /**
     * Returns the vendor sell price of the given item in coppers.
     *
     * @param {Item} item
     * @return {number}
     */
    getVendorSellPrice(item) {
        if (item.hasOwnProperty('vendorSell')) {
            return item.vendorSell;
        }
        if (item.hasOwnProperty('vendorSellFactor')) {
            const baseFactor = my.vendor[item.vendorSellBase || item['class']][item.bonusLevel || item.squishedItemLevel || item.itemLevel];
            const qualityFactor = my.vendor.quality[item.quality];

            return Math.floor(item.vendorSellFactor * baseFactor * qualityFactor);
        }

        return 0;
    },

    /**
     * Fetches the item list data.
     */
    async init() {
        await Promise.all([
            fetchItemIds(),
            fetchItemNames(Locales.getCurrent()),
            fetchItemSuffixes(Locales.getCurrent()),
            fetchBattlePets(),
            fetchBattlePetNames(Locales.getCurrent()),
            fetchVendor(),
        ]);

        Locales.registerCallback(onLocaleChange);
    },

    /**
     * Turns an item key string into an item key object.
     *
     * @param {ItemKeyString} itemKeyString
     * @return {ItemKey}
     */
    parseKey(itemKeyString) {
        const parts = itemKeyString.split('-');

        return {
            itemId: parseInt(parts[0] || 0),
            itemLevel: parseInt(parts[1] || 0),
            itemSuffix: parseInt(parts[2] || 0),
        };
    },

    /**
     * Performs a search depending on the UI state, and returns item objects that match.
     *
     * @param {number} searchMode
     * @return {Promise<Item[]>}
     */
    async search(searchMode) {
        const result = [];

        const arbitrage = Search.isArbitrageMode();
        const forSuggestions = searchMode === Items.SEARCH_MODE_SUGGESTIONS;
        const favoritesOnly = searchMode === Items.SEARCH_MODE_FAVORITES;
        const favorites = favoritesOnly ? Search.getFavorites() : [];
        const seenNames = {};
        const classId = Categories.getClassId();
        const subClassIds = Categories.getSubClassIds();
        const invTypes = Categories.getInvTypes();
        const extraFilters = Categories.getExtraFilters();

        let itemVariants = {};
        let speciesVariants = {};
        if (arbitrage) {
            const regionState = await Auctions.getRegionState();
            itemVariants = regionState.arbitrageVariants;
            speciesVariants = regionState.arbitrageSpeciesVariants;
        } else {
            const realmState = await Auctions.getRealmState();
            itemVariants = realmState.variants;
            speciesVariants = realmState.speciesVariants;
        }
        const useVariants = !qs('.main .search-bar .filter [name="transmog-mode"]').checked;

        const idList = [];
        const wordExpressions = [];
        const searchBox = qs('.main .search-bar input[type="text"]');

        let query = searchBox.value;
        // Trim whitespace.
        query = query.replace(/^\s+|\s+$/g, '');
        if (/^[\d ,]+$/.test(query)) {
            const idSet = new Set();
            query.match(/\d+/g).forEach(idString => idSet.add(+idString));
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
            const rarityFrom = qs('.main .search-bar .filter select.rarity[name="rarity-from"]');
            const rarityTo = qs('.main .search-bar .filter select.rarity[name="rarity-to"]');
            const minRarity = parseInt(rarityFrom.options[rarityFrom.selectedIndex].value);
            const maxRarity = parseInt(rarityTo.options[rarityTo.selectedIndex].value);
            for (let rarity = minRarity; rarity <= maxRarity; rarity++) {
                validRarity.push(rarity);
            }
        }

        let minLevel = (/^\d+$/.exec(qs('.main .search-bar input[name="level-min"]').value) || [])[0];
        let maxLevel = (/^\d+$/.exec(qs('.main .search-bar input[name="level-max"]').value) || [])[0];
        if (minLevel !== undefined) {
            minLevel = parseInt(minLevel);
        }
        if (maxLevel !== undefined) {
            maxLevel = parseInt(maxLevel);
        }

        let expansion;
        {
            const expansionSelect = qs('.main .filter select.expansion');
            const selected = expansionSelect.options[expansionSelect.selectedIndex].value;
            if (selected !== '') {
                expansion = parseInt(selected);
            }
        }

        let usePetCage = false;

        for (let id in my.items) {
            if (!my.items.hasOwnProperty(id)) {
                continue;
            }
            if (idList.length && !idList.includes(+id)) {
                continue;
            }

            let item = my.items[id];
            if (classId !== undefined && item['class'] !== classId) {
                continue;
            }
            if (parseInt(id) === ITEM_PET_CAGE) {
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
            if (invTypes !== undefined && !invTypes.includes(item.inventoryType)) {
                continue;
            }
            if (extraFilters !== undefined && !(item.extraFilters || []).some(value => extraFilters.includes(value))) {
                continue;
            }
            if (!validRarity.includes(item.quality)) {
                continue;
            }
            switch (item['class']) {
                case Items.CLASS_CONSUMABLE:
                    if (minLevel !== undefined && item.reqLevel < minLevel) {
                        continue;
                    }
                    if (maxLevel !== undefined && item.reqLevel > maxLevel) {
                        continue;
                    }
                    break;

                case Items.CLASS_WEAPON:
                case Items.CLASS_ARMOR:
                case Items.CLASS_PROFESSION:
                    if (useVariants) {
                        // Normally we'll check item level for each variant.
                        break;
                    }

                // Check the item level of the base item, not the variant.
                // falls through
                case Items.CLASS_GEM:
                    if (minLevel !== undefined && (item.squishedItemLevel || item.itemLevel) < minLevel) {
                        continue;
                    }
                    if (maxLevel !== undefined && (item.squishedItemLevel || item.itemLevel) > maxLevel) {
                        continue;
                    }
                    break;
            }

            /** @type {Array.<ItemKeyString>} variants */
            let variants;
            if (!useVariants) {
                // Not using any variants, just bare item IDs.
                variants = [Items.stringifyKeyParts(parseInt(id), 0, 0)];
            } else {
                if (itemVariants[id]) {
                    variants = itemVariants[id].slice(0);
                } else {
                    variants = [
                        Items.stringifyKeyParts(
                            parseInt(id),
                            Items.CLASSES_EQUIPMENT.includes(item['class']) ? (item.squishedItemLevel || item.itemLevel) : 0,
                            0,
                        ),
                    ];
                }

                if (forSuggestions && variants.length > 1) {
                    // Strip out item levels. We won't be looking up these key strings anyway.
                    for (let index = 0; index < variants.length; index++) {
                        let itemKey = Items.parseKey(variants[index]);
                        variants[index] = Items.stringifyKeyParts(itemKey.itemId, 0, itemKey.itemSuffix);
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
                const itemKey = Items.parseKey(keyString);

                if (itemKey.itemLevel) {
                    if (minLevel !== undefined && itemKey.itemLevel < minLevel) {
                        return;
                    }
                    if (maxLevel !== undefined && itemKey.itemLevel > maxLevel) {
                        return;
                    }
                }

                let searchName = my.searchNames[itemKey.itemId] ?? my.names[itemKey.itemId];
                if (itemKey.itemSuffix) {
                    const suffix = Items.getSuffix(itemKey.itemId, itemKey.itemSuffix);
                    searchName += ' ' + (suffix.searchName ?? suffix.name);
                }

                let foundAllWords = true;
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

                /** @type {Item} newItem */
                let newItem = {};
                co(newItem, item);
                newItem.id = parseInt(id);
                newItem.name = my.names[id];
                newItem.bonusLevel = itemKey.itemLevel;
                newItem.bonusSuffix = itemKey.itemSuffix;
                result.push(newItem);
            });
        }

        if (usePetCage) {
            let item = my.items[ITEM_PET_CAGE];
            for (let speciesId in my.battlePets) {
                if (!my.battlePets.hasOwnProperty(speciesId)) {
                    continue;
                }
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
                    variants = [Items.stringifyKeyParts(ITEM_PET_CAGE, speciesId, 0)];
                } else {
                    if (speciesVariants[speciesId]) {
                        variants = speciesVariants[speciesId].slice(0);
                    } else {
                        variants = [Items.stringifyKeyParts(ITEM_PET_CAGE, speciesId, 0)];
                    }
                }

                if (favoritesOnly) {
                    variants = variants.filter(keyString => favorites.includes(keyString));
                }

                variants.forEach(keyString => {
                    const itemKey = Items.parseKey(keyString);

                    let searchName = my.searchBattlePetNames[itemKey.itemLevel] ??
                        my.battlePetNames[itemKey.itemLevel];

                    let foundAllWords = true;
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

                    /** @type {Item} newItem */
                    let newItem = {};
                    co(newItem, item);

                    // Set the regular Item properties (added on top of UnnamedItem)
                    newItem.id = ITEM_PET_CAGE;
                    newItem.name = my.battlePetNames[speciesId];
                    newItem.bonusLevel = itemKey.itemLevel;
                    newItem.bonusSuffix = itemKey.itemSuffix;

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

                    result.push(newItem);
                });
            }
        }

        return result;
    },

    /**
     * Serialize an item key's parts into a short string.
     */
    stringifyKeyParts(itemId: Types.ItemID, itemLevel: number, itemSuffix: Types.SuffixID): Types.ItemKeyString {
        let result = '' + itemId;
        if (itemLevel) {
            result += '-' + itemLevel;
            if (itemSuffix) {
                result += '-' + itemSuffix;
            }
        }

        return result;
    },
};
export default Items;

/**
 * Escapes a string for use in a regex.
 *
 * @param {string} string
 * @return {string}
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

/**
 * Fetches the list of battle pet names and stores it locally.
 *
 * @param {string} locale
 */
async function fetchBattlePetNames(locale) {
    const response = await Progress.fetch('json/battlepets.' + locale + '.json', {mode:'same-origin'});
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
    const response = await Progress.fetch('json/battlepets.json', {mode:'same-origin'});
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

    await Promise.all([
        (async () => {
            unboundResponse = await Progress.fetch('json/items.unbound.json', {mode:'same-origin'});
        })(),
        (async () => {
            boundResponse = await Progress.fetch('json/items.bound.json', {mode:'same-origin'});
        })(),
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
        if (item['class'] === Items.CLASS_MISCELLANEOUS && item.subclass === Items.SUBCLASS_MISCELLANEOUS_PET) {
            item['class'] = Items.CLASS_BATTLE_PET;
            item.subclass = 0;
        }
    }
}

/**
 * Fetches the list of item names and stores it locally.
 *
 * @param {string} locale
 */
async function fetchItemNames(locale) {
    let unboundResponse;
    let boundResponse;

    await Promise.all([
        (async () => {
            unboundResponse = await Progress.fetch(`json/names.unbound.${locale}.json`, {mode:'same-origin'});
        })(),
        (async () => {
            boundResponse = await Progress.fetch(`json/names.bound.${locale}.json`, {mode:'same-origin'});
        })(),
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
 *
 * @param {string} locale
 */
async function fetchItemSuffixes(locale) {
    const response = await Progress.fetch('json/name-suffixes.' + locale + '.json', {mode:'same-origin'});
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
    const response = await Progress.fetch('json/vendor.json', {mode:'same-origin'});
    if (!response.ok) {
        throw 'Cannot get vendor pricing data!';
    }

    my.vendor = await response.json();
}

/**
 * Returns a sparse map which is a copy of $map but where the normalized $map value differs from the $map value.
 *
 * @param {Object<string|int, string>} map
 * @return {Object<string|int, string>}
 */
function getSearchNames(map) {
    const result = {};
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
 *
 * @param {string} fancy
 * @return {string}
 */
const normalizeForSearch = fancy => fancy.replace(
    /[‘’‛‚ʼʻʽʾʿ“”„«»–—−…\u00A0\u3000]/g,
    match => NORMALIZATION_MAP[match] ?? match,
).normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Called when the user changes their preferred locale, this fetches new names for items and pets.
 *
 * @param {string} locale
 */
async function onLocaleChange(locale) {
    await Promise.all([
        fetchBattlePetNames(locale),
        fetchItemNames(locale),
        fetchItemSuffixes(locale),
    ]);
}

