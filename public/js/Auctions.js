import {COPPER_SILVER, ITEM_PET_CAGE, MS_DAY, MS_HOUR, MS_SEC} from "./constants.js";
import {
    copyObject as co,
    createElement as ce,
    createText as ct,
    emptyElement as ee,
    querySelector as qs,
    updateDeltaTimestamps
} from "./utils.js";

import Items from "./Items.js";
import Progress from "./Progress.js";
import Realms from "./Realms.js";

/** @type {Object<Region, ConnectedRealmID>} Realm IDs used by commodity realms for each region. */
const COMMODITY_REALMS = {
    'us': 0x7F00,
    'eu': 0x7F01,
    'tw': 0x7F02,
    'kr': 0x7F03,
};

const MAX_SNAPSHOT_INTERVAL = 2 * MS_HOUR;
const SNAPSHOTS_FOR_INTERVAL = 20;

const REALM_STATE_CACHE_DURATION = 10 * MS_SEC;

const VERSION_DEALS_STATE = 1;
const VERSION_GLOBAL_STATE = 2;
const VERSION_ITEM_STATE = 5;
const VERSION_REALM_STATE = 4;
const VERSION_REGION_STATE = 2;
const VERSION_TOKEN_STATE = 1;

const my = {
    bonusToStats: undefined,
    lastCommodityRealmState: {},
    lastRealmState: {},
    lastRegionState: {},

    lastSnapshotList: {},
};

/**
 * Manages item prices and availability.
 */
