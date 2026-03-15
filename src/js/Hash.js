import {querySelector as qs} from "./utils";

import Auctions from "./Auctions";
import Categories from "./Categories";
import Detail from "./Detail";
import Items from "./Items";
import Realms from "./Realms";
import Search from "./Search";

/**
 * Manages the URL/location hash.
 */
const Hash = {
    /**
     * Returns the hash we use for the detail page for the given item on the given realm.
     *
     * @param {Item} item
     * @param {Realm} [realm]
     * @return {string}
     */
    getItemDetailHash(item, realm) {
        let realmHash = Realms.getRealmHash(realm || Realms.getCurrentRealm());

        let itemHash = Items.stringifyKeyParts(
            item.id,
            item.bonusLevel,
            item.bonusSuffix,
        );

        return `${realmHash}/${itemHash}`;
    },

    /**
     * Returns the hash we use for the current search criteria.
     *
     * @param {string} searchTypeName
     */
    getSearchHash(searchTypeName) {
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
    },

    /**
     * Reads the hash currently in the browser's location bar and applies it to the current state. Invalid hashes
     * are silently ignored. Sets up listener so that future hash changes are also read.
     */
    init() {
        window.addEventListener('hashchange', () => read());
        read();
    },

    /**
     * Sets the browser's location bar hash.
     *
     * @param {string} newHash Must not include any initial #
     * @param {string} title The page title fragment
     */
    set(newHash, title) {
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
    },
};
export default Hash;

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

/**
 * Reads the hash currently in the browser's location bar and applies it to the current state. Invalid hashes
 * are silently ignored.
 */
const read = async function () {
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
