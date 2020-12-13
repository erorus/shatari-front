"use strict";

new function () {
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
     * @property {string} region  "us" or "eu"
     * @property {ConnectedRealmID} id
     * @property {Realm} canonical
     * @property {Realm[]} secondary
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
     * @property {Realm}           realm
     * @property {PricedItem}      item
     * @property {Timestamp}       snapshot   The last snapshot when this item was seen
     * @property {Money}           price      The cheapest price when this item was last seen
     * @property {number}          quantity   How many were available when this was last seen
     * @property {Auction[]}       auctions   An array of distinct prices and quantities, ordered by price ascending
     * @property {AuctionDetail[]} specifics  An array of prices and bonus information, ordered by price ascending
     * @property {SummaryLine[]}   snapshots  An array of summary prices, order by snapshot ascending
     */

    /**
     * @typedef {Item} PricedItem
     * @property {Money}     price
     * @property {number}    quantity
     * @property {Timestamp} snapshot
     */

    /**
     * @typedef {Object} Realm
     * @property {string} region  "us" or "eu"
     * @property {string} name
     * @property {string} slug
     * @property {RealmID} id
     * @property {ConnectedRealmID} connectedId
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
     */

    /** @typedef {number} SubclassID */

    /**
     * @typedef {Object} SummaryLine
     * @property {Timestamp} snapshot  When this item was last seen
     * @property {Money}     price     The cheapest price when it was last seen
     * @property {number}    quantity  The total quantity available when it was last seen
     */

    /** @typedef {number} Timestamp  A UNIX timestamp, in milliseconds. */

    /**
     * @typedef {object} UnnamedItem
     * @property {number} class
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
     * @property {number} subclass
     * @property {number} [vendorSell]
     * @property {number} [vendorSellBase]
     * @property {number} [vendorSellFactor]
     */

    /** @type {ItemID} ITEM_PET_CAGE */
    const ITEM_PET_CAGE = 82800;

    const MS_SEC = 1000;
    const MS_MINUTE = 60 * MS_SEC;
    const MS_HOUR = 60 * MS_MINUTE;
    const MS_DAY = 24 * MS_HOUR;

    const SIDE_ALLIANCE = 1;
    const SIDE_HORDE = 2;

    const ct = document.createTextNode.bind(document);
    const qs = document.body.querySelector.bind(document.body);
    const qsa = document.body.querySelectorAll.bind(document.body);

    /**
     * Manages item prices and availability.
     */
    const Auctions = new function () {
        // ********************* //
        // ***** CONSTANTS ***** //
        // ********************* //

        const COPPER_SILVER = 100;

        const REALM_STATE_CACHE_DURATION = 10 * MS_SEC;

        const VERSION_GLOBAL_STATE = 2;
        const VERSION_ITEM_STATE = 4;
        const VERSION_REALM_STATE = 3;

        // ********************* //
        // ***** VARIABLES ***** //
        // ********************* //

        const my = {
            lastRealmState: {},

            lastSnapshotList: {},
        };

        // ********************* //
        // ***** FUNCTIONS ***** //
        // ********************* //

        // ------ //
        // PUBLIC //
        // ------ //

        /**
         * Given an item object, return its item state for the current/given realm.
         *
         * @param {PricedItem} item
         * @param {Realm|null} realm
         * @return {Promise<ItemState>}
         */
        this.getItem = async function (item, realm) {
            return getItemState(realm || Realms.getCurrentRealm(), item, !!realm);
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
            updatedElement.appendChild(ct(realm.name + ' last updated '));
            updatedElement.appendChild(ce('span', {
                className: 'delta-timestamp',
                dataset: {timestamp: realmState.snapshot}
            }));
            updatedElement.appendChild(ct('.'));
            updateDeltaTimestamps();

            return realmState;
        };

        /**
         * Hydrates a list of items with prices and quantities for the currently-selected realm.
         *
         * @param {Item[]} items
         * @return {Promise<PricedItem[]>}
         */
        this.hydrateList = async function (items) {
            const realmState = await getRealmState(Realms.getCurrentRealm());

            const result = [];

            items.forEach(function (item) {
                const keyString = Items.stringifyKey({
                    itemId: item.id,
                    itemLevel: item.bonusLevel,
                    itemSuffix: item.bonusSuffix,
                });

                /** @type {PricedItem} pricedItem */
                let pricedItem = {};
                co(pricedItem, item);

                const cur = realmState.summary[keyString];
                if (cur) {
                    pricedItem.price = cur.price;
                    pricedItem.quantity = cur.snapshot === realmState.snapshot ? cur.quantity : 0;
                    pricedItem.snapshot = cur.snapshot;
                } else {
                    pricedItem.price = 0;
                    pricedItem.quantity = 0;
                    pricedItem.snapshot = 0;
                }

                result.push(pricedItem);
            });

            return result;
        }

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

            const response = await fetch('data/global/state.bin', {mode: 'same-origin'});
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
         * Given realm and item objects, return its item state.
         *
         * @param {Realm} realm
         * @param {PricedItem} item
         * @param {boolean} useCached
         * @return {Promise<ItemState>}
         */
        async function getItemState(realm, item, useCached) {
            let basename = Items.stringifyKey({
                itemId: item.id,
                itemLevel: item.bonusLevel,
                itemSuffix: item.bonusSuffix,
            });
            const url = [
                'data',
                useCached ? 'cached' : '',
                realm.connectedId,
                item.id === ITEM_PET_CAGE ? 'pet' : '',
                item.id === ITEM_PET_CAGE ? (item.bonusLevel & 0xFF) : (item.id & 0xFF),
                basename + '.bin'
            ].filter(v => v !== '').join('/');
            const response = await fetch(url, {mode: 'same-origin'});
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
            switch (version) {
                case 3:
                    fullModifiers = false;
                    // no break
                case VERSION_ITEM_STATE:
                    // no op
                    break;
                default:
                    throw "Unknown data version for item state.";
            }

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
                result.specifics.push({
                    price: price,
                    modifiers: modifiers,
                    bonuses: bonuses,
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
                if (!prevDelta) {
                    prevDelta = deltas[snapshot];
                }
            }

            if (prevDelta) {
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

            return result;
        }

        /**
         * Given a realm object, return its current realm state. May return a cached object shared between calls.
         *
         * @param {Realm} realm
         * @return {Promise<RealmState>}
         */
        async function getRealmState(realm) {
            if (
                my.lastRealmState.data &&
                my.lastRealmState.id === realm.connectedId &&
                my.lastRealmState.checked > Date.now() - REALM_STATE_CACHE_DURATION
            ) {
                return my.lastRealmState.data;
            }

            const response = await fetch('data/' + realm.connectedId + '/state.bin', {mode: 'same-origin'});
            if (!response.ok) {
                throw "Unable to get realm state for " + realm.connectedId;
            }

            if (my.lastRealmState.data &&
                my.lastRealmState.id === realm.connectedId &&
                my.lastRealmState.modified === response.headers.get('last-modified')
            ) {
                my.lastRealmState.checked = Date.now();

                return my.lastRealmState.data;
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
            Object.freeze(result.realm);
            result.snapshot = view.getUint32(read(4), true) * MS_SEC;
            result.lastCheck = view.getUint32(read(4), true) * MS_SEC;
            result.snapshots = [];
            for (let remaining = view.getUint16(read(2), true); remaining > 0; remaining--) {
                result.snapshots.push(view.getUint32(read(4), true) * MS_SEC);
            }
            Object.freeze(result.snapshots);
            result.summary = {};
            result.variants = {};
            result.speciesVariants = {};
            for (let remaining = view.getUint32(read(4), true); remaining > 0; remaining--) {
                let itemId = view.getUint32(read(4), true);
                let itemLevel = view.getUint16(read(2), true);
                let itemSuffix = view.getUint16(read(2), true);
                let itemKey = {
                    itemId: itemId,
                    itemLevel: itemLevel,
                    itemSuffix: itemSuffix,
                };
                let itemKeyString = Items.stringifyKey(itemKey);
                if (itemId === ITEM_PET_CAGE) {
                    if (itemKey.itemSuffix) {
                        result.speciesVariants[itemKey.itemLevel] = result.speciesVariants[itemKey.itemLevel] || [];
                        result.speciesVariants[itemKey.itemLevel].push(itemKeyString);
                    }
                } else {
                    if (itemKey.itemLevel) {
                        result.variants[itemId] = result.variants[itemId] || [];
                        result.variants[itemId].push(itemKeyString);
                    }
                }

                let snapshot = view.getUint32(read(4), true) * MS_SEC;
                let price = view.getUint32(read(4), true) * COPPER_SILVER;
                let quantity = view.getUint32(read(4), true);
                result.summary[itemKeyString] = Object.freeze({
                    snapshot: snapshot,
                    price: price,
                    quantity: quantity,
                });
            }
            for (let itemId in result.variants) {
                if (result.variants.hasOwnProperty(itemId)) {
                    Object.freeze(result.variants[itemId]);
                }
            }
            for (let speciesId in result.speciesVariants) {
                if (result.speciesVariants.hasOwnProperty(speciesId)) {
                    Object.freeze(result.speciesVariants[speciesId]);
                }
            }
            Object.freeze(result.summary);
            Object.freeze(result.variants);
            Object.freeze(result.speciesVariants);
            Object.freeze(result);

            my.lastRealmState = {
                id: realm.connectedId,
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
         * @property {string}     name
         * @property {ClassID}    class
         * @property {number[]} [extraFilters]
         * @property {InventoryType[]} [invTypes]
         * @property {SubclassID} [subClass]
         * @property {SubclassID[]} [subClasses]
         * @property {Subcategory[]} [subcategories]
         */

        // ********************* //
        // ***** VARIABLES ***** //
        // ********************* //

        /**
         * @type {{
         *  classId: ClassID|undefined,
         *  extraFilters: number[]|undefined,
         *  invTypes: InventoryType[]|undefined,
         *  subClassId: SubclassID|undefined,
         *  subClassIds: SubclassID[]|undefined,
         *  detailColumn: DetailColumn|undefined,
         *  categories: Category[],
         *  battlePetTypes: Object.<number, string>,
         *  }}
         */
        const my = {
            categories: undefined,
            battlePetTypes: {},

            classId: undefined,
            extraFilters: undefined,
            invTypes: undefined,
            subClassId: undefined,
            subClassIds: undefined,

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
         * Returns the class ID to use in search filtering, or undefined for none.
         *
         * @return {ClassID|undefined}
         */
        this.getClassId = function () {
            return my.classId;
        }

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
        }

        /**
         * Returns extra filter IDs to use in search filtering, or undefined for none.
         *
         * @return {number[]}
         */
        this.getExtraFilters = function () {
            return my.extraFilters && my.extraFilters.slice(0);
        }

        /**
         * Returns the inventory type IDs to use in search filtering, or undefined for none.
         *
         * @return {InventoryType[]}
         */
        this.getInvTypes = function () {
            return my.invTypes && my.invTypes.slice(0);
        }

        /**
         * Returns the subclass IDs to use in search filtering, or undefined for none.
         *
         * @return {SubclassID[]|undefined}
         */
        this.getSubClassIds = function () {
            return my.subClassIds && my.subClassIds.slice(0) ||
                my.subClassId !== undefined && [my.subClassId] ||
                undefined;
        }

        /**
         * Fetches the category list data and creates its elements in the category div.
         */
        this.init = async function () {
            const data = await getCategories();

            const categoriesParent = qs('.main .categories');
            ee(categoriesParent);

            data.forEach(function (cat) {
                const catDiv = ce(
                    'div',
                    {
                        className: 'category',
                        dataset: {
                            classId: cat['class'],
                        },
                    },
                    getNameNode(cat.name)
                );
                categoriesParent.appendChild(catDiv);
                catDiv.addEventListener('click', clickCategory.bind(null, catDiv, cat));

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
                        getNameNode(subcat.name)
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
                            getNameNode(subsubcat.name)
                        );
                        if (subsubcat.hasOwnProperty('subClass')) {
                            subsubcatDiv.dataset.subClassId = subsubcat.subClass;
                        } else if (subcat.hasOwnProperty('subClasses')) {
                            subsubcatDiv.dataset.subClassIds = subsubcat.subClasses.join(',');
                        }
                        if (subsubcat.hasOwnProperty('invTypes')) {
                            subsubcatDiv.dataset.invTypes = subsubcat.invTypes.join(',');
                        }
                        if (subsubcat.hasOwnProperty('extraFilters')) {
                            subsubcatDiv.dataset.extraFilters = subsubcat.extraFilters.join(',');
                        }
                        categoriesParent.appendChild(subsubcatDiv);
                        subsubcatDiv.addEventListener('click', clickSubSubCategory.bind(null, subsubcatDiv));
                    });
                });
            });
        }

        // ------- //
        // PRIVATE //
        // ------- //

        /**
         * Event handler for clicking a primary category.
         *
         * @param {HTMLElement} catDiv
         * @param {Category} cat
         */
        function clickCategory(catDiv, cat) {
            const classId = parseInt(catDiv.dataset.classId);
            const wasSelected = !!catDiv.dataset.selected;

            // De-select everything.
            qsa('.main .categories > div').forEach(function (node) {
                delete node.dataset.selected;
                delete node.dataset.visible;
            });
            my.classId = undefined;
            my.subClassId = undefined;
            my.subClassIds = undefined;
            my.invTypes = undefined;
            my.extraFilters = undefined;
            my.detailColumn = undefined;

            if (!wasSelected) {
                // Select this category.
                catDiv.dataset.selected = 1;
                my.classId = classId;
                my.detailColumn = cat.detailColumn;

                // Show any subcategories under this category.
                qsa('.main .categories .subcategory[data-parent-class="' + classId + '"]').forEach(function (node) {
                    node.dataset.visible = 1;
                });
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
         * Fetches (if necessary) and returns the categories list.
         *
         * @return {Promise<Category[]>}
         */
        async function getCategories() {
            if (my.categories) {
                return my.categories;
            }

            const response = await fetch('json/categories.enus.json', {mode:'same-origin'});
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
         * @param {string} nameString
         * @return {Node}
         */
        function getNameNode(nameString) {
            let match = /^\|c([0-9a-f]{2})([0-9a-f]{6})(.*)\|r$/.exec(nameString);
            if (match) {
                return ce('span', {style: {color: '#' + match[2] + match[1]}}, ct(match[3]));
            }

            return ct(nameString);
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

        /** @var {Object.<number, BattlePetStats>} */
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
        }

        /**
         * Enters detail mode to show the given item's details.
         *
         * @param {PricedItem} item
         * @param {Realm|null} realm
         */
        this.show = async function (item, realm) {
            qs('.main .main-result').dataset.detailMode = 1;

            const itemDiv = qs('.main .main-result .item');
            ee(itemDiv);

            {
                const backBar = ce('div', {className: 'back-bar'});
                itemDiv.appendChild(backBar);

                const backButton = ce('button', {}, ct('Back'));
                backBar.appendChild(backButton);
                backButton.addEventListener('click', self.hide);

                if (realm && realm.id !== Realms.getCurrentRealm().id) {
                    backBar.appendChild(ce('span', {className: 'alt-realm'}, ct('Viewing Realm ' + realm.name)));
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
            populateDetails(item, itemState);
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
         * Returns an array of item states for the given item for all realms in the given region.
         *
         * @param {PricedItem} item
         * @param {string} region
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
         * @param {PricedItem} item
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

                    datasetParams.wowhead = wowheadParams.join('&');
                }

                const a = ce('a',
                    {dataset: datasetParams},
                    priceElement(specLine.price)
                );
                td.appendChild(a);
            });
        }

        /**
         * Populate the empty details panel for the given item.
         *
         * @param {PricedItem} item
         * @param {ItemState} itemState
         */
        function populateDetails(item, itemState) {
            const parent = qs('.main .main-result .item .details');
            const scroller = ce('div', {className: 'scroller'});
            parent.appendChild(scroller);
            scroller.scrollTop = 0;

            const MIN_SNAPSHOT_COUNT = 6;

            const days = itemState.snapshots.length ? Math.round(
                (itemState.snapshots[itemState.snapshots.length - 1].snapshot - itemState.snapshots[0].snapshot) /
                (24 * 60 * 60 * 1000)
            ) : 0;
            const realmName = itemState.realm.name;
            const regionName = itemState.realm.region.toUpperCase();

            // Name panel
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

                    icon.addEventListener('mouseover', (event) => WH.Tooltip.showAtCursor(event, pic.outerHTML));
                    icon.addEventListener('mousemove', WH.Tooltip.cursorUpdate);
                    icon.addEventListener('mouseout', WH.Tooltip.hide);
                }

                let itemName = item.name;
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
                    nameLink.href = 'https://www.wowhead.com/npc=' + item.npc;
                } else {
                    nameLink.href = 'https://www.wowhead.com/item=' + item.id;
                }
                if (wowheadParams.length) {
                    nameLink.dataset.wowhead = wowheadParams.join('&');
                }
            }

            const getStatistics = (values) => {
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

            let regionElements = {};

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
                tr.appendChild(ce('td', {}, ct(realmName)));
                tr.appendChild(ce('td', {}, ct(regionName)));

                table.appendChild(tr = ce('tr'));
                tr.appendChild(ce('td', {}, ct('Available')));
                tr.appendChild(ce('td', {
                    dataset: {simpleTooltip: 'Total quantity for sale in ' + realmName + ' right now.'}
                }, ct(item.quantity.toLocaleString())));
                tr.appendChild(regionElements.quantity = ce('td', {
                    dataset: {simpleTooltip: 'Total quantity for sale in all ' + regionName + ' realms right now.'}
                }));

                if (!item.quantity) {
                    table.appendChild(tr = ce('tr'));
                    tr.appendChild(ce('td', {}, ct('Last Seen')));
                    tr.appendChild(ce('td', {}, ce('span', {className: 'delta-timestamp', dataset: {timestamp: item.snapshot}})));
                    tr.appendChild(ce('td'));
                }

                if (item.price) {
                    table.appendChild(tr = ce('tr'));
                    tr.appendChild(ce('td', {}, ct('Current')));
                    tr.appendChild(ce('td', {
                        dataset: {simpleTooltip: 'Lowest price in ' + realmName + ' right now.'}
                    }, priceElement(item.price)));
                    tr.appendChild(ce('td'));
                }

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
                    dataset: {simpleTooltip: 'Median price in ' + realmName + ' over the past ' + days + ' days.'}
                }));
                tr.appendChild(regionElements.median = ce('td', {
                    dataset: {simpleTooltip: 'Median price among all ' + regionName + ' realms right now.'}
                }));

                table.appendChild(tr = ce('tr'));
                tr.appendChild(ce('td', {}, ct('Mean')));
                tr.appendChild(realmElements.mean = ce('td', {
                    dataset: {simpleTooltip: 'Mean (average) price in ' + realmName + ' over the past ' + days + ' days.'}
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
                    tr.appendChild(ce('td', {}, ct('Vendor')));
                    tr.appendChild(ce('td', {
                        dataset: {simpleTooltip: 'The amount you get when selling this item to a vendor.'}
                    }, priceElement(vendorSell)));
                    tr.appendChild(ce('td'));
                }
            })();

            // Price chart
            (() => {
                if (itemState.snapshots.length < MIN_SNAPSHOT_COUNT) {
                    return;
                }

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
                const yGap = 10 * constScale;
                const yMaxQuantity = (500 * constScale) - yMaxPrice - yGap;
                const yMax = yMaxPrice + yMaxQuantity;

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
                let maxQuantity = 0;
                let firstTimestamp = Date.now();
                let lastTimestamp = 0;
                {
                    let prices = [];
                    itemState.snapshots.forEach(snapshot => {
                        maxPrice = Math.max(maxPrice, snapshot.price);
                        maxQuantity = Math.max(maxQuantity, snapshot.quantity);
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
                const quantityPoints = [];
                const hoverData = [];

                const xOffset = Math.round(1 / itemState.snapshots.length * xMax / 2);
                const xRange = xMax - 2 * xOffset;

                itemState.snapshots.forEach(snapshot => {
                    const x = xOffset + Math.round((snapshot.snapshot - firstTimestamp) / timestampRange * xRange);
                    const priceY = Math.round((maxPrice - snapshot.price) / maxPrice * yMaxPrice);
                    pricePoints.push([x, priceY].join(','));

                    const quantityY = Math.round((maxQuantity - snapshot.quantity) / maxQuantity * yMaxQuantity) + yMaxPrice + yGap;
                    quantityPoints.push([x, quantityY].join(','));

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
                    {data: quantityPoints, max: yMaxQuantity + yMaxPrice + yGap, name: 'quantity'},
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

                    if (snapshot.price) {
                        const priceLine = ce('tr');
                        priceLine.appendChild(ce('td', {className: 'price'}, ct('Lowest Price')));
                        priceLine.appendChild(ce('td', {}, priceElement(snapshot.price)));
                        result.appendChild(priceLine);
                    }

                    const quantityLine = ce('tr');
                    quantityLine.appendChild(ce('td', {className: 'quantity'}, ct('Total Quantity')));
                    quantityLine.appendChild(ce('td', {}, ct(snapshot.quantity.toLocaleString())));
                    result.appendChild(quantityLine);

                    WH.Tooltip.showAtCursor(event, result.outerHTML);
                });
                priceChart.addEventListener('mouseout', WH.Tooltip.hide);
            })();

            // Quantity calc
            if (itemState.auctions.length) {
                const quantityPanel = ce('div', {className: 'quantity-calc framed'});
                scroller.appendChild(quantityPanel);

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

            // Other realms
            (() => {
                const topContainer = ce('div', {
                    className: 'other-realms-container framed',
                });
                scroller.appendChild(topContainer);
                topContainer.appendChild(ce('span', {className: 'frame-title'}, ct('Current Regional Prices')));

                const otherRealmsContainer = ce('div', {className: 'check-container'});
                topContainer.appendChild(otherRealmsContainer);
                const otherRealmsLabel = ce('label', {}, ct('Include Connected Realms'));
                otherRealmsContainer.appendChild(otherRealmsLabel);
                const otherRealmsControl = ce('input', {type: 'checkbox'});
                otherRealmsLabel.appendChild(otherRealmsControl);

                const list = ce('div', {
                    className: 'list',
                });
                topContainer.appendChild(list);

                const COL_NAME = 1;
                const COL_PRICE = 2;

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
                    let columnPos = 0;
                    for (let x = 0; x < headerTds.length; x++) {
                        delete headerTds[x].dataset.sort;
                        if (headerTds[x] === headerTd) {
                            columnPos = x + 1;
                        }
                    }

                    headerTd.dataset.sort = dir;
                    let table = headerTr;
                    while (table.tagName !== 'TABLE') {
                        table = table.parentNode;
                    }
                    let rows = Array.from(table.querySelectorAll('tbody tr'));
                    rows.sort(function (a, b) {
                        const aVal = a.querySelector('td:nth-child(' + columnPos + ')').dataset.sortValue;
                        const bVal = b.querySelector('td:nth-child(' + columnPos + ')').dataset.sortValue;

                        if (isString) {
                            return aVal.localeCompare(bVal);
                        }

                        const valDiff = parseInt(aVal) - parseInt(bVal);
                        if (valDiff) {
                            return valDiff;
                        }

                        // Fallbacks.
                        if (columnPos !== COL_PRICE) {
                            const aPrice = a.querySelector('td:nth-child(' + COL_PRICE + ')').dataset.sortValue;
                            const bPrice = b.querySelector('td:nth-child(' + COL_PRICE + ')').dataset.sortValue;

                            const valDiff = parseInt(aPrice) - parseInt(bPrice);
                            if (valDiff) {
                                return valDiff;
                            }
                        }

                        if (columnPos !== COL_NAME) {
                            const aName = a.querySelector('td:nth-child(' + COL_NAME + ')').dataset.sortValue;
                            const bName = b.querySelector('td:nth-child(' + COL_NAME + ')').dataset.sortValue;

                            const valDiff = aName.localeCompare(bName);
                            if (valDiff) {
                                return valDiff;
                            }
                        }

                        return 0;
                    });

                    if (dir === 'desc') {
                        rows.reverse();
                    }
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
                let firstSortTd;
                tr.appendChild(firstSortTd = td = ce('td', {}, ct('Realm')));
                td.addEventListener('click', columnSort.bind(null, td, true));
                tr.appendChild(td = ce('td', {}, ct('Price')));
                td.addEventListener('click', columnSort.bind(null, td, false));
                tr.appendChild(td = ce('td', {}, ct('Quantity')));
                td.addEventListener('click', columnSort.bind(null, td, false));

                regionElements.listTable = tbody;
                regionElements.afterList = () => {
                    columnSort(firstSortTd, true);
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
                otherRealms.forEach(itemState => {
                    quantitySum += itemState.quantity;
                    if (itemState.price) {
                        prices.push(itemState.price);
                    }

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
                        tr.appendChild(td = ce('td', {dataset: {sortValue: realm.name}}, ct(realm.name)));
                        td.appendChild(a = ce('a', {
                            href: 'javascript:',
                        }));
                        if (index > 0) {
                            tr.dataset.connectedRealm = 1;
                        }
                        a.addEventListener('click', showOtherRealmItem.bind(self, item, itemState, realm));
                        tr.appendChild(ce('td', {dataset: {sortValue: itemState.price}}, itemState.price ? priceElement(itemState.price) : undefined));
                        tr.appendChild(td = ce('td', {dataset: {sortValue: itemState.quantity}}, ct(itemState.quantity.toLocaleString())));
                        if (itemState.quantity === 0) {
                            td.classList.add('q0');
                        }

                        regionElements.listTable.appendChild(tr);
                    }
                });

                regionElements.afterList();

                regionElements.quantity.appendChild(ct(quantitySum.toLocaleString()));
                if (prices.length >= 5) {
                    let statistics = getStatistics(prices);
                    regionElements.median.appendChild(priceElement(statistics.median));
                    regionElements.mean.appendChild(priceElement(statistics.mean));
                }
            });

            updateDeltaTimestamps();
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

        /**
         * Shows the item detail for a given item on an alternate realm.
         *
         * @param {PricedItem} item
         * @param {ItemState} itemState
         * @param {Realm} realm
         */
        function showOtherRealmItem(item, itemState, realm) {
            /** @var {PricedItem} repricedItem */
            const repricedItem = {};
            co(repricedItem, item);
            repricedItem.quantity = itemState.quantity;
            repricedItem.price = itemState.price;

            self.show(repricedItem, realm);
        }
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
         * @property {string} name
         * @property {number|null} bonus
         */

        this.CLASS_CONSUMABLE = 0;
        this.CLASS_WEAPON = 2;
        this.CLASS_GEM = 3;
        this.CLASS_ARMOR = 4;
        this.CLASS_MISCELLANEOUS = 15;
        this.CLASS_BATTLE_PET = 17;
        this.CLASSES_EQUIPMENT = [this.CLASS_ARMOR, this.CLASS_WEAPON];

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

        const ID_PET_CAGE = 82800;

        // ********************* //
        // ***** VARIABLES ***** //
        // ********************* //

        /**
         * @type {{
         * items: Object.<ItemID, UnnamedItem>,
         * names: Object.<ItemID, string>,
         * suffixes: Object.<SuffixID, Suffix>,
         * battlePets: Object.<BattlePetSpeciesID, BattlePetSpecies>,
         * battlePetNames: Object.<BattlePetSpeciesID, string>,
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
                const baseFactor = my.vendor[item.vendorSellBase || item['class']][item.bonusLevel || item.itemLevel];
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
                fetchItemNames(),
                fetchItemSuffixes(),
                fetchBattlePets(),
                fetchBattlePetNames(),
                fetchVendor(),
            ]);
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

            const forSuggestions = searchMode === self.SEARCH_MODE_SUGGESTIONS;
            const favoritesOnly = searchMode === self.SEARCH_MODE_FAVORITES;
            const favorites = favoritesOnly ? Search.getFavorites() : [];
            const seenNames = {};
            const classId = Categories.getClassId();
            const subClassIds = Categories.getSubClassIds();
            const invTypes = Categories.getInvTypes();
            const extraFilters = Categories.getExtraFilters();
            const realmState = await Auctions.getRealmState();
            const useVariants = !qs('.main .search-bar .filter [name="transmog-mode"]').checked;

            const wordExpressions = [];
            const searchBox = qs('.main .search-bar input[type="text"]');
            searchBox.value.replace(/^\s+|\s+$/, '').split(/\s+/).forEach(function (word) {
                if (word) {
                    wordExpressions.push(new RegExp('\\b' + escapeRegExp(word), 'i'));
                }
            });

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

                let item = my.items[id];
                if (classId !== undefined && item['class'] !== classId) {
                    continue;
                }
                if (parseInt(id) === ID_PET_CAGE) {
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
                        if (useVariants) {
                            // Normally we'll check item level for each variant.
                            break;
                        }
                        // Check the item level of the base item, not the variant. No break.
                    case Items.CLASS_GEM:
                        if (minLevel !== undefined && item.itemLevel < minLevel) {
                            continue;
                        }
                        if (maxLevel !== undefined && item.itemLevel > maxLevel) {
                            continue;
                        }
                        break;
                }

                /** @type {Array.<ItemKeyString>} variants */
                let variants;
                if (!useVariants) {
                    // Not using any variants, just bare item IDs.
                    variants = [Items.stringifyKey({itemId: parseInt(id), itemLevel: 0, itemSuffix: 0})];
                } else {
                    if (realmState.variants[id]) {
                        variants = realmState.variants[id].slice(0);
                    } else {
                        variants = [
                            Items.stringifyKey({
                                itemId: parseInt(id),
                                itemLevel: self.CLASSES_EQUIPMENT.includes(item['class']) ? item.itemLevel : 0,
                                itemSuffix: 0,
                            }),
                        ];
                    }

                    if (forSuggestions && variants.length > 1) {
                        // Strip out item levels. We won't be looking up these key strings anyway.
                        for (let index = 0; index < variants.length; index++) {
                            let itemKey = Items.parseKey(variants[index]);
                            itemKey.itemLevel = 0;
                            variants[index] = Items.stringifyKey(itemKey);
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

                    let name = my.names[itemKey.itemId];
                    if (itemKey.itemSuffix) {
                        name += ' ' + Items.getSuffix(itemKey.itemId, itemKey.itemSuffix).name;
                    }

                    let foundAllWords = true;
                    for (let regex, x = 0; foundAllWords && (regex = wordExpressions[x]); x++) {
                        foundAllWords = regex.test(name);
                    }
                    if (!foundAllWords) {
                        return;
                    }

                    if (forSuggestions) {
                        if (seenNames[name]) {
                            return;
                        }
                        seenNames[name] = true;
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
                        variants = [Items.stringifyKey({itemId: ITEM_PET_CAGE, itemLevel: speciesId, itemSuffix: 0})];
                    } else {
                        if (realmState.speciesVariants[speciesId]) {
                            variants = realmState.speciesVariants[speciesId].slice(0);
                        } else {
                            variants = [Items.stringifyKey({itemId: ITEM_PET_CAGE, itemLevel: speciesId, itemSuffix: 0})];
                        }
                    }

                    if (favoritesOnly) {
                        variants = variants.filter(keyString => favorites.includes(keyString));
                    }

                    variants.forEach(keyString => {
                        const itemKey = Items.parseKey(keyString);

                        let name = my.battlePetNames[itemKey.itemLevel];

                        let foundAllWords = true;
                        for (let regex, x = 0; foundAllWords && (regex = wordExpressions[x]); x++) {
                            foundAllWords = regex.test(name);
                        }
                        if (!foundAllWords) {
                            return;
                        }

                        if (forSuggestions) {
                            if (seenNames[name]) {
                                return;
                            }
                            seenNames[name] = true;
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
         * Serialize an item key into a short string.
         *
         * @param {ItemKey} itemKey
         * @return {ItemKeyString}
         */
        this.stringifyKey = function (itemKey) {
            let result = '' + itemKey.itemId;
            if (itemKey.itemLevel) {
                result += '-' + itemKey.itemLevel;
                if (itemKey.itemSuffix) {
                    result += '-' + itemKey.itemSuffix;
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
            return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
        }

        /**
         * Fetches the list of battle pet names and stores it locally.
         */
        async function fetchBattlePetNames() {
            const response = await fetch('json/battlepets.enus.json', {mode:'same-origin'});
            if (!response.ok) {
                throw 'Cannot get list of battle pet names!';
            }

            my.battlePetNames = await response.json();
        }

        /**
         * Fetches the list of battle pets and stores it locally.
         */
        async function fetchBattlePets() {
            const response = await fetch('json/battlepets.json', {mode:'same-origin'});
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
            const response = await fetch('json/items.json', {mode:'same-origin'});
            if (!response.ok) {
                throw 'Cannot get list of item IDs!';
            }

            my.items = await response.json();

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
         */
        async function fetchItemNames() {
            const response = await fetch('json/names.enus.json', {mode:'same-origin'});
            if (!response.ok) {
                throw 'Cannot get list of item names!';
            }

            my.names = await response.json();
        }

        /**
         * Fetches the list of item names and stores it locally.
         */
        async function fetchItemSuffixes() {
            const response = await fetch('json/name-suffixes.enus.json', {mode:'same-origin'});
            if (!response.ok) {
                throw 'Cannot get list of item suffixes!';
            }

            my.suffixes = await response.json();
        }

        /**
         * Fetches the list of vendor sell data and stores it locally.
         */
        async function fetchVendor() {
            const response = await fetch('json/vendor.json', {mode:'same-origin'});
            if (!response.ok) {
                throw 'Cannot get vendor pricing data!';
            }

            my.vendor = await response.json();
        }
    };

    /**
     * Methods to handle realms and connected realms.
     */
    const Realms = new function () {
        const self = this;

        // ********************* //
        // ***** CONSTANTS ***** //
        // ********************* //

        this.REGION_US = 'us';
        this.REGION_EU = 'eu';

        const REGIONS = [this.REGION_US, this.REGION_EU];

        // ********************* //
        // ***** VARIABLES ***** //
        // ********************* //

        /** @type {{
         *      connectedRealms: Object.<string, Object.<ConnectedRealmID, ConnectedRealm>>,
         *      realms: Object.<RealmID, Realm>
         * }}
         */
        const my = {
            connectedRealms: {},

            realms: {},
        };

        // ********************* //
        // ***** FUNCTIONS ***** //
        // ********************* //

        // ------ //
        // PUBLIC //
        // ------ //

        /**
         * Returns the connected realm object for a given realm.
         *
         * @param {Realm} realm
         * @return {ConnectedRealm}
         */
        this.getConnectedRealm = function (realm) {
            return getConnectedRealmsForRegion(realm.region)[realm.connectedId];
        }

        /**
         * Get a copy of the realm object for the currently-selected realm, or undefined if not found.
         *
         * @return {Realm|undefined}
         */
        this.getCurrentRealm = function () {
            const sel = qs('.main .search-bar select');
            const realmId = sel.options[sel.selectedIndex].value;

            if (!realmId) {
                return;
            }

            try {
                localStorage.setItem('realm', realmId);
            } catch (e) {
                // Ignore
            }

            return self.getRealm(parseInt(realmId));
        }

        /**
         * Get a copy of the realm object for the given realm ID, or undefined if not found.
         *
         * @param {RealmID} realmId
         * @return {Realm|undefined}
         */
        this.getRealm = function (realmId) {
            if (!my.realms[realmId]) {
                return;
            }

            let result = {};
            co(result, my.realms[realmId]);

            return result;
        }

        /**
         * Returns a sorted array of connected realms for the given region.
         *
         * @param {string} region
         * @return {ConnectedRealm[]}
         */
        this.getRegionConnectedRealms = function (region) {
            const result = Object.values(getConnectedRealmsForRegion(region));
            result.sort((a, b) => a.canonical.name.localeCompare(b.canonical.name));

            return result;
        }

        /**
         * Fetches the realm list data and creates the realm list dropdown.
         */
        this.init = async function () {
            await getRealms();

            const savedRealmId = parseInt(localStorage.getItem('realm') || 0);

            const select = qs('.main .search-bar select');
            const placeholderUsageCheck = function () {
                if (!select.options[0].value) {
                    if (select.selectedIndex !== 0) {
                        select.removeChild(select.querySelector('option[value=""]'));
                        select.removeEventListener('change', placeholderUsageCheck);
                    }
                } else {
                    select.removeEventListener('change', placeholderUsageCheck);
                }
            }
            select.addEventListener('change', placeholderUsageCheck);

            const sorted = [];
            for (let k in my.realms) {
                if (!my.realms.hasOwnProperty(k)) {
                    continue;
                }

                sorted.push(my.realms[k]);
            }
            sorted.sort((a, b) => {
                return a.name.localeCompare(b.name) || (REGIONS.indexOf(a.region) - REGIONS.indexOf(b.region));
            });

            const seenNames = {};
            sorted.forEach(realm => {
                let o = ce('option');
                o.value = realm.id;
                o.label = realm.name;

                if (seenNames[realm.name]) {
                    if (seenNames[realm.name] !== true) {
                        const opt = seenNames[realm.name];
                        opt.label += ' ' + self.getRealm(parseInt(opt.value)).region.toUpperCase();
                        ee(opt);
                        opt.appendChild(ct(opt.label));

                        seenNames[realm.name] = true;
                    }
                    o.label += ' ' + realm.region.toUpperCase();
                } else {
                    seenNames[realm.name] = o;
                }
                o.appendChild(ct(o.label));

                if (realm.id === savedRealmId) {
                    o.selected = true;
                }

                select.appendChild(o);
            });

            placeholderUsageCheck();
        }

        // ------- //
        // PRIVATE //
        // ------- //

        /**
         * Returns the connected realms for a region, keyed by connected realm ID.
         *
         * @param {string} region
         * @return {Object.<ConnectedRealmID, ConnectedRealm>}
         */
        function getConnectedRealmsForRegion(region) {
            let result = my.connectedRealms[region];
            if (result) {
                return result;
            }

            result = {};
            for (let realmId in my.realms) {
                if (!my.realms.hasOwnProperty(realmId)) {
                    continue;
                }

                let realm = my.realms[realmId];
                if (realm.region !== region) {
                    continue;
                }

                if (!result.hasOwnProperty(realm.connectedId)) {
                    result[realm.connectedId] = {
                        region: realm.region,
                        id: realm.connectedId,
                        secondary: [],
                    };
                }
                if (realm.id === realm.connectedId) {
                    result[realm.connectedId].canonical = realm;
                } else {
                    result[realm.connectedId].secondary.push(realm);
                }
            }

            for (let connectedId in result) {
                if (!result.hasOwnProperty(connectedId)) {
                    continue;
                }

                let connectedRealm = result[connectedId];
                connectedRealm.secondary.sort((a, b) => a.name.localeCompare(b.name));
                if (!connectedRealm.canonical) {
                    connectedRealm.canonical = connectedRealm.secondary.shift();
                }
            }

            return my.connectedRealms[region] = result;
        }

        /**
         * Fetches the realm list and stores it locally.
         */
        async function getRealms() {
            const response = await fetch('json/realm-list.enus.json', {mode:'same-origin'});
            if (!response.ok) {
                throw 'Cannot get list of realms!';
            }

            my.realms = await response.json();
        }
    }

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
         * Perform a search for items, reading the parameters from the UI.
         *
         * @param {boolean} favoritesOnly
         */
        this.perform = async function (favoritesOnly) {
            if (!Realms.getCurrentRealm()) {
                alert('Please select a realm in the top left corner.');
                qs('.main .search-bar select').focus();

                return;
            }

            Detail.hide();
            emptyItemList();

            const itemsList = await Auctions.hydrateList(
                await Items.search(favoritesOnly ? Items.SEARCH_MODE_FAVORITES : Items.SEARCH_MODE_NORMAL)
            );

            await showItemList(itemsList);
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
            const headerTds = headerTr.querySelectorAll('td');
            let columnPos = 0;
            for (let x = 0; x < headerTds.length; x++) {
                delete headerTds[x].dataset.sort;
                if (headerTds[x] === headerTd) {
                    columnPos = x + 1;
                }
            }

            setPreferredSort(columnPos * (dir === 'asc' ? 1 : -1));

            headerTd.dataset.sort = dir;

            my.rows.sort(function (a, b) {
                if (a[0].classList.contains('message')) {
                    return dir === 'asc' ? -1 : 1;
                }
                if (b[0].classList.contains('message')) {
                    return dir === 'asc' ? 1 : -1;
                }

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

                if (headerTds.length > 3 && columnPos !== COL_DETAIL) {
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
            my.rows.forEach(row => row[0].parentNode.appendChild(row[0]));
        }

        /**
         * Empty the item list. This is done separately from showing the list so we can ensure old results are wiped out
         * while we build a new long list.
         */
        function emptyItemList() {
            qs('.main .welcome').style.display = 'none';
            ee(qs('.main .search-result-target'));
            my.rows = [];
        }

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
         * Given an pricing-hydrated list of items, show it in the UI.
         *
         * @param {PricedItem[]} itemsList
         */
        async function showItemList(itemsList) {
            const detailColumn = Categories.getDetailColumn();
            const showOutOfStock = qs('.main .search-bar .filter [name="out-of-stock"]').checked;
            const vendorFlip = qs('.main .search-bar .filter [name="vendor-flip"]').checked;
            const favorites = self.getFavorites();

            const parent = qs('.main .search-result-target');
            parent.classList.add('processing');

            let tr, td;

            const table = ce('table');
            parent.appendChild(table);
            const thead = ce('thead');
            table.appendChild(thead);

            thead.appendChild(tr = ce('tr'));
            tr.appendChild(td = ce('td', {}, ct('Price')));
            td.addEventListener('click', columnSort.bind(null, td, false));
            tr.appendChild(td = ce('td', {}, ct('Name')));
            td.addEventListener('click', columnSort.bind(null, td, true));
            if (detailColumn) {
                tr.appendChild(td = ce('td', {}, ct(detailColumn.name)));
                td.addEventListener('click', columnSort.bind(null, td, false));
            }
            tr.appendChild(td = ce('td', {}, ct('Available')));
            td.addEventListener('click', columnSort.bind(null, td, false));

            my.rows = [];
            const tbody = ce('tbody');
            table.appendChild(tbody);
            for (let item, itemIndex = 0; item = itemsList[itemIndex]; itemIndex++) {
                if ((item.quantity || 0) === 0) {
                    if ((item.price || 0) === 0) {
                        continue;
                    } else {
                        if (!showOutOfStock) {
                            continue;
                        }
                    }
                }
                if (vendorFlip) {
                    const vendorPrice = Items.getVendorSellPrice(item);
                    if (!vendorPrice || vendorPrice <= item.price) {
                        continue;
                    }
                }

                if (my.rows.length % MAX_RESULTS_SHOWN === 0) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }

                let suffix;
                if (item.bonusSuffix) {
                    suffix = Items.getSuffix(item.id, item.bonusSuffix);
                }

                let tr, td;
                tbody.appendChild(tr = ce('tr'));

                const sortRow = [tr];
                my.rows.push(sortRow);

                //
                // PRICE
                //
                {
                    tr.appendChild(td = ce('td', {className: 'price'}));
                    sortRow.push(item.price || 0);
                    const rowLink = ce('a');
                    if (item.price) {
                        td.appendChild(priceElement(item.price));

                        if (!vendorFlip && item.quantity && Items.getVendorSellPrice(item) > item.price) {
                            tr.classList.add('vendor-flip');
                            rowLink._fixTooltip = html => html + '<div class="q2">Posted for under vendor price!</div>';
                        }
                    }
                    if (item.id === ITEM_PET_CAGE) {
                        rowLink.dataset.wowhead = 'npc=' + item.npc;
                    } else {
                        rowLink.dataset.wowhead = 'item=' + item.id;
                        if (item.bonusLevel) {
                            rowLink.dataset.wowhead += '&ilvl=' + item.bonusLevel;
                        }
                        if (suffix && suffix.bonus) {
                            rowLink.dataset.wowhead += '&bonus=' + suffix.bonus;
                        }
                    }
                    rowLink.addEventListener('click', Detail.show.bind(null, item, null));
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
                    if (item.bonusLevel && item.id !== ITEM_PET_CAGE && !(detailColumn && detailColumn.prop === 'itemLevel')) {
                        itemName += ' (' + item.bonusLevel + ')';
                    }
                    tr.appendChild(td = ce('td', {className: 'name'}));
                    sortRow.push(itemName);
                    if (item.side === SIDE_ALLIANCE) {
                        td.appendChild(ce('img', {
                            src: Items.getIconUrl('ui_allianceicon', Items.ICON_SIZE.MEDIUM),
                            loading: 'lazy',
                        }));
                        td.dataset.sideIcon = 1;
                        tbody.dataset.sideIcon = 1;
                    } else if (item.side === SIDE_HORDE) {
                        td.appendChild(ce('img', {
                            src: Items.getIconUrl('ui_hordeicon', Items.ICON_SIZE.MEDIUM),
                            loading: 'lazy',
                        }));
                        td.dataset.sideIcon = 1;
                        tbody.dataset.sideIcon = 1;
                    }
                    td.appendChild(ce('img', {
                        src: Items.getIconUrl(item.icon, Items.ICON_SIZE.MEDIUM),
                        loading: 'lazy',
                    }));
                    td.appendChild(ce('span', {className: 'q' + item.quality}, ct(itemName)));
                }

                //
                // DETAIL
                //
                if (detailColumn) {
                    let value = item[detailColumn.prop];
                    if (detailColumn.prop === 'reqLevel' && value <= 1) {
                        value = 1;
                    }
                    if (detailColumn.prop === 'itemLevel' && item.bonusLevel) {
                        value = item.bonusLevel;
                    }
                    tr.appendChild(td = ce('td', {className: detailColumn.prop}));
                    sortRow.push(value);
                    td.appendChild(ct(value.toLocaleString()));
                }

                //
                // QUANTITY
                //
                const quantity = item.quantity || 0;
                tr.appendChild(td = ce('td', {
                    className: 'quantity' + (quantity === 0 ? ' q0' : ''),
                }, ct(quantity.toLocaleString())));
                if (quantity === 0) {
                    td.appendChild(ce('span', {className: 'delta-timestamp', dataset: {timestamp: item.snapshot}}));
                    sortRow.push(quantity + item.snapshot / 10000000000000);
                } else {
                    sortRow.push(quantity);
                }

                let itemKey = Items.stringifyKey({
                    itemId: item.id,
                    itemLevel: item.bonusLevel,
                    itemSuffix: item.bonusSuffix,
                });
                let favSpan = ce('span', {className: 'favorite'});
                if (favorites.includes(itemKey)) {
                    favSpan.dataset.favorite = 1;
                }
                favSpan.addEventListener('click', toggleFavorite.bind(self, itemKey, favSpan));
                td.appendChild(favSpan);
            }

            if (tbody.childNodes.length === 0) {
                tbody.appendChild(ce('tr', {className: 'message'}, td = ce('td', {colSpan: detailColumn ? 4 : 3})));
                td.appendChild(ct('No results found. Double-check your category and filter settings.'));
            } else {
                if (tbody.childNodes.length > MAX_RESULTS_SHOWN) {
                    tbody.appendChild(ce('tr', {className: 'message'}, ce('td', {colSpan: detailColumn ? 4 : 3}, ct(
                        tbody.childNodes.length.toLocaleString() + ' results found. Showing the first ' + MAX_RESULTS_SHOWN.toLocaleString() + '.',
                    ))));
                }

                const prefSort = getPreferredSort() || 1;
                const sortTd = thead.querySelectorAll('td')[Math.abs(prefSort) - 1] || thead.querySelector('td');
                if (prefSort < 0) {
                    // Will flip to desc when we call the next sort.
                    sortTd.dataset.sort = 'asc';
                }
                sortTd.dispatchEvent(new MouseEvent('click'));
            }

            parent.classList.remove('processing');
            parent.scrollTop = 0;
            updateDeltaTimestamps();
        }

        /**
         * Toggles whether the given item key string is in the favorites list.
         *
         * @param {ItemKeyString} itemKeyString
         * @param {HTMLElement} favSpan
         */
        function toggleFavorite(itemKeyString, favSpan) {
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
                self.perform(true);
            }
        });
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
            const items = await Auctions.hydrateList(await Items.search(Items.SEARCH_MODE_SUGGESTIONS));
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

    //                           //
    // Generic Utility Functions //
    //                           //

    /**
     * Create Element.
     *
     * @param {string} tag
     * @param {object} [props]
     * @param {HTMLElement} [child]
     * @return {HTMLElement}
     */
    function ce(tag, props, child) {
        const result = document.createElement(tag);

        co(result, props || {});

        if (child) {
            result.appendChild(child);
        }

        return result;
    }

    /**
     * Create SVG Element.
     *
     * @param {string} tag
     * @param {object} [attributes]
     * @param {Node} [child]
     * @return {Node}
     */
    function svge(tag, attributes, child) {
        const result = document.createElementNS('http://www.w3.org/2000/svg', tag);

        if (attributes) {
            for (let key in attributes) {
                if (attributes.hasOwnProperty(key)) {
                    result.setAttribute(key, attributes[key]);
                }
            }
        }

        if (child) {
            result.appendChild(child);
        }

        return result;
    }

    /**
     * Copy Object. Properties from source are set onto dest.
     *
     * @param {object} dest
     * @param {object} source
     */
    function co(dest, source) {
        for (let k in source) {
            if (!source.hasOwnProperty(k)) {
                continue;
            }
            if (typeof source[k] === 'object') {
                if (Array.isArray(source[k])) {
                    dest[k] = source[k].slice(0);
                } else {
                    if (!(k in dest)) {
                        dest[k] = {};
                    }
                    co(dest[k], source[k]);
                }
            } else {
                dest[k] = source[k];
            }
        }
    }

    /**
     * Empties an element of all children.
     *
     * @param {Node} ele
     */
    function ee(ele) {
        while (ele.hasChildNodes()) {
            ele.removeChild(ele.firstChild);
        }
    }

    /**
     * Returns an element for the given price.
     *
     * @param {Money} coppers
     * @return {HTMLSpanElement}
     */
    function priceElement(coppers) {
        const df = ce('span', {style: {whiteSpace: 'nowrap'}});
        coppers = Math.abs(coppers);
        const silver = Math.floor(coppers / 100) % 100;
        const gold = Math.floor(coppers / 10000);

        if (gold > 0) {
            df.appendChild(ce('span', {className: 'gold'}, ct(gold.toLocaleString())));
        }
        df.appendChild(ce('span', {className: 'silver'}, ct(silver)));

        return df;
    }

    /**
     * Updates all delta timestamp elements on the page with values for the current time.
     */
    function updateDeltaTimestamps() {
        const longFormatter = new Intl.DateTimeFormat([], {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            timeZoneName: 'short',
        });

        const shortFormatter = new Intl.DateTimeFormat([], {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });

        qsa('.delta-timestamp[data-timestamp]').forEach(ele => {
            const timestamp = parseInt(ele.dataset.timestamp);
            ele.dataset.simpleTooltip = longFormatter.format(new Date(timestamp));
            ee(ele);

            let now = Date.now();
            let delta = now - timestamp;
            let timeString = '';
            if (delta < 0) {
                timeString = ele.dataset.simpleTooltip;
            } else if (delta < MS_MINUTE) {
                timeString = Math.round(delta / MS_SEC) + ' seconds ago';
            } else if (delta < 2 * MS_HOUR) {
                timeString = Math.round(delta / MS_MINUTE) + ' minutes ago';
            } else if (delta < 2 * MS_DAY) {
                timeString = Math.round(delta / MS_HOUR) + ' hours ago';
            } else if (delta < 14 * MS_DAY) {
                timeString = Math.round(delta / MS_DAY) + ' days ago';
            } else {
                timeString = shortFormatter.format(new Date(timestamp));
            }

            ele.appendChild(ct(timeString));
        })
    }

    //      //
    // Init //
    //      //

    async function init() {
        await Promise.all([
            Categories.init(),
            Items.init(),
            Realms.init(),
        ]);

        qs('.main .search-bar button.search').addEventListener('click', Search.perform.bind(null, false));
        qs('.main .search-bar > div.filter').addEventListener('mouseup', (event) => {
            const div = qs('.main .search-bar > div.filter div');
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
                Search.perform(false);
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
    }

    init().catch(alert);
};
