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
import {ITEM_PET_CAGE} from "./constants";

import {isPaid, showBenefitsText} from "./Account";
import Auctions from "./Auctions";
import Categories, {DetailColumn} from "./Categories";
import Detail from "./Detail";
import Hash from "./Hash";
import * as Items from "./Items";
import {getWowheadDomain} from "./Locales";
import Realms from "./Realms";
import Suggestions from "./Suggestions";
import * as Types from "./Types";

type CategorySorts = Record<Types.ClassID, number>;

type SortRow = [
    rowGenerator: HTMLTableRowElement|((favorites: Types.ItemKeyString[]) => HTMLTableRowElement),
    price: Types.Money,
    name: string,
    ...number[]
];

enum Column {
    Price = 1,
    Name = 2,
    Detail = 3,
}

type SortableColumn = 1|2|3|4|5;

enum SortDirection {
    Ascending = 'asc',
    Descending = 'desc',
}

enum Side {
    Alliance = 1,
    Horde = 2,
}

const SEARCH_FAVORITES_BUTTON = qs('.main .search-bar .favorite') as HTMLElement;

const MAX_RESULTS_SHOWN = 500;

type ModuleVars = {
    hash: string|undefined,
    hashRealm: Types.Realm|undefined,
    rows: SortRow[],
}
const my: ModuleVars = {
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
     */
    getFavorites(): Types.ItemKeyString[] {
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

        qs('.main .search-bar .deals')?.addEventListener('click', () => Search.perform(false, true));

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
                    const input = label.querySelector('input');
                    input && (input.disabled = checkbox.checked);
                });
            });
            checkbox.checked = false;
        }

        /**
         * Pressing Ctrl-C while hovering over a search result row will copy that result's name to the clipboard.
         */
        const copyNameToClipboard = function (event: KeyboardEvent) {
            if (event.isComposing || event.keyCode === 229) {
                return;
            }
            if (event.ctrlKey && event.key.toLowerCase() === 'c') {
                const hoveredRow = qs('.main .search-result-target tr[data-hover][data-copy-name]') as HTMLTableRowElement;
                if (hoveredRow?.dataset.copyName) {
                    navigator.clipboard.writeText(hoveredRow.dataset.copyName);
                }
            }
        };
        document.addEventListener('keyup', copyNameToClipboard);

        qs('.main .search-bar button.search')?.addEventListener('click', Search.perform.bind(null, false, false));
        const searchBox = qs('.main .search-bar input[type="text"]') as HTMLInputElement;
        searchBox.addEventListener('keyup', event => {
            if (event.key === 'Enter') {
                Search.perform(false, false);
            }
        });
        qs('.main .search-bar .text-reset')?.addEventListener('click', event => {
            searchBox.value = '';
            searchBox.focus();
            searchBox.dispatchEvent(new FocusEvent('focus'));
        });

        Suggestions.init();
    },

    /**
     * Returns whether we're in arbitrage mode.
     */
    isArbitrageMode: (): boolean => isPaid() && getArbitrageModeControl().checked,

    /**
     * Perform a search for items, reading the parameters from the UI.
     */
    async perform(favoritesOnly: boolean, dealsOnly: boolean) {
        if (Categories.getClassId() === Items.ItemClass.WowToken) {
            // Get out of WoW Token mode before performing any searches.
            qs('.main .categories .category[data-class-id="' + Items.ItemClass.WowToken + '"]')?.dispatchEvent(new MouseEvent('click'));
        }

        const thisRealm = Realms.getCurrentRealm();
        if (!thisRealm) {
            alert('Please select a realm in the top left corner.');
            (qs('.main .search-bar select') as HTMLSelectElement|null)?.focus();

            return;
        }

        Detail.hide();
        emptyItemList();
        Realms.savePreferredRealm();
        try {
            if (getRegionMedianControl().checked) {
                localStorage.setItem('show-region-median', '1');
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

        const searchBox = qs('.main .search-bar input[type="text"]') as HTMLInputElement;
        const hasSearchText = /\S/.test(searchBox.value);

        let itemsList = await Auctions.hydrateList(
            await Items.search(favoritesOnly ? Items.SearchMode.Favorites : Items.SearchMode.Normal),
            {arbitrage: Search.isArbitrageMode(), regionMedian: isPaid() && getRegionMedianControl().checked},
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
     */
    toggleFavorite(itemKeyString: Types.ItemKeyString, favSpan?: HTMLElement) {
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
                favSpan.dataset.favorite = '1';
            }
        }
        setFavorites(favorites);
    },
};
export default Search;

/**
 * Sorts the result table by the given column.
 */
function columnSort(headerTd: HTMLTableCellElement) {
    let dir: SortDirection = SortDirection.Ascending;
    if (headerTd.dataset.sort === SortDirection.Ascending) {
        dir = SortDirection.Descending;
    }

    const headerTr = headerTd.parentNode as HTMLTableRowElement;
    const tbody = headerTr.closest('table')?.querySelector('tbody') as HTMLTableSectionElement;
    const potentialColumn = parseInt(headerTd.dataset.colPos ?? `${Column.Price}`);
    const columnPos: SortableColumn = isSortableColumn(potentialColumn) ? potentialColumn : Column.Price;
    const hasDetail = !!headerTr.querySelector('td[data-col-name="detail"]');

    (headerTr.querySelectorAll('td[data-sort]') as NodeListOf<HTMLTableCellElement>)
        .forEach(td => delete td.dataset.sort);
    setPreferredSort(columnPos, dir);

    headerTd.dataset.sort = dir;

    my.rows.sort(function (a, b) {
        {
            let valDiff: number;
            if (columnPos === Column.Name) {
                valDiff = a[columnPos].localeCompare(b[columnPos]);
            } else {
                valDiff = (a[columnPos] ?? 0) - (b[columnPos] ?? 0);
            }
            if (valDiff) {
                return valDiff;
            }
        }

        // Fallbacks.
        if (hasDetail && columnPos === Column.Name) {
            const aDetail = a[Column.Detail];
            const bDetail = b[Column.Detail];

            const valDiff = (aDetail ?? 0) - (bDetail ?? 0);
            if (valDiff) {
                return valDiff;
            }
        }

        if (columnPos !== Column.Price) {
            const aPrice = a[Column.Price];
            const bPrice = b[Column.Price];

            const valDiff = aPrice - bPrice;
            if (valDiff) {
                return valDiff;
            }
        }

        if (columnPos !== Column.Name) {
            const aName = a[Column.Name];
            const bName = b[Column.Name];

            const valDiff = aName.localeCompare(bName);
            if (valDiff) {
                return valDiff;
            }
        }

        if (hasDetail && columnPos !== Column.Detail) {
            const aDetail = a[Column.Detail];
            const bDetail = b[Column.Detail];

            const valDiff = (aDetail ?? 0) - (bDetail ?? 0);
            if (valDiff) {
                return valDiff;
            }
        }

        return 0;
    });

    if (dir === SortDirection.Descending) {
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
        tr.dataset.sortedResult = '1';
        tbody.insertBefore(tr, afterNode ? afterNode.nextSibling : tbody.firstChild);
    }
    tbody.querySelectorAll('tr.result:not([data-sorted-result])').forEach(tr => tbody.removeChild(tr));
    (tbody.querySelectorAll('tr.result') as NodeListOf<HTMLTableRowElement>).forEach(tr => delete tr.dataset.sortedResult);

    updateDeltaTimestamps();
}

function createRestricted(contents: Node): HTMLSpanElement {
    return ce('span', {className: 'restricted'}, contents);
}

/**
 * Creates a search result row.
 */
function createRow(
    item: Types.PricedItem,
    tbody: HTMLTableSectionElement,
    detailColumn: DetailColumn|undefined,
    vendorFlip: boolean,
    showingDeals: boolean,
    hasRegionMedian :boolean,
    arbitrage: boolean,
    restricted: boolean,
    favorites: Types.ItemKeyString[],
): HTMLTableRowElement {
    let suffix;
    if (item.bonusSuffix) {
        suffix = Items.getSuffix(item.id, item.bonusSuffix);
    }

    const restrictedName = restricted && (Categories.getBonusStat() != null);

    let tr: HTMLTableRowElement = document.createElement('tr');
    tr.addEventListener('mouseenter', onRowEnter);
    tr.addEventListener('mouseleave', onRowLeave);
    tr.classList.add('result');
    let td: HTMLTableCellElement;

    //
    // PRICE
    //
    {
        tr.appendChild(td = document.createElement('td'));
        td.className = 'price';
        const rowLink = document.createElement('a') as WowheadAnchor;
        const price = item.price;
        if (price) {
            td.appendChild(restricted ? createRestricted(priceElement(123456)) : priceElement(price));

            let vsp;
            if (
                !restricted &&
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
            if (restricted) {
                rowLink.dataset.simpleTooltip = 'Become a patron to view pricing stats for this version of the item!';
            } else if (item.id === ITEM_PET_CAGE) {
                rowLink.dataset.wowhead = `npc=${item.npc}&domain=${getWowheadDomain()}`;
            } else {
                rowLink.dataset.wowhead = `item=${item.id}&domain=${getWowheadDomain()}`;
                if (item.bonusLevel) {
                    rowLink.dataset.wowhead += `&ilvl=${item.bonusLevel}`;
                }
                if (suffix && suffix.bonus) {
                    rowLink.dataset.wowhead += `&bonus=${suffix.bonus}`;
                }
            }
        }
        if (restricted) {
            rowLink.addEventListener('click', showBenefitsText);
        } else {
            rowLink.href = '#' + Hash.getItemDetailHash(item);
            rowLink.addEventListener('click', event => {
                event.preventDefault();
                Detail.show(Auctions.strip(item), null);
            });
        }
        td.appendChild(rowLink);
    }

    //
    // NAME
    //
    {
        let itemName = item.name;
        if (suffix) {
            itemName += ` ${suffix.name}`;
        }
        tr.dataset.copyName = itemName;
        if (item.bonusLevel && item.id !== ITEM_PET_CAGE && !(detailColumn && detailColumn.prop === 'itemLevel')) {
            itemName += ` (${item.bonusLevel})`;
        }
        tr.appendChild(td = document.createElement('td'));
        td.className = 'name';
        if (item.side === Side.Alliance) {
            let img = document.createElement('img');
            img.loading = 'lazy';
            img.src = Items.getIconUrl('ui_allianceicon', Items.IconSize.Large);
            img.classList.add('icon');
            td.appendChild(img);
            td.dataset.sideIcon = '1';
            tbody.dataset.sideIcon = '1';
        } else if (item.side === Side.Horde) {
            let img = document.createElement('img');
            img.loading = 'lazy';
            img.src = Items.getIconUrl('ui_hordeicon', Items.IconSize.Medium);
            img.classList.add('icon');
            td.appendChild(img);
            td.dataset.sideIcon = '1';
            tbody.dataset.sideIcon = '1';
        }
        let img = document.createElement('img');
        img.loading = 'lazy';
        img.src = Items.getIconUrl(restrictedName ? 'inv_misc_questionmark' : item.icon, Items.IconSize.Medium);
        img.classList.add('icon');
        td.appendChild(restrictedName ? createRestricted(img) : img);

        let span = document.createElement('span');
        span.className = 'q' + item.quality;
        span.appendChild(restrictedName ? createRestricted(ct('Blessed Blade of the Windseeker')) : ct(itemName));
        td.appendChild(span);

        if (item.craftingQualityId) {
            const craftingQuality = Items.getCraftingQuality(item.craftingQualityId);
            if (craftingQuality?.iconUrl) {
                td.appendChild(ce('img', {
                    className: 'quality-tier',
                    src: craftingQuality?.iconUrl,
                }));
            }
        }
    }

    //
    // DETAIL
    //
    if (detailColumn) {
        let value = item[detailColumn.prop];
        if (detailColumn.prop === 'reqLevel' && value != null && value <= 1) {
            value = 1;
        }
        if (detailColumn.prop === 'itemLevel') {
            if (!restricted && !isPaid()) {
                value = undefined;
            } else {
                value = item.bonusLevel || item.squishedItemLevel || value;
            }
        }
        tr.appendChild(td = document.createElement('td'));
        td.className = detailColumn.prop;
        if (value != null) {
            td.appendChild(ct(value.toLocaleString()));
        }
    }

    //
    // QUANTITY / PERCENTAGE
    //
    if (showingDeals) {
        tr.appendChild(td = document.createElement('td'));
        td.className = 'price-percentage'
        item.regionMedian && td.appendChild(
            restricted ? createRestricted(ct('67%')) : ct(Math.round(item.price / item.regionMedian * 100) + '%')
        );
    } else if (restricted) {
        tr.appendChild(td = document.createElement('td'));
        td.className = 'quantity';
        td.appendChild(createRestricted(ct('67')));
    } else {
        const quantity = item.quantity || 0;
        tr.appendChild(td = document.createElement('td'));
        td.className = 'quantity' + (quantity === 0 ? ' q0' : '');
        td.appendChild(ct(quantity.toLocaleString() + (arbitrage ? '%' : '')));
        if (quantity === 0 && item.snapshot > 0) {
            let span = document.createElement('span');
            span.className = 'delta-timestamp';
            span.dataset.timestamp = `${item.snapshot}`;
            td.appendChild(span);
        }
    }

    if (!restrictedName) {
        let itemKey = Items.stringifyKeyParts(item.id, item.bonusLevel, item.bonusSuffix);
        let favSpan = document.createElement('span');
        favSpan.className = 'favorite';
        if (favorites.includes(itemKey)) {
            favSpan.dataset.favorite = '1';
        }
        favSpan.addEventListener('click', Search.toggleFavorite.bind(self, itemKey, favSpan));
        td.appendChild(favSpan);
    }

    //
    // REGION MEDIAN
    //
    if (hasRegionMedian) {
        tr.appendChild(td = document.createElement('td'));
        td.className = 'price median';
        if (item.regionMedian) {
            td.appendChild(restricted ? createRestricted(priceElement(123456)) : priceElement(item.regionMedian));
        }
    }

    return tr;
}

/**
 * Empty the item list. This is done separately from showing the list so we can ensure old results are wiped out
 * while we build a new long list.
 */
function emptyItemList() {
    (qs('.main .welcome') as HTMLElement).style.display = 'none';
    ee(qs('.main .search-result-target') as HTMLElement);
    my.rows = [];
    my.hash = undefined;
    my.hashRealm = undefined;
    Search.setHash();
}

/**
 * Returns a list of items which are deals from the given list of priced items.
 */
async function findDeals(itemsList: Types.PricedItem[]): Promise<Types.PricedItem[]> {
    // Items must be in stock, and must not be commodities.
    itemsList = itemsList.filter(pricedItem => pricedItem.quantity > 0 && !((pricedItem.stack ?? 1) > 1));

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
 */
const getArbitrageModeControl = () => qs('.main .search-bar .filter [name="arbitrage-mode"]') as HTMLInputElement;

/**
 * Returns the checkbox for the option to show the region median price.
 */
const getRegionMedianControl = () => qs('.main .search-bar .filter [name="show-region-median"]') as HTMLInputElement;

/**
 * Returns the column we should use for the initial sort, based on the category class.
 */
function getPreferredSort(): {columnPos: SortableColumn, dir: SortDirection} {
    const result: {columnPos: SortableColumn, dir: SortDirection} = {columnPos: Column.Price, dir: SortDirection.Ascending};

    const categoryClass = Categories.getClassId();
    if (categoryClass == null) {
        return result;
    }

    let categorySorts: CategorySorts = {};
    try {
        categorySorts = JSON.parse(localStorage.getItem('category-sort') || '{}');
    } catch (e) {
        // Ignore
    }

    const storedValue = categorySorts[categoryClass];
    if (storedValue !== null) {
        if (storedValue < 0) {
            result.dir = SortDirection.Descending;

            const flippedValue = storedValue * -1;
            if (isSortableColumn(flippedValue)) {
                result.columnPos = flippedValue;
            }
        } else if (isSortableColumn(storedValue)) {
            result.columnPos = storedValue;
        }
    }

    return result;
}

/**
 * Returns whether the given number is a valid locale Column enum value.
 */
function isSortableColumn(value: number): value is SortableColumn {
    return [1, 2, 3, 4, 5].includes(value);
}

/**
 * Sets a data attribute on the event target to indicate that it's being hovered by the mouse.
 */
function onRowEnter(event: MouseEvent) {
    if (event.target) {
        (event.target as HTMLTableRowElement).dataset.hover = '1';
    }
}

/**
 * Removes a data attribute on the event target indicating that it was being hovered by the mouse.
 */
function onRowLeave(event: MouseEvent) {
    if (event.target) {
        delete (event.target as HTMLTableRowElement).dataset.hover;
    }
}

/**
 * Saves the given list of favorites.
 *
 * @param {ItemKeyString[]} favorites
 */
function setFavorites(favorites: Types.ItemKeyString[]) {
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
 */
function setPreferredSort(columnPos: SortableColumn, dir: SortDirection) {
    const categoryClass = Categories.getClassId();
    if (categoryClass == null) {
        return;
    }

    let categorySorts: CategorySorts = {};
    try {
        categorySorts = JSON.parse(localStorage.getItem('category-sort') || '{}');
    } catch (e) {
        // Ignore
    }

    categorySorts[categoryClass] = columnPos * (dir === SortDirection.Ascending ? 1 : -1);

    try {
        localStorage.setItem('category-sort', JSON.stringify(categorySorts));
    } catch (e) {
        // Ignore
    }
}

/**
 * Given a pricing-hydrated list of items, show it in the UI.
 */
async function showItemList(itemsList: Types.PricedItem[], includeNeverSeen: boolean, showingDeals: boolean) {
    const paid = isPaid();
    const detailColumn = Categories.getDetailColumn();
    const arbitrage = Search.isArbitrageMode();
    const showOutOfStock = !paid || !arbitrage && (qs('.main .search-bar .filter [name="out-of-stock"]') as HTMLInputElement).checked;
    const vendorFlip = paid && !arbitrage && (qs('.main .search-bar .filter [name="vendor-flip"]') as HTMLInputElement).checked;
    const bonusStat = Categories.getBonusStat();

    let itemKeyAllowList;
    if (bonusStat != null) {
        const realmState = await Auctions.getRealmState();
        itemKeyAllowList = realmState.bonusStatItems[bonusStat] || [];
    }

    const parent = qs('.main .search-result-target') as HTMLDivElement;
    const searchResultTargetParent = parent.parentNode as HTMLDivElement;

    let tr: HTMLTableRowElement;
    let td: HTMLTableCellElement;

    const table = ce('table');
    parent.appendChild(table);
    const thead = ce('thead');
    table.appendChild(thead);

    let colSpan = 0;
    let detailColumnOffset = detailColumn ? 1 : 0;
    const hasRegionMedian = itemsList.some(pricedItem => pricedItem.hasOwnProperty('regionMedian'));

    thead.appendChild(tr = ce('tr'));

    tr.appendChild(td = ce('td', {dataset: {colPos: Column.Price, colName: 'price'}}, ct('Price')));
    colSpan++;
    td.addEventListener('click', columnSort.bind(null, td));
    tr.appendChild(td = ce('td', {dataset: {colPos: Column.Name, colName: 'name'}}, ct('Name')));
    colSpan++;
    td.addEventListener('click', columnSort.bind(null, td));
    if (detailColumn) {
        tr.appendChild(td = ce('td', {dataset: {colPos: Column.Detail, colName: 'detail'}}, ct(detailColumn.name)));
        colSpan++;
        td.addEventListener('click', columnSort.bind(null, td));
    }
    tr.appendChild(td = ce(
        'td',
        {dataset: {colPos: 3 + detailColumnOffset, colName: 'quantity'}},
        ct(showingDeals ? '% of Region' :'Available')
    ));
    colSpan++;
    td.addEventListener('click', columnSort.bind(null, td));

    delete searchResultTargetParent.dataset.withMedian;
    if (hasRegionMedian) {
        searchResultTargetParent.dataset.withMedian = '1';
        tr.appendChild(td = ce(
            'td',
            {dataset: {colPos: 4 + detailColumnOffset, colName: 'median'}},
            ct('Region Median'),
        ));
        colSpan++;
        td.addEventListener('click', columnSort.bind(null, td));
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
        const restricted = !paid && !!(item.bonusSuffix || (item.bonusLevel && item.id !== ITEM_PET_CAGE));

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

        const sortRow: SortRow = [
            createRow.bind(null, item, tbody, detailColumn, vendorFlip, showingDeals, hasRegionMedian, arbitrage, restricted),
            0, // Price
            '', // Name
        ];
        my.rows.push(sortRow);

        //
        // PRICE
        //
        sortRow[Column.Price] = restricted ? 0 : (item.price || 0);

        //
        // NAME
        //
        {
            let itemName: string = item.name;
            if (suffix) {
                itemName += ' ' + suffix.name;
            }
            if (item.bonusLevel && item.id !== ITEM_PET_CAGE && !(detailColumn && detailColumn.prop === 'itemLevel')) {
                itemName += ' (' + item.bonusLevel.toString().padStart(4, '0') + ')';
            }
            if (item.craftingQualityId) {
                const craftingQuality = Items.getCraftingQuality(item.craftingQualityId);
                if (craftingQuality) {
                    itemName += ' ' + craftingQuality.tier.toString().padStart(3, '0');
                }
            }
            sortRow[Column.Name] = itemName;
        }

        //
        // DETAIL
        //
        if (detailColumn) {
            let value = item[detailColumn.prop];
            if (detailColumn.prop === 'reqLevel' && value != null && value <= 1) {
                value = 1;
            }
            if (detailColumn.prop === 'itemLevel') {
                if (!paid && !restricted) {
                    value = 0;
                } else {
                    value = item.bonusLevel || item.squishedItemLevel || value;
                }
            }
            if (value == null) {
                value = 0;
            }
            sortRow.push(value);
        }

        //
        // QUANTITY / PERCENTAGE
        //
        if (restricted) {
            sortRow.push(0);
        } else if (showingDeals) {
            sortRow.push(item.price / (item.regionMedian ?? 1));
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
            sortRow.push(restricted ? 0 : (item.regionMedian ?? 0));
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
        if (!paid && bonusStat != null) {
            // Note: this second message will always be at the bottom of the list.
            tbody.appendChild(
                ce('tr', {className: 'message'},
                    ce('td', {colSpan: colSpan},
                        ct(my.rows.length.toLocaleString() + ' results found. Become a patron to unlock their info!')
                    )));
        } else if (my.rows.length > MAX_RESULTS_SHOWN) {
            // Note: this second message will always be at the bottom of the list.
            tbody.appendChild(ce('tr', {className: 'message'}, ce('td', {colSpan: colSpan}, ct(
                my.rows.length.toLocaleString() + ' results found. Showing the first ' + MAX_RESULTS_SHOWN.toLocaleString() + '.',
            ))));
        }

        {
            const prefSort = getPreferredSort();
            const sortTd =
                (thead.querySelector(`td[data-col-pos="${prefSort.columnPos}"]`) ||
                thead.querySelector(`td[data-col-pos="${Column.Price}"]`)) as HTMLTableCellElement;

            // Will flip when we call the next sort.
            sortTd.dataset.sort = prefSort.dir === SortDirection.Descending ?
                SortDirection.Ascending :
                SortDirection.Descending;
            sortTd.dispatchEvent(new MouseEvent('click'));
        }
    }

    parent.scrollTop = 0;
}

/**
 * Enable/disable the favorites button in the search bar.
 */
function updateFavoritesButton(isEnabled: boolean) {
    if (isEnabled) {
        SEARCH_FAVORITES_BUTTON.dataset.enabled = '1';
        delete SEARCH_FAVORITES_BUTTON.dataset.simpleTooltip;
    } else {
        delete SEARCH_FAVORITES_BUTTON.dataset.enabled;
        SEARCH_FAVORITES_BUTTON.dataset.simpleTooltip = SEARCH_FAVORITES_BUTTON.dataset.defaultTooltip;
    }
}