const Auctions = {
    /**
     * Returns the deals state for the given realm.
     *
     * @param {Realm|null} realm
     * @return {Promise<DealsState>}
     */
    async getDeals(realm) {
        const result = {
            items: {},
        };

        if (!realm) {
            realm = Realms.getCurrentRealm();
        }

        if (!realm) {
            return result;
        }

        result.region = realm.region;

        const url = 'data/global/deals-' + realm.region + '.bin';
        const response = await Progress.fetch(url, {mode: 'same-origin'});
        if (!response.ok) {
            return result;
        }

        const buffer = await response.arrayBuffer();
        const view = new DataView(buffer);

        let offset = 0;
        const read = function (byteCount) {
            let result = offset;
            offset += byteCount;

            return result;
        };

        let version = view.getUint8(read(1));
        switch (version) {
            case VERSION_DEALS_STATE:
                // no op
                break;
            default:
                throw "Unknown data version for token state.";
        }

        for (let remaining = view.getUint32(read(4), true); remaining > 0; remaining--) {
            let itemId = view.getUint32(read(4), true);
            let itemLevel = view.getUint16(read(2), true);
            let itemSuffix = view.getUint16(read(2), true);
            let itemKeyString = Items.stringifyKeyParts(itemId, itemLevel, itemSuffix);

            let median = view.getUint32(read(4), true) * COPPER_SILVER;
            let dealPrice = view.getUint32(read(4), true) * COPPER_SILVER;
            result.items[itemKeyString] = {
                regionMedian: median,
                dealPrice: dealPrice,
            };
        }

        return result;
    },

    /**
     * Given an item object, return its item state for the current/given realm.
     *
     * @param {Item} item
     * @param {Realm|null} realm
     * @return {Promise<ItemState>}
     */
    async getItem(item, realm) {
        realm = realm || Realms.getCurrentRealm();

        if (item.stack > 1) {
            realm = getCommodityRealm(realm.region);
        }

        return getItemState(realm, Auctions.strip(item), !!realm);
    },

    /**
     * Return the current realm's state. May return a cached object shared between calls.
     *
     * @return {Promise<RealmState>}
     */
    async getRealmState() {
        const realm = Realms.getCurrentRealm();
        const realmState = await getRealmState(realm);

        const updatedElement = qs('.main .bottom-bar .last-updated');
        ee(updatedElement);

        if (Date.now() - realmState.snapshot > 2 * MS_HOUR) {
            updatedElement.appendChild(ct(realm.name + ' last updated '));
            updatedElement.appendChild(ce('span', {
                className: 'delta-timestamp',
                dataset: {timestamp: realmState.snapshot}
            }));
            updatedElement.appendChild(ct('.'));

            updateDeltaTimestamps();
        }

        return realmState;
    },

    /**
     * Returns the current realm's region state. May return a cached object shared between calls.
     *
     * @returns {Promise<RegionState>}
     */
    async getRegionState() {
        return await getRegionState(Realms.getCurrentRealm().region);
    },

    /**
     * Return the WoW token state for the given realm.
     *
     * @param {Realm|null} realm
     * @return {Promise<TokenState>}
     */
    async getToken(realm) {
        /** @var {TokenState} result */
        const result = {
            region: null,
            snapshot: 0,
            price: 0,
            snapshots: [],
        };

        if (!realm) {
            realm = Realms.getCurrentRealm();
        }

        if (!realm) {
            return result;
        }

        result.region = realm.region;

        const url = 'data/global/token-' + realm.region + '.bin';
        const response = await Progress.fetch(url, {mode: 'same-origin'});
        if (!response.ok) {
            return result;
        }

        const buffer = await response.arrayBuffer();
        const view = new DataView(buffer);

        let offset = 0;
        const read = function (byteCount) {
            let result = offset;
            offset += byteCount;

            return result;
        };

        let version = view.getUint8(read(1));
        switch (version) {
            case VERSION_TOKEN_STATE:
                // no op
                break;
            default:
                throw "Unknown data version for token state.";
        }

        result.snapshot = view.getUint32(read(4), true) * MS_SEC;
        result.price = view.getUint32(read(4), true) * COPPER_SILVER;

        result.snapshots = [];
        for (let remaining = view.getUint16(read(2), true); remaining > 0; remaining--) {
            let snapshot = view.getUint32(read(4), true) * MS_SEC;
            let price = view.getUint32(read(4), true) * COPPER_SILVER;
            result.snapshots.push({
                snapshot: snapshot,
                price: price,
                quantity: 1,
            });
        }

        return result;
    },

    /**
     * Hydrates a list of items with prices and quantities for the currently-selected realm.
     *
     * @param {Item[]} items
     * @param {boolean} [arbitrage]
     * @param {Realm|undefined} [realm]
     * @param {boolean} [regionMedian]
     * @return {Promise<PricedItem[]>}
     */
    async hydrateList(items, {arbitrage, realm, regionMedian}) {
        realm = realm || Realms.getCurrentRealm();
        const useRegionMedian = regionMedian;

        /** @type {RealmState} */
        let realmState;
        /** @type {RegionState} */
        let regionState;

        const regionRealmCount = arbitrage ? Realms.getRegionConnectedRealms(realm.region).length : 0;

        let promises = [];
        if (!arbitrage) {
            promises.push((async () => realmState = await getRealmState(realm))());
        }
        if (arbitrage || useRegionMedian) {
            promises.push((async () => regionState = await getRegionState(realm.region))());
        }
        await Promise.all(promises);

        const result = [];

        items.forEach(function (item) {
            const keyString = Items.stringifyKeyParts(item.id, item.bonusLevel, item.bonusSuffix);

            /** @type {PricedItem} pricedItem */
            let pricedItem = {
                price: 0,
                quantity: 0,
                snapshot: 0,
            };
            co(pricedItem, item);

            if (arbitrage) {
                const cur = regionState.arbitrage[keyString];
                if (cur) {
                    pricedItem.price = cur.min;
                    pricedItem.quantity = Math.round(cur.realms / regionRealmCount * 100);
                }
            } else {
                const cur = realmState.summary[keyString];
                if (cur) {
                    pricedItem.price = cur.price;
                    pricedItem.quantity = cur.quantity;
                    pricedItem.snapshot = cur.snapshot;
                }
            }

            let regionMedian = useRegionMedian && regionState && regionState.items[keyString];
            if (regionMedian) {
                pricedItem.regionMedian = regionMedian;
            }

            result.push(pricedItem);
        });

        return result;
    },

    /**
     * Converts a PricedItem object back to a simple Item.
     *
     * @param {PricedItem|Item} pricedItem
     * @return {Item}
     */
    strip(pricedItem) {
        const {price, quantity, regionMedian, snapshot, ...result} = pricedItem;

        return result;
    },
};
export default Auctions;

/**
 * Return the list of snapshot timestamps, keyed by connected realm ID.
 *
 * @return {Promise<Object.<ConnectedRealmID, Timestamp[]>>}
 */
