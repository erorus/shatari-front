import {
    canHover,
    createElement as ce,
    copyObject as co,
    createSVGElement as svge,
    createText as ct,
    emptyElement as ee,
    priceElement,
    querySelector as qs,
    querySelectorAll as qsa,
    timeString,
    updateDeltaTimestamps,
    waitForHighstock,
} from './js/utils.js';
import {
    COPPER_SILVER,
    COPPER_GOLD,
    ITEM_PET_CAGE,
    MS_SEC,
    MS_MINUTE,
    MS_HOUR,
    MS_DAY,
    NBSP,
    SIDE_ALLIANCE,
    SIDE_HORDE,
} from './js/constants.js';

import Locales from './js/Locales.js';
import Progress from './js/Progress.js';
import Realms from './js/Realms.js';
import UndermineMigration from './js/UndermineMigration.js';

    /**
     * @typedef {Object} ArbitrageLine
     * @property {Money} min
     * @property {number} realms
     */

    /**
     * @typedef {Object} Auction
     * @property {Money} price
     * @property {number} quantity
     */

    /**
     * @typedef {Object} AuctionDetail
     * @property {number[]} bonuses
     * @property {Object.<number, number>} modifiers
     * @property {Money} price
     * @property {number[]} stats List of unique tertiary stat IDs
     */

    /** @typedef {number} BattlePetSpeciesID */

    /**
     * @typedef {Object} BattlePetSpecies
     * @property {number} display
     * @property {number} expansion
     * @property {string} icon
     * @property {number} npc
     * @property {number} [side]
     * @property {number} type
     */

    /**
     * @typedef {Object} BattlePetStats
     * @property {number} power
     * @property {number} stamina
     * @property {number} speed
     */

    /** @typedef {number} ClassID */

    /** @typedef {number} ConnectedRealmID */

    /**
     * @typedef {Object} ConnectedRealm
     * @property {Region} region
     * @property {ConnectedRealmID} id
     * @property {Realm} canonical
     * @property {Realm[]} secondary
     */

    /**
     * @typedef {Object} DealsPrices
     * @property {Money} regionMedian
     * @property {Money} dealPrice
     */

    /**
     * @typedef {object} DealsState
     * @property {Object<ItemKeyString, DealsPrices>} items
     */

    /** @typedef {number} InventoryType */

    /** @typedef {number} ItemID */

    /** @typedef {string} ItemKeyString */

    /** @typedef {number} SuffixID */

    /**
     * @typedef {object} ItemKey
     * @property {ItemID} itemId
     * @property {number} itemLevel
     * @property {SuffixID} itemSuffix
     */

    /** @typedef {number} Money  Expressed in coppers. */

    /**
     * @typedef {UnnamedItem} Item
     * @property {BattlePetStats} [battlePetStats]
     * @property {number} [battlePetType]
     * @property {number} bonusLevel
     * @property {SuffixID} bonusSuffix
     * @property {ItemID} id
     * @property {string} name
     * @property {number} [npc]
     */

    /**
     * @typedef {object} ItemState
     * @property {Auction[]}       auctions   An array of distinct prices and quantities, ordered by price ascending
     * @property {SummaryLine[]}   daily      A list of summary prices by day, order by snapshot ascending
     * @property {Item}            item
     * @property {Realm}           realm
     * @property {Money}           price      The cheapest price when this item was last seen
     * @property {number}          quantity   How many were available when this was last seen
     * @property {Timestamp}       snapshot   The last snapshot when this item was seen
     * @property {SummaryLine[]}   snapshots  An array of summary prices, order by snapshot ascending
     * @property {AuctionDetail[]} specifics  An array of prices and bonus information, ordered by price ascending
     */

    /**
     * @typedef {Item} PricedItem Only to be used in search result lists.
     * @property {Money}     price
     * @property {number}    quantity
     * @property {Money}     [regionMedian]
     * @property {Timestamp} snapshot
     */

    /**
     * @typedef {Object} Realm
     * @property {string}           category
     * @property {ConnectedRealmID} connectedId
     * @property {RealmID}          id
     * @property {string}           name
     * @property {string}           [nativeName]
     * @property {number}           population
     * @property {string}           populationName
     * @property {Region}           region
     * @property {string}           slug
     */

    /** @typedef {number} RealmID */

    /**
     * @typedef {Object} RealmState
     * @property {Realm} realm
     * @property {Timestamp} snapshot   The timestamp of the most recent snapshot
     * @property {Timestamp} lastCheck  The timestamp when we last checked for a new snapshot
     * @property {Timestamp[]} snapshots  An array of snapshot timestamps, in ascending order
     * @property {Object.<ItemKeyString, SummaryLine>} summary
     * @property {Object.<ItemID, Array<ItemKeyString>>} variants
     * @property {Object.<BattlePetSpeciesID, Array<ItemKeyString>>} speciesVariants
     * @property {Object.<StatID, Array<ItemKeyString>>} bonusStatItems
     */

    /** @typedef {string} Region "us" or "eu", etc. */

    /**
     * @typedef {object} RegionState
     * @property {Region} region
     * @property {Object.<ItemKeyString, ArbitrageLine>} arbitrage
     * @property {Object.<ItemID, Array<ItemKeyString>>} arbitrageVariants
     * @property {Object.<BattlePetSpeciesID, Array<ItemKeyString>>} arbitrageSpeciesVariants
     * @property {Object.<ItemKeyString, Money>} items
     */

    /** @typedef {number} StatID */

    /** @typedef {number} SubclassID */

    /**
     * @typedef {Object} SummaryLine
     * @property {Timestamp} snapshot  When this item was last seen
     * @property {Money}     price     The cheapest price when it was last seen
     * @property {number}    quantity  The total quantity available when it was last seen
     */

    /** @typedef {number} Timestamp  A UNIX timestamp, in milliseconds. */

    /**
     * @typedef {object} TokenState
     * @property {Region}        region
     * @property {Money}         price
     * @property {Timestamp}     snapshot   When the token price last changed
     * @property {SummaryLine[]} snapshots  An array of prices, order by snapshot ascending
     */

    /**
     * @typedef {object} UnnamedItem
     * @property {boolean} [bop]
     * @property {number} class
     * @property {number} [craftingQualityTier]
     * @property {number} [display]
     * @property {number} expansion
     * @property {number[]} [extraFilters]
     * @property {string} icon
     * @property {InventoryType} [inventoryType]
     * @property {number} [itemLevel]
     * @property {number} quality
     * @property {number} [reqLevel]
     * @property {number} [side]
     * @property {number} [slots]
     * @property {number} [squishEra]
     * @property {number} [squishedItemLevel]
     * @property {number} [stack]
     * @property {number} subclass
     * @property {number} [vendorBuy]
     * @property {number} [vendorSell]
     * @property {number} [vendorSellBase]
     * @property {number} [vendorSellFactor]
     */

    /**
     * Manages item prices and availability.
     */
    const Auctions = new function () {
        const self = this;

        // ********************* //
        // ***** CONSTANTS ***** //
        // ********************* //

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

        // ********************* //
        // ***** VARIABLES ***** //
        // ********************* //

        const my = {
            bonusToStats: undefined,
            lastCommodityRealmState: {},
            lastRealmState: {},
            lastRegionState: {},

            lastSnapshotList: {},
        };

        // ********************* //
        // ***** FUNCTIONS ***** //
        // ********************* //

        // ------ //
        // PUBLIC //
        // ------ //

        /**
         * Returns the deals state for the given realm.
         *
         * @param {Realm|null} realm
         * @return {Promise<DealsState>}
         */
        this.getDeals = async function (realm) {
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
        };

        /**
         * Given an item object, return its item state for the current/given realm.
         *
         * @param {Item} item
         * @param {Realm|null} realm
         * @return {Promise<ItemState>}
         */
        this.getItem = async function (item, realm) {
            realm = realm || Realms.getCurrentRealm();

            if (item.stack > 1) {
                realm = getCommodityRealm(realm.region);
            }

            return getItemState(realm, self.strip(item), !!realm);
        }

        /**
         * Return the current realm's state. May return a cached object shared between calls.
         *
         * @return {Promise<RealmState>}
         */
        this.getRealmState = async function () {
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
        };

        /**
         * Returns the current realm's region state. May return a cached object shared between calls.
         *
         * @returns {Promise<RegionState>}
         */
        this.getRegionState = async () => await getRegionState(Realms.getCurrentRealm().region);

        /**
         * Return the WoW token state for the given realm.
         *
         * @param {Realm|null} realm
         * @return {Promise<TokenState>}
         */
        this.getToken = async function (realm) {
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
        }

        /**
         * Hydrates a list of items with prices and quantities for the currently-selected realm.
         *
         * @param {Item[]} items
         * @param {boolean} [arbitrage]
         * @param {Realm|undefined} [realm]
         * @param {boolean} [regionMedian]
         * @return {Promise<PricedItem[]>}
         */
        this.hydrateList = async function (items, {arbitrage, realm, regionMedian}) {
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
        }

        /**
         * Converts a PricedItem object back to a simple Item.
         *
         * @param {PricedItem|Item} pricedItem
         * @return {Item}
         */
        this.strip = pricedItem => {
            const {price, quantity, regionMedian, snapshot, ...result} = pricedItem;

            return result;
        };

        // ------- //
        // PRIVATE //
        // ------- //


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
                    // no break
                case 4:
                    dailyHistory = false;
                    // no break
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
    };

    /**
     * Manages the categories sidebar list.
     */
    const Categories = new function () {
        /**
         * @typedef {Object} Category
         * @property {string}        name
         * @property {ClassID}       class
         * @property {DetailColumn}  [detailColumn]
         * @property {Subcategory[]} [subcategories]
         */

        /**
         * @typedef {Object} DetailColumn
         * @property {string} prop  The field in an Item with the value for this column
         * @property {string} name
         */

        /**
         * @typedef {Object} Subcategory
         * @property {string}          name
         * @property {ClassID}         class
         * @property {StatID}          [bonusStat]
         * @property {number[]}        [extraFilters]
         * @property {InventoryType[]} [invTypes]
         * @property {SubclassID}      [subClass]
         * @property {SubclassID[]}    [subClasses]
         * @property {Subcategory[]}   [subcategories]
         */

        // ********************* //
        // ***** VARIABLES ***** //
        // ********************* //

        /**
         * @type {{
         *  bonusStat: StatID|undefined,
         *  classId: ClassID|undefined,
         *  extraFilters: number[]|undefined,
         *  invTypes: InventoryType[]|undefined,
         *  subClassId: SubclassID|undefined,
         *  subClassIds: SubclassID[]|undefined,
         *  detailColumn: DetailColumn|undefined,
         *  hashCode: string|undefined,
         *  categories: Category[],
         *  battlePetTypes: Object.<number, string>,
         *  }}
         */
        const my = {
            categories: undefined,
            battlePetTypes: {},

            classId: undefined,
            bonusStat: undefined,
            extraFilters: undefined,
            invTypes: undefined,
            subClassId: undefined,
            subClassIds: undefined,
            hashCode: undefined,

            detailColumn: undefined,
        };

        // ********************* //
        // ***** FUNCTIONS ***** //
        // ********************* //

        // ------ //
        // PUBLIC //
        // ------ //

        /**
         * Given a battle pet type ID, return its name.
         *
         * @param {number} typeId
         * @return {string|undefined}
         */
        this.getBattlePetTypeName = function (typeId) {
            return my.battlePetTypes[typeId];
        };

        /**
         * Returns bonus stat ID to use in search filtering, or undefined for none.
         *
         * @return {number[]}
         */
        this.getBonusStat = function () {
            return my.bonusStat;
        };

        /**
         * Returns the class ID to use in search filtering, or undefined for none.
         *
         * @return {ClassID|undefined}
         */
        this.getClassId = function () {
            return my.classId;
        };

        /**
         * Returns the detail column to show in the item list, based on the selected category.
         *
         * @return {DetailColumn|undefined}
         */
        this.getDetailColumn = function () {
            if (!my.detailColumn) {
                return;
            }

            let result = {};
            co(result, my.detailColumn);

            return result;
        };

        /**
         * Returns extra filter IDs to use in search filtering, or undefined for none.
         *
         * @return {number[]}
         */
        this.getExtraFilters = function () {
            return my.extraFilters && my.extraFilters.slice(0);
        };

        /**
         * Returns the hash code of the currently-selected category/subcategory/subsubcategory.
         *
         * @return {string}
         */
        this.getHashCode = function () {
            return my.hashCode || '';
        };

        /**
         * Returns the inventory type IDs to use in search filtering, or undefined for none.
         *
         * @return {InventoryType[]}
         */
        this.getInvTypes = function () {
            return my.invTypes && my.invTypes.slice(0);
        };

        /**
         * Returns the subclass IDs to use in search filtering, or undefined for none.
         *
         * @return {SubclassID[]|undefined}
         */
        this.getSubClassIds = function () {
            return my.subClassIds && my.subClassIds.slice(0) ||
                my.subClassId !== undefined && [my.subClassId] ||
                undefined;
        };

        /**
         * Returns the name of the WoW Token in the current locale, since it's a BoP item (and not included in our item
         * names) but is a category name.
         *
         * @return {string}
         */
        this.getTokenName = function () {
            let tokenName = 'WoW Token';

            my.categories.forEach(category => {
                if (category['class'] === Items.CLASS_WOW_TOKEN) {
                    tokenName = category.name;
                }
            });

            return tokenName;
        };

        /**
         * Fetches the category list data and creates its elements in the category div.
         */
        this.init = async function () {
            const data = await getCategories();

            const categoriesParent = qs('.main .categories');
            ee(categoriesParent);

            /**
             * Sets a unique hash code dataset property, based on other dataset properties of the given div.
             *
             * @param {HTMLElement} catDiv
             */
            let setHashCode = function (catDiv) {
                let hashCode = catDiv.dataset.classId + '.';
                if (catDiv.dataset.subClassId) {
                    hashCode += catDiv.dataset.subClassId;
                } else if (catDiv.dataset.subClassIds) {
                    hashCode += catDiv.dataset.subClassIds.replace(/,/g, '_');
                }
                hashCode += '.';
                hashCode += (catDiv.dataset.invTypes || '').replace(/,/g, '_') + '.';
                hashCode += (catDiv.dataset.extraFilters || '').replace(/,/g, '_') + '.';
                hashCode += (catDiv.dataset.bonusStat || '');
                hashCode = hashCode.replace(/\.+$/, '');

                catDiv.dataset.hashCode = hashCode;
            };

            data.forEach(function (cat) {
                const catDiv = ce(
                    'div',
                    {
                        className: 'category',
                        dataset: {
                            classId: cat['class'],
                        },
                    },
                    getNameNode(cat)
                );
                if (cat.detailColumn) {
                    catDiv.dataset.detailColumn = JSON.stringify(cat.detailColumn);
                }
                setHashCode(catDiv);
                categoriesParent.appendChild(catDiv);
                catDiv.addEventListener('click', clickCategory.bind(null, catDiv));
                if (cat['class'] === Items.CLASS_WOW_TOKEN) {
                    catDiv.classList.add('q8');
                }

                if (!cat.subcategories) {
                    return;
                }

                let subCatIndex = -1;
                cat.subcategories.forEach(function (subcat) {
                    const subcatDiv = ce(
                        'div',
                        {
                            className: 'subcategory',
                            dataset: {
                                parentClass: cat['class'],
                                classId: subcat['class'],
                                subCategoryIndex: ++subCatIndex,
                            },
                        },
                        getNameNode(subcat)
                    );
                    if (subcat.hasOwnProperty('subClass')) {
                        subcatDiv.dataset.subClassId = subcat.subClass;
                    } else if (subcat.hasOwnProperty('subClasses')) {
                        subcatDiv.dataset.subClassIds = subcat.subClasses.join(',');
                    }
                    if (subcat.hasOwnProperty('invTypes')) {
                        subcatDiv.dataset.invTypes = subcat.invTypes.join(',');
                    }
                    if (subcat.hasOwnProperty('extraFilters')) {
                        subcatDiv.dataset.extraFilters = subcat.extraFilters.join(',');
                    }
                    if (subcat.hasOwnProperty('bonusStat')) {
                        subcatDiv.dataset.bonusStat = `${subcat.bonusStat}`;
                    }
                    setHashCode(subcatDiv);
                    categoriesParent.appendChild(subcatDiv);
                    subcatDiv.addEventListener('click', clickSubCategory.bind(null, subcatDiv));

                    if (!subcat.subcategories) {
                        return;
                    }

                    subcat.subcategories.forEach(function (subsubcat) {
                        const subsubcatDiv = ce(
                            'div',
                            {
                                className: 'subsubcategory',
                                dataset: {
                                    parentClass: cat['class'],
                                    parentSubCategory: subCatIndex,
                                    classId: subsubcat['class'],
                                },
                            },
                            getNameNode(subsubcat)
                        );
                        if (subsubcat.hasOwnProperty('subClass')) {
                            subsubcatDiv.dataset.subClassId = subsubcat.subClass;
                        } else if (subsubcat.hasOwnProperty('subClasses')) {
                            subsubcatDiv.dataset.subClassIds = subsubcat.subClasses.join(',');
                        }
                        if (subsubcat.hasOwnProperty('invTypes')) {
                            subsubcatDiv.dataset.invTypes = subsubcat.invTypes.join(',');
                        }
                        if (subsubcat.hasOwnProperty('extraFilters')) {
                            subsubcatDiv.dataset.extraFilters = subsubcat.extraFilters.join(',');
                        }
                        if (subsubcat.hasOwnProperty('bonusStat')) {
                            subsubcatDiv.dataset.bonusStat = `${subsubcat.bonusStat}`;
                        }
                        setHashCode(subsubcatDiv);
                        categoriesParent.appendChild(subsubcatDiv);
                        subsubcatDiv.addEventListener('click', clickSubSubCategory.bind(null, subsubcatDiv));
                    });
                });
            });

            Locales.registerCallback(onLocaleChange);
        };

        /**
         * Resets all category selections, then selects the category leaf matching the given hash code.
         *
         * @param {string} hashCode
         */
        this.setHashCode = function (hashCode) {
            deselectAll();

            hashCode = hashCode.replace(/[^-\d._]/g, '');
            if (!hashCode) {
                return;
            }

            let node = qs('.main .categories > div[data-hash-code="' + hashCode + '"]');
            if (!node) {
                return;
            }

            let subsubCatDiv;
            let subCatDiv;
            let catDiv;
            if (node.classList.contains('subsubcategory')) {
                subsubCatDiv = node;

                {
                    let selector = '.main .categories .subcategory';
                    selector += '[data-parent-class="' + subsubCatDiv.dataset.parentClass + '"]';
                    selector += '[data-sub-category-index="' + subsubCatDiv.dataset.parentSubCategory + '"]';

                    subCatDiv = qs(selector);
                }

                {
                    let selector = '.main .categories .category';
                    selector += '[data-class-id="' + subsubCatDiv.dataset.parentClass + '"]';
                    catDiv = qs(selector);
                }
            } else if (node.classList.contains('subcategory')) {
                subCatDiv = node;

                {
                    let selector = '.main .categories .category';
                    selector += '[data-class-id="' + subCatDiv.dataset.parentClass + '"]';
                    catDiv = qs(selector);
                }
            } else if (node.classList.contains('category')) {
                catDiv = node;
            }

            if (catDiv) {
                clickCategory(catDiv);
            }
            if (subCatDiv) {
                clickSubCategory(subCatDiv);
            }
            if (subsubCatDiv) {
                clickSubSubCategory(subsubCatDiv);
            }
        };

        // ------- //
        // PRIVATE //
        // ------- //

        /**
         * Event handler for clicking a primary category.
         *
         * @param {HTMLElement} catDiv
         */
        function clickCategory(catDiv) {
            const classId = parseInt(catDiv.dataset.classId);
            const wasSelected = !!catDiv.dataset.selected;
            const oldClassId = my.classId;

            deselectAll();

            if (!wasSelected) {
                // Select this category.
                catDiv.dataset.selected = 1;
                my.classId = classId;
                my.detailColumn = catDiv.dataset.detailColumn ? JSON.parse(catDiv.dataset.detailColumn) : undefined;
                my.hashCode = catDiv.dataset.hashCode;

                // Show any subcategories under this category.
                qsa('.main .categories .subcategory[data-parent-class="' + classId + '"]').forEach(function (node) {
                    node.dataset.visible = 1;
                });
            }

            if (my.classId === Items.CLASS_WOW_TOKEN) {
                // Jump straight to the WoW Token detail panel.
                Detail.showWowToken();
            } else if (oldClassId === Items.CLASS_WOW_TOKEN) {
                // Exit WoW Token mode.
                Detail.hide();
            }
        }

        /**
         * Event handler for clicking a subcategory.
         *
         * @param {HTMLElement} subCatDiv
         */
        function clickSubCategory(subCatDiv) {
            const wasSelected = !!subCatDiv.dataset.selected;

            // De-select every subcategory.
            qsa('.main .categories .subcategory[data-selected]').forEach(function (node) {
                delete node.dataset.selected;
            });

            // De-select and hide every subsubcategory.
            qsa('.main .categories .subsubcategory').forEach(function (node) {
                delete node.dataset.selected;
                delete node.dataset.visible;
            });

            if (!wasSelected) {
                // Select this subcategory.
                subCatDiv.dataset.selected = 1;

                my.classId = parseInt(subCatDiv.dataset.classId);
                if (subCatDiv.dataset.hasOwnProperty('subClassId')) {
                    my.subClassId = parseInt(subCatDiv.dataset.subClassId);
                } else {
                    my.subClassId = undefined;
                }
                my.subClassIds = subCatDiv.dataset.hasOwnProperty('subClassIds') &&
                    subCatDiv.dataset.subClassIds.split(',').map(value => parseInt(value)) || undefined;
                my.invTypes = subCatDiv.dataset.hasOwnProperty('invTypes') &&
                    subCatDiv.dataset.invTypes.split(',').map(value => parseInt(value)) || undefined;
                my.extraFilters = subCatDiv.dataset.hasOwnProperty('extraFilters') &&
                    subCatDiv.dataset.extraFilters.split(',').map(value => parseInt(value)) || undefined;
                my.bonusStat = subCatDiv.dataset.hasOwnProperty('bonusStat') &&
                    parseInt(subCatDiv.dataset.bonusStat) || undefined;
                my.hashCode = subCatDiv.dataset.hashCode;

                // Show any subsubcategories under this subcategory.
                let selector = '.main .categories .subsubcategory';
                selector += '[data-parent-class="' + subCatDiv.dataset.classId + '"]';
                selector += '[data-parent-sub-category="' + subCatDiv.dataset.subCategoryIndex + '"]';
                qsa(selector).forEach(function (node) {
                    node.dataset.visible = 1;
                });
            } else {
                // De-select this subcategory, reverting back to the parent category criteria.
                my.classId = parseInt(subCatDiv.dataset.parentClass);
                my.subClassId = undefined;
                my.subClassIds = undefined;
                my.invTypes = undefined;
                my.extraFilters = undefined;
                my.bonusStat = undefined;

                let selector = '.main .categories .category';
                selector += '[data-class-id="' + subCatDiv.dataset.parentClass + '"]';
                const catDiv = qs(selector);
                my.hashCode = catDiv ? catDiv.dataset.hashCode : subCatDiv.dataset.parentClass;
            }
        }

        /**
         * Event handler for clicking a subsubcategory.
         *
         * @param {HTMLElement} subsubCatDiv
         */
        function clickSubSubCategory(subsubCatDiv) {
            const wasSelected = !!subsubCatDiv.dataset.selected;

            // De-select every subsubcategory.
            qsa('.main .categories .subsubcategory[data-selected]').forEach(function (node) {
                delete node.dataset.selected;
            });

            if (!wasSelected) {
                // Select this subsubcategory.
                subsubCatDiv.dataset.selected = 1;

                my.classId = parseInt(subsubCatDiv.dataset.classId);
                my.subClassId = parseInt(subsubCatDiv.dataset.subClassId);
                my.subClassIds = subsubCatDiv.dataset.hasOwnProperty('subClassIds') &&
                    subsubCatDiv.dataset.subClassIds.split(',').map(value => parseInt(value)) || undefined;
                my.invTypes = subsubCatDiv.dataset.hasOwnProperty('invTypes') &&
                    subsubCatDiv.dataset.invTypes.split(',').map(value => parseInt(value)) || undefined;
                my.extraFilters = subsubCatDiv.dataset.hasOwnProperty('extraFilters') &&
                    subsubCatDiv.dataset.extraFilters.split(',').map(value => parseInt(value)) || undefined;
                my.bonusStat = subsubCatDiv.dataset.hasOwnProperty('bonusStat') &&
                    parseInt(subsubCatDiv.dataset.bonusStat) || undefined;
                my.hashCode = subsubCatDiv.dataset.hashCode;
            } else {
                // De-select this subsubcategory, reverting back to the parent subcategory criteria.
                let selector = '.main .categories .subcategory';
                selector += '[data-parent-class="' + subsubCatDiv.dataset.parentClass + '"]';
                selector += '[data-sub-category-index="' + subsubCatDiv.dataset.parentSubCategory + '"]';

                const subCatDiv = qs(selector);
                delete subCatDiv.dataset.selected;
                clickSubCategory(subCatDiv);
            }
        }

        /**
         * De-selects all categories, returning to the initial state.
         */
        function deselectAll() {
            qsa('.main .categories > div').forEach(function (node) {
                delete node.dataset.selected;
                delete node.dataset.visible;
            });
            my.classId = undefined;
            my.subClassId = undefined;
            my.subClassIds = undefined;
            my.invTypes = undefined;
            my.extraFilters = undefined;
            my.bonusStat = undefined;
            my.detailColumn = undefined;
            my.hashCode = undefined;
        }

        /**
         * Fetches (if necessary) and returns the categories list.
         *
         * @return {Promise<Category[]>}
         */
        async function getCategories() {
            if (my.categories) {
                return my.categories;
            }

            const locale = Locales.getCurrent();
            const response = await Progress.fetch('json/categories.' + locale + '.json', {mode:'same-origin'});
            if (!response.ok) {
                throw 'Cannot get list of categories!';
            }

            my.categories = await response.json();
            my.categories.forEach(category => {
                if (category['class'] === Items.CLASS_BATTLE_PET) {
                    category.subcategories.forEach(subcategory => {
                        if (subcategory.subClass > 0) {
                            my.battlePetTypes[subcategory.subClass] = subcategory.name;
                        }
                    });
                }
            });

            return my.categories;
        }

        /**
         * Parses the colors out of a name string and returns a node to use in the category div.
         *
         * @param {Category|Subcategory} cat
         * @return {Node}
         */
        function getNameNode(cat) {
            const nameString = cat.name;
            let match = /^\|c([0-9a-f]{2})([0-9a-f]{6})(.*)\|r$/.exec(nameString);
            if (match) {
                return ce('span', {style: {color: '#' + match[2] + match[1]}}, ct(match[3]));
            }
            if (cat.bonusStat) {
                return ce('span', {className: 'q2'}, ct(nameString));
            }

            return ct(nameString);
        }

        /**
         * Called when the user changes their preferred locale, this updates the UI with the new names.
         *
         * @param {string} locale
         */
        async function onLocaleChange(locale) {
            my.categories = undefined;
            my.battlePetTypes = {};

            my.classId = undefined;
            my.subClassId = undefined;
            my.subClassIds = undefined;
            my.invTypes = undefined;
            my.extraFilters = undefined;
            my.bonusStat = undefined;
            my.detailColumn = undefined;

            await Categories.init();
        }
    };

    /**
     * Manages the display of an individual item's details.
     */
    const Detail = new function () {
        const self = this;

        // ********************* //
        // ***** CONSTANTS ***** //
        // ********************* //

        /** @type {Object.<number, BattlePetStats>} */
        const BREED_STATS = {
            3:  {stamina: 0.5, power: 0.5, speed: 0.5},
            4:  {stamina: 0.0, power: 2.0, speed: 0.0},
            5:  {stamina: 0.0, power: 0.0, speed: 2.0},
            6:  {stamina: 2.0, power: 0.0, speed: 0.0},
            7:  {stamina: 0.9, power: 0.9, speed: 0.0},
            8:  {stamina: 0.0, power: 0.9, speed: 0.9},
            9:  {stamina: 0.9, power: 0.0, speed: 0.9},
            10: {stamina: 0.4, power: 0.9, speed: 0.4},
            11: {stamina: 0.4, power: 0.4, speed: 0.9},
            12: {stamina: 0.9, power: 0.4, speed: 0.4},
        }

        /** @type {string[]} All the section keys, in default order. */
        const SECTION_KEYS = [
            'base-stats',
            'snapshots',
            'heat',
            'daily',
            'bulk',
            'regional-daily',
            'other-realms',
        ];

        /** @type {Object<number, string>} A map of stat ID to icon name. */
        const STAT_TO_ICON = {
            61: 'petbattle_speed',                    // Speed
            62: 'rogue_leeching_poison',              // Leech
            63: 'rogue_burstofspeed',                 // Avoidance
            64: 'spell_magic_greaterblessingofkings', // Indestructible
        };

        // ********************* //
        // ***** VARIABLES ***** //
        // ********************* //

        const my = {
            everScrolled: false,
        };

        // ********************* //
        // ***** FUNCTIONS ***** //
        // ********************* //

        // ------ //
        // PUBLIC //
        // ------ //

        /**
         * Hide detail mode to revert to search result mode.
         */
        this.hide = function () {
            delete qs('.main .main-result').dataset.detailMode;
            Search.setHash();
        }

        /**
         * Enters detail mode to show the given item's details.
         *
         * @param {Item} item
         * @param {Realm|null} realm
         */
        this.show = async function (item, realm) {
            qs('.main .main-result').dataset.detailMode = 1;

            const itemDiv = qs('.main .main-result .item');
            ee(itemDiv);

            {
                let thisRealm = realm || Realms.getCurrentRealm();
                Hash.set(
                    Hash.getItemDetailHash(item, thisRealm),
                    `[${item.name}] - ${thisRealm.name} ${thisRealm.region.toUpperCase()}`,
                );
            }

            {
                const backBar = ce('div', {className: 'back-bar'});
                itemDiv.appendChild(backBar);

                const backButton = ce('button', {}, ct('Back'));
                backButton.addEventListener('click', self.hide);
                backBar.appendChild(ce('div', {className: 'button-border'}, backButton));

                if (realm && realm.id !== Realms.getCurrentRealm().id) {
                    const span = ce('span', {className: 'alt-realm'}, ct('Viewing Realm ' + realm.name));
                    if (realm.nativeName) {
                        span.appendChild(ce('span', {className: 'native-name'}, ct(realm.nativeName)));
                    }
                    backBar.appendChild(span);
                }

                backBar.appendChild(ce('span', {className: 'available'}));
            }

            const panels = ce('div', {className: 'panels'});
            itemDiv.appendChild(panels);

            const details = ce('div', {className: 'details'});
            panels.appendChild(details);
            const auctions = ce('div', {className: 'auctions'});
            panels.appendChild(auctions);

            const itemState = await Auctions.getItem(item, realm);

            populateAuctions(item, itemState);
            await populateDetails(item, itemState);
        }

        /**
         * Shows the WoW Token panel for the current region.
         */
        this.showWowToken = async function () {
            qs('.main .main-result').dataset.detailMode = 1;
            Hash.set('', '');

            const itemDiv = qs('.main .main-result .item');
            ee(itemDiv);

            {
                const backBar = ce('div', {className: 'back-bar'});
                itemDiv.appendChild(backBar);

                const backButton = ce('button', {}, ct('Back'));
                backBar.appendChild(backButton);
                backButton.addEventListener('click', self.hide);
            }

            const panels = ce('div', {className: 'panels'});
            itemDiv.appendChild(panels);

            const details = ce('div', {className: 'details'});
            panels.appendChild(details);

            const scroller = ce('div', {className: 'scroller'});
            details.appendChild(scroller);
            scroller.scrollTop = 0;

            // Name panel
            {
                const namePanel = ce('span', {
                    className: 'title q8',
                });
                scroller.appendChild(namePanel);

                const icon = ce('span', {className: 'icon', dataset: {quality: 8}});
                icon.style.backgroundImage = 'url("' + Items.getIconUrl('wow_token01', Items.ICON_SIZE.LARGE) + '")';
                namePanel.appendChild(icon);

                let itemName = Categories.getTokenName();
                const nameLink = ce('a', {
                    href: 'https://www.wowhead.com/' + Locales.getWowheadPathPrefix() + 'item=122284',
                }, ct(itemName));
                namePanel.appendChild(nameLink);
            }

            const tokenState = await Auctions.getToken(null);
            if (!tokenState.region) {
                scroller.appendChild(ct('Choose a realm first.'));

                return;
            }

            const regionName = tokenState.region.toUpperCase();
            const days = tokenState.snapshots.length ? Math.round(
                (tokenState.snapshots[tokenState.snapshots.length - 1].snapshot - tokenState.snapshots[0].snapshot) /
                (24 * 60 * 60 * 1000)
            ) : 0;

            // Stats
            (() => {
                const statsPanel = ce('div', {className: 'base-stats framed'});
                scroller.appendChild(statsPanel);

                statsPanel.appendChild(ce('span', {className: 'frame-title'}, ct('Base Stats')));

                const table = ce('table');
                statsPanel.appendChild(table);

                let tr;

                table.appendChild(tr = ce('tr', {className: 'header'}));
                tr.appendChild(ce('td'));
                tr.appendChild(ce('td', {}, ct(regionName)));

                table.appendChild(tr = ce('tr'));
                tr.appendChild(ce('td', {}, ct('Current')));
                tr.appendChild(ce('td', {
                    dataset: {simpleTooltip: 'Price of a token in ' + regionName + ' right now.'}
                }, tokenState.price ? priceElement(tokenState.price) : null));

                table.appendChild(tr = ce('tr'));
                tr.appendChild(ce('td', {}, ct('Updated')));
                tr.appendChild(ce('td', {}, ce('span', {className: 'delta-timestamp', dataset: {timestamp: tokenState.snapshot}})));

                let prices = [];
                tokenState.snapshots.forEach(snapshot => {
                    if (snapshot.price > 0) {
                        prices.push(snapshot.price);
                    }
                });
                prices.sort((a, b) => a - b);

                let elements = {};

                table.appendChild(tr = ce('tr'));
                tr.appendChild(ce('td', {}, ct('Median')));
                tr.appendChild(elements.median = ce('td', {
                    dataset: {simpleTooltip: 'Median price in ' + regionName + ' over the past ' + days + ' days.'}
                }));

                table.appendChild(tr = ce('tr'));
                tr.appendChild(ce('td', {}, ct('Mean')));
                tr.appendChild(elements.mean = ce('td', {
                    dataset: {simpleTooltip: 'Mean (average) price in ' + regionName + ' over the past ' + days + ' days.'}
                }));

                let statistics = getStatistics(prices);
                elements.median.appendChild(priceElement(statistics.median));
                elements.mean.appendChild(priceElement(statistics.mean));
            })();

            // Price chart
            (() => {
                // Chart container
                const chartContainer = ce('div', {
                    className: 'charts-container framed',
                });
                scroller.appendChild(chartContainer);
                chartContainer.appendChild(ce('span', {className: 'frame-title'}, ct(days + '-Day History')));

                // Chart wrapper and parent SVG
                const constScale = 5;
                const xMax = 1000 * constScale;
                const yMaxPrice = 333 * constScale;
                const yMax = yMaxPrice;

                const chartWrapper = ce('div', {
                    className: 'chart-wrapper',
                    style: {
                        paddingBottom: (yMax / xMax * 100) + '%',
                    }
                });
                chartContainer.appendChild(chartWrapper);
                const priceChart = svge('svg', {
                    'viewBox': [0, 0, xMax, yMax].join(' '),
                });
                chartWrapper.appendChild(priceChart);

                // Determine scaling
                let maxPrice = 0;
                let firstTimestamp = Date.now();
                let lastTimestamp = 0;
                {
                    let prices = [];
                    tokenState.snapshots.forEach(snapshot => {
                        maxPrice = Math.max(maxPrice, snapshot.price);
                        firstTimestamp = Math.min(firstTimestamp, snapshot.snapshot);
                        lastTimestamp = Math.max(lastTimestamp, snapshot.snapshot);
                        if (snapshot.price > 0) {
                            prices.push(snapshot.price);
                        }
                    });
                    if (maxPrice === 0) {
                        return;
                    }

                    prices.sort((a, b) => a - b);
                    let q1 = prices[Math.floor(prices.length * 0.25)];
                    let q3 = prices[Math.floor(prices.length * 0.75)];
                    let iqr = q3 - q1;

                    maxPrice = Math.min(maxPrice, q3 + iqr * 1.5) * 1.15;
                }
                const timestampRange = lastTimestamp - firstTimestamp;

                // Set point arrays.
                const pricePoints = [];
                const hoverData = [];

                const xOffset = Math.round(1 / tokenState.snapshots.length * xMax / 2);
                const xRange = xMax - 2 * xOffset;

                tokenState.snapshots.forEach(snapshot => {
                    const x = xOffset + Math.round((snapshot.snapshot - firstTimestamp) / timestampRange * xRange);
                    const priceY = Math.round((maxPrice - snapshot.price) / maxPrice * yMaxPrice);
                    pricePoints.push([x, priceY].join(','));

                    const hoverPoint = {
                        xCenter: x / xMax,
                    };
                    co(hoverPoint, snapshot);
                    if (hoverData.length === 0) {
                        hoverPoint.xMin = 0;
                    } else {
                        let prev = hoverData[hoverData.length - 1];
                        hoverPoint.xMin = prev.xMax = prev.xCenter + (hoverPoint.xCenter - prev.xCenter) / 2;
                    }

                    hoverData.push(hoverPoint);
                });
                hoverData[hoverData.length - 1].xMax = 1;

                // line + fill
                [
                    {data: pricePoints, max: yMaxPrice, name: 'price'},
                ].forEach(dataset => {
                    const firstY = dataset.data[0].split(',')[1];
                    const lastY = dataset.data[dataset.data.length - 1].split(',')[1];

                    const line = svge('polyline', {
                        points: '0,' + firstY + ' ' + dataset.data.join(' ') + ' ' + xMax + ',' + lastY,
                    });
                    line.classList.add(dataset.name);

                    // Loop us back around to fill the shape.
                    dataset.data.push([xMax, lastY].join(','));
                    dataset.data.push([xMax, dataset.max].join(','));
                    dataset.data.push([0, dataset.max].join(','));
                    dataset.data.push([0, firstY].join(','));
                    const fill = svge('polygon', {
                        points: dataset.data.join(' '),
                    });
                    fill.classList.add(dataset.name);

                    priceChart.appendChild(fill);
                    priceChart.appendChild(line);
                });

                const hoverLine = svge('line', {x1: -1000, x2: -1000, y1: 0, y2: yMax});
                hoverLine.classList.add('hover');
                priceChart.appendChild(hoverLine);

                const formatter = new Intl.DateTimeFormat([], {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    timeZoneName: 'short',
                });

                priceChart.addEventListener('mousemove', (event) => {
                    let leftOffset = priceChart.getBoundingClientRect().left;
                    let xPos = Math.min(0.9999, (event.clientX - leftOffset) / priceChart.clientWidth);

                    hoverLine.x1.baseVal.value = hoverLine.x2.baseVal.value = xPos * xMax;

                    let left = 0;
                    let right = hoverData.length - 1;
                    let mid = 0;
                    while (left <= right) {
                        mid = Math.floor((left + right) / 2);
                        if (hoverData[mid].xMax < xPos) {
                            left = mid + 1;
                        } else if (hoverData[mid].xMin > xPos) {
                            right = mid - 1;
                        } else {
                            break;
                        }
                    }

                    let snapshot = hoverData[mid];

                    const result = ce('table', {className: 'shatari-tooltip'});
                    result.appendChild(ce('tr', {}, ce('td', {className: 'date', colSpan: 2}, ct(formatter.format(new Date(snapshot.snapshot))))));

                    const priceLine = ce('tr');
                    priceLine.appendChild(ce('td', {className: 'price'}, ct('Price')));
                    priceLine.appendChild(ce('td', {}, priceElement(snapshot.price)));
                    result.appendChild(priceLine);

                    WH.Tooltips.showAtCursor(event, result.outerHTML);
                });
                priceChart.addEventListener('mouseout', WH.Tooltips.hide);
            })();

            updateDeltaTimestamps();
        }

        // ------- //
        // PRIVATE //
        // ------- //

        /**
         * Given a pet's base stats and an auction's modifiers, return the actual stats of the pet.
         *
         * @param {BattlePetStats} baseStats
         * @param {Object.<number, number>} modifiers
         * @return {BattlePetStats}
         */
        function getBattlePetStats(baseStats, modifiers) {
            const quality = modifiers[Items.MODIFIER_BATTLE_PET_QUALITY];
            const rawBreed = modifiers[Items.MODIFIER_BATTLE_PET_BREED];
            const level = modifiers[Items.MODIFIER_BATTLE_PET_LEVEL];

            if (quality === undefined) {
                throw "Missing pet quality";
            }
            if (rawBreed === undefined) {
                throw "Missing pet breed";
            }
            if (level === undefined) {
                throw "Missing pet level";
            }

            // Squash gender
            const breed = ((rawBreed - 3) % 10) + 3;

            let breedStats = BREED_STATS[breed];
            if (breedStats === undefined) {
                throw "Invalid breed";
            }

            return {
                stamina: roundToOdd((baseStats.stamina + breedStats.stamina) * 5 * level * (1 + quality / 10) + 100),
                power: roundToOdd((baseStats.power + breedStats.power) * level * (1 + quality / 10)),
                speed: roundToOdd((baseStats.speed + breedStats.speed) * level * (1 + quality / 10)),
            };
        }

        /**
         * Returns the median and mean of a sorted list of numbers.
         *
         * @param {number[]} values
         * @return {{median: number, mean: number}}
         */
        function getStatistics(values) {
            let median;
            if (values.length % 2 === 1) {
                median = values[Math.floor(values.length / 2)];
            } else {
                let value1 = values[values.length / 2 - 1];
                let value2 = values[values.length / 2];
                median = Math.round((value1 + value2) / 2);
            }

            let mean;
            let sum = 0;
            values.forEach(value => sum += value);
            mean = Math.round(sum / values.length);

            return {
                median: median,
                mean: mean,
            };
        }

        /**
         * Returns an array of item states for the given item for all realms in the given region.
         *
         * @param {Item} item
         * @param {Region} region
         * @return {Promise<ItemState[]>}
         */
        async function fetchOtherRealms(item, region) {
            const currentRealm = Realms.getCurrentRealm();
            const connectedRealms = Realms.getRegionConnectedRealms(region);

            const toFetch = [];
            connectedRealms.forEach(connectedRealm => {
                toFetch.push(Auctions.getItem(
                    item,
                    connectedRealm.id === currentRealm.connectedId ? currentRealm : connectedRealm.canonical
                ));
            });

            return await Promise.all(toFetch);
        }

        /**
         * Populate the auctions list in the rightmost panel.
         *
         * @param {Item} item
         * @param {ItemState} itemState
         */
        function populateAuctions(item, itemState) {
            const availableSpan = qs('.main .main-result .item .back-bar .available');

            availableSpan.appendChild(ct(itemState.quantity.toLocaleString() + ' Available'));

            const auctionsPanel = qs('.main .main-result .item .auctions');
            const scroller = ce('div', {className: 'scroller'});
            auctionsPanel.appendChild(scroller);
            scroller.scrollTop = 0;

            const table = ce('table');
            scroller.appendChild(table);

            const onRowClick = tr => {
                const input = qs('.main .main-result .item .details .quantity-calc input');
                input.value = tr.dataset.runningQuantity;
                input.dispatchEvent(new Event('change'));
            };

            let runningQuantity = 0;
            itemState.auctions.forEach(auction => {
                const tr = ce('tr');
                table.appendChild(tr);

                tr.dataset.price = auction.price;
                tr.dataset.quantity = auction.quantity;
                tr.dataset.runningQuantity = runningQuantity += auction.quantity
                tr.appendChild(ce('td', {}, priceElement(auction.price)));
                tr.appendChild(ce('td', {}, ct(auction.quantity.toLocaleString())));

                tr.addEventListener('click', onRowClick.bind(null, tr));
            });

            itemState.specifics.forEach(specLine => {
                const tr = ce('tr');
                table.appendChild(tr);

                const td = ce('td');
                tr.appendChild(td);

                const datasetParams = {};
                if (item.id === ITEM_PET_CAGE) {
                    // Build our own damn tooltip, with stats.
                    let finalStats;
                    try {
                        finalStats = getBattlePetStats(item.battlePetStats, specLine.modifiers);
                    } catch (e) {
                        console.debug("Could not get battle pet stats", item.battlePetStats, specLine.modifiers);
                    }

                    if (finalStats) {
                        const quality = specLine.modifiers[Items.MODIFIER_BATTLE_PET_QUALITY];
                        const level = specLine.modifiers[Items.MODIFIER_BATTLE_PET_LEVEL];

                        let tooltip = ce('div');
                        tooltip.appendChild(ce('b', {className: 'q' + quality}, ct(item.name)));
                        tooltip.appendChild(ce('br'));
                        let flexParent = ce('div', {className: 'battle-pet-tooltip'});
                        tooltip.appendChild(flexParent);
                        let flexLeft = ce('div');
                        flexParent.appendChild(flexLeft);
                        let flexRight = ce('div');
                        flexParent.appendChild(flexRight);

                        flexLeft.appendChild(ct('Battle Pet'));
                        flexLeft.appendChild(ce('br'));
                        flexLeft.appendChild(ct('Level ' + level));
                        flexLeft.appendChild(ce('br'));
                        flexLeft.appendChild(ce('img', {src: 'images/bpet-stamina.png'}));
                        flexLeft.appendChild(ct(finalStats.stamina));
                        flexLeft.appendChild(ce('br'));
                        flexLeft.appendChild(ce('img', {src: 'images/bpet-power.png'}));
                        flexLeft.appendChild(ct(finalStats.power));
                        flexLeft.appendChild(ce('br'));
                        flexLeft.appendChild(ce('img', {src: 'images/bpet-speed.png'}));
                        flexLeft.appendChild(ct(finalStats.speed));

                        flexRight.appendChild(ct(Categories.getBattlePetTypeName(item.battlePetType)));
                        flexRight.appendChild(ce('br'));
                        flexRight.appendChild(ce('img', {
                            src: 'https://wow.zamimg.com/images/pets/types-circle/original/' + item.battlePetType + '.png',
                        }));

                        datasetParams.simpleTooltip = tooltip.innerHTML;
                    }
                } else {
                    const wowheadParams = [];
                    wowheadParams.push('item=' + item.id);
                    wowheadParams.push('domain=' + Locales.getWowheadDomain());
                    if (specLine.bonuses.length) {
                        wowheadParams.push('bonus=' + specLine.bonuses.join(':'));
                    }
                    let lvl = specLine.modifiers[Items.MODIFIER_TYPE_TIMEWALKER_LEVEL];
                    if (lvl) {
                        wowheadParams.push('lvl=' + lvl);
                    }
                    if (item.bonusLevel) {
                        wowheadParams.push('ilvl=' + item.bonusLevel);
                    }
                    const craftedStats = [];
                    if (specLine.modifiers[Items.MODIFIER_TYPE_CRAFTING_STAT_1]) {
                        craftedStats[0] = specLine.modifiers[Items.MODIFIER_TYPE_CRAFTING_STAT_1];
                    }
                    if (specLine.modifiers[Items.MODIFIER_TYPE_CRAFTING_STAT_2]) {
                        let stat2 = specLine.modifiers[Items.MODIFIER_TYPE_CRAFTING_STAT_2];
                        if (!craftedStats.length) {
                            craftedStats.push(0);
                        }
                        craftedStats[1] = stat2;
                    }
                    if (craftedStats.length) {
                        wowheadParams.push('crafted-stats=' + craftedStats.join(':'));
                    }
                    if (specLine.modifiers[Items.MODIFIER_TYPE_CRAFTING_QUALITY]) {
                        wowheadParams.push('crafting-quality=' + specLine.modifiers[Items.MODIFIER_TYPE_CRAFTING_QUALITY]);
                    }

                    datasetParams.wowhead = wowheadParams.join('&');
                }

                const a = ce('a', {dataset: datasetParams});

                const statIcons = ce('span');
                specLine.stats
                    .sort((a, b) => a - b)
                    .forEach(stat => {
                        const iconName = STAT_TO_ICON[stat];
                        if (!iconName) {
                            return;
                        }

                        const icon = ce('span', {className: 'icon'});
                        icon.style.backgroundImage = 'url("' + Items.getIconUrl(iconName, Items.ICON_SIZE.MEDIUM) + '")';

                        statIcons.appendChild(icon);
                    });
                switch (statIcons.children.length) {
                    case 0:
                        break;
                    case 1:
                        a.appendChild(statIcons.firstChild);
                        break;
                    default:
                        a.appendChild(statIcons);
                }

                a.appendChild(ce('span', {}, priceElement(specLine.price)));

                td.appendChild(a);
            });
        }

        /**
         * Populate the empty details panel for the given item.
         *
         * @param {Item} item
         * @param {ItemState} itemState
         */
        async function populateDetails(item, itemState) {
            const parent = qs('.main .main-result .item .details');
            const scroller = ce('div', {className: 'scroller'});
            parent.appendChild(scroller);
            scroller.scrollTop = 0;

            await waitForHighstock();

            if (!my.everScrolled) {
                let indicator = makeScrollIndicator();
                scroller.appendChild(indicator);
                let hideIndicator = () => {
                    indicator.dataset.hidden = 1;
                    my.everScrolled = true;
                    scroller.removeEventListener('scroll', hideIndicator);
                };
                scroller.addEventListener('scroll', hideIndicator);
            }

            const MIN_SNAPSHOT_COUNT = 6;

            const days = itemState.snapshots.length ? Math.round(
                (itemState.snapshots[itemState.snapshots.length - 1].snapshot - itemState.snapshots[0].snapshot) /
                MS_DAY
            ) : 0;
            const realmName = itemState.realm.name;
            const regionName = itemState.realm.region.toUpperCase();

            const houseName = item.stack > 1 ? `${regionName} realms` : realmName;

            // Name panel
            let itemName;
            {
                let wowheadParams = [];

                const namePanel = ce('span', {
                    className: 'title q' + item.quality,
                });
                scroller.appendChild(namePanel);

                const icon = ce('span', {className: 'icon', dataset: {quality: item.quality}});
                icon.style.backgroundImage = 'url("' + Items.getIconUrl(item.icon, Items.ICON_SIZE.LARGE) + '")';
                namePanel.appendChild(icon);

                // Model
                if (item.display) {
                    let url = 'https://wow.zamimg.com/modelviewer/live/webthumbs/' +
                        (item.id === ITEM_PET_CAGE ? 'npc' : 'item') + '/' +
                        (item.display & 0xFF) + '/' + item.display;
                    const pic = ce('picture', {className: 'model-thumbnail'});
                    pic.appendChild(ce('source', {
                        srcset: url + '.webp',
                        type: 'image/webp',
                    }));
                    pic.appendChild(ce('img', {
                        src: url + '.png',
                    }));

                    icon.addEventListener('mouseover', event => WH.Tooltips.showAtCursor(event, pic.outerHTML));
                    icon.addEventListener('mousemove', WH.Tooltips.cursorUpdate);
                    icon.addEventListener('mouseout', WH.Tooltips.hide);
                }

                itemName = item.name;
                if (item.bonusSuffix) {
                    let suffix = Items.getSuffix(item.id, item.bonusSuffix);
                    if (suffix) {
                        itemName += ' ' + suffix.name;
                        if (suffix.bonus) {
                            wowheadParams.push('bonus=' + suffix.bonus);
                        }
                    }
                }
                if (item.id !== ITEM_PET_CAGE && item.bonusLevel) {
                    itemName += ' (' + item.bonusLevel + ')';
                    wowheadParams.push('ilvl=' + item.bonusLevel);
                }
                const nameLink = ce('a', {}, ct(itemName));
                namePanel.appendChild(nameLink);

                if (item.id === ITEM_PET_CAGE) {
                    nameLink.href = 'https://www.wowhead.com/' + Locales.getWowheadPathPrefix() + 'npc=' + item.npc;
                } else {
                    nameLink.href = 'https://www.wowhead.com/' + Locales.getWowheadPathPrefix() + 'item=' + item.id;
                }
                nameLink.href += '/' + item.name
                    .replace(/%\w|['#]|^\s*|\s*$/g, '')
                    .replace(/ \/ |_|[^\u00C0-\u1FFF\u2C00-\uD7FF\w]+/g, '-')
                    .toLocaleLowerCase()
                    .replace(/-{2,}/g, '-')
                    .replace(/^-+|-+$/g, '');
                if (wowheadParams.length) {
                    nameLink.dataset.wowhead = wowheadParams.join('&');
                }

                if (item.craftingQualityTier) {
                    nameLink.appendChild(ce('img', {
                        className: 'quality-tier',
                        src: `images/professions-chaticon-quality-tier${item.craftingQualityTier}.webp`,
                    }));
                }

                // Favstar
                let itemKey = Items.stringifyKeyParts(item.id, item.bonusLevel, item.bonusSuffix);
                let favSpan = document.createElement('span');
                favSpan.className = 'favorite';
                if (Search.getFavorites().includes(itemKey)) {
                    favSpan.dataset.favorite = 1;
                }
                favSpan.addEventListener('click', Search.toggleFavorite.bind(self, itemKey, favSpan));
                namePanel.appendChild(favSpan);
            }

            const sectionParent = ce('div', {className: 'section-parent'});
            scroller.appendChild(sectionParent);

            let regionElements = {};

            // Stats
            (() => {
                const statsPanel = ce('div', {className: 'base-stats framed', dataset: {sectionKey: 'base-stats'}});
                sectionParent.appendChild(statsPanel);

                statsPanel.appendChild(ce('span', {className: 'frame-title'}, ct('Base Stats')));

                const table = ce('table');
                statsPanel.appendChild(table);

                if (item.stack > 1) {
                    table.classList.add('hidden-region-details');
                }

                let tr;

                table.appendChild(tr = ce('tr', {className: 'header'}));
                tr.appendChild(ce('td'));
                tr.appendChild(ce('td', {}, ct(houseName)));
                tr.appendChild(ce('td', {}, ct(`${regionName} realms`)));

                table.appendChild(tr = ce('tr'));
                tr.appendChild(ce('td', {}, ct('Available')));
                tr.appendChild(ce('td', {
                    dataset: {simpleTooltip: `Total quantity for sale on ${houseName} right now.`}
                }, ct(itemState.quantity.toLocaleString())));
                tr.appendChild(regionElements.quantity = ce('td', {
                    dataset: {simpleTooltip: 'Total quantity for sale in all ' + regionName + ' realms right now.'}
                }));

                if (!itemState.quantity) {
                    table.appendChild(tr = ce('tr'));
                    tr.appendChild(ce('td', {}, ct('Last Seen')));
                    tr.appendChild(ce('td', {}, ce('span', {className: 'delta-timestamp', dataset: {timestamp: itemState.snapshot}})));
                    tr.appendChild(ce('td'));
                }

                table.appendChild(tr = ce('tr'));
                tr.appendChild(ce('td', {}, ct('Current')));
                tr.appendChild(ce('td', {
                    dataset: {simpleTooltip: `Lowest price on ${houseName} right now.`}
                }, itemState.price ? priceElement(itemState.price) : null));
                tr.appendChild(regionElements.current = ce('td', {
                    dataset: {simpleTooltip: 'Lowest price among all ' + regionName + ' realms right now.'}
                }));

                let prices = [];
                itemState.snapshots.forEach(snapshot => {
                    if (snapshot.price > 0) {
                        prices.push(snapshot.price);
                    }
                });
                prices.sort((a, b) => a - b);

                let realmElements = {};

                table.appendChild(tr = ce('tr'));
                tr.appendChild(ce('td', {}, ct('Median')));
                tr.appendChild(realmElements.median = ce('td', {
                    dataset: {simpleTooltip: `Median price on ${houseName} over the past ${days} days.`}
                }));
                tr.appendChild(regionElements.median = ce('td', {
                    dataset: {simpleTooltip: 'Median price among all ' + regionName + ' realms right now.'}
                }));

                table.appendChild(tr = ce('tr'));
                tr.appendChild(ce('td', {}, ct('Mean')));
                tr.appendChild(realmElements.mean = ce('td', {
                    dataset: {simpleTooltip: `Mean (average) price on ${houseName} over the past ${days} days.`}
                }));
                tr.appendChild(regionElements.mean = ce('td', {
                    dataset: {simpleTooltip: 'Mean (average) price among all ' + regionName + ' realms right now.'}
                }));

                if (prices.length >= MIN_SNAPSHOT_COUNT) {
                    let statistics = getStatistics(prices);
                    realmElements.median.appendChild(priceElement(statistics.median));
                    realmElements.mean.appendChild(priceElement(statistics.mean));
                }

                const vendorSell = Items.getVendorSellPrice(item);
                if (vendorSell >= 100) {
                    table.appendChild(tr = ce('tr'));
                    tr.appendChild(ce('td', {}, ct('Vendor Sell')));
                    tr.appendChild(ce('td', {
                        dataset: {simpleTooltip: 'The amount you get when selling this item to a vendor.'}
                    }, priceElement(vendorSell)));
                    tr.appendChild(ce('td'));
                }

                if (item.vendorBuy) {
                    table.appendChild(tr = ce('tr'));
                    tr.appendChild(ce('td', {}, ct('Vendor Buy')));
                    tr.appendChild(ce('td', {
                        dataset: {simpleTooltip: 'The amount you pay when buying this item from a vendor.'}
                    }, priceElement(Math.max(100, item.vendorBuy))));
                    tr.appendChild(ce('td'));
                }
            })();

            /**
             * Renders a chart of summary lines.
             *
             * @param {SummaryLine[]}          snapshotList
             * @param {Object<string, string>} strings
             * @param {boolean}                withTimes        True if the snapshot list includes hourly data, false for daily data.
             * @param {HTMLDivElement}         [chartContainer]
             * @return {HTMLDivElement} chartContainer
             */
            let showPriceChart = function (snapshotList, strings, withTimes, chartContainer) {
                // Chart container
                if (!chartContainer) {
                    chartContainer = ce('div');
                    sectionParent.appendChild(chartContainer);
                }
                chartContainer.classList.add('highcharts-container', 'framed');
                chartContainer.appendChild(ce('span', {className: 'frame-title'}, ct(strings.title)));

                if (strings.caption) {
                    chartContainer.appendChild(ce('div', {className: 'caption'}, ct(strings.caption)));
                }

                // Highchart parent.
                const highchartParent = ce('div', {className: 'chart-wrapper'});
                chartContainer.appendChild(highchartParent);

                const addAxisLabels = highchartParent.clientWidth >= 600;

                // Determine scaling
                let maxPrice = 0;
                let maxQuantity = 0;
                let firstTimestamp = Date.now();
                let lastTimestamp = 0;
                let priceData = [];
                let quantityData = [];
                {
                    let prices = [];
                    snapshotList.forEach(snapshot => {
                        maxPrice = Math.max(maxPrice, snapshot.price);
                        maxQuantity = Math.max(maxQuantity, snapshot.quantity);
                        firstTimestamp = Math.min(firstTimestamp, snapshot.snapshot);
                        lastTimestamp = Math.max(lastTimestamp, snapshot.snapshot);
                        if (snapshot.price > 0) {
                            prices.push(snapshot.price);
                        }
                        priceData.push([snapshot.snapshot, snapshot.price]);
                        quantityData.push([snapshot.snapshot, snapshot.quantity]);
                    });
                    if (maxPrice === 0) {
                        return;
                    }

                    prices.sort((a, b) => a - b);
                    let p95 = prices[Math.floor(prices.length * 0.95)];

                    maxPrice = Math.min(maxPrice, p95 * 1.1);
                }

                const priceFormatter = point => {
                    let money = point.value / COPPER_SILVER;
                    let suffix = 's';
                    if (money >= (COPPER_GOLD / COPPER_SILVER)) {
                        money /= (COPPER_GOLD / COPPER_SILVER);
                        suffix = 'g';
                    }
                    if (money > 1000) {
                        money /= 1000;
                        suffix = 'k';
                    }
                    if (money > 1000) {
                        money /= 1000;
                        suffix = 'm';
                    }
                    if (suffix !== 's' && money < 10) {
                        return money.toPrecision(2) + suffix;
                    } else {
                        return Math.round(money) + suffix;
                    }
                };
                const dateFormatter = new Intl.DateTimeFormat([], withTimes ? {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    timeZoneName: 'short',
                } : {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC',
                });

                const labelFormatter = {
                    minute: new Intl.DateTimeFormat([], {
                        month: 'numeric',
                        day: 'numeric',
                        hour: 'numeric',
                    }),
                    day: new Intl.DateTimeFormat([], {
                        month: 'short',
                        day: 'numeric',
                    }),
                    month: new Intl.DateTimeFormat([], {
                        year: 'numeric',
                        month: 'short',
                    }),
                };

                const priceSeries = {
                    data: priceData,
                    fillColor: 'rgba(136,136,255,0.5)',
                    lineColor: '#8888FF',
                    marker: {
                        states: {
                            hover: {
                                fillColor: '#8888FF',
                            },
                        },
                    },
                    name: strings.price,
                    type: 'area',
                    zIndex: 5,
                };
                const quantitySeries = {
                    data: quantityData,
                    lineColor: '#BB5555',
                    marker: {
                        states: {
                            hover: {
                                fillColor: '#FF8888',
                            },
                        },
                    },
                    name: strings.quantity,
                    type: 'line',
                    yAxis: 1,
                    zIndex: 10,
                };

                Highcharts.stockChart(highchartParent, {
                    accessibility: {enabled: false},
                    chart: {
                        backgroundColor: 'rgba(0,0,0,0)',
                        height: withTimes ? 325 : 400,
                        style: {
                            fontFamily: 'inherit',
                            fontSize: 'inherit',
                        },
                        zoomType: 'x',
                    },
                    credits: {
                        style: {
                            color: '#888',
                        },
                    },
                    legend: {enabled: false},
                    navigator: {
                        enabled: !withTimes,
                        outlineWidth: 0,
                        series: priceSeries,
                        xAxis: {
                            visible: false,
                        },
                        yAxis: {
                            max: maxPrice,
                            min: 0,
                        },
                    },
                    plotOptions: {
                        series: {
                            lineWidth: 2,
                            marker: {
                                enabled: false,
                                radius: 3,
                                states: {
                                    hover: {
                                        enabled: true,
                                    },
                                },
                            },
                            states: {
                                hover: {
                                    lineWidth: 2,
                                },
                            },
                        },
                    },
                    rangeSelector: {
                        buttons: [
                            {type: 'week', count: 2, text: '2w'},
                            {type: 'month', count: 1, text: '1m'},
                            {type: 'month', count: 3, text: '3m'},
                            {type: 'month', count: 6, text: '6m'},
                            {type: 'year', count: 1, text: '1y'},
                            {type: 'all', text: 'All'},
                        ],
                        enabled: !withTimes,
                        inputStyle: {
                            color: '#CCCCCC',
                        },
                        selected: withTimes ? 5 : 4,
                    },
                    scrollbar: {
                        // middle button
                        barBackgroundColor: '#4a4644',
                        barBorderRadius: 4,
                        barBorderWidth: 0,

                        // Left/right arrow buttons
                        buttonArrowColor: 'rgba(0,0,0,0)',
                        buttonBackgroundColor: 'rgba(0,0,0,0)',
                        buttonBorderWidth: 0,

                        rifleColor: 'rgba(0,0,0,0)',

                        //showFull: false,

                        // under all buttons
                        trackBackgroundColor: 'rgba(0,0,0,0)',
                        trackBorderColor: '#393433',
                        trackBorderRadius: 4,
                        trackBorderWidth: 1,
                    },
                    series: [quantitySeries, priceSeries],
                    time: {useUTC: !withTimes},
                    title: {text: undefined},
                    tooltip: {
                        backgroundColor: '#282322',
                        borderColor: '#777',
                        borderRadius: 4,
                        formatter: function () {
                            const result = ce('div');
                            result.appendChild(ct(dateFormatter.format(new Date(this.x))));

                            if (this.points[1].y) {
                                result.appendChild(ce('br'));
                                result.appendChild(ce(
                                    'span',
                                    {style: {color: '#8888FF'}},
                                    ct((strings.priceTooltip || strings.price) + ': ')
                                ));
                                result.appendChild(ct((this.points[1].y / COPPER_GOLD).toFixed(2) + 'g'));
                            }

                            result.appendChild(ce('br'));
                            result.appendChild(ce(
                                'span',
                                {style: {color: '#DD6666'}},
                                ct((strings.quantityTooltip || strings.quantity) + ': ')
                            ));
                            result.appendChild(ct(this.points[0].y.toLocaleString()));

                            return result.innerHTML;
                        },
                        shared: true,
                        style: {
                            color: '#EEEEEE',
                            fontFamily: '"Friz Quadrata TT", sans-serif',
                            fontSize: '14px',
                            lineHeight: '20px',
                        }
                    },
                    xAxis: {
                        labels: {
                            formatter: context => ({
                                    second: labelFormatter.minute.format(new Date(context.value)),
                                    minute: labelFormatter.minute.format(new Date(context.value)),
                                    hour: labelFormatter.minute.format(new Date(context.value)),
                                    day: labelFormatter.day.format(new Date(context.value)),
                                    week: labelFormatter.day.format(new Date(context.value)),
                                    month: labelFormatter.month.format(new Date(context.value)),
                                    year: Highcharts.dateFormat('%Y', context.value),
                                }[context.tickPositionInfo.unitName].replace(/\s/g, NBSP)),
                            style: {
                                color: '#CCCCCC',
                                fontSize: 'inherit',
                            },
                        },
                        lineColor: '#393433',
                        lineWidth: 1,
                        minRange: 4 * MS_HOUR,
                        tickColor: '#393433',
                        type: 'datetime',
                    },
                    yAxis: [{
                        gridLineColor: '#393433',
                        labels: {
                            enabled: addAxisLabels,
                            formatter: priceFormatter,
                            style: {
                                color: '#CCCCCC',
                                fontSize: 'inherit',
                            },
                        },
                        max: maxPrice,
                        min: 0,
                        opposite: false,
                        title: {
                            style: {
                                color: '#8888FF',
                            },
                            text: addAxisLabels ? strings.price : undefined,
                        },
                    }, {
                        gridLineWidth: 0,
                        labels: {
                            enabled: addAxisLabels,
                            formatter: point => point.value.toLocaleString(),
                            style: {
                                color: '#CCCCCC',
                                fontSize: 'inherit',
                            },
                        },
                        max: maxQuantity,
                        min: 0,
                        opposite: true,
                        title: {
                            style: {
                                color: '#BB5555',
                            },
                            text: addAxisLabels ? strings.quantity : undefined,
                        },
                    }],
                });

                return chartContainer;
            };

            // Price charts
            if (itemState.snapshots.length >= MIN_SNAPSHOT_COUNT) {
                showPriceChart(itemState.snapshots, {
                    title: `Snapshots for ${houseName}`,
                    caption: `This shows the lowest price and total quantity available of ${itemName} on ${houseName} every hour for the past few weeks.`,
                    price: 'Lowest Price',
                    quantity: 'Total Quantity',
                }, true).dataset.sectionKey = 'snapshots';

                // Heat Map
                {
                    let mapContainer = ce('div', {className: 'heat-container framed', dataset: {sectionKey: 'heat'}});
                    sectionParent.appendChild(mapContainer);

                    mapContainer.appendChild(ce('span', {className: 'frame-title'}, ct(`Hourly Heat Maps for ${houseName}`)));

                    let startFrom = new Date();
                    startFrom.setDate(startFrom.getDate() - 7);
                    startFrom.setHours(0, 0, 0, 0);

                    mapContainer.appendChild(ce('div', {className: 'caption'}, ct(`These heat maps show the lowest price and total quantity available of ${itemName} on ${houseName} each hour for the past week. Using your browser's time zone of ` +
                        (new Intl.DateTimeFormat([], {year: 'numeric', timeZoneName: 'short'})).format(startFrom).replace(new RegExp('\\W*' + startFrom.getFullYear() + '\\W*'), '') + '.')));

                    let dayFormatter = new Intl.DateTimeFormat([], {day: 'numeric', weekday: 'short'});

                    let day = new Date(startFrom);
                    let now = new Date();
                    let days = [];
                    let dayIndexes = {};
                    while (day < now) {
                        days.push({
                            name: dayFormatter.format(day),
                            date: day.getDate(),
                            prices: [].fill(undefined, 0, 23),
                            quantities: [].fill(undefined, 0, 23),
                        });
                        dayIndexes[day.getDate()] = days.length - 1;
                        day.setDate(day.getDate() + 1);
                    }
                    itemState.snapshots.filter(summaryLine => summaryLine.snapshot >= startFrom).forEach(summaryLine => {
                        let now = new Date(summaryLine.snapshot);
                        let dayIndex = dayIndexes[now.getDate()];
                        if (dayIndex != null) {
                            days[dayIndex].prices[now.getHours()] = summaryLine.price;
                            days[dayIndex].quantities[now.getHours()] = summaryLine.quantity;
                        }
                    });

                    let prices = [];
                    let quantities = [];
                    days.forEach(day => {
                        day.prices.filter(amount => amount > 0).forEach(amount => prices.push(amount));
                        day.quantities.filter(amount => amount > 0).forEach(amount => quantities.push(amount));
                    });
                    prices.sort((a, b) => a - b);
                    quantities.sort((a, b) => a - b);
                    let priceMin = prices.length ? prices[Math.floor(prices.length * 0.15)] : undefined;
                    let priceMax = prices.length ? prices[Math.floor(prices.length * 0.85)] : undefined;
                    let quantityMin = quantities.length ? quantities[Math.floor(quantities.length * 0.15)] : undefined;
                    let quantityMax = quantities.length ? quantities[Math.floor(quantities.length * 0.85)] : undefined;

                    {
                        let tableWrapper = ce('div', {className: 'table-wrapper'});
                        mapContainer.appendChild(tableWrapper);

                        let table = ce('table');
                        tableWrapper.appendChild(table);

                        let cellProperties = {};
                        days.forEach(day => {
                            let tr = ce('tr', {}, ce('td', {}, ct(day.name.replace(/\s+/g, NBSP))));
                            table.appendChild(tr);
                            for (let hour = 0; hour < 24; hour++) {
                                let text = '';
                                let copper = day.prices[hour];
                                if (copper) {
                                    let percentage = 1;
                                    if (priceMin !== priceMax) {
                                        percentage = (copper - priceMin) / (priceMax - priceMin);
                                        percentage = Math.min(1, Math.max(0, percentage));
                                    }
                                    cellProperties = {style: {backgroundColor: 'rgba(136, 136, 255, ' + (percentage * 0.5 + 0.1) + ')'}};

                                    let money = copper / COPPER_SILVER;
                                    let suffix = 's';
                                    if (money >= (COPPER_GOLD / COPPER_SILVER)) {
                                        money /= (COPPER_GOLD / COPPER_SILVER);
                                        suffix = 'g';
                                    }
                                    if (money > 1000) {
                                        money /= 1000;
                                        suffix = 'k';
                                    }
                                    if (money > 1000) {
                                        money /= 1000;
                                        suffix = 'm';
                                    }
                                    if (suffix !== 's' && money < 10) {
                                        text = money.toPrecision(2) + suffix;
                                    } else {
                                        text = Math.round(money) + suffix;
                                    }
                                }
                                tr.appendChild(ce('td', cellProperties, ct(text)));
                            }
                        });

                        let timeFormatter = Intl.DateTimeFormat([], {hour: 'numeric', timeZone: 'UTC'});
                        let tr = ce('tr', {}, ce('td'));
                        table.appendChild(tr);
                        for (let hour = 0; hour < 24; hour++) {
                            tr.appendChild(ce('td', {}, ct(timeFormatter.format(new Date(hour * MS_HOUR)).toLowerCase().replace(/\s+/g, ''))));
                        }
                    }

                    {
                        let tableWrapper = ce('div', {className: 'table-wrapper', dataset: {type: 'quantity'}});
                        mapContainer.appendChild(tableWrapper);

                        let table = ce('table');
                        tableWrapper.appendChild(table);

                        let cellProperties = {};
                        days.forEach(day => {
                            let tr = ce('tr', {}, ce('td', {}, ct(day.name.replace(/\s+/g, NBSP))));
                            table.appendChild(tr);
                            for (let hour = 0; hour < 24; hour++) {
                                let text = '';
                                let amount = day.quantities[hour];
                                if (amount !== undefined) {
                                    let percentage = 1;
                                    if (quantityMin !== quantityMax) {
                                        percentage = (amount - quantityMin) / (quantityMax - quantityMin);
                                        percentage = Math.min(1, Math.max(0, percentage));
                                    }
                                    cellProperties = {style: {backgroundColor: 'rgba(255, 136, 136, ' + (percentage * 0.5 + 0.1) + ')'}};

                                    let scaled = amount;
                                    let suffix = '';
                                    if (scaled > 1000) {
                                        scaled /= 1000;
                                        suffix = 'k';
                                    }
                                    if (scaled > 1000) {
                                        scaled /= 1000;
                                        suffix = 'm';
                                    }
                                    if (suffix !== '' && scaled < 10) {
                                        text = scaled.toPrecision(2) + suffix;
                                    } else {
                                        text = Math.round(scaled) + suffix;
                                    }
                                }
                                tr.appendChild(ce('td', cellProperties, ct(text)));
                            }
                        });

                        let timeFormatter = Intl.DateTimeFormat([], {hour: 'numeric', timeZone: 'UTC'});
                        let tr = ce('tr', {}, ce('td'));
                        table.appendChild(tr);
                        for (let hour = 0; hour < 24; hour++) {
                            tr.appendChild(ce('td', {}, ct(timeFormatter.format(new Date(hour * MS_HOUR)).toLowerCase().replace(/\s+/g, ''))));
                        }
                    }
                }
            }
            const showDailyChart = (data, strings, target) => {
                let minDays = 15;
                let minPoints = MIN_SNAPSHOT_COUNT;

                let days = !data.length ? 0 :
                    (Math.round((data[data.length - 1].snapshot - data[0].snapshot) / MS_DAY) + 1);
                if (days >= minDays && data.length >= minPoints) {
                    return showPriceChart(data, strings, false, target);
                }

                return ce('div');
            }
            showDailyChart(itemState.daily, {
                title: `Daily History for ${houseName}`,
                caption: `This shows the maximum observed available quantity, and the lowest price at that time, of ${itemName} on ${houseName} each day.`,
                price: 'Price at Max Quantity',
                priceTooltip: 'Price at Max Qty',
                quantity: 'Max Quantity',
            }).dataset.sectionKey = 'daily';

            // Quantity calc
            if (itemState.auctions.length) {
                const quantityPanel = ce('div', {className: 'quantity-calc framed', dataset: {sectionKey: 'bulk'}});
                sectionParent.appendChild(quantityPanel);

                quantityPanel.appendChild(ce('span', {className: 'frame-title'}, ct('Bulk Pricing')));

                const table = ce('table');
                quantityPanel.appendChild(table);

                let tr, td;

                table.appendChild(tr = ce('tr'));
                tr.appendChild(td = ce('td'));
                td.appendChild(ct('Quantity'));
                tr.appendChild(td = ce('td'));
                const input = ce('input', {type: 'text', value: 1});
                td.appendChild(input);

                table.appendChild(tr = ce('tr'));
                tr.appendChild(td = ce('td'));
                td.appendChild(ct('Unit Price'));
                const unitPriceTarget = ce('td');
                tr.appendChild(unitPriceTarget);

                table.appendChild(tr = ce('tr'));
                tr.appendChild(td = ce('td'));
                td.appendChild(ct('Total Price'));
                const totalPriceTarget = ce('td');
                tr.appendChild(totalPriceTarget);

                const validateAndRun = () => {
                    let quantity = 0;
                    let price = 0;
                    if (input.value !== '') {
                        if (/\D/.test(input.value)) {
                            input.value = input.value.replace(/\D+/g, '');
                        }
                        quantity = parseInt(input.value);
                        if (quantity > itemState.quantity) {
                            input.value = quantity = itemState.quantity;
                        }
                    }

                    const auctionsTable = qs('.main .main-result .item .auctions table');
                    auctionsTable.querySelectorAll('tr[data-selected]').forEach(tr => {
                        delete tr.dataset.selected;
                    });

                    let qtyRemaining = quantity;
                    const rows = auctionsTable.querySelectorAll('tr');
                    for (let row, index = 0; (qtyRemaining > 0) && (row = rows[index]); index++) {
                        let aucPrice = parseInt(row.dataset.price);
                        let aucQty = parseInt(row.dataset.quantity);
                        if (aucQty <= qtyRemaining) {
                            price += aucPrice * aucQty;
                            qtyRemaining -= aucQty;
                            row.dataset.selected = 'full';
                        } else {
                            price += aucPrice * qtyRemaining;
                            qtyRemaining = 0;
                            row.dataset.selected = 'part';
                        }
                    }

                    ee(totalPriceTarget);
                    ee(unitPriceTarget);
                    if (!price) {
                        return;
                    }

                    totalPriceTarget.appendChild(priceElement(price));
                    unitPriceTarget.appendChild(priceElement(Math.round(price / quantity / 100) * 100));
                };
                input.addEventListener('keyup', validateAndRun);
                input.addEventListener('change', validateAndRun);
                validateAndRun();
            }

            updateDeltaTimestamps();

            if (item.stack > 1) {
                makeSectionControls(sectionParent);

                return;
            }

            const regionalDailyHistoryContainer = ce('div', {dataset: {sectionKey: 'regional-daily'}});
            sectionParent.appendChild(regionalDailyHistoryContainer);

            // Create the "Current Regional Prices" bar chart area and data list.
            let otherRealmsChart;
            (() => {
                // Both the bar chart and the list are in this topContainer.
                const topContainer = ce('div', {
                    className: 'other-realms-container framed',
                    dataset: {sectionKey: 'other-realms'},
                });
                sectionParent.appendChild(topContainer);

                // Add a title above this bar chart.
                topContainer.appendChild(ce('span', {className: 'frame-title'}, ct(`Current Regional Prices for ${regionName} realms`)));

                topContainer.appendChild(ce('div', {className: 'caption'}, ct(`This chart, and the following list, show the current price and available quantity of ${itemName} on each ${regionName} realm. The dashed line shows ${realmName}.`)));

                // Create the bar chart.
                otherRealmsChart = ce('div', {className: 'other-realms-bars chart-wrapper'});
                topContainer.appendChild(otherRealmsChart);
                otherRealmsChart.appendChild(ce('div', {className: 'bar-section price-bars'}));
                otherRealmsChart.appendChild(ce('div', {className: 'bar-section quantity-bars'}));
                otherRealmsChart.appendChild(ce('div', {className: 'bar-section links'}));

                // Create the list container header. ("Include Connected Realms")
                const otherRealmsContainer = ce('div', {className: 'check-container'});
                topContainer.appendChild(otherRealmsContainer);
                const otherRealmsLabel = ce('label', {}, ct('Include Connected Realms'));
                otherRealmsContainer.appendChild(otherRealmsLabel);
                const otherRealmsControl = ce('input', {type: 'checkbox'});
                otherRealmsLabel.appendChild(otherRealmsControl);

                // Create the list.
                const list = ce('div', {
                    className: 'list',
                });
                topContainer.appendChild(list);

                const COL_POS_NAME = 1;
                const COL_POS_PRICE = 3;
                const COL_POS_QUANTITY = 4;

                /**
                 * Sorts the result table by the given column.
                 *
                 * @param {HTMLTableCellElement} headerTd The header table cell for the column to sort.
                 * @param {boolean} isString True when this column has string values.
                 */
                const columnSort = function (headerTd, isString) {
                    let dir = 'asc';
                    if (headerTd.dataset.sort === 'asc') {
                        dir = 'desc';
                    }

                    const headerTr = headerTd.parentNode;
                    const headerTds = headerTr.querySelectorAll('td');
                    const sortCol = parseInt(headerTd.dataset.sortCol);
                    let columnPos = 0;
                    for (let x = 0; x < headerTds.length; x++) {
                        delete headerTds[x].dataset.sort;
                        if (headerTds[x] === headerTd) {
                            columnPos = x + 1;
                        }
                    }

                    try {
                        localStorage.setItem('other-realms-sort', `${sortCol * (dir === 'desc' ? -1 : 1)}`);
                    } catch (e) {
                        // Ignore
                    }

                    headerTd.dataset.sort = dir;
                    let table = headerTr;
                    while (table.tagName !== 'TABLE') {
                        table = table.parentNode;
                    }
                    let rows = Array.from(table.querySelectorAll('tbody tr'));
                    rows.sort(function (a, b) {
                        // **Always** sort 0-quantity rows at the end, except for realm name sort.
                        if (columnPos !== COL_POS_NAME) {
                            const aZero = a.querySelector(`td:nth-child(${COL_POS_QUANTITY})`).dataset.sortValue === '0';
                            const bZero = b.querySelector(`td:nth-child(${COL_POS_QUANTITY})`).dataset.sortValue === '0';

                            if (aZero && !bZero) {
                                return 1;
                            }
                            if (!aZero && bZero) {
                                return -1;
                            }
                        }

                        const reversed = dir === 'desc' ? -1 : 1;
                        const aTd = a.querySelector('td:nth-child(' + columnPos + ')');
                        const bTd = b.querySelector('td:nth-child(' + columnPos + ')');

                        const aVal = aTd.dataset.sortValue;
                        const bVal = bTd.dataset.sortValue;

                        if (isString) {
                            return reversed * aVal.localeCompare(bVal);
                        }

                        const valDiff = parseInt(aVal) - parseInt(bVal);
                        if (valDiff) {
                            return reversed * valDiff;
                        }

                        if (aTd.dataset.sortValue2) {
                            const valDiff = parseInt(aTd.dataset.sortValue2) - parseInt(bTd.dataset.sortValue2);
                            if (valDiff) {
                                return reversed * valDiff;
                            }
                        }

                        // Fallbacks.
                        if (columnPos !== COL_POS_PRICE) {
                            const aPrice = a.querySelector('td:nth-child(' + COL_POS_PRICE + ')').dataset.sortValue;
                            const bPrice = b.querySelector('td:nth-child(' + COL_POS_PRICE + ')').dataset.sortValue;

                            const valDiff = parseInt(aPrice) - parseInt(bPrice);
                            if (valDiff) {
                                return valDiff;
                            }
                        }

                        if (columnPos !== COL_POS_NAME) {
                            const aName = a.querySelector('td:nth-child(' + COL_POS_NAME + ')').dataset.sortValue;
                            const bName = b.querySelector('td:nth-child(' + COL_POS_NAME + ')').dataset.sortValue;

                            const valDiff = aName.localeCompare(bName);
                            if (valDiff) {
                                return valDiff;
                            }
                        }

                        return 0;
                    });

                    rows.forEach(function (row) {
                        row.parentNode.appendChild(row);
                    });
                }

                const table = ce('table');
                list.appendChild(table);
                const thead = ce('thead');
                table.appendChild(thead);
                const tbody = ce('tbody');
                table.appendChild(tbody);

                const tr = ce('tr');
                thead.appendChild(tr);

                let td;
                tr.appendChild(td = ce('td', {dataset: {sortCol: '1'}}, ct('Realm')));
                td.addEventListener('click', columnSort.bind(null, td, true));
                tr.appendChild(td = ce('td', {dataset: {sortCol: '4'}}, ct('Pop')));
                td.addEventListener('click', columnSort.bind(null, td, false));
                tr.appendChild(td = ce('td', {dataset: {sortCol: '2'}}, ct('Price')));
                td.addEventListener('click', columnSort.bind(null, td, false));
                tr.appendChild(td = ce('td', {dataset: {sortCol: '3'}}, ct('Quantity')));
                td.addEventListener('click', columnSort.bind(null, td, false));

                regionElements.listTable = tbody;
                regionElements.afterList = () => {
                    let sortNum = parseInt(localStorage.getItem('other-realms-sort'));
                    if (isNaN(sortNum)) {
                        sortNum = 1;
                    }
                    const desc = sortNum < 0;
                    if (desc) {
                        sortNum *= -1;
                    }

                    const col = tr.querySelector(`td[data-sort-col="${sortNum}"]`) || tr.querySelector('td');
                    if (desc) {
                        col.dataset.sort = 'asc';
                    }

                    col.click();
                }

                otherRealmsControl.addEventListener('click', () => {
                    if (otherRealmsControl.checked) {
                        table.dataset.withConnectedRealms = 1;
                    } else {
                        delete table.dataset.withConnectedRealms;
                    }
                });
            })();

            // Fetch other realms
            const detailRealmId = itemState.realm.id;
            const stateRealmId = Realms.getCurrentRealm().id;
            fetchOtherRealms(item, itemState.realm.region).then(otherRealms => {
                let quantitySum = 0;
                let prices = [];
                let lowestAvailablePrice;
                let chartData = [];
                let regionDailyHistory = {};

                otherRealms.forEach(itemState => {
                    // Collect stats for the base stats summary at the top.
                    quantitySum += itemState.quantity;
                    if (itemState.price && itemState.quantity) {
                        prices.push(itemState.price);
                        lowestAvailablePrice = Math.min(itemState.price, lowestAvailablePrice || itemState.price);
                    }

                    // Add rows to the current regional prices table.
                    const connectedRealm = Realms.getConnectedRealm(itemState.realm);
                    /** @var {Realm[]} ourRealms */
                    const ourRealms = [connectedRealm.canonical].concat(connectedRealm.secondary);
                    ourRealms.sort((a, b) => {
                        return ((a.id === detailRealmId ? 0 : 1) - (b.id === detailRealmId ? 0 : 1)) ||
                            ((a.id === stateRealmId ? 0 : 1) - (b.id === stateRealmId ? 0 : 1)) ||
                            ((a.id === connectedRealm.canonical.id ? 0 : 1) - (b.id === connectedRealm.canonical.id ? 0 : 1)) ||
                            a.name.localeCompare(b.name);
                    });
                    for (let realm, index = 0; realm = ourRealms[index]; index++) {
                        const tr = ce('tr');
                        let td, a;
                        tr.appendChild(td = ce('td', {className: 'text', dataset: {sortValue: realm.name}}, ct(realm.name)));
                        if (realm.nativeName) {
                            td.appendChild(ce('span', {className: 'native-name'}, ct(realm.nativeName)));
                        }
                        td.appendChild(a = ce('a', {
                            href: 'javascript:',
                        }));
                        if (index > 0) {
                            tr.dataset.connectedRealm = 1;
                        }
                        a.addEventListener('click', () => self.show(item, realm));
                        tr.appendChild(td = ce('td', {
                            className: 'text',
                            dataset: {pop: realm.population, sortValue: realm.population},
                        }, ct(realm.populationName)));
                        tr.appendChild(ce('td', {dataset: {sortValue: itemState.price}}, itemState.price ? priceElement(itemState.price) : undefined));
                        tr.appendChild(td = ce('td', {dataset: {
                            sortValue: itemState.quantity,
                            sortValue2: itemState.snapshot,
                        }}, ct(itemState.quantity.toLocaleString())));
                        if (itemState.quantity === 0) {
                            td.classList.add('q0');
                            if (itemState.snapshot) {
                                td.insertBefore(
                                    ce('span', {className: 'delta-timestamp', dataset: {timestamp: itemState.snapshot}}),
                                    td.firstChild,
                                );
                            }
                        }

                        regionElements.listTable.appendChild(tr);
                    }

                    // Add an entry for the current regional prices bar chart.
                    chartData.push({
                        realm: itemState.realm,
                        price: itemState.price,
                        quantity: itemState.quantity,
                        lastSeen: itemState.snapshot,
                    });

                    // Scan all daily data, add nonzero quantities to regionDailyHistory.
                    itemState.daily.filter(summaryLine => summaryLine.quantity > 0).forEach(summaryLine => {
                        regionDailyHistory[summaryLine.snapshot] = regionDailyHistory[summaryLine.snapshot] || {
                            quantitySum: 0,
                            prices: [],
                        };

                        regionDailyHistory[summaryLine.snapshot].quantitySum += summaryLine.quantity;
                        regionDailyHistory[summaryLine.snapshot].prices.push(summaryLine.price);
                    });
                });

                // The table has finished being filled, now sort it.
                regionElements.afterList();
                updateDeltaTimestamps();

                // Update the base stats summary.
                regionElements.quantity.appendChild(ct(quantitySum.toLocaleString()));
                if (lowestAvailablePrice) {
                    regionElements.current.appendChild(priceElement(lowestAvailablePrice));
                }
                if (prices.length >= 5) {
                    prices.sort((a, b) => a - b);
                    let statistics = getStatistics(prices);
                    regionElements.median.appendChild(priceElement(statistics.median));
                    regionElements.mean.appendChild(priceElement(statistics.mean));
                }

                // Fill out the Regional Daily History chart.
                /** @type {SummaryLine[]} */
                showDailyChart(
                    Object.keys(regionDailyHistory)
                        .map(key => parseInt(key))
                        .sort((a, b) => a - b)
                        .map(snapshot => ({
                            snapshot: snapshot,
                            quantity: regionDailyHistory[snapshot].quantitySum,
                            price: getStatistics(regionDailyHistory[snapshot].prices).mean,
                        })),
                    {
                        title: `Regional Daily History for ${regionName} realms`,
                        caption: `This shows the total daily max available quantity, and the average daily price, of ${itemName} from all ${regionName} realms.`,
                        price: 'Average Price',
                        quantity: 'Total Quantity',
                    },
                    regionalDailyHistoryContainer,
                );

                // Fill out the Current Regional Prices chart.
                {
                    chartData.sort((a, b) =>
                        b.price - a.price ||
                        b.quantity - a.quantity ||
                        a.realm.name.localeCompare(b.realm.name)
                    );

                    ['price', 'quantity'].forEach(type => {
                        let container = otherRealmsChart.querySelector(`.${type}-bars`);
                        let max = chartData.reduce((prev, cur) => Math.max(cur[type], prev), 0);
                        chartData.forEach(entry => {
                            let bar = ce('div', {
                                className: 'bar',
                                style: {
                                    height: entry[type] / max * 100 + '%',
                                }
                            });
                            container.appendChild(bar);
                        });
                    });
                    let container = otherRealmsChart.querySelector('.links');
                    chartData.forEach(entry => {
                        const result = ce('table', {className: 'shatari-tooltip'});
                        const realmTitle = ce('b', {}, ct(entry.realm.name));
                        if (entry.realm.nativeName) {
                            realmTitle.appendChild(ce('span', {className: 'native-name'}, ct(entry.realm.nativeName)));
                        }
                        result.appendChild(ce('tr', {}, ce('td', {colSpan: 2}, realmTitle)));

                        if (entry.price) {
                            const priceLine = ce('tr');
                            priceLine.appendChild(ce('td', {className: 'price'}, ct('Current Price')));
                            priceLine.appendChild(ce('td', {}, priceElement(entry.price)));
                            result.appendChild(priceLine);
                        }

                        const quantityLine = ce('tr');
                        quantityLine.appendChild(ce('td', {className: 'quantity'}, ct('Quantity')));
                        quantityLine.appendChild(ce('td', {}, ct(entry.quantity.toLocaleString())));
                        result.appendChild(quantityLine);

                        if (entry.quantity === 0 && entry.lastSeen) {
                            const dateLine = ce('tr');
                            dateLine.appendChild(ce('td', {}, ct('Last Seen')));
                            dateLine.appendChild(ce('td', {}, ct(timeString(entry.lastSeen))));
                            result.appendChild(dateLine);
                        }

                        let link = ce('a', {
                            className: 'link',
                            dataset: {
                                simpleTooltip: result.outerHTML,
                            }
                        }, ce('div', {className: 'hover-line'}));
                        if (entry.realm.connectedId === itemState.realm.connectedId) {
                            link.dataset.shown = 1;
                        }
                        container.appendChild(link);
                    });
                }

                makeSectionControls(sectionParent);
            });
        }

        /**
         * Returns an element for the scroll indicator to appear at the bottom of the scrollable panel.
         *
         * @return {HTMLElement}
         */
        function makeScrollIndicator() {
            let result = ce('div', {className: 'scroll-indicator'});
            result.appendChild(ce('div', {className: 'chevron'}));
            result.appendChild(ce('div', {className: 'chevron'}));
            result.appendChild(ce('div', {className: 'chevron'}));

            return result;
        }

        /**
         * Adds section control elements to all elements with section keys in the parent. Orders those sections to user
         * preferences.
         *
         * @param {HTMLElement} parent
         */
        function makeSectionControls(parent) {
            /**
             * Returns an ordered list of section keys.
             *
             * @returns {string[]}
             */
            const getSectionOrder = () => {
                const result = SECTION_KEYS;
                try {
                    const savedOrder = localStorage.getItem('detail-section-order').split(',');
                    result.sort((a, b) => {
                        const aSaved = savedOrder.indexOf(a);
                        const bSaved = savedOrder.indexOf(b);
                        if (aSaved >= 0 && bSaved >= 0) {
                            return aSaved - bSaved;
                        }

                        return SECTION_KEYS.indexOf(a) - SECTION_KEYS.indexOf(b);
                    });
                } catch (e) {
                    // Use default.
                }

                return result;
            };

            /**
             * Sets the CSS order of the section elements in the DOM to match the given section order.
             *
             * @param {string[]} sectionOrder
             */
            const updateSections = sectionOrder => {
                parent.childNodes.forEach(ele => {
                    ele.style.order = sectionOrder.indexOf(ele.dataset.sectionKey) + 1;
                    delete ele.dataset.ordered;
                });
                parent.childNodes.forEach(ele => {
                    if (!getAdjacentSection(sectionOrder, ele.dataset.sectionKey, -1)) {
                        ele.dataset.ordered = 'first';
                    } else if (!getAdjacentSection(sectionOrder, ele.dataset.sectionKey, 1)) {
                        ele.dataset.ordered = 'last';
                    }
                });
            };

            /**
             * Returns the next node in the given direction starting at sectionKey.
             *
             * @param {string[]} sectionOrder
             * @param {string}   sectionKey
             * @param {number}   direction 1 or -1
             * @returns {Node|undefined}
             */
            const getAdjacentSection = (sectionOrder, sectionKey, direction) => {
                let index = sectionOrder.indexOf(sectionKey);
                let nextKey;
                do {
                    index += direction;
                    nextKey = sectionOrder[index];
                    if (nextKey) {
                        const node = parent.querySelector(`[data-section-key="${nextKey}"]`);
                        if (node) {
                            return node;
                        }
                    }
                } while (nextKey);
            };

            /**
             * Updates the section order to adjust sectionKey in the given direction.
             *
             * @param {string} sectionKey
             * @param {number} direction 1 or -1
             */
            const move = (sectionKey, direction) => {
                const sectionOrder = getSectionOrder();
                const relativeNode = getAdjacentSection(sectionOrder, sectionKey, direction);
                if (!relativeNode) {
                    return;
                }
                const oldIndex = sectionOrder.indexOf(sectionKey);
                sectionOrder.splice(oldIndex, 1);
                const relativeIndex = sectionOrder.indexOf(relativeNode.dataset.sectionKey);
                sectionOrder.splice(relativeIndex + Math.max(0, direction), 0, sectionKey);

                try {
                    localStorage.setItem('detail-section-order', sectionOrder.join(','));
                } catch (e) {
                    // do nothing.
                }

                updateSections(sectionOrder);
                const sectionNode = parent.querySelector(`[data-section-key="${sectionKey}"]`);
                const scroller = sectionNode.closest('.scroller');
                scroller.scrollTop = Math.max(0, sectionNode.offsetTop - (scroller.offsetHeight / 2));
            };

            parent.querySelectorAll(':scope > [data-section-key]:empty').forEach(
                section => section.parentNode.removeChild(section)
            );

            parent.querySelectorAll(':scope > [data-section-key]').forEach(section => {
                const controls = ce('span', {className: 'section-controls'});
                section.appendChild(controls);

                [[-1, 'up'], [1, 'down']].forEach(([offset, name]) => {
                    const control = ce('span', {className: 'move', dataset: {
                        direction: name,
                        simpleTooltip: `Move this section ${name}.`,
                    }});
                    control.addEventListener('click', () => move(section.dataset.sectionKey, offset));
                    controls.appendChild(control);
                });
            });

            updateSections(getSectionOrder());
        }

        /**
         * Rounds a value, but halves always round towards the odd number.
         *
         * @param {number} value
         * @return {number}
         */
        function roundToOdd(value) {
            let floored = Math.floor(value);
            if (Math.floor((value - floored) * 1000000) === 500000) {
                if (floored % 2 === 0) {
                    return floored + 1;
                }

                return floored;
            }

            return Math.floor(value + 0.5);
        }
    };

    /**
     * Manages the URL/location hash.
     */
    const Hash = new function () {
        const self = this;

        // ------ //
        // PUBLIC //
        // ------ //

        /**
         * Returns the hash we use for the detail page for the given item on the given realm.
         *
         * @param {Item} item
         * @param {Realm} [realm]
         * @return {string}
         */
        this.getItemDetailHash = function (item, realm) {
            let realmHash = Realms.getRealmHash(realm || Realms.getCurrentRealm());

            let itemHash = Items.stringifyKeyParts(
                item.id,
                item.bonusLevel,
                item.bonusSuffix,
            );

            return `${realmHash}/${itemHash}`;
        };

        /**
         * Returns the hash we use for the current search criteria.
         *
         * @param {string} searchTypeName
         */
        this.getSearchHash = function (searchTypeName) {
            let realmHash = Realms.getRealmHash(Realms.getCurrentRealm());

            let result = `${realmHash}/${searchTypeName}`;

            {
                const categoryHash = Categories.getHashCode();
                if (categoryHash) {
                    result += `/cat=${categoryHash}`
                }
            }

            {
                let minLevel = (/^\d+$/.exec(qs('.main .search-bar input[name="level-min"]').value) || [])[0];
                let maxLevel = (/^\d+$/.exec(qs('.main .search-bar input[name="level-max"]').value) || [])[0];
                if (minLevel !== undefined) {
                    result += `/lmin=${minLevel}`;
                }
                if (maxLevel !== undefined) {
                    result += `/lmax=${maxLevel}`;
                }
            }

            {
                const rarityFrom = qs('.main .search-bar .filter select.rarity[name="rarity-from"]');
                const rarityTo = qs('.main .search-bar .filter select.rarity[name="rarity-to"]');
                const minRarity = parseInt(rarityFrom.options[rarityFrom.selectedIndex].value);
                const maxRarity = parseInt(rarityTo.options[rarityTo.selectedIndex].value);

                if (minRarity !== 0) {
                    result += `/rmin=${minRarity}`;
                }
                if (maxRarity !== 5) {
                    result += `/rmax=${maxRarity}`;
                }
            }

            {
                const expansionSelect = qs('.main .filter select.expansion');
                if (expansionSelect.selectedIndex !== 0) {
                    result += `/era=${expansionSelect.options[expansionSelect.selectedIndex].value}`;
                }
            }

            {
                const arbitrage = Search.isArbitrageMode();
                const transmogMode = qs('.main .search-bar .filter [name="transmog-mode"]').checked;
                const vendorFlip = qs('.main .search-bar .filter [name="vendor-flip"]').checked;
                const outOfStock = qs('.main .search-bar .filter [name="out-of-stock"]').checked;

                if (transmogMode) {
                    result += '/opt=transmog-mode';
                }
                if (arbitrage) {
                    result += '/opt=arbitrage';
                } else {
                    if (vendorFlip) {
                        result += '/opt=vendor-flip';
                    }
                    if (!outOfStock) {
                        result += '/opt=in-stock';
                    }
                }
            }

            {
                const searchBox = qs('.main .search-bar input[type="text"]');
                let searchText = searchBox.value.replace(/^\s+|\s+$/, '');
                if (searchText !== '') {
                    result += '/' + encodeURIComponent(searchText).replace(
                        /[!'()*]/g,
                        c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
                    );
                }
            }

            return result;
        };

        /**
         * Reads the hash currently in the browser's location bar and applies it to the current state. Invalid hashes
         * are silently ignored.
         */
        this.read = async function () {
            let hash = getHash();
            let hashParts = hash.split('/');
            if (hashParts.length < 2) {
                // Didn't recognize hash format.
                return;
            }

            let realm = Realms.getRealmByHash(hashParts[0]);
            if (!realm) {
                // Didn't recognize realm.
                return;
            }
            Realms.setCurrentRealm(realm);

            let match = /^\d+(?:-\d+(?:-\d+)?)?$/.exec(hashParts[1]);
            if (match) {
                // Try to show an item detail page.
                let item = Items.getItemByKey(Items.parseKey(match[0]));
                if (item) {
                    let hydrated = await Auctions.hydrateList([item], {realm});
                    if (hydrated.length) {
                        await Detail.show(Auctions.strip(hydrated[0]), realm);
                    }
                }

                return;
            }

            switch (hashParts[1]) {
                case 'search':
                case 'favorites':
                case 'deals':
                    await performSearch(hashParts[1], hashParts.slice(2));
                    break;
            }
        };

        /**
         * Sets the browser's location bar hash.
         *
         * @param {string} newHash Must not include any initial #
         * @param {string} title The page title fragment
         */
        this.set = function (newHash, title) {
            document.title = (title ? `${title} - ` : '') + 'Undermine Exchange';

            if (newHash === getHash()) {
                return;
            }

            let path = location.pathname + location.search;
            if (newHash) {
                path += '#' + newHash;
            }

            let hasExistingHash = getHash() !== '';

            try {
                if (hasExistingHash) {
                    history.pushState({}, '', path);
                } else {
                    history.replaceState({}, '', path);
                }
            } catch {
                // Ignore errors.
            }
        };

        // ------- //
        // PRIVATE //
        // ------- //

        /**
         * Returns the current location hash, without leading #.
         *
         * @return {string}
         */
        function getHash() {
            return decodeURIComponent(location.hash.replace(/^#+/, ''));
        }

        /**
         * Performs a search of the given type.
         *
         * @param {string}   searchType
         * @param {string[]} params     The additional hash components between slashes.
         */
        async function performSearch(searchType, params) {
            let catHash = '';
            let rmin = 0;
            let rmax = 5;
            let lmin = '';
            let lmax = '';
            let expansion = '';
            let transmogMode = false;
            let vendorFlip = false;
            let outOfStock = true;
            let arbitrage = false;
            let searchText = '';

            params.forEach(param => {
                if (param.indexOf('=') < 0) {
                    searchText = decodeURIComponent(param);

                    return;
                }

                let [name, value] = param.split('=', 2);
                let intValue = parseInt(value);

                switch (name) {
                    case 'cat':
                        catHash = value;
                        break;
                    case 'rmin':
                        if (!isNaN(intValue) && intValue >= 0 && intValue <= 5) {
                            rmin = intValue;
                        }
                        break;
                    case 'rmax':
                        if (!isNaN(intValue) && intValue >= 0 && intValue <= 5) {
                            rmax = intValue;
                        }
                        break;
                    case 'lmin':
                        if (!isNaN(intValue)) {
                            lmin = intValue;
                        }
                        break;
                    case 'lmax':
                        if (!isNaN(intValue)) {
                            lmax = intValue;
                        }
                        break;
                    case 'era':
                        if (!isNaN(intValue)) {
                            expansion = intValue;
                        }
                        break;
                    case 'opt':
                        switch (value) {
                            case 'arbitrage':
                                arbitrage = true;
                                break;
                            case 'transmog-mode':
                                transmogMode = true;
                                break;
                            case 'vendor-flip':
                                vendorFlip = true;
                                break;
                            case 'in-stock':
                                outOfStock = false;
                                break;
                        }
                        break;
                }
            });
            if (rmax < rmin) {
                rmax = rmin;
            }

            Categories.setHashCode(catHash);
            qs(`.main .search-bar .filter select.expansion`).selectedIndex = 0;
            [
                ['.rarity[name="rarity-from"]', rmin],
                ['.rarity[name="rarity-to"]', rmax],
                ['.expansion', expansion],
            ].forEach(([selector, value]) => {
                const sel = qs(`.main .search-bar .filter select${selector}`);
                Array.from(sel.options).forEach((opt, index) => {
                    if (opt.value == value) {
                        sel.selectedIndex = index;
                    }
                });
                sel.dispatchEvent(new Event('change'));
            });
            qs('.main .search-bar input[name="level-min"]').value = lmin;
            qs('.main .search-bar input[name="level-max"]').value = lmax;
            qs('.main .search-bar .filter [name="transmog-mode"]').checked = transmogMode;
            qs('.main .search-bar .filter [name="vendor-flip"]').checked = vendorFlip;
            qs('.main .search-bar .filter [name="out-of-stock"]').checked = outOfStock;
            {
                const checkbox = qs('.main .search-bar .filter [name="arbitrage-mode"]');
                if (checkbox.checked !== arbitrage) {
                    checkbox.click();
                }
            }

            qs('.main .search-bar input[type="text"]').value = searchText;

            await Search.perform(searchType === 'favorites', searchType === 'deals');
        }

        window.addEventListener('hashchange', () => self.read());
    };

    /**
     * Methods to handle item data, independent of any prices.
     */
    const Items = new function () {
        const self = this;

        // ********************* //
        // ***** CONSTANTS ***** //
        // ********************* //

        // ------ //
        // PUBLIC //
        // ------ //

        /** @typedef {string} IconSize */

        /**
         * @typedef {object} Suffix
         * @property {number|null} bonus
         * @property {string} name
         * @property {string} [searchName]
         */

        this.CLASS_CONSUMABLE = 0;
        this.CLASS_WEAPON = 2;
        this.CLASS_GEM = 3;
        this.CLASS_ARMOR = 4;
        this.CLASS_MISCELLANEOUS = 15;
        this.CLASS_BATTLE_PET = 17;
        this.CLASS_WOW_TOKEN = 18;
        this.CLASS_PROFESSION = 19;
        this.CLASSES_EQUIPMENT = [this.CLASS_ARMOR, this.CLASS_WEAPON, this.CLASS_PROFESSION];

        /**
         * Icon sizes.
         *
         * @readonly
         * @enum {IconSize}
         */
        this.ICON_SIZE = {
            LARGE: 'large',
            MEDIUM: 'medium',
            // SMALL: 'small',
        };

        this.MODIFIER_BATTLE_PET_QUALITY = 2; // This totally isn't what modifier 2 means, but I want to store quality and they don't have a mod for that.
        this.MODIFIER_BATTLE_PET_SPECIES = 3;
        this.MODIFIER_BATTLE_PET_BREED = 4;
        this.MODIFIER_BATTLE_PET_LEVEL = 5;
        this.MODIFIER_BATTLE_PET_CREATUREDISPLAYID = 6;
        this.MODIFIER_TYPE_TIMEWALKER_LEVEL = 9;
        this.MODIFIER_TYPE_CRAFTING_STAT_1 = 29;
        this.MODIFIER_TYPE_CRAFTING_STAT_2 = 30;
        this.MODIFIER_TYPE_CRAFTING_QUALITY = 38;

        this.SEARCH_MODE_NORMAL = 0;
        this.SEARCH_MODE_SUGGESTIONS = 1;
        this.SEARCH_MODE_FAVORITES = 2;

        this.SUBCLASS_MISCELLANEOUS_PET = 2;

        // ------- //
        // PRIVATE //
        // ------- //

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

        // ********************* //
        // ***** VARIABLES ***** //
        // ********************* //

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

        // ********************* //
        // ***** FUNCTIONS ***** //
        // ********************* //

        // ------ //
        // PUBLIC //
        // ------ //

        /**
         * Returns the full URL to an icon image.
         *
         * @param {string} iconName
         * @param {IconSize} size
         */
        this.getIconUrl = function (iconName, size) {
            return 'https://wow.zamimg.com/images/wow/icons/' + size + '/' + iconName + '.jpg';
        }

        /**
         * Returns the Item record for the item with the given key on the given/current realm.
         *
         * @param {ItemKey} itemKey
         * @returns {Item|null}
         */
        this.getItemByKey = function (itemKey) {
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
        };

        /**
         * Returns the localized name suffix for the given suffix ID.
         *
         * @param {ItemID} itemId
         * @param {SuffixID} suffixId
         * @return {Suffix|undefined}
         */
        this.getSuffix = function (itemId, suffixId) {
            if (itemId === ITEM_PET_CAGE) {
                return {
                    name: BREEDS[suffixId] || ('Breed ' + suffixId),
                    bonus: null
                };
            }

            return my.suffixes[suffixId];
        };

        /**
         * Returns the vendor sell price of the given item in coppers.
         *
         * @param {Item} item
         * @return {number}
         */
        this.getVendorSellPrice = function (item) {
            if (item.hasOwnProperty('vendorSell')) {
                return item.vendorSell;
            }
            if (item.hasOwnProperty('vendorSellFactor')) {
                const baseFactor = my.vendor[item.vendorSellBase || item['class']][item.bonusLevel || item.squishedItemLevel || item.itemLevel];
                const qualityFactor = my.vendor.quality[item.quality];

                return Math.floor(item.vendorSellFactor * baseFactor * qualityFactor);
            }

            return 0;
        }

        /**
         * Fetches the item list data.
         */
        this.init = async function () {
            await Promise.all([
                fetchItemIds(),
                fetchItemNames(Locales.getCurrent()),
                fetchItemSuffixes(Locales.getCurrent()),
                fetchBattlePets(),
                fetchBattlePetNames(Locales.getCurrent()),
                fetchVendor(),
            ]);

            Locales.registerCallback(onLocaleChange);
        };

        /**
         * Turns an item key string into an item key object.
         *
         * @param {ItemKeyString} itemKeyString
         * @return {ItemKey}
         */
        this.parseKey = function (itemKeyString) {
            const parts = itemKeyString.split('-');

            return {
                itemId: parseInt(parts[0] || 0),
                itemLevel: parseInt(parts[1] || 0),
                itemSuffix: parseInt(parts[2] || 0),
            };
        }

        /**
         * Performs a search depending on the UI state, and returns item objects that match.
         *
         * @param {number} searchMode
         * @return {Promise<Item[]>}
         */
        this.search = async function (searchMode) {
            const result = [];

            const arbitrage = Search.isArbitrageMode();
            const forSuggestions = searchMode === self.SEARCH_MODE_SUGGESTIONS;
            const favoritesOnly = searchMode === self.SEARCH_MODE_FAVORITES;
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
                        // Check the item level of the base item, not the variant. No break.
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
                                self.CLASSES_EQUIPMENT.includes(item['class']) ? (item.squishedItemLevel || item.itemLevel) : 0,
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
        }

        /**
         * Serialize an item key's parts into a short string.
         *
         * @param {ItemID}   itemId
         * @param {number}   itemLevel
         * @param {SuffixID} itemSuffix
         * @returns {ItemKeyString}
         */
        this.stringifyKeyParts = function (itemId, itemLevel, itemSuffix) {
            let result = '' + itemId;
            if (itemLevel) {
                result += '-' + itemLevel;
                if (itemSuffix) {
                    result += '-' + itemSuffix;
                }
            }

            return result;
        };

        // ------- //
        // PRIVATE //
        // ------- //

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
                if (item['class'] === self.CLASS_MISCELLANEOUS && item.subclass === self.SUBCLASS_MISCELLANEOUS_PET) {
                    item['class'] = self.CLASS_BATTLE_PET;
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
    };

    /**
     * Manages the search result list.
     */
    const Search = new function () {
        const self = this;

        // ********************* //
        // ***** CONSTANTS ***** //
        // ********************* //

        const COL_PRICE = 1;
        const COL_NAME = 2;
        const COL_DETAIL = 3;

        const SEARCH_FAVORITES_BUTTON = qs('.main .search-bar .favorite');

        const MAX_RESULTS_SHOWN = 500;

        // ********************* //
        // ***** VARIABLES ***** //
        // ********************* //

        const my = {
            hash: undefined,
            hashRealm: undefined,
            rows: [],
        };

        // ********************* //
        // ***** FUNCTIONS ***** //
        // ********************* //

        // ------ //
        // PUBLIC //
        // ------ //

        /**
         * Returns the current list of favorite item keys.
         *
         * @return {ItemKeyString[]}
         */
        this.getFavorites = function () {
            let favorites;
            try {
                favorites = localStorage.getItem('favorites');
            } catch (e) {
                // Ignore
            }

            return favorites ? favorites.split(',') : [];
        }

        /**
         * Empties the item list.
         */
        this.hide = function () {
            emptyItemList();
        }

        /**
         * Returns whether we're in arbitrage mode.
         *
         * @returns {boolean}
         */
        this.isArbitrageMode = () => getArbitrageModeControl().checked;

        /**
         * Perform a search for items, reading the parameters from the UI.
         *
         * @param {boolean} favoritesOnly
         * @param {boolean} dealsOnly
         */
        this.perform = async function (favoritesOnly, dealsOnly) {
            if (Categories.getClassId() === Items.CLASS_WOW_TOKEN) {
                // Get out of WoW Token mode before performing any searches.
                qs('.main .categories .category[data-class-id="' + Items.CLASS_WOW_TOKEN + '"]').dispatchEvent(new MouseEvent('click'));
            }

            const thisRealm = Realms.getCurrentRealm();
            if (!thisRealm) {
                alert('Please select a realm in the top left corner.');
                qs('.main .search-bar select').focus();

                return;
            }

            Detail.hide();
            emptyItemList();
            Realms.savePreferredRealm();
            try {
                if (getRegionMedianControl().checked) {
                    localStorage.setItem('show-region-median', 1);
                } else {
                    localStorage.removeItem('show-region-median');
                }
            } catch (e) {
                console.error('Could not update localStorage for show-region-median', e);
            }

            let searchTypeName = 'search';
            if (favoritesOnly) searchTypeName = 'favorites';
            if (dealsOnly) searchTypeName = 'deals';
            my.hash = Hash.getSearchHash(searchTypeName);
            my.hashRealm = thisRealm;
            self.setHash();

            const searchBox = qs('.main .search-bar input[type="text"]');
            const hasSearchText = /\S/.test(searchBox.value);

            let itemsList = await Auctions.hydrateList(
                await Items.search(favoritesOnly ? Items.SEARCH_MODE_FAVORITES : Items.SEARCH_MODE_NORMAL),
                {arbitrage: self.isArbitrageMode(), regionMedian: getRegionMedianControl().checked},
            );

            if (dealsOnly) {
                itemsList = await findDeals(itemsList);
            }

            await showItemList(itemsList, hasSearchText || favoritesOnly, dealsOnly);
        };

        /**
         * Sets the location bar hash for the current search parameters.
         */
        this.setHash = function () {
            if (!my.hash || !my.hashRealm) {
                Hash.set('', '');
            } else {
                Hash.set(my.hash, `Search - ${my.hashRealm.name} ${my.hashRealm.region.toUpperCase()}`);
            }
        };

        /**
         * Toggles whether the given item key string is in the favorites list.
         *
         * @param {ItemKeyString} itemKeyString
         * @param {HTMLElement} favSpan
         */
        this.toggleFavorite = function (itemKeyString, favSpan) {
            const favorites = self.getFavorites();
            const pos = favorites.indexOf(itemKeyString);
            if (pos >= 0) {
                favorites.splice(pos, 1);
                if (favSpan) {
                    delete favSpan.dataset.favorite;
                }
            } else {
                favorites.push(itemKeyString);
                if (favSpan) {
                    favSpan.dataset.favorite = 1;
                }
            }
            setFavorites(favorites);
        };

        // ------- //
        // PRIVATE //
        // ------- //

        /**
         * Sorts the result table by the given column.
         *
         * @param {HTMLTableCellElement} headerTd The header table cell for the column to sort.
         * @param {boolean} isString True when this column has string values.
         */
        function columnSort(headerTd, isString) {
            let dir = 'asc';
            if (headerTd.dataset.sort === 'asc') {
                dir = 'desc';
            }

            const headerTr = headerTd.parentNode;
            const tbody = headerTr.parentNode.parentNode.querySelector('tbody');
            const columnPos = parseInt(headerTd.dataset.colPos);
            const hasDetail = !!headerTr.querySelector('td[data-col-name="detail"]');

            headerTr.querySelectorAll('td[data-sort]').forEach(td => delete td.dataset.sort);
            setPreferredSort(columnPos * (dir === 'asc' ? 1 : -1));

            headerTd.dataset.sort = dir;

            my.rows.sort(function (a, b) {
                const aVal = a[columnPos];
                const bVal = b[columnPos];

                if (isString) {
                    return aVal.localeCompare(bVal);
                }

                const valDiff = parseFloat(aVal) - parseFloat(bVal);
                if (valDiff) {
                    return valDiff;
                }

                // Fallbacks.
                if (columnPos !== COL_PRICE) {
                    const aPrice = a[COL_PRICE];
                    const bPrice = b[COL_PRICE];

                    const valDiff = parseInt(aPrice) - parseInt(bPrice);
                    if (valDiff) {
                        return valDiff;
                    }
                }

                if (columnPos !== COL_NAME) {
                    const aName = a[COL_NAME];
                    const bName = b[COL_NAME];

                    const valDiff = aName.localeCompare(bName);
                    if (valDiff) {
                        return valDiff;
                    }
                }

                if (hasDetail && columnPos !== COL_DETAIL) {
                    const aDetail = a[COL_DETAIL];
                    const bDetail = b[COL_DETAIL];

                    const valDiff = parseInt(aDetail) - parseInt(bDetail);
                    if (valDiff) {
                        return valDiff;
                    }
                }

                return 0;
            });

            if (dir === 'desc') {
                my.rows.reverse();
            }

            const favorites = self.getFavorites();
            // Note: only the first message row stays at the top. Any other message rows are pushed to the bottom.
            const afterNode = tbody.querySelector('tr.message');
            for (let x = Math.min(MAX_RESULTS_SHOWN, my.rows.length) - 1; x >= 0; x--) {
                let tr = my.rows[x][0];
                if (typeof tr === 'function') {
                    tr = tr(favorites);
                    my.rows[x][0] = tr;
                }
                tr.dataset.sortedResult = 1;
                tbody.insertBefore(tr, afterNode ? afterNode.nextSibling : tbody.firstChild);
            }
            tbody.querySelectorAll('tr.result:not([data-sorted-result])').forEach(tr => tbody.removeChild(tr));
            tbody.querySelectorAll('tr.result').forEach(tr => delete tr.dataset.sortedResult);

            updateDeltaTimestamps();
        }

        /**
         * Creates a search result row.
         *
         * @param {PricedItem} item
         * @param {HTMLTableSectionElement} tbody
         * @param {DetailColumn|undefined} detailColumn
         * @param {boolean} vendorFlip
         * @param {boolean} showingDeals
         * @param {boolean} hasRegionMedian
         * @param {boolean} arbitrage
         * @param {ItemKeyString[]} favorites
         * @return {HTMLTableRowElement}
         */
        function createRow(
            item,
            tbody,
            detailColumn,
            vendorFlip,
            showingDeals,
            hasRegionMedian,
            arbitrage,
            favorites
        ) {
            let suffix;
            if (item.bonusSuffix) {
                suffix = Items.getSuffix(item.id, item.bonusSuffix);
            }

            let tr = document.createElement('tr');
            tr.addEventListener('mouseenter', onRowEnter);
            tr.addEventListener('mouseleave', onRowLeave);
            tr.classList.add('result');
            let td;

            //
            // PRICE
            //
            {
                tr.appendChild(td = document.createElement('td'));
                td.className = 'price';
                const rowLink = document.createElement('a');
                const price = item.price;
                if (price) {
                    td.appendChild(priceElement(price));

                    let vsp;
                    if (
                        !vendorFlip &&
                        item.quantity &&
                        (vsp = Items.getVendorSellPrice(item)) > price &&
                        vsp >= 10000
                    ) {
                        tr.classList.add('vendor-flip');
                        rowLink._fixTooltip = html => html + '<div class="q2">Posted for under vendor price!</div>';
                    }
                }
                if (canHover()) {
                    if (item.id === ITEM_PET_CAGE) {
                        rowLink.dataset.wowhead = 'npc=' + item.npc + '&domain=' + Locales.getWowheadDomain();
                    } else {
                        rowLink.dataset.wowhead = 'item=' + item.id + '&domain=' + Locales.getWowheadDomain();
                        if (item.bonusLevel) {
                            rowLink.dataset.wowhead += '&ilvl=' + item.bonusLevel;
                        }
                        if (suffix && suffix.bonus) {
                            rowLink.dataset.wowhead += '&bonus=' + suffix.bonus;
                        }
                    }
                }
                rowLink.href = '#' + Hash.getItemDetailHash(item);
                rowLink.addEventListener('click', event => {
                    event.preventDefault();
                    Detail.show(Auctions.strip(item), null);
                });
                td.appendChild(rowLink);
            }

            //
            // NAME
            //
            {
                let itemName = item.name;
                if (suffix) {
                    itemName += ' ' + suffix.name;
                }
                tr.dataset.copyName = itemName;
                if (item.bonusLevel && item.id !== ITEM_PET_CAGE && !(detailColumn && detailColumn.prop === 'itemLevel')) {
                    itemName += ' (' + item.bonusLevel + ')';
                }
                tr.appendChild(td = document.createElement('td'));
                td.className = 'name';
                if (item.side === SIDE_ALLIANCE) {
                    let img = document.createElement('img');
                    img.loading = 'lazy';
                    img.src = Items.getIconUrl('ui_allianceicon', Items.ICON_SIZE.MEDIUM);
                    img.classList.add('icon');
                    td.appendChild(img);
                    td.dataset.sideIcon = 1;
                    tbody.dataset.sideIcon = 1;
                } else if (item.side === SIDE_HORDE) {
                    let img = document.createElement('img');
                    img.loading = 'lazy';
                    img.src = Items.getIconUrl('ui_hordeicon', Items.ICON_SIZE.MEDIUM);
                    img.classList.add('icon');
                    td.appendChild(img);
                    td.dataset.sideIcon = 1;
                    tbody.dataset.sideIcon = 1;
                }
                let img = document.createElement('img');
                img.loading = 'lazy';
                img.src = Items.getIconUrl(item.icon, Items.ICON_SIZE.MEDIUM);
                img.classList.add('icon');
                td.appendChild(img);

                let span = document.createElement('span');
                span.className = 'q' + item.quality;
                span.appendChild(ct(itemName));
                td.appendChild(span);

                if (item.craftingQualityTier) {
                    td.appendChild(ce('img', {
                        className: 'quality-tier',
                        src: `images/professions-chaticon-quality-tier${item.craftingQualityTier}.webp`,
                    }));
                }
            }

            //
            // DETAIL
            //
            if (detailColumn) {
                let value = item[detailColumn.prop];
                if (detailColumn.prop === 'reqLevel' && value <= 1) {
                    value = 1;
                }
                if (detailColumn.prop === 'itemLevel') {
                    value = item.bonusLevel || item.squishedItemLevel || value;
                }
                tr.appendChild(td = document.createElement('td'));
                td.className = detailColumn.prop;
                td.appendChild(ct(value.toLocaleString()));
            }

            //
            // QUANTITY / PERCENTAGE
            //
            if (showingDeals) {
                tr.appendChild(td = document.createElement('td'));
                td.className = 'price-percentage'
                td.appendChild(ct(Math.round(item.price / item.regionMedian * 100) + '%'));
            } else {
                const quantity = item.quantity || 0;
                tr.appendChild(td = document.createElement('td'));
                td.className = 'quantity' + (quantity === 0 ? ' q0' : '');
                td.appendChild(ct(quantity.toLocaleString() + (arbitrage ? '%' : '')));
                if (quantity === 0 && item.snapshot > 0) {
                    let span = document.createElement('span');
                    span.className = 'delta-timestamp';
                    span.dataset.timestamp = item.snapshot;
                    td.appendChild(span);
                }
            }

            let itemKey = Items.stringifyKeyParts(item.id, item.bonusLevel, item.bonusSuffix);
            let favSpan = document.createElement('span');
            favSpan.className = 'favorite';
            if (favorites.includes(itemKey)) {
                favSpan.dataset.favorite = 1;
            }
            favSpan.addEventListener('click', self.toggleFavorite.bind(self, itemKey, favSpan));
            td.appendChild(favSpan);

            //
            // REGION MEDIAN
            //
            if (hasRegionMedian) {
                tr.appendChild(td = document.createElement('td'));
                td.className = 'price median';
                if (item.regionMedian) {
                    td.appendChild(priceElement(item.regionMedian));
                }
            }

            return tr;
        }

        /**
         * Empty the item list. This is done separately from showing the list so we can ensure old results are wiped out
         * while we build a new long list.
         */
        function emptyItemList() {
            qs('.main .welcome').style.display = 'none';
            ee(qs('.main .search-result-target'));
            my.rows = [];
            my.hash = undefined;
            my.hashRealm = undefined;
            self.setHash();
        }

        /**
         * Returns a list of items which are deals from the given list of priced items.
         *
         * @param {PricedItem[]} itemsList
         * @return {Promise<PricedItem[]>}
         */
        async function findDeals(itemsList) {
            // Items must be in stock, and must not be commodities.
            itemsList = itemsList.filter(pricedItem => pricedItem.quantity > 0 && !(pricedItem.stack > 1));

            let dealsData = await Auctions.getDeals();

            itemsList = itemsList.filter(item => {
                let itemKey = Items.stringifyKeyParts(item.id, item.bonusLevel, item.bonusSuffix);
                if (!dealsData.items[itemKey] || item.price > dealsData.items[itemKey].dealPrice) {
                    return false;
                }

                // Normally, the region median is taken from realms which currently have quantity > 0. This region
                // median comes from all realms which ever offered the item, including those with 0 quantity.
                item.regionMedian = dealsData.items[itemKey].regionMedian;

                return true;
            });

            return itemsList;
        }

        /**
         * Returns the checkbox for the option to use arbitrage mode.
         *
         * @return {HTMLInputElement}
         */
        const getArbitrageModeControl = () => qs('.main .search-bar .filter [name="arbitrage-mode"]');

        /**
         * Returns the checkbox for the option to show the region median price.
         *
         * @return {HTMLInputElement}
         */
        const getRegionMedianControl = () => qs('.main .search-bar .filter [name="show-region-median"]');

        /**
         * Returns the column we should use for the initial sort, based on the category class.
         *
         * @return {number|undefined}
         */
        function getPreferredSort() {
            const categoryClass = Categories.getClassId();
            if (categoryClass === undefined) {
                return;
            }

            let categorySorts = {};
            try {
                categorySorts = JSON.parse(localStorage.getItem('category-sort') || '{}');
            } catch (e) {
                // Ignore
            }

            return categorySorts[categoryClass];
        }

        /**
         * Sets a data attribute on the event target to indicate that it's being hovered by the mouse.
         *
         * @param {MouseEvent} event
         */
        function onRowEnter(event) {
            event.target.dataset.hover = 1;
        }

        /**
         * Removes a data attribute on the event target indicating that it was being hovered by the mouse.
         *
         * @param {MouseEvent} event
         */
        function onRowLeave(event) {
            delete event.target.dataset.hover;
        }

        /**
         * Saves the given list of favorites.
         *
         * @param {ItemKeyString[]} favorites
         */
        function setFavorites(favorites) {
            try {
                if (favorites.length) {
                    localStorage.setItem('favorites', favorites.join(','));
                } else {
                    localStorage.removeItem('favorites');
                }
                updateFavoritesButton(favorites.length > 0);
            } catch (e) {
                alert('Could not save favorites to your browser! ' + e);
                updateFavoritesButton(false);
            }
        }

        /**
         * Saves the preferred column and order for the current category class.
         *
         * @param sortValue
         */
        function setPreferredSort(sortValue) {
            const categoryClass = Categories.getClassId();
            if (categoryClass === undefined) {
                return;
            }

            let categorySorts = {};
            try {
                categorySorts = JSON.parse(localStorage.getItem('category-sort') || '{}');
            } catch (e) {
                // Ignore
            }

            categorySorts[categoryClass] = sortValue;

            try {
                localStorage.setItem('category-sort', JSON.stringify(categorySorts));
            } catch (e) {
                // Ignore
            }
        }

        /**
         * Given a pricing-hydrated list of items, show it in the UI.
         *
         * @param {PricedItem[]} itemsList
         * @param {boolean}      includeNeverSeen
         * @param {boolean}      showingDeals
         */
        async function showItemList(itemsList, includeNeverSeen, showingDeals) {
            const detailColumn = Categories.getDetailColumn();
            const arbitrage = self.isArbitrageMode();
            const showOutOfStock = !arbitrage && qs('.main .search-bar .filter [name="out-of-stock"]').checked;
            const vendorFlip = !arbitrage && qs('.main .search-bar .filter [name="vendor-flip"]').checked;
            const bonusStat = Categories.getBonusStat();

            let itemKeyAllowList;
            if (bonusStat != null) {
                const realmState = await Auctions.getRealmState();
                itemKeyAllowList = realmState.bonusStatItems[bonusStat] || [];
            }

            const parent = qs('.main .search-result-target');

            let tr, td;

            const table = ce('table');
            parent.appendChild(table);
            const thead = ce('thead');
            table.appendChild(thead);

            let colSpan = 0;
            let detailColumnOffset = detailColumn ? 1 : 0;
            const hasRegionMedian = itemsList.some(pricedItem => pricedItem.hasOwnProperty('regionMedian'));

            thead.appendChild(tr = ce('tr'));

            tr.appendChild(td = ce('td', {dataset: {colPos: COL_PRICE, colName: 'price'}}, ct('Price')));
            colSpan++;
            td.addEventListener('click', columnSort.bind(null, td, false));
            tr.appendChild(td = ce('td', {dataset: {colPos: COL_NAME, colName: 'name'}}, ct('Name')));
            colSpan++;
            td.addEventListener('click', columnSort.bind(null, td, true));
            if (detailColumn) {
                tr.appendChild(td = ce('td', {dataset: {colPos: COL_DETAIL, colName: 'detail'}}, ct(detailColumn.name)));
                colSpan++;
                td.addEventListener('click', columnSort.bind(null, td, false));
            }
            tr.appendChild(td = ce(
                'td',
                {dataset: {colPos: 3 + detailColumnOffset, colName: 'quantity'}},
                ct(showingDeals ? '% of Region' :'Available')
            ));
            colSpan++;
            td.addEventListener('click', columnSort.bind(null, td, false));

            delete parent.parentNode.dataset.withMedian;
            if (hasRegionMedian) {
                parent.parentNode.dataset.withMedian = 1;
                tr.appendChild(td = ce(
                    'td',
                    {dataset: {colPos: 4 + detailColumnOffset, colName: 'median'}},
                    ct('Region Median'),
                ));
                colSpan++;
                td.addEventListener('click', columnSort.bind(null, td, false));
            }

            my.rows = [];
            const tbody = ce('tbody');
            table.appendChild(tbody);
            for (let itemIndex = 0; itemIndex < itemsList.length; itemIndex++) {
                let item = itemsList[itemIndex];
                if (itemKeyAllowList != null) {
                    const itemKey = Items.stringifyKeyParts(item.id, item.bonusLevel, item.bonusSuffix);
                    if (!itemKeyAllowList.includes(itemKey)) {
                        continue;
                    }
                }
                if ((item.quantity || 0) === 0) {
                    if (!showOutOfStock) {
                        continue;
                    }
                    if (!includeNeverSeen && (item.price || 0) === 0) {
                        continue;
                    }
                }
                if (vendorFlip) {
                    const vendorPrice = Items.getVendorSellPrice(item);
                    if (!vendorPrice || vendorPrice <= item.price) {
                        continue;
                    }
                }

                let suffix;
                if (item.bonusSuffix) {
                    suffix = Items.getSuffix(item.id, item.bonusSuffix);
                }

                const sortRow = [
                    createRow.bind(self, item, tbody, detailColumn, vendorFlip, showingDeals, hasRegionMedian, arbitrage),
                ];
                my.rows.push(sortRow);

                //
                // PRICE
                //
                sortRow.push(item.price || 0);

                //
                // NAME
                //
                {
                    let itemName = item.name;
                    if (suffix) {
                        itemName += ' ' + suffix.name;
                    }
                    if (item.bonusLevel && item.id !== ITEM_PET_CAGE && !(detailColumn && detailColumn.prop === 'itemLevel')) {
                        itemName += ' (' + item.bonusLevel.toString().padStart(4, '0') + ')';
                    }
                    if (item.craftingQualityTier) {
                        itemName += ' ' + item.craftingQualityTier.toString().padStart(3, '0');
                    }
                    sortRow.push(itemName);
                }

                //
                // DETAIL
                //
                if (detailColumn) {
                    let value = item[detailColumn.prop];
                    if (detailColumn.prop === 'reqLevel' && value <= 1) {
                        value = 1;
                    }
                    if (detailColumn.prop === 'itemLevel') {
                        value = item.bonusLevel || item.squishedItemLevel || value;
                    }
                    sortRow.push(value);
                }

                //
                // QUANTITY / PERCENTAGE
                //
                if (showingDeals) {
                    sortRow.push(item.price / item.regionMedian);
                } else {
                    const quantity = item.quantity || 0;
                    if (quantity === 0) {
                        sortRow.push(quantity + item.snapshot / 10000000000000);
                    } else {
                        sortRow.push(quantity);
                    }
                }

                //
                // REGION MEDIAN
                //
                if (hasRegionMedian) {
                    sortRow.push(item.regionMedian || 0);
                }
            }

            if (my.rows.length === 0) {
                tbody.appendChild(ce('tr', {className: 'message'}, td = ce('td', {colSpan: colSpan})));
                td.appendChild(ct('No results found. Double-check your category and filter settings.'));
            } else {
                const td = ce('td', {colSpan: colSpan});
                td.appendChild(ce('img', {src: 'images/line-chart-line.svg'}));
                td.appendChild(ct('Click an entry for more information.'));
                td.appendChild(ce('img', {src: 'images/line-chart-line.svg'}));

                tbody.appendChild(ce('tr', {className: 'message'}, td));
                if (my.rows.length > MAX_RESULTS_SHOWN) {
                    // Note: this second message will always be at the bottom of the list.
                    tbody.appendChild(ce('tr', {className: 'message'}, ce('td', {colSpan: colSpan}, ct(
                        my.rows.length.toLocaleString() + ' results found. Showing the first ' + MAX_RESULTS_SHOWN.toLocaleString() + '.',
                    ))));
                }

                const prefSort = getPreferredSort() || COL_PRICE;
                const sortTd = thead.querySelector(`td[data-col-pos="${Math.abs(prefSort)}"]`) ||
                    thead.querySelector(`td[data-col-pos="${COL_PRICE}"]`);
                if (prefSort < 0) {
                    // Will flip to desc when we call the next sort.
                    sortTd.dataset.sort = 'asc';
                }
                sortTd.dispatchEvent(new MouseEvent('click'));
            }

            parent.scrollTop = 0;
        }

        /**
         * Enable/disable the favorites button in the search bar.
         *
         * @param {boolean} isEnabled
         */
        function updateFavoritesButton(isEnabled) {
            if (isEnabled) {
                SEARCH_FAVORITES_BUTTON.dataset.enabled = 1;
                delete SEARCH_FAVORITES_BUTTON.dataset.simpleTooltip;
            } else {
                delete SEARCH_FAVORITES_BUTTON.dataset.enabled;
                SEARCH_FAVORITES_BUTTON.dataset.simpleTooltip = SEARCH_FAVORITES_BUTTON.dataset.defaultTooltip;
            }
        }

        updateFavoritesButton(self.getFavorites().length > 0);
        SEARCH_FAVORITES_BUTTON.addEventListener('click', () => {
            if (SEARCH_FAVORITES_BUTTON.dataset.enabled) {
                self.perform(true, false);
            }
        });

        qs('.main .search-bar .deals').addEventListener('click', () => self.perform(false, true));

        try {
            getRegionMedianControl().checked = !!localStorage.getItem('show-region-median');
        } catch (e) {
            // Oh well.
        }

        {
            const checkbox = getArbitrageModeControl();
            checkbox.addEventListener('click', () => {
                qsa('.main .search-bar .filter .arbitrage-mode-ignored').forEach(label => {
                    label.classList.toggle('disabled', checkbox.checked);
                    label.querySelector('input').disabled = checkbox.checked;
                });
            });
            checkbox.checked = false;
        }

        /**
         * Pressing Ctrl-C while hovering over a search result row will copy that result's name to the clipboard.
         *
         * @param {KeyboardEvent} event
         */
        const copyNameToClipboard = function (event) {
            if (event.isComposing || event.keyCode === 229) {
                return;
            }
            if (event.ctrlKey && event.key.toLowerCase() === 'c') {
                let hoveredRow = qs('.main .search-result-target tr[data-hover][data-copy-name]');
                if (hoveredRow) {
                    navigator.clipboard.writeText(hoveredRow.dataset.copyName);
                }
            }
        };
        document.addEventListener('keyup', copyNameToClipboard);
    }

    /** Manages the search suggestions list. */
    const Suggestions = new function () {
        const searchBox = qs('.main .search-bar input[type="text"]');
        const textContainer = searchBox.parentNode;
        const datalist = qs('.main .search-bar .datalist');

        const MIN_SEARCH_LENGTH = 2;
        const MAX_SUGGESTIONS = 10;
        const SEARCH_DELAY = 150;

        let searchTimer;
        let lastSearch;
        let blurTimeout;

        function init() {
            const queueUpdate = () => {
                if (searchTimer !== undefined) {
                    clearTimeout(searchTimer);
                }
                searchTimer = setTimeout(update, SEARCH_DELAY);
            };

            searchBox.addEventListener('keydown', event => {
                if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
                    // Avoid the up/down arrows from moving the cursor.
                    event.preventDefault();
                }
            });
            searchBox.addEventListener('keyup', event => {
                let typedLetter = event.key.length === 1;
                if (event.key === 'Backspace' || typedLetter || searchBox.value.length < MIN_SEARCH_LENGTH) {
                    // Updates are queued with a short delay, so fast typing doesn't have earlier results overwriting
                    // later ones.
                    queueUpdate();
                } else if (event.key === 'Enter') {
                    // The actual search functionality was added in the keyup listener in the main init.
                    searchBox.blur();
                } else if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
                    navigateList(event.key === 'ArrowDown');
                }
            });
            searchBox.addEventListener('blur', event => {
                if (blurTimeout !== undefined) {
                    clearTimeout(blurTimeout);
                }
                // We set a blur timeout so if you click the data list, the click actually lands (instead of the click
                // blurring the text box, which then immediately hides the data list, which causes the click to land
                // under where the list was.
                blurTimeout = setTimeout(() => {
                    blurTimeout = undefined;
                    delete textContainer.dataset.withFocus;
                }, SEARCH_DELAY);
            });
            searchBox.addEventListener('focus', function (event) {
                if (blurTimeout) {
                    // We might get a blur then immediate focus when the "clear all" button is clicked, causing the
                    // button to gain focus, then immediately set it back to the search box. Clear the blur timeout
                    // so we don't keep the data list hidden once we start typing.
                    clearTimeout(blurTimeout);
                    blurTimeout = undefined;
                }
                queueUpdate();
                delete datalist.dataset.withItems;
                textContainer.dataset.withFocus = 1;
            });

            const onOptionClick = option => {
                searchBox.value = option.dataset.value;
                searchBox.dispatchEvent(new KeyboardEvent('keyup', {key: 'Enter'}));
            };
            for (let x = 0; x < MAX_SUGGESTIONS; x++) {
                let option = ce('div');
                option.addEventListener('click', onOptionClick.bind(null, option));
                datalist.appendChild(option);
            }
        }

        function navigateList(down) {
            if (!datalist.dataset.withItems) {
                return;
            }

            let curSelection = datalist.querySelector('div.selected');
            let newSelection;
            if (!curSelection) {
                if (down) {
                    newSelection = datalist.querySelector('div');
                } else {
                    return;
                }
            } else {
                newSelection = down ? curSelection.nextSibling : curSelection.previousSibling;
            }
            if (!newSelection || !newSelection.textContent) {
                return;
            }

            if (curSelection) {
                curSelection.classList.remove('selected');
            }
            newSelection.classList.add('selected');
            newSelection.parentNode.scrollTop = newSelection.offsetTop - newSelection.parentNode.firstChild.offsetTop;

            searchBox.value = newSelection.dataset.value;
            searchBox.selectionStart = searchBox.value.length;
        }

        /**
         * Updates the search suggestions datalist element.
         */
        async function update() {
            searchTimer = undefined;
            datalist.querySelectorAll('div.selected').forEach(div => {
                div.classList.remove('selected');
            });
            const options = datalist.querySelectorAll('div');

            const typed = searchBox.value.toLowerCase().replace(/^\s+|\s+$/, '');
            if (typed.length < MIN_SEARCH_LENGTH) {
                options.forEach(option => ee(option));
                delete datalist.dataset.withItems;

                return;
            }

            lastSearch = typed;
            const items = await Auctions.hydrateList(await Items.search(Items.SEARCH_MODE_SUGGESTIONS), {});
            if (lastSearch !== typed) {
                return;
            }
            items.sort((a, b) => {
                let aFullName = a.name + (a.bonusSuffix ? ' ' + Items.getSuffix(a.id, a.bonusSuffix).name : '');
                let bFullName = b.name + (b.bonusSuffix ? ' ' + Items.getSuffix(b.id, b.bonusSuffix).name : '');
                let aFirst = aFullName.toLowerCase().startsWith(typed) ? 0 : 1;
                let bFirst = bFullName.toLowerCase().startsWith(typed) ? 0 : 1;

                return (aFirst - bFirst) || (b.quantity - a.quantity) || aFullName.localeCompare(bFullName);
            });
            items.splice(MAX_SUGGESTIONS);

            let index = 0;
            for (let item; item = items[index]; index++) {
                let name = item.name + (item.bonusSuffix ? ' ' + Items.getSuffix(item.id, item.bonusSuffix).name : '');
                let option = options[index];
                ee(option);
                option.dataset.value = name;
                option.appendChild(ce('img', {
                    src: Items.getIconUrl(item.icon, Items.ICON_SIZE.MEDIUM),
                    loading: 'lazy',
                }));
                option.appendChild(document.createTextNode(name));
            }
            while (index < MAX_SUGGESTIONS) {
                ee(options[index++]);
            }
            if (options[0].firstChild) {
                datalist.dataset.withItems = 1;
            } else {
                delete datalist.dataset.withItems;
            }
        }

        init();
    };

    //      //
    // Init //
    //      //

    async function init() {
        const inMaintenance = !!qs('.main .welcome').dataset.maintenance;
        if (inMaintenance) {
            return;
        }

        if (UndermineMigration.abortInit()) {
            return;
        }

        {
            const toReplace = qs('#contact-link');
            if (toReplace) {
                const df = document.createDocumentFragment();
                df.appendChild(document.createTextNode('Report issues to '));
                const address = `feedback@${location.hostname}`;
                df.appendChild(ce('a', {href: `mailto:${address}`}, document.createTextNode(address)));
                df.appendChild(document.createTextNode('.'));
                df.appendChild(ce('br'));
                df.appendChild(document.createTextNode('All messages are read, but replies are uncommon.'));
                df.appendChild(ce('br'));
                df.appendChild(ce('br'));
                toReplace.parentNode.replaceChild(df, toReplace);
            }
        }

        let hsTag = ce('script', {
            src: 'highstock-10.3.3.js',
            id: 'highstock-script',
        });
        hsTag.addEventListener('load', () => hsTag.dataset.loaded = '1');
        document.head.appendChild(hsTag);

        document.head.appendChild(ce('script', {src: 'power.js'}));

        if (!navigator.userAgentData &&
            navigator.userAgent.indexOf('Safari') > -1 &&
            navigator.userAgent.indexOf('Chrome') < 0 &&
            navigator.userAgent.indexOf('Chromium') < 0
        ) {
            // Safari applies TR backgrounds to each TD.
            document.body.classList.add('no-row-backgrounds');
        }

        const fsDiv = qs('.main .welcome .full-screen');
        if (document.fullscreenEnabled || document.webkitFullscreenEnabled) {
            fsDiv.querySelector('button').addEventListener('click', () => {
                if (document.fullscreenEnabled) {
                    qs('.main').requestFullscreen();
                } else if (document.webkitFullscreenEnabled) {
                    qs('.main').webkitRequestFullscreen();
                }
            });
        } else {
            fsDiv.style.visibility = 'hidden';
        }

        Locales.init();

        await Promise.all([
            Categories.init(),
            Items.init(),
            Realms.init(),
        ]);

        qs('.main .search-bar button.search').addEventListener('click', Search.perform.bind(null, false, false));

        const filterButton = qs('.main .search-bar .filter');
        filterButton.addEventListener('mouseup', (event) => {
            const div = filterButton.querySelector('div');
            if (div.style.display === 'block') {
                return;
            }

            div.style.display = 'block';
            const outside = document.body;
            /**
             * Called on mouseup to close the filter tooltip.
             *
             * @param {Event} event
             */
            const closeDiv = function (event) {
                let target = event.target;
                while (target.parentNode) {
                    if (target === div) {
                        return;
                    }
                    target = target.parentNode;
                }
                div.style.removeProperty('display');
                outside.removeEventListener('mouseup', closeDiv);
            }
            outside.addEventListener('mouseup', closeDiv);
            event.stopPropagation();
        });
        const searchBox = qs('.main .search-bar input[type="text"]');
        searchBox.addEventListener('keyup', event => {
            if (event.key === 'Enter') {
                Search.perform(false, false);
            }
        });
        qs('.main .search-bar .text-reset').addEventListener('click', event => {
            searchBox.value = '';
            searchBox.focus();
            searchBox.dispatchEvent(new FocusEvent('focus'));
        });

        {
            const rarityClassFix = select =>
                select.querySelectorAll('option').forEach(option => {
                    if (option.selected) {
                        select.classList.add(option.className);
                    } else {
                        select.classList.remove(option.className);
                    }
                });
            const rarityFrom = qs('.main .search-bar .filter select.rarity[name="rarity-from"]');
            const rarityTo = qs('.main .search-bar .filter select.rarity[name="rarity-to"]');
            rarityFrom.addEventListener('change', () => {
                rarityTo.selectedIndex = Math.max(rarityFrom.selectedIndex, rarityTo.selectedIndex);
                rarityClassFix(rarityFrom);
                rarityClassFix(rarityTo);
            });
            rarityTo.addEventListener('change', () => {
                rarityFrom.selectedIndex = Math.min(rarityFrom.selectedIndex, rarityTo.selectedIndex);
                rarityClassFix(rarityFrom);
                rarityClassFix(rarityTo);
            });
        }

        qs('.main .bottom-bar .links a.home').addEventListener('click', event => {
            event.preventDefault();
            Detail.hide();
            Search.hide();
            qs('.main .welcome').style.display = '';
        });

        setInterval(updateDeltaTimestamps, MS_MINUTE);

        Hash.read();
    }

    init().catch(alert);

