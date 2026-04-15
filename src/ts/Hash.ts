import {querySelector as qs} from "./utils";

import Auctions from "./Auctions";
import Categories from "./Categories";
import Detail from "./Detail";
import {getItemByKey, parseKey, stringifyKeyParts} from "./Items";
import Realms from "./Realms";
import Search from "./Search";
import * as Types from "./Types";

/**
 * Manages the URL/location hash.
 */
const Hash = {
    /**
     * Returns the hash we use for the detail page for the given item on the given realm.
     */
    getItemDetailHash(item: Types.Item, realm?: Types.Realm) {
        realm ??= Realms.getCurrentRealm();
        if (!realm) {
            return '';
        }

        const realmHash = Realms.getRealmHash(realm);
        const itemHash = stringifyKeyParts(
            item.id,
            item.bonusLevel,
            item.bonusSuffix,
        );

        return `${realmHash}/${itemHash}`;
    },

    /**
     * Returns the hash we use for the current search criteria.
     */
    getSearchHash(searchTypeName: string) {
        const realm = Realms.getCurrentRealm();
        if (!realm) {
            return '';
        }
        const realmHash = Realms.getRealmHash(realm);

        let result = `${realmHash}/${searchTypeName}`;

        {
            const categoryHash = Categories.getHashCode();
            if (categoryHash) {
                result += `/cat=${categoryHash}`
            }
        }

        {
            let minLevel = (/^\d+$/.exec((qs('.main .search-bar input[name="level-min"]') as HTMLInputElement).value) || [])[0];
            let maxLevel = (/^\d+$/.exec((qs('.main .search-bar input[name="level-max"]') as HTMLInputElement).value) || [])[0];
            if (minLevel !== undefined) {
                result += `/lmin=${minLevel}`;
            }
            if (maxLevel !== undefined) {
                result += `/lmax=${maxLevel}`;
            }
        }

        {
            const rarityFrom = qs('.main .search-bar .filter select.rarity[name="rarity-from"]') as HTMLSelectElement;
            const rarityTo = qs('.main .search-bar .filter select.rarity[name="rarity-to"]') as HTMLSelectElement;
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
            const expansionSelect = qs('.main .filter select.expansion') as HTMLSelectElement;
            if (expansionSelect.selectedIndex !== 0) {
                result += `/era=${expansionSelect.options[expansionSelect.selectedIndex].value}`;
            }
        }

        {
            const arbitrage = Search.isArbitrageMode();
            const transmogMode = (qs('.main .search-bar .filter [name="transmog-mode"]') as HTMLInputElement).checked;
            const vendorFlip = (qs('.main .search-bar .filter [name="vendor-flip"]') as HTMLInputElement).checked;
            const outOfStock = (qs('.main .search-bar .filter [name="out-of-stock"]') as HTMLInputElement).checked;

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
            const searchBox = qs('.main .search-bar input[type="text"]') as HTMLInputElement;
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
     *
     * Returns true when the hash was read successfully.
     */
    async init() {
        window.addEventListener('hashchange', () => read());

        return await read();
    },

    /**
     * Sets the browser's location bar hash.
     */
    set(
        newHash: string, // Must not include any initial #
        title: string,   // The page title fragment
    ) {
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

    storeInSession(): void {
        const hash = location.hash.replace(/^#+/, '');
        if (hash.length) {
            try {
                sessionStorage.setItem('returnToHash', hash);
            } catch (e) {
                // Oh well.
            }
        }
    },
};
export default Hash;

/**
 * Returns the current location hash, without leading #.
 */
function getHash(): string {
    let sessionHash: string = '';
    try {
        sessionHash = sessionStorage.getItem('returnToHash') ?? '';
        sessionStorage.removeItem('returnToHash');
    } catch (e) {
        // No session storage.
    }

    return decodeURIComponent(location.hash.replace(/^#+/, '') || sessionHash);
}

/**
 * Performs a search of the given type.
 */
async function performSearch(
    searchType: string,
    params: string[], // The additional hash components between slashes.
) {
    let catHash: string = '';
    let rmin: number = 0;
    let rmax: number = 5;
    let lmin: number|undefined;
    let lmax: number|undefined;
    let expansion: number|undefined;
    let transmogMode: boolean = false;
    let vendorFlip: boolean = false;
    let outOfStock: boolean = true;
    let arbitrage: boolean = false;
    let searchText: string = '';

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
    ([
        ['.rarity[name="rarity-from"]', `${rmin}`],
        ['.rarity[name="rarity-to"]', `${rmax}`],
        ['.expansion', `${expansion ?? ''}`],
    ] as [string, string][]).forEach(([selector, value]) => {
        const sel = qs(`.main .search-bar .filter select${selector}`) as HTMLSelectElement;
        Array.from(sel.options).forEach((opt, index) => {
            if (opt.value === value) {
                sel.selectedIndex = index;
            }
        });
        sel.dispatchEvent(new Event('change'));
    });
    (qs('.main .search-bar input[name="level-min"]') as HTMLInputElement).value = `${lmin ?? ''}`;
    (qs('.main .search-bar input[name="level-max"]') as HTMLInputElement).value = `${lmax ?? ''}`;
    (qs('.main .search-bar .filter [name="transmog-mode"]') as HTMLInputElement).checked = transmogMode;
    (qs('.main .search-bar .filter [name="vendor-flip"]') as HTMLInputElement).checked = vendorFlip;
    (qs('.main .search-bar .filter [name="out-of-stock"]') as HTMLInputElement).checked = outOfStock;
    {
        const checkbox = qs('.main .search-bar .filter [name="arbitrage-mode"]') as HTMLInputElement;
        if (checkbox.checked !== arbitrage) {
            checkbox.click();
        }
    }

    (qs('.main .search-bar input[type="text"]') as HTMLInputElement).value = searchText;

    await Search.perform(searchType === 'favorites', searchType === 'deals');
}

/**
 * Reads the hash currently in the browser's location bar and applies it to the current state. Invalid hashes
 * are silently ignored.
 *
 * Returns true when we performed some action due to a valid hash.
 */
const read = async function (): Promise<boolean> {
    let hash = getHash();
    let hashParts = hash.split('/');
    if (hashParts.length < 2) {
        // Didn't recognize hash format.
        return false;
    }

    let realm = Realms.getRealmByHash(hashParts[0]);
    if (!realm) {
        // Didn't recognize realm.
        return false;
    }
    Realms.setCurrentRealm(realm);

    let match = /^\d+(?:-\d+(?:-\d+)?)?$/.exec(hashParts[1]);
    if (match) {
        // Try to show an item detail page.

        let item = getItemByKey(parseKey(match[0]));
        if (item) {
            let hydrated = await Auctions.hydrateList([item], {realm});
            if (hydrated.length) {
                await Detail.show(Auctions.strip(hydrated[0]), realm);
            }
        }

        return true;
    }

    switch (hashParts[1]) {
        case 'search':
        case 'favorites':
        case 'deals':
            await performSearch(hashParts[1], hashParts.slice(2));

            return true;
    }

    return false;
};