async function fetchSnapshotList() {
    if (
        my.lastSnapshotList.data &&
        my.lastSnapshotList.checked > Date.now() - REALM_STATE_CACHE_DURATION
    ) {
        return my.lastSnapshotList.data;
    }

    const response = await Progress.fetch('data/global/state.bin', {mode: 'same-origin'});
    if (!response.ok) {
        throw "Unable to get global state";
    }

    if (my.lastSnapshotList.data &&
        my.lastSnapshotList.modified === response.headers.get('last-modified')
    ) {
        my.lastSnapshotList.checked = Date.now();

        return my.lastSnapshotList.data;
    }

    const buffer = await response.arrayBuffer();
    const view = new DataView(buffer);

    let offset = 0;
    const read = function (byteCount) {
        let result = offset;
        offset += byteCount;

        return result;
    };

    let version = view.getUint8(read(1));
    switch (version) {
        case VERSION_GLOBAL_STATE:
            // no op
            break;
        default:
            throw "Unknown data version for global state.";
    }

    /** @type {Object.<ConnectedRealmID, Timestamp[]>} result */
    const result = {};

    // Skip the first timestamp list.
    const firstListLength = view.getUint16(read(2), true);
    offset += firstListLength * (2 + 4);

    // Load the snapshot lists.
    for (let remaining = view.getUint16(read(2), true); remaining > 0; remaining--) {
        let realmId = view.getUint16(read(2), true);
        result[realmId] = [];
        for (let realmRemaining = view.getUint16(read(2), true); realmRemaining > 0; realmRemaining--) {
            result[realmId].push(view.getUint32(read(4), true) * MS_SEC);
        }
        Object.freeze(result[realmId]);
    }
    Object.freeze(result);

    my.lastSnapshotList = {
        modified: response.headers.get('last-modified'),
        checked: Date.now(),
        data: result,
    };

    return result;
}

/**
 * Returns the map of bonus ID => tertiary stat IDs.
 *
 * @returns {Promise<Object.<number, number[]>>}
 */
async function getBonusToStats() {
    if (my.bonusToStats) {
        return my.bonusToStats;
    }

    const response = await Progress.fetch('json/bonusToStats.json', {mode:'same-origin'});

    if (!response.ok) {
        throw 'Cannot get map of bonus to stats!';
    }

    return my.bonusToStats = await response.json();
}

/**
 * Returns a fake Realm object for the commodity realm used by the given region.
 *
 * @param {Region} region
 * @return {Realm}
 */
function getCommodityRealm(region) {
    return {
        category: 'Commodities',
        connectedId: COMMODITY_REALMS[region],
        id: COMMODITY_REALMS[region],
        name: region.toUpperCase(),
        region: region,
        slug: 'commodity',
    };
}

/**
 * Given realm and item objects, return its item state.
 *
 * @param {Realm} realm
 * @param {Item} item
 * @param {boolean} useCached
 * @return {Promise<ItemState>}
 */
