import {
    canHover,
    createElement as ce,
    createText as ct,
    emptyElement as ee,
    priceElement,
    querySelector as qs,
    querySelectorAll as qsa,
    updateDeltaTimestamps
} from "./utils";
import {ITEM_PET_CAGE, SIDE_ALLIANCE, SIDE_HORDE} from "./constants";

import Auctions from "./Auctions";
import Categories from "./Categories";
import Detail from "./Detail";
import Hash from "./Hash";
import Items from "./Items";
import Locales from "./Locales";
import Realms from "./Realms";
import Suggestions from "./Suggestions";

const COL_PRICE = 1;
const COL_NAME = 2;
const COL_DETAIL = 3;

const SEARCH_FAVORITES_BUTTON = qs('.main .search-bar .favorite');

const MAX_RESULTS_SHOWN = 500;

const my = {
    hash: undefined,
    hashRealm: undefined,
    rows: [],
};

/**
 * Manages the search result list.
 */
const Search = {
    /**
     * Returns the current list of favorite item keys.
     *
     * @return {ItemKeyString[]}
     */
    getFavorites() {
        let favorites;
        try {
            favorites = localStorage.getItem('favorites');
        } catch (e) {
            // Ignore
        }

        return favorites ? favorites.split(',') : [];
    },

    /**
     * Empties the item list.
     */
    hide() {
        emptyItemList();
    },

    /**
     * Sets up event listeners.
     */
    init() {
        updateFavoritesButton(Search.getFavorites().length > 0);
        SEARCH_FAVORITES_BUTTON.addEventListener('click', () => {
            if (SEARCH_FAVORITES_BUTTON.dataset.enabled) {
                Search.perform(true, false);
            }
        });

        qs('.main .search-bar .deals').addEventListener('click', () => Search.perform(false, true));

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

        qs('.main .search-bar button.search').addEventListener('click', Search.perform.bind(null, false, false));
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

        Suggestions.init();
    },

    /**
     * Returns whether we're in arbitrage mode.
     *
     * @returns {boolean}
     */
    isArbitrageMode: () => getArbitrageModeControl().checked,

    /**
     * Perform a search for items, reading the parameters from the UI.
     *
     * @param {boolean} favoritesOnly
     * @param {boolean} dealsOnly
     */
    async perform(favoritesOnly, dealsOnly) {
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
        Search.setHash();

        const searchBox = qs('.main .search-bar input[type="text"]');
        const hasSearchText = /\S/.test(searchBox.value);

        let itemsList = await Auctions.hydrateList(
            await Items.search(favoritesOnly ? Items.SEARCH_MODE_FAVORITES : Items.SEARCH_MODE_NORMAL),
            {arbitrage: Search.isArbitrageMode(), regionMedian: getRegionMedianControl().checked},
        );

        if (dealsOnly) {
            itemsList = await findDeals(itemsList);
        }

        await showItemList(itemsList, hasSearchText || favoritesOnly, dealsOnly);
    },

    /**
     * Sets the location bar hash for the current search parameters.
     */
    setHash() {
        if (!my.hash || !my.hashRealm) {
            Hash.set('', '');
        } else {
            Hash.set(my.hash, `Search - ${my.hashRealm.name} ${my.hashRealm.region.toUpperCase()}`);
        }
    },

    /**
     * Toggles whether the given item key string is in the favorites list.
     *
     * @param {ItemKeyString} itemKeyString
     * @param {HTMLElement} favSpan
     */
    toggleFavorite(itemKeyString, favSpan) {
        const favorites = Search.getFavorites();
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
    },
};
export default Search;

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

    const favorites = Search.getFavorites();
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
    favSpan.addEventListener('click', Search.toggleFavorite.bind(self, itemKey, favSpan));
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
    Search.setHash();
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
    const arbitrage = Search.isArbitrageMode();
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
