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

    /** @typedef {number} ClassID */

    /** @typedef {number} ConnectedRealmID */

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
     * @property {ItemID} id
     * @property {string} name
     * @property {number} bonusLevel
     * @property {SuffixID} bonusSuffix
     */

    /**
     * @typedef {object} ItemState
     * @property {Timestamp}       snapshot   The last snapshot when this item was seen
     * @property {Money}           price      The cheapest price when this item was last seen
     * @property {number}          quantity   How many were available when this was last seen
     * @property {Auction[]}       auctions   An array of distinct prices and quantities, ordered by price ascending
     * @property {AuctionDetail[]} specifics  An array of prices and bonus information, ordered by price ascending
     * @property {SummaryLine[]}   snapshots  An array of summary prices, order by snapshot ascending
     */

    /**
     * @typedef {Item} PricedItem
     * @property {Money}  price
     * @property {number} quantity
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
     * @property {Timestamp}                    snapshot   The timestamp of the most recent snapshot
     * @property {Timestamp}                    lastCheck  The timestamp when we last checked for a new snapshot
     * @property {Timestamp[]}                  snapshots  An array of snapshot timestamps, in ascending order
     * @property {Object.<ItemKeyString, SummaryLine>} summary
     * @property {Object.<ItemID, Array<ItemKeyString>>} variants
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
     * @property {number[]} [extraFilters]
     * @property {string} icon
     * @property {InventoryType} [inventoryType]
     * @property {number} [itemLevel]
     * @property {number} quality
     * @property {number} [reqLevel]
     * @property {number} [side]
     * @property {number} [slots]
     * @property {number} subclass
     */

    const SIDE_ALLIANCE = 1;
    const SIDE_HORDE = 2;

    const ct = document.createTextNode.bind(document);
    const qs = document.body.querySelector.bind(document.body);
    const qsa = document.body.querySelectorAll.bind(document.body);

    /**
     * Manages item prices and availability.
     */
    const Auctions = new function () {
        const self = this;

        // ********************* //
        // ***** CONSTANTS ***** //
        // ********************* //

        // ------ //
        // PUBLIC //
        // ------ //

        this.MODIFIER_TYPE_TIMEWALKER_LEVEL = 9;

        // ------- //
        // PRIVATE //
        // ------- //

        const COPPER_SILVER = 100;
        const MS_SEC = 1000;

        const REALM_STATE_CACHE_DURATION = 10 * MS_SEC;

        const VERSION_ITEM_STATE = 4;
        const VERSION_REALM_STATE = 3;

        // ********************* //
        // ***** VARIABLES ***** //
        // ********************* //

        const my = {
            lastRealmState: {},
        };

        // ********************* //
        // ***** FUNCTIONS ***** //
        // ********************* //

        // ------ //
        // PUBLIC //
        // ------ //

        /**
         * Given an item object, return its item state for the current realm.
         *
         * @param {PricedItem} item
         * @return {Promise<ItemState>}
         */
        this.getItem = async function (item) {
            return getItemState(Realms.getCurrentRealm(), item);
        }

        /**
         * Return the current realm's state. May return a cached object shared between calls.
         *
         * @return {Promise<RealmState>}
         */
        this.getRealmState = () => getRealmState(Realms.getCurrentRealm());

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
                } else {
                    pricedItem.price = 0;
                    pricedItem.quantity = 0;
                }

                result.push(pricedItem);
            });

            return result;
        }

        // ------- //
        // PRIVATE //
        // ------- //

        /**
         * Given realm and item objects, return its item state.
         *
         * @param {Realm} realm
         * @param {PricedItem} item
         * @return {Promise<ItemState>}
         */
        async function getItemState(realm, item) {
            let basename = Items.stringifyKey({
                itemId: item.id,
                itemLevel: item.bonusLevel,
                itemSuffix: item.bonusSuffix,
            });
            const url = 'data/' + realm.connectedId + '/' + (item.id & 0xFF) + '/' + basename + '.bin';
            const response = await fetch(url, {mode: 'same-origin'});
            if (!response.ok) {
                return {
                    snapshot: 0,
                    price: 0,
                    quantity: 0,
                    auctions: [],
                    snapshots: [],
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

            const result = {};
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
                        modifiers[self.MODIFIER_TYPE_TIMEWALKER_LEVEL] = level;
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
                const realmState = await getRealmState(realm);

                realmState.snapshots.forEach(timestamp => {
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
            result.snapshot = view.getUint32(read(4), true) * MS_SEC;
            result.lastCheck = view.getUint32(read(4), true) * MS_SEC;
            result.snapshots = [];
            for (let remaining = view.getUint16(read(2), true); remaining > 0; remaining--) {
                result.snapshots.push(view.getUint32(read(4), true) * MS_SEC);
            }
            Object.freeze(result.snapshots);
            result.summary = {};
            result.variants = {};
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
                if (itemKey.itemLevel) {
                    result.variants[itemId] = result.variants[itemId] || [];
                    result.variants[itemId].push(itemKeyString);
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
            Object.freeze(result.summary);
            Object.freeze(result.variants);
            Object.freeze(result);

            my.lastRealmState = {
                id: realm.connectedId,
                modified: response.headers.get('last-modified'),
                checked: Date.now(),
                data: result,
            };

            return result;
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
         *  }}
         */
        const my = {
            categories: undefined,

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

            return my.categories = await response.json();
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
         */
        this.show = async function (item) {
            qs('.main .main-result').dataset.detailMode = 1;

            const itemDiv = qs('.main .main-result .item');
            ee(itemDiv);

            {
                const backBar = ce('div', {className: 'back-bar'});
                itemDiv.appendChild(backBar);

                const backButton = ce('button', {}, ct('Back'));
                backBar.appendChild(backButton);
                backButton.addEventListener('click', self.hide);

                backBar.appendChild(ce('span', {className: 'available'}));
            }

            const panels = ce('div', {className: 'panels'});
            itemDiv.appendChild(panels);

            const details = ce('div', {className: 'details'});
            panels.appendChild(details);
            const auctions = ce('div', {className: 'auctions'});
            panels.appendChild(auctions);

            let realmState;
            let itemState;

            await Promise.all([
                Auctions.getRealmState().then(result => realmState = result),
                Auctions.getItem(item).then(result => itemState = result),
            ]);

            populateAuctions(item, realmState, itemState);
            populateDetails(item, realmState, itemState);
        }

        /**
         * Populate the auctions list in the rightmost panel.
         *
         * @param {PricedItem} item
         * @param {RealmState} realmState
         * @param {ItemState} itemState
         */
        function populateAuctions(item, realmState, itemState) {
            const availableSpan = qs('.main .main-result .item .back-bar .available');

            availableSpan.appendChild(ct(itemState.quantity.toLocaleString() + ' Available'));

            const auctionsPanel = qs('.main .main-result .item .auctions');
            const scroller = ce('div', {className: 'scroller'});
            auctionsPanel.appendChild(scroller);

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

                const wowheadParams = [
                    'item=' + item.id,
                ];
                if (specLine.bonuses.length) {
                    wowheadParams.push('bonus=' + specLine.bonuses.join(':'));
                }
                let lvl = specLine.modifiers[Auctions.MODIFIER_TYPE_TIMEWALKER_LEVEL];
                if (lvl) {
                    wowheadParams.push('lvl=' + lvl);
                }
                if (item.bonusLevel) {
                    wowheadParams.push('ilvl=' + item.bonusLevel);
                }

                const a = ce('a',
                    {dataset: {wowhead: wowheadParams.join('&')}},
                    priceElement(specLine.price)
                );
                td.appendChild(a);
            });
        }

        /**
         * Populate the empty details panel for the given item.
         *
         * @param {PricedItem} item
         * @param {RealmState} realmState
         * @param {ItemState} itemState
         */
        function populateDetails(item, realmState, itemState) {
            const parent = qs('.main .main-result .item .details');
            const scroller = ce('div', {className: 'scroller'});
            parent.appendChild(scroller);

            // Name panel
            {
                let wowheadParams = [];

                const namePanel = ce('a', {
                    className: 'title q' + item.quality,
                    href: 'https://www.wowhead.com/item=' + item.id
                });
                scroller.appendChild(namePanel);

                const icon = ce('span', {className: 'icon', dataset: {quality: item.quality}});
                icon.style.backgroundImage = 'url("' + Items.getIconUrl(item.icon, Items.ICON_SIZE.LARGE) + '")';
                namePanel.appendChild(icon);
                let itemName = item.name;
                if (item.bonusSuffix) {
                    let suffix = Items.getSuffix(item.bonusSuffix);
                    if (suffix) {
                        itemName += ' ' + suffix.name;
                        if (suffix.bonus) {
                            wowheadParams.push('bonus=' + suffix.bonus);
                        }
                    }
                }
                if (item.bonusLevel) {
                    itemName += ' (' + item.bonusLevel + ')';
                    wowheadParams.push('ilvl=' + item.bonusLevel);
                }
                namePanel.appendChild(ct(itemName));

                if (wowheadParams.length) {
                    namePanel.dataset.wowhead = wowheadParams.join('&');
                }
            }

            // Model
            if (item.display) {
                const modelContainer = ce('div', {className: 'model-container'});
                scroller.appendChild(modelContainer);

                let url = 'https://wow.zamimg.com/modelviewer/live/webthumbs/item/' + (item.display & 0xFF) + '/' + item.display;
                const pic = ce('picture');
                pic.appendChild(ce('source', {
                    srcset: url + '.webp',
                    type: 'image/webp',
                }));
                pic.appendChild(ce('img', {
                    src: url + '.png',
                }));
                modelContainer.appendChild(pic);
            }

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

            // Price chart
            (() => {
                if (itemState.snapshots.length < 6) {
                    return;
                }

                // Chart container
                const chartContainer = ce('div', {
                    className: 'charts-container framed',
                });
                scroller.appendChild(chartContainer);
                chartContainer.appendChild(ce('span', {className: 'frame-title'}, ct('14-day History')));

                // Chart wrapper and parent SVG
                const xMax = 1000;
                const yMaxPrice = 333;
                const yGap = 10;
                const yMaxQty = 500 - yMaxPrice - yGap;
                const yMax = yMaxPrice + yMaxQty;

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
                let lastTimestamp = 0;
                let pointCount = 0;
                {
                    let prices = [];
                    itemState.snapshots.forEach(snapshot => {
                        maxPrice = Math.max(maxPrice, snapshot.price);
                        maxQuantity = Math.max(maxQuantity, snapshot.quantity);
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
                    pointCount = prices.length;
                }
                const firstTimestamp = itemState.snapshots[0].snapshot;
                const timestampRange = lastTimestamp - firstTimestamp;

                const barWidth = Math.floor(xMax / pointCount * 2 / 3);
                const barMargin = (xMax - (barWidth * pointCount)) / pointCount;

                // Set point arrays.
                const pricePoints = [];
                const quantityBars = [];
                let gotFirstPrice = false;
                itemState.snapshots.forEach(snapshot => {
                    if (!snapshot.price && !gotFirstPrice) {
                        return;
                    }
                    gotFirstPrice = true;

                    const x = Math.round((snapshot.snapshot - firstTimestamp) / timestampRange * xMax);
                    const y = Math.round((maxPrice - snapshot.price) / maxPrice * yMaxPrice);
                    pricePoints.push([x, y].join(','));

                    const barLeft = Math.floor(quantityBars.length * (barWidth + barMargin) + barMargin / 2);
                    const barTop = (snapshot.quantity === 0) ? yMax :
                        (maxQuantity - snapshot.quantity) / maxQuantity * yMaxQty + yMaxPrice + yGap;
                    const barRight = barLeft + barWidth;
                    const barBottom = yMax;
                    quantityBars.push([
                        [barLeft, barTop].join(','),
                        [barRight, barTop].join(','),
                        [barRight, barBottom].join(','),
                        [barLeft, barBottom].join(','),
                    ].join(' '));
                });

                // Price line + fill
                {
                    const line = svge('polyline', {
                        points: pricePoints.join(' '),
                    });
                    line.classList.add('price');

                    // Loop us back around to fill the shape.
                    pricePoints.push([xMax, yMaxPrice].join(','));
                    pricePoints.push([0, yMaxPrice].join(','));
                    const fill = svge('polygon', {
                        points: pricePoints.join(' '),
                    });
                    fill.classList.add('price');

                    priceChart.appendChild(fill);
                    priceChart.appendChild(line);
                }

                // Quantity bars.
                quantityBars.forEach(pointsList => {
                    const bar = svge('polygon', {
                        points: pointsList
                    });
                    bar.classList.add('quantity');

                    priceChart.appendChild(bar);
                });
            })();

            scroller.appendChild(ct('TODO: more charts and stuff goes here'));
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

        // ********************* //
        // ***** VARIABLES ***** //
        // ********************* //

        /**
         * @type {{
         * items: Object.<ItemID, UnnamedItem>,
         * names: Object.<ItemID, string>,
         * suffixes: Object.<SuffixID, Suffix>
         * }}
         */
        const my = {
            items: {},
            names: {},
            suffixes: {},
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
         * @param {SuffixID} suffixId
         * @return {Suffix|undefined}
         */
        this.getSuffix = function (suffixId) {
            return my.suffixes[suffixId];
        };

        /**
         * Fetches the item list data.
         */
        this.init = async function () {
            const idTask = fetchItemIds();
            const nameTask = fetchItemNames();
            const suffixTask = fetchItemSuffixes();

            await Promise.all([idTask, nameTask, suffixTask]);
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
         * @param {boolean} forSuggestions
         * @return {Promise<Item[]>}
         */
        this.search = async function (forSuggestions) {
            const result = [];

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
            qsa('.main .search-bar input[type="checkbox"].rarity:checked').forEach(function (checkBox) {
                validRarity.push(parseInt(checkBox.value));
            });

            let minLevel = (/^\d+$/.exec(qs('.main .search-bar input[name="level-min"]').value) || [])[0];
            let maxLevel = (/^\d+$/.exec(qs('.main .search-bar input[name="level-max"]').value) || [])[0];
            if (minLevel !== undefined) {
                minLevel = parseInt(minLevel);
            }
            if (maxLevel !== undefined) {
                maxLevel = parseInt(maxLevel);
            }

            for (let id in my.items) {
                if (!my.items.hasOwnProperty(id)) {
                    continue;
                }

                let item = my.items[id];
                if (classId !== undefined && item['class'] !== classId) {
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
                        name += ' ' + Items.getSuffix(itemKey.itemSuffix).name;
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
         * Fetches the list of item IDs and stores it locally.
         */
        async function fetchItemIds() {
            const response = await fetch('json/items.json', {mode:'same-origin'});
            if (!response.ok) {
                throw 'Cannot get list of item IDs!';
            }

            my.items = await response.json();

            for (let id in my.items) {
                if (my.items.hasOwnProperty(id) && !my.items[id].icon) {
                    my.items[id].icon = 'inv_misc_questionmark';
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

        /** @type {{realms: Object.<RealmID, Realm>}} */
        const my = {
            realms: {},
        };

        // ********************* //
        // ***** FUNCTIONS ***** //
        // ********************* //

        // ------ //
        // PUBLIC //
        // ------ //

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

        // ********************* //
        // ***** FUNCTIONS ***** //
        // ********************* //

        // ------ //
        // PUBLIC //
        // ------ //

        /**
         * Perform a search for items, reading the parameters from the UI.
         */
        this.perform = async function () {
            if (!Realms.getCurrentRealm()) {
                alert('Please select a realm in the top left corner.');
                qs('.main .search-bar select').focus();

                return;
            }

            Detail.hide();
            emptyItemList();

            const itemsList = await Auctions.hydrateList(await Items.search(false));

            requestAnimationFrame(function () {
                requestAnimationFrame(
                    showItemList.bind(self, itemsList)
                );
            });
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
                    const aName = a.querySelector('td:nth-child(2)').dataset.sortValue;
                    const bName = b.querySelector('td:nth-child(2)').dataset.sortValue;

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

        /**
         * Empty the item list. This is done separately from showing the list so we can ensure old results are wiped out
         * while we build a new long list.
         */
        function emptyItemList() {
            const welcome = qs('.main .welcome');
            if (welcome) {
                welcome.parentNode.removeChild(welcome);
            }

            ee(qs('.main .search-result-target'));
        }

        /**
         * Given an pricing-hydrated list of items, show it in the UI.
         *
         * @param {PricedItem[]} itemsList
         */
        function showItemList(itemsList) {
            const detailColumn = Categories.getDetailColumn();
            const showOutOfStock = qs('.main .search-bar .filter [name="out-of-stock"]').checked;
            const showNeverSeen = qs('.main .search-bar .filter [name="never-seen"]').checked;

            const parent = qs('.main .search-result-target');

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

            const tbody = ce('tbody');
            table.appendChild(tbody);
            itemsList.forEach(function (item) {
                if ((item.quantity || 0) === 0) {
                    if ((item.price || 0) === 0) {
                        if (!showNeverSeen) {
                            return;
                        }
                    } else {
                        if (!showOutOfStock) {
                            return;
                        }
                    }
                }

                let suffix;
                if (item.bonusSuffix) {
                    suffix = Items.getSuffix(item.bonusSuffix);
                }

                let tr, td;
                tbody.appendChild(tr = ce('tr'));

                //
                // PRICE
                //
                {
                    tr.appendChild(td = ce('td', {
                        className: 'price',
                        dataset: {
                            sortValue: item.price || 0,
                        },
                    }));
                    if (item.price) {
                        td.appendChild(priceElement(item.price));
                    }
                    const rowLink = ce('a', {
                        dataset: {wowhead: 'item=' + item.id},
                    });
                    if (item.bonusLevel) {
                        rowLink.dataset.wowhead += '&ilvl=' + item.bonusLevel;
                    }
                    if (suffix && suffix.bonus) {
                        rowLink.dataset.wowhead += '&bonus=' + suffix.bonus;
                    }
                    rowLink.addEventListener('click', Detail.show.bind(null, item));
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
                    if (item.bonusLevel && !(detailColumn && detailColumn.prop === 'itemLevel')) {
                        itemName += ' (' + item.bonusLevel + ')';
                    }
                    tr.appendChild(td = ce('td', {
                        className: 'name',
                        dataset: {
                            sortValue: itemName,
                        },
                    }));
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
                    tr.appendChild(td = ce('td', {
                        className: detailColumn.prop,
                        dataset: {
                            sortValue: value,
                        },
                    }));
                    td.appendChild(ct(value.toLocaleString()));
                }

                //
                // QUANTITY
                //
                tr.appendChild(ce('td', {
                    className: 'quantity',
                    dataset: {
                        sortValue: item.quantity || 0,
                    },
                }, ct((item.quantity || 0).toLocaleString())));
            });

            columnSort(thead.querySelector('td'), false);

            parent.scrollTop = 0;
        }
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
            const items = await Auctions.hydrateList(await Items.search(true));
            if (lastSearch !== typed) {
                return;
            }
            items.sort((a, b) => {
                let aFullName = a.name + (a.bonusSuffix ? ' ' + Items.getSuffix(a.bonusSuffix).name : '');
                let bFullName = b.name + (b.bonusSuffix ? ' ' + Items.getSuffix(b.bonusSuffix).name : '');
                let aFirst = aFullName.toLowerCase().startsWith(typed) ? 0 : 1;
                let bFirst = bFullName.toLowerCase().startsWith(typed) ? 0 : 1;

                return (aFirst - bFirst) || (b.quantity - a.quantity) || aFullName.localeCompare(bFullName);
            });
            items.splice(MAX_SUGGESTIONS);

            let index = 0;
            for (let item; item = items[index]; index++) {
                let name = item.name + (item.bonusSuffix ? ' ' + Items.getSuffix(item.bonusSuffix).name : '');
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
                    if (!dest.hasOwnProperty(k)) {
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

    //      //
    // Init //
    //      //

    async function init() {
        await Promise.all([
            Categories.init(),
            Items.init(),
            Realms.init(),
        ]);

        qs('.main .search-bar button.search').addEventListener('click', Search.perform);
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
                Search.perform();
            }
        });
        qs('.main .search-bar .text-reset').addEventListener('click', event => {
            searchBox.value = '';
            searchBox.focus();
            searchBox.dispatchEvent(new FocusEvent('focus'));
        });
    }

    init().catch(alert);
};