async function getItemState(realm, item, useCached) {
    let basename = Items.stringifyKeyParts(item.id, item.bonusLevel, item.bonusSuffix);
    const url = [
        'data',
        useCached ? 'cached' : '',
        realm.connectedId,
        item.id === ITEM_PET_CAGE ? 'pet' : '',
        item.id === ITEM_PET_CAGE ? (item.bonusLevel & 0xFF) : (item.id & 0xFF),
        basename + '.bin'
    ].filter(v => v !== '').join('/');
    const response = await Progress.fetch(url, {mode: 'same-origin'});
    if (!response.ok) {
        return {
            realm: realm,
            item: item,
            snapshot: 0,
            price: 0,
            quantity: 0,
            auctions: [],
            snapshots: [],
            specifics: [],
            daily: [],
        };
    }

    const buffer = await response.arrayBuffer();
    const view = new DataView(buffer);

    let offset = 0;
    const read = function (byteCount) {
        let result = offset;
        offset += byteCount;

        return result;
    };

    let version = view.getUint8(read(1));
    let fullModifiers = true;
    let dailyHistory = true;
    switch (version) {
        case 3:
            fullModifiers = false;
            // falls through
        case 4:
            dailyHistory = false;
            // falls through
        case VERSION_ITEM_STATE:
            // no op
            break;
        default:
            throw "Unknown data version for item state.";
    }

    /** @type {ItemState} result */
    const result = {
        realm: realm,
        item: item,
    };
    result.snapshot = view.getUint32(read(4), true) * MS_SEC;
    result.price = view.getUint32(read(4), true) * COPPER_SILVER;
    result.quantity = view.getUint32(read(4), true);

    result.auctions = [];
    for (let remaining = view.getUint16(read(2), true); remaining > 0; remaining--) {
        let price = view.getUint32(read(4), true) * COPPER_SILVER;
        let quantity = view.getUint32(read(4), true);
        result.auctions.push({price: price, quantity: quantity});
    }
    result.auctions.sort((a, b) => a.price - b.price);

    const bonusToStats = await getBonusToStats();
    result.specifics = [];
    for (let remaining = view.getUint16(read(2), true); remaining > 0; remaining--) {
        let price = view.getUint32(read(4), true) * COPPER_SILVER;
        let modifiers = {};
        if (fullModifiers) {
            for (let remainingModifiers = view.getUint8(read(1)); remainingModifiers > 0; remainingModifiers--) {
                let type = view.getUint16(read(2), true);
                let value = view.getUint32(read(4), true);
                modifiers[type] = value;
            }
        } else {
            let level = view.getUint8(read(1));
            if (level) {
                modifiers[Items.MODIFIER_TYPE_TIMEWALKER_LEVEL] = level;
            }
        }
        let bonuses = [];
        for (let remainingBonuses = view.getUint8(read(1)); remainingBonuses > 0; remainingBonuses--) {
            bonuses.push(view.getUint16(read(2), true));
        }
        bonuses.sort((a, b) => a - b);
        let stats = new Set();
        bonuses.forEach(bonus => bonusToStats[bonus]?.forEach(stat => stats.add(stat)));
        result.specifics.push({
            price: price,
            modifiers: modifiers,
            bonuses: bonuses,
            stats: Array.from(stats.values()),
        });
    }
    result.specifics.sort((a, b) => a.price - b.price);

    result.snapshots = [];
    let deltas = {};
    let prevDelta;
    for (let remaining = view.getUint16(read(2), true); remaining > 0; remaining--) {
        let snapshot = view.getUint32(read(4), true) * MS_SEC;
        let price = view.getUint32(read(4), true) * COPPER_SILVER;
        let quantity = view.getUint32(read(4), true);
        deltas[snapshot] = {snapshot: snapshot, price: price, quantity: quantity};
        // Workaround for when data collection didn't carry over the price when quantity became zero.
        if (deltas[snapshot].quantity === 0 && prevDelta && deltas[snapshot].price === 0) {
            deltas[snapshot].price = prevDelta.price;
        }
        prevDelta = deltas[snapshot];
    }

    if (prevDelta) {
        prevDelta = deltas[Object.keys(deltas)[0]];
        (await getSnapshotList(realm)).forEach(timestamp => {
            if (deltas[timestamp]) {
                // Something changed at this timestamp, and we have new stats.
                prevDelta = deltas[timestamp];
                result.snapshots.push(deltas[timestamp]);
            } else if (prevDelta.snapshot < timestamp) {
                // There were no changes recorded at this snapshot, assume it's the same as the prev snapshot.
                result.snapshots.push({
                    snapshot: timestamp,
                    price: prevDelta.price,
                    quantity: prevDelta.quantity,
                });
            } else {
                // prevDelta.snapshot > timestamp, which means our first record of this item came after now.
                result.snapshots.push({
                    snapshot: timestamp,
                    price: 0, // We don't know its price, we haven't seen it yet.
                    quantity: 0, // We know we saw a snapshot at this timestamp, but no item, so quantity = 0.
                });
            }
        });
    }

    result.daily = [];
    if (dailyHistory) {
        for (let remaining = view.getUint16(read(2), true); remaining > 0; remaining--) {
            let snapshot = view.getUint16(read(2), true) * MS_DAY;
            let price = view.getUint32(read(4), true) * COPPER_SILVER;
            let quantity = view.getUint32(read(4), true);
            let dayState = {snapshot: snapshot, price: price, quantity: quantity};
            if (result.daily.length > 0) {
                let prevSeen = result.daily[result.daily.length - 1];
                let lostDay = prevSeen.snapshot + MS_DAY;
                while (lostDay < dayState.snapshot) {
                    result.daily.push({snapshot: lostDay, price: prevSeen.price, quantity: 0});
                    lostDay += MS_DAY;
                }
            }
            result.daily.push(dayState);
        }
    }

    return result;
}

/**
 * Given a realm object, return its current realm state. May return a cached object shared between calls.
 *
 * @param {Realm} realm
 * @return {Promise<RealmState>}
 */
