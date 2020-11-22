new function () {
    const ct = document.createTextNode.bind(document);
    const qs = document.body.querySelector.bind(document.body);
    const qsa = document.body.querySelectorAll.bind(document.body);

    /**
     * Manages item prices and availability.
     */
    const Auctions = new function () {
        // ********************* //
        // ***** FUNCTIONS ***** //
        // ********************* //

        // ------ //
        // PUBLIC //
        // ------ //

        /**
         * Hydrates a list of items with prices and quantities for the currently-selected realm.
         *
         * @param {{object}[]} items
         */
        this.hydrateList = function (items) {
            items.forEach(function (item) {
                // TODO
                item.price = Math.ceil(Math.random() * 10000 * (Math.pow(10, Math.random() * 4))) + 100;
                item.quantity = Math.ceil(Math.random() * 200);
            });
        }
    };

    /**
     * Manages the categories sidebar list.
     */
    const Categories = new function () {
        // ********************* //
        // ***** VARIABLES ***** //
        // ********************* //

        const my = {
            categories: undefined,

            classId: undefined,
            detailColumn: undefined,
            subClassId: undefined,
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
         * @return {number|undefined}
         */
        this.getClassId = function () {
            return my.classId;
        }

        /**
         * Returns the detail column to show in the item list, based on the selected category.
         *
         * @return {object|undefined}
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
         * @return {number|undefined}
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
            while (categoriesParent.hasChildNodes()) {
                categoriesParent.removeChild(categoriesParent.firstChild);
            }

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

                (cat.subcategories || []).forEach(function (subcat) {
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
         * @param {object} cat
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
         * @returns {{object}[]}
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
     * Methods to handle item data, independent of any prices.
     */
    const Items = new function () {
        // ********************* //
        // ***** VARIABLES ***** //
        // ********************* //

        const my = {
            items: undefined,
            names: undefined,
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
         * @return {{object}[]}
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

            for (let id in my.items) {
                if (!my.items.hasOwnProperty(id)) {
                    continue;
                }

                let item = my.items[id];
                if (classId !== undefined && item['class'] !== classId) {
                    continue;
                }
                if (subClassId !== undefined && item['subclass'] !== subClassId) {
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
        // ********************* //
        // ***** CONSTANTS ***** //
        // ********************* //

        this.REGION_US = 'us';
        this.REGION_EU = 'eu';

        const REGIONS = [this.REGION_US, this.REGION_EU];

        // ********************* //
        // ***** VARIABLES ***** //
        // ********************* //

        const my = {
            realms: undefined,
        };

        // ********************* //
        // ***** FUNCTIONS ***** //
        // ********************* //

        // ------ //
        // PUBLIC //
        // ------ //

        /**
         * Get a copy of the realm object for the given realm ID, or undefined if not found.
         * @param {number} realmId
         * @return {object|undefined}
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

            const select = qs('.main .search-bar select');
            const removePlaceholder = function () {
                if (!select.options[0].value) {
                    if (select.selectedIndex !== 0) {
                        select.removeChild(select.querySelector('option[value=""]'));
                        select.removeEventListener('change', removePlaceholder);
                    }
                } else {
                    select.removeEventListener('change', removePlaceholder);
                }
            }
            select.addEventListener('change', removePlaceholder);

            const byRegion = {};
            for (let k in my.realms) {
                if (!my.realms.hasOwnProperty(k)) {
                    continue;
                }

                let realm = my.realms[k];
                byRegion[realm.region] = byRegion[realm.region] || [];
                byRegion[realm.region].push(realm);
            }

            REGIONS.forEach(region => {
                if (!byRegion.hasOwnProperty(region)) {
                    return;
                }

                byRegion[region].sort(function (a, b) {
                    return a.name.localeCompare(b.name);
                });

                byRegion[region].forEach(realm => {
                    let o = ce('option');
                    o.value = realm.id;
                    o.label = region.toUpperCase() + ' ' + realm.name;
                    o.appendChild(ct(o.label));

                    select.appendChild(o);
                });
            });
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

        // ------ //
        // PUBLIC //
        // ------ //

        /**
         * Given an pricing-hydrated list of items, show it in the UI.
         *
         * @param {{object}[]} itemsList
         */
        this.showResults = function (itemsList) {
            emptyItemList();

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

                return parseInt(aVal) - parseInt(bVal);
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
            const parent = qs('.main .search-result-target');
            while (parent.hasChildNodes()) {
                parent.removeChild(parent.firstChild);
            }
        }

        /**
         * Given an pricing-hydrated list of items, show it in the UI.
         *
         * @param {{object}[]} itemsList
         */
        function showItemList(itemsList) {
            const detailColumn = Categories.getDetailColumn();

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
                let tr, td;
                tbody.appendChild(tr = ce('tr'));

                tr.appendChild(td = ce('td', {
                    className: 'price',
                    dataset: {
                        sortValue: item.price || 0,
                    },
                }, priceHtml(item.price || 0)));
                const rowLink = ce('a', {
                    //href: './',
                    dataset: {wowhead: 'item=' + item.id},
                });
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
                td.appendChild(ct(item.name));

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
     * @returns {HTMLElement}
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
     * Returns a document fragment for the given price.
     *
     * @param {number} coppers
     * @return {DocumentFragment}
     */
    function priceHtml(coppers) {
        const df = document.createDocumentFragment();
        coppers = Math.abs(coppers);
        const silver = Math.floor(coppers / 100) % 100;
        const gold = Math.floor(coppers / 10000);

        if (gold > 0) {
            df.appendChild(ce('span', {className: 'gold moneygold'}, ct(gold.toLocaleString())));
        }
        df.appendChild(ce('span', {className: 'silver moneysilver'}, ct(silver)));

        return df;
    }

    //      //
    // Init //
    //      //

    async function init() {
        await Promise.all([
            Categories.init(),
            Items.init(),
            Realms.init()
        ]);

        qs('.main .search-bar button').addEventListener('click', function () {
            const itemsList = Items.search();
            Auctions.hydrateList(itemsList);
            Search.showResults(itemsList);
        });
    }

    init().catch(alert);
};
