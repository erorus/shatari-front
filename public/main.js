new function () {
    /**
     * @typedef {Object} Auction
     * @property {Money} price
     * @property {number} quantity
     */

    /** @typedef {number} ClassID */

    /** @typedef {number} ConnectedRealmID */

    /** @typedef {number} ItemID */

    /** @typedef {number} Money  Expressed in coppers. */

    /**
     * @typedef {UnnamedItem} Item
     * @property {ItemID} id
     * @property {string} name
     */

    /**
     * @typedef {object} ItemState
     * @property {Timestamp}      snapshot   The last snapshot when this item was seen
     * @property {Money}          price      The cheapest price when this item was last seen
     * @property {number}         quantity   How many were available when this was last seen
     * @property {Auction[]}      auctions   An array of distinct prices and quantities, ordered by price ascending
     * @property {SummaryLine[]}  snapshots  An array of summary prices, order by snapshot ascending
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
     * @property {Object.<ItemID, SummaryLine>} summary
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
     * @typedef {Object} UnnamedItem
     * @property {number} class
     * @property {string} icon
     * @property {number} [itemLevel]
     * @property {number} quality
     * @property {number} [reqLevel]
     * @property {number} [slots]
     * @property {number} subclass
     * @property {Money}  vendorSell  The money you get when you sell this item to a vendor
     */

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
        const MS_SEC = 1000;

        const VERSION_ITEM_STATE = 1;
        const VERSION_REALM_STATE = 1;

        // ********************* //
        // ***** FUNCTIONS ***** //
        // ********************* //

        // ------ //
        // PUBLIC //
        // ------ //

        /**
         * Given an item object, return its item state for the current realm.
         *
         * @param {Item} item
         * @return {Promise<ItemState>}
         */
        this.getItem = async function (item) {
            return getItemState(Realms.getCurrentRealm(), item);
        }

        /**
         * Return the current realm's state.
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
                let pricedItem = {};
                co(pricedItem, item);

                const cur = realmState.summary[item.id];
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
         * @param {Item} item
         * @return {Promise<ItemState>}
         */
        async function getItemState(realm, item) {
            const url = 'data/' + realm.connectedId + '/' + (item.id & 0xFF) + '/' + item.id + '.bin';
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

            if (view.getUint8(read(1)) !== VERSION_ITEM_STATE) {
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

            result.snapshots = [];
            for (let remaining = view.getUint16(read(2), true); remaining > 0; remaining--) {
                let snapshot = view.getUint32(read(4), true) * MS_SEC;
                let price = view.getUint32(read(4), true) * COPPER_SILVER;
                let quantity = view.getUint32(read(4), true);
                result.snapshots.push({snapshot: snapshot, price: price, quantity: quantity});
            }

            return result;
        }

        /**
         * Given a realm object, return its current realm state.
         *
         * @param {Realm} realm
         * @return {Promise<RealmState>}
         */
        async function getRealmState(realm) {
            const response = await fetch('data/' + realm.connectedId + '/state.bin', {mode: 'same-origin'});
            const buffer = await response.arrayBuffer();
            const view = new DataView(buffer);

            let offset = 0;
            const read = function (byteCount) {
                let result = offset;
                offset += byteCount;

                return result;
            };

            if (view.getUint8(read(1)) !== VERSION_REALM_STATE) {
                throw "Unknown data version for realm state.";
            }

            const result = {};
            result.snapshot = view.getUint32(read(4), true) * MS_SEC;
            result.lastCheck = view.getUint32(read(4), true) * MS_SEC;
            result.snapshots = [];
            for (let remaining = view.getUint16(read(2), true); remaining > 0; remaining--) {
                result.snapshots.push(view.getUint32(read(4), true) * MS_SEC);
            }
            result.summary = {};
            for (let remaining = view.getUint16(read(2), true); remaining > 0; remaining--) {
                let itemId = view.getUint32(read(4), true);
                let snapshot = view.getUint32(read(4), true) * MS_SEC;
                let price = view.getUint32(read(4), true) * COPPER_SILVER;
                let quantity = view.getUint32(read(4), true);
                result.summary[itemId] = {
                    snapshot: snapshot,
                    price: price,
                    quantity: quantity,
                };
            }

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
         * @property {SubclassID} subClass
         */

        // ********************* //
        // ***** VARIABLES ***** //
        // ********************* //

        /**
         * @type {{
         *  classId: ClassID|undefined,
         *  subClassId: SubclassID|undefined,
         *  detailColumn: DetailColumn|undefined,
         *  categories: Category[],
         *  }}
         */
        const my = {
            categories: undefined,

            classId: undefined,
            subClassId: undefined,

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
         * Returns the subclass ID to use in search filtering, or undefined for none.
         *
         * @return {SubclassID|undefined}
         */
        this.getSubClassId = function () {
            return my.subClassId;
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
                    ct(cat.name)
                );
                categoriesParent.appendChild(catDiv);
                catDiv.addEventListener('click', clickCategory.bind(null, catDiv, cat));

                if (!cat.subcategories) {
                    return;
                }
                cat.subcategories.forEach(function (subcat) {
                    const subcatDiv = ce(
                        'div',
                        {
                            className: 'subcategory',
                            dataset: {
                                parentClass: cat['class'],
                                classId: subcat['class'],
                                subClassId: subcat.subClass,
                            },
                        },
                        ct(subcat.name)
                    );
                    categoriesParent.appendChild(subcatDiv);
                    subcatDiv.addEventListener('click', clickSubCategory.bind(null, subcatDiv));
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

            if (!wasSelected) {
                // Select this subcategory.
                subCatDiv.dataset.selected = 1;

                my.classId = parseInt(subCatDiv.dataset.classId);
                my.subClassId = parseInt(subCatDiv.dataset.subClassId);
            } else {
                // De-select this subcategory, reverting back to the parent category criteria.
                my.classId = parseInt(subCatDiv.dataset.parentClass);
                my.subClassId = undefined;
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

            populateDetails(item, realmState, itemState);
            populateAuctions(item, realmState, itemState);
        }

        /**
         * Populate the auctions list in the rightmost panel.
         *
         * @param {Item} item
         * @param {RealmState} realmState
         * @param {ItemState} itemState
         */
        function populateAuctions(item, realmState, itemState) {
            const availableSpan = qs('.main .main-result .item .back-bar .available');

            if (itemState.snapshot < realmState.snapshot) {
                // Item hasn't been updated in the most recent snapshot, so assume there are none available.
                availableSpan.appendChild(ct('0 Available'));

                return;
            }

            availableSpan.appendChild(ct(itemState.quantity.toLocaleString() + ' Available'));

            const auctionsPanel = qs('.main .main-result .item .auctions');
            const scroller = ce('div', {className: 'scroller'});
            auctionsPanel.appendChild(scroller);

            const table = ce('table');
            scroller.appendChild(table);

            itemState.auctions.forEach(auction => {
                const tr = ce('tr');
                table.appendChild(tr);

                tr.appendChild(ce('td', {}, priceElement(auction.price)));
                tr.appendChild(ce('td', {}, ct(auction.quantity.toLocaleString())));
            });
        }

        /**
         * Populate the empty details panel for the given item.
         *
         * @param {Item} item
         * @param {RealmState} realmState
         * @param {ItemState} itemState
         */
        function populateDetails(item, realmState, itemState) {
            const parent = qs('.main .main-result .item .details');
            const scroller = ce('div', {className: 'scroller'});
            parent.appendChild(scroller);

            const namePanel = ce('a', {
                className: 'title q' + item.quality,
                href: 'https://www.wowhead.com/item=' + item.id
            });
            scroller.appendChild(namePanel);

            const icon = ce('span', {className: 'icon', dataset: {quality: item.quality}});
            icon.style.backgroundImage = 'url("https://wow.zamimg.com/images/wow/icons/large/' + item.icon + '.jpg")';
            namePanel.appendChild(icon);
            namePanel.appendChild(ct(item.name));

            scroller.appendChild(ct('TODO: more charts and stuff goes here'));
        }
    };

    /**
     * Methods to handle item data, independent of any prices.
     */
    const Items = new function () {
        // ********************* //
        // ***** VARIABLES ***** //
        // ********************* //

        /**
         * @type {{items: Object.<ItemID, UnnamedItem>, names: Object.<ItemID, string>}}
         */
        const my = {
            items: {},
            names: {},
        };

        // ********************* //
        // ***** FUNCTIONS ***** //
        // ********************* //

        // ------ //
        // PUBLIC //
        // ------ //

        /**
         * Fetches the item list data.
         */
        this.init = async function () {
            const idTask = fetchItemIds();
            const nameTask = fetchItemNames();

            await Promise.all([idTask, nameTask]);
        };

        /**
         * Performs a search depending on the UI state, and returns item objects that match.
         *
         * @return {Item[]}
         */
        this.search = function () {
            const result = [];

            const classId = Categories.getClassId();
            const subClassId = Categories.getSubClassId();

            const wordExpressions = [];
            const searchBox = qs('.main .search-bar input[type="text"]');
            searchBox.value.replace(/^\s+|\s+$/, '').split(/\s+/).forEach(function (word) {
                wordExpressions.push(new RegExp('\\b' + escapeRegExp(word), 'i'));
            });

            const validRarity = [];
            qsa('.main .search-bar input[type="checkbox"].rarity:checked').forEach(function (checkBox) {
                validRarity.push(parseInt(checkBox.value));
            });

            for (let id in my.items) {
                if (!my.items.hasOwnProperty(id)) {
                    continue;
                }

                let item = my.items[id];
                if (classId !== undefined && item['class'] !== classId) {
                    continue;
                }
                if (subClassId !== undefined && item.subclass !== subClassId) {
                    continue;
                }
                if (!validRarity.includes(item.quality)) {
                    continue;
                }

                let name = my.names[id];

                let foundAllWords = true;
                for (let regex, x = 0; foundAllWords && (regex = wordExpressions[x]); x++) {
                    foundAllWords = regex.test(name);
                }
                if (!foundAllWords) {
                    continue;
                }

                let newItem = {};
                co(newItem, item);
                newItem.id = parseInt(id);
                newItem.name = name;
                result.push(newItem);
            }

            return result;
        }

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

            const itemsList = await Auctions.hydrateList(Items.search());

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

                let tr, td;
                tbody.appendChild(tr = ce('tr'));

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
                rowLink.addEventListener('click', Detail.show.bind(null, item));
                td.appendChild(rowLink);

                tr.appendChild(td = ce('td', {
                    className: 'name',
                    dataset: {
                        sortValue: item.name,
                    },
                }));
                td.appendChild(ce('img', {
                    //src: 'icons/medium/' + item.icon + '.jpg',
                    src: 'https://wow.zamimg.com/images/wow/icons/medium/' + item.icon + '.jpg',
                    loading: 'lazy',
                }));
                td.appendChild(ce('span', {className: 'q' + item.quality}, ct(item.name)));

                if (detailColumn) {
                    let value = item[detailColumn.prop];
                    if (detailColumn.prop === 'reqLevel' && value <= 1) {
                        value = 1;
                    }
                    tr.appendChild(td = ce('td', {
                        className: detailColumn.prop,
                        dataset: {
                            sortValue: value,
                        },
                    }));
                    if (detailColumn.prop !== 'reqLevel' || value > 1) {
                        td.appendChild(ct(value.toLocaleString()));
                    }
                }

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
        qs('.main .search-bar input[type="text"]').addEventListener('keyup', event => {
            if (event.code === 'Enter') {
                Search.perform();
            }
        });
    }

    init().catch(alert);
};