async function getRealmState(realm) {
    let isCommodityRealm = Object.values(COMMODITY_REALMS).includes(realm.connectedId);
    let lastStateKey = isCommodityRealm ? 'lastCommodityRealmState' : 'lastRealmState';

    if (
        my[lastStateKey].data &&
        my[lastStateKey].id === realm.connectedId &&
        my[lastStateKey].checked > Date.now() - REALM_STATE_CACHE_DURATION
    ) {
        return my[lastStateKey].data;
    }

    let response;
    let commodityRealmState;
    let promises = [
        (async () => {
            response = await Progress.fetch(`data/${realm.connectedId}/state.bin`, {mode: 'same-origin'});
        })(),
    ];
    if (!isCommodityRealm) {
        promises.push((async () => {
            commodityRealmState = await getRealmState(getCommodityRealm(realm.region));
        })());
    }
    await Promise.all(promises);

    if (!response.ok) {
        throw "Unable to get realm state for " + realm.connectedId;
    }

    if (
        my[lastStateKey].data &&
        my[lastStateKey].id === realm.connectedId &&
        my[lastStateKey].modified === response.headers.get('last-modified')
    ) {
        my[lastStateKey].checked = Date.now();

        return my[lastStateKey].data;
    }

    const buffer = await response.arrayBuffer();
    const view = new DataView(buffer);

    let offset = 0;
    const read = function (byteCount) {
        let result = offset;
        offset += byteCount;

        return result;
    };

    let version = view.getUint8(read(1));
    let hasBonusStatItems = true;
    switch (version) {
        case 3:
            hasBonusStatItems = false;
            break;
        case VERSION_REALM_STATE:
            // no op
            break;
        default:
            throw "Unknown data version for realm state.";
    }

    /** @type {RealmState} result */
    const result = {};
    result.realm = {};
    co(result.realm, realm);
    result.snapshot = view.getUint32(read(4), true) * MS_SEC;
    result.lastCheck = view.getUint32(read(4), true) * MS_SEC;
    result.snapshots = [];
    for (let remaining = view.getUint16(read(2), true); remaining > 0; remaining--) {
        result.snapshots.push(view.getUint32(read(4), true) * MS_SEC);
    }
    result.summary = {};
    result.variants = {};
    result.speciesVariants = {};
    for (let remaining = view.getUint32(read(4), true); remaining > 0; remaining--) {
        let itemId = view.getUint32(read(4), true);
        let itemLevel = view.getUint16(read(2), true);
        let itemSuffix = view.getUint16(read(2), true);
        let itemKeyString = Items.stringifyKeyParts(itemId, itemLevel, itemSuffix);
        if (itemId === ITEM_PET_CAGE) {
            if (itemSuffix) {
                result.speciesVariants[itemLevel] = result.speciesVariants[itemLevel] || [];
                result.speciesVariants[itemLevel].push(itemKeyString);
            }
        } else {
            if (itemLevel) {
                result.variants[itemId] = result.variants[itemId] || [];
                result.variants[itemId].push(itemKeyString);
            }
        }

        let snapshot = view.getUint32(read(4), true) * MS_SEC;
        let price = view.getUint32(read(4), true) * COPPER_SILVER;
        let quantity = view.getUint32(read(4), true);
        result.summary[itemKeyString] = {
            snapshot: snapshot,
            price: price,
            quantity: quantity,
        };
    }
    result.bonusStatItems = {};
    if (hasBonusStatItems) {
        for (let statCount = view.getUint8(read(1)); statCount > 0; statCount--) {
            const statId = view.getUint8(read(1));
            result.bonusStatItems[statId] = [];
            for (let keyCount = view.getUint16(read(2), true); keyCount > 0; keyCount--) {
                const itemId = view.getUint32(read(4), true);
                const itemLevel = view.getUint16(read(2), true);
                const itemSuffix = view.getUint16(read(2), true);
                const itemKeyString = Items.stringifyKeyParts(itemId, itemLevel, itemSuffix);
                result.bonusStatItems[statId].push(itemKeyString);
            }
        }
    }

    if (!isCommodityRealm) {
        mergeCommodityData(result, commodityRealmState);
    }

    my[lastStateKey] = {
        id: realm.connectedId,
        modified: response.headers.get('last-modified'),
        checked: Date.now(),
        data: result,
    };

    return result;
}

/**
 * Returns the region state for the given region. May return a cached object shared between calls.
 *
 * @param {Region} region
 * @return {Promise<RegionState>}
 */
async function getRegionState(region) {
    if (
        my.lastRegionState.data &&
        my.lastRegionState.region === region &&
        my.lastRegionState.checked > Date.now() - REALM_STATE_CACHE_DURATION
    ) {
        return my.lastRegionState.data;
    }

    const response = await Progress.fetch(`data/global/region-${region}.bin`, {mode: 'same-origin'});
    if (!response.ok) {
        throw `Unable to get region state for ${region}`;
    }

    if (
        my.lastRegionState.data &&
        my.lastRegionState.region === region &&
        my.lastRegionState.modified === response.headers.get('last-modified')
    ) {
        my.lastRegionState.checked = Date.now();

        return my.lastRegionState.data;
    }

    const buffer = await response.arrayBuffer();
    const view = new DataView(buffer);

    let offset = 0;
    const read = function (byteCount) {
        let result = offset;
        offset += byteCount;

        return result;
    };

    let hasArbitrage = true;

    let version = view.getUint8(read(1));
    switch (version) {
        case 1:
            hasArbitrage = false;
            break;

        case VERSION_REGION_STATE:
            // no op
            break;

        default:
            throw `Unknown data version for region state for ${region}.`;
    }

    /** @type {RegionState} result */
    const result = {
        region,
        arbitrage: {},
        arbitrageVariants: {},
        arbitrageSpeciesVariants: {},
        items: {},
    };
    let lastItemId = 0;
    for (let remaining = view.getUint32(read(4), true); remaining > 0; remaining--) {
        let itemId = lastItemId + view.getUint16(read(2), true);
        let itemLevel = view.getUint16(read(2), true);
        let itemSuffix = view.getUint16(read(2), true);
        let itemKeyString = Items.stringifyKeyParts(itemId, itemLevel, itemSuffix);

        result.items[itemKeyString] = view.getUint32(read(4), true) * COPPER_SILVER;
        lastItemId = itemId;
    }

    if (hasArbitrage) {
        let lastItemId = 0;
        for (let remaining = view.getUint32(read(4), true); remaining > 0; remaining--) {
            let itemId = lastItemId + view.getUint16(read(2), true);
            let itemLevel = view.getUint16(read(2), true);
            let itemSuffix = view.getUint16(read(2), true);
            let itemKeyString = Items.stringifyKeyParts(itemId, itemLevel, itemSuffix);

            if (itemId === ITEM_PET_CAGE) {
                if (itemSuffix) {
                    result.arbitrageSpeciesVariants[itemLevel] ??= [];
                    result.arbitrageSpeciesVariants[itemLevel].push(itemKeyString);
                }
            } else {
                result.arbitrageVariants[itemId] ??= [];
                result.arbitrageVariants[itemId].push(itemKeyString);
            }

            let realms = view.getUint8(read(1))
            let min = view.getUint32(read(4), true) * COPPER_SILVER;
            result.arbitrage[itemKeyString] = {min, realms};
            lastItemId = itemId;
        }

        // Remove the base variants from the item variants list when that item has multiple variants.
        // This allows us to include prior expansion items which don't have variant pricing data in our lists
        // which would normally ignore them, but but not include those base variants which have pricing data for
        // specific variants for the current expansion.
        Object.entries(result.arbitrageVariants)
            .filter(([itemIdString, itemKeys]) => itemKeys.length > 1)
            .forEach(([itemIdString, itemKeys]) => {
                const baseKey = Items.stringifyKeyParts(parseInt(itemIdString), 0, 0);
                const baseKeyIndex = itemKeys.indexOf(baseKey);
                if (baseKeyIndex >= 0) {
                    itemKeys.splice(baseKeyIndex, 1);
                }
            });
    }

    my.lastRegionState = {
        region: region,
        modified: response.headers.get('last-modified'),
        checked: Date.now(),
        data: result,
    };

    return result;
}

/**
 * Returns an array of snapshot timestamps for the given realm.
 *
 * @param {Realm} realm
 * @return {Promise<Timestamp[]>}
 */
async function getSnapshotList(realm) {
    return (await fetchSnapshotList())[realm.connectedId] || [];
}

/**
 * Applies data from the commodity realm state on top of the base realm state.
 *
 * @param {RealmState} realmState
 * @param {RealmState} commodityRealmState
 */
function mergeCommodityData(realmState, commodityRealmState) {
    let closestCache = {};
    let getClosestSnapshot = commSnapshot => {
        let snapshots = realmState.snapshots.slice();
        snapshots.sort((a, b) => Math.abs(a - commSnapshot) - Math.abs(b - commSnapshot));

        return closestCache[commSnapshot] = snapshots[0];
    }

    for (const [keyString, itemData] of Object.entries(commodityRealmState.summary)) {
        itemData.snapshot = closestCache[itemData.snapshot] || getClosestSnapshot(itemData.snapshot);
        realmState.summary[keyString] = itemData;
    }
}
