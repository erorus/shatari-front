import {
    copyObject as co,
    createElement as ce,
    createText as ct,
    emptyElement as ee,
    querySelector as qs
} from "./utils.js";
import Locales from "./Locales.js";
import Progress from "./Progress.js";

/** @type {Region[]} */
const REGIONS = ['us', 'eu', 'tw', 'kr'];

/** @type {{
 *      connectedRealms: Object.<string, Object.<ConnectedRealmID, ConnectedRealm>>,
 *      realms: Object.<RealmID, Realm>
 * }}
 */
const my = {
    connectedRealms: {},

    realms: {},
};

/**
 * Methods to handle realms and connected realms.
 */
const Realms = {
    /**
     * Returns the connected realm object for a given realm.
     *
     * @param {Realm} realm
     * @return {ConnectedRealm}
     */
    getConnectedRealm(realm) {
        return getConnectedRealmsForRegion(realm.region)[realm.connectedId];
    },

    /**
     * Get a copy of the realm object for the currently-selected realm, or undefined if not found.
     *
     * @return {Realm|undefined}
     */
    getCurrentRealm() {
        const sel = qs('.main .search-bar select');
        const realmId = sel.options[sel.selectedIndex].value;

        if (!realmId) {
            return;
        }

        return Realms.getRealm(parseInt(realmId));
    },

    /**
     * Get a copy of the realm object for the given realm ID, or undefined if not found.
     *
     * @param {RealmID} realmId
     * @return {Realm|undefined}
     */
    getRealm(realmId) {
        if (!my.realms[realmId]) {
            return;
        }

        let result = {};
        co(result, my.realms[realmId]);

        return result;
    },

    /**
     * Returns the realm matching the given hash slug, or undefined for no realm.
     *
     * @param {string} hashSlug
     * @return {Realm|undefined}
     */
    getRealmByHash(hashSlug) {
        return Object.values(my.realms).find(realm => hashSlug === Realms.getRealmHash(realm));
    },

    /**
     * Returns the realm's slug which is used in the location hash.
     *
     * @param {Realm} realm
     */
    getRealmHash(realm) {
        return `${realm.region}-${realm.slug}`;
    },

    /**
     * Returns a sorted array of connected realms for the given region.
     *
     * @param {Region} region
     * @return {ConnectedRealm[]}
     */
    getRegionConnectedRealms(region) {
        const result = Object.values(getConnectedRealmsForRegion(region));
        result.sort((a, b) => a.canonical.name.localeCompare(b.canonical.name));

        return result;
    },

    /**
     * Fetches the realm list data and creates the realm list dropdown.
     */
    async init() {
        await getRealms();

        const select = qs('.main .search-bar select');
        select.addEventListener('change', placeholderUsageCheck);

        updateSelectNames(parseInt(localStorage.getItem('realm') || 0));

        placeholderUsageCheck();

        Locales.registerCallback(onLocaleChange);
    },

    /**
     * Saves the current/given realm to localstorage as the preferred realm.
     *
     * @param {Realm} [realm]
     */
    savePreferredRealm(realm) {
        realm = realm || Realms.getCurrentRealm();
        if (!realm) {
            return;
        }

        try {
            localStorage.setItem('realm', realm.id);
        } catch (e) {
            // Ignore
        }
    },

    /**
     * Changes the currently-selected realm to the given realm.
     *
     * @param {Realm} realm
     */
    setCurrentRealm(realm) {
        const select = qs('.main .search-bar select');
        let option = select.querySelector(`option[value="${realm.id}"]:not([data-native])`);
        if (option) {
            option.selected = true;
        }

        placeholderUsageCheck();
    },
};
export default Realms;

/**
 * Returns the connected realms for a region, keyed by connected realm ID.
 *
 * @param {Region} region
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
    const localeCode = Locales.getCurrent();

    const responses = await Promise.all([
        Progress.fetch('json/realms/realm-list.json', {mode:'same-origin'}),
        Progress.fetch(`json/realms/realm-names.${localeCode}.json`, {mode:'same-origin'}),
    ]);

    if (!responses[0].ok) {
        throw 'Cannot get list of realms!';
    }
    if (!responses[1].ok) {
        throw 'Cannot get list of realm names!';
    }

    my.realms = await responses[0].json();
    setNames(await responses[1].json());
}

/**
 * Called when the user changes their preferred locale, this updates the UI with the new names.
 *
 * @param {string} locale
 */
async function onLocaleChange(locale) {
    const response = await Progress.fetch('json/realms/realm-names.' + locale + '.json', {mode:'same-origin'});
    if (!response.ok) {
        throw 'Could not load realm names in locale ' + locale;
    }

    setNames(await response.json());
    updateSelectNames();
}

/**
 * Removes the "Select a realm" placeholder from the realm dropdown once it's no longer needed.
 */
function placeholderUsageCheck() {
    const select = qs('.main .search-bar select');
    if (!select.options[0].value) {
        if (select.selectedIndex !== 0) {
            select.removeChild(select.querySelector('option[value=""]'));
            select.removeEventListener('change', placeholderUsageCheck);
        }
    } else {
        select.removeEventListener('change', placeholderUsageCheck);
    }
}

/**
 * Set the names and categories of our cached realms using the given dictionary.
 *
 * @param {Object.<number, {name: string, category: string, nativeName: string}>} names
 */
function setNames(names) {
    const popNames = Locales.getPopulationNames();

    for (let id in my.realms) {
        if (!my.realms.hasOwnProperty(id)) {
            continue;
        }
        let nameRec = names[my.realms[id].id] || {};
        my.realms[id].name = nameRec.name || ('Realm ' + id);
        if (nameRec.nativeName) {
            my.realms[id].nativeName = nameRec.nativeName;
        } else {
            delete my.realms[id].nativeName;
        }
        my.realms[id].category = nameRec.category || '';
        my.realms[id].populationName = popNames[my.realms[id].population] || '';
    }
}

/**
 * Updates the realm select box options with their names for the current locale.
 *
 * @param {number} [savedRealmId] The "current" realm ID.
 */
function updateSelectNames(savedRealmId) {
    if (!savedRealmId) {
        savedRealmId = (Realms.getCurrentRealm() || {}).id;
    }

    const select = qs('.main .search-bar select');

    if (!select.querySelector('optgroup')) {
        REGIONS.forEach(region => {
            select.appendChild(ce('optgroup', {dataset: {region}, label: region.toUpperCase() + ' Realms'}));
        });
    }

    select.querySelectorAll('option[data-native]').forEach(option => option.parentNode.removeChild(option));

    const sorted = [];
    for (let k in my.realms) {
        if (!my.realms.hasOwnProperty(k)) {
            continue;
        }

        const realm = my.realms[k];
        sorted.push(realm);
        if (realm.nativeName) {
            sorted.push({
                ...realm,
                name: realm.nativeName,
                fromNative: true,
            });
        }
    }
    sorted.sort((a, b) => {
        return a.name.localeCompare(b.name) || (REGIONS.indexOf(a.region) - REGIONS.indexOf(b.region));
    });

    let og = select.querySelector('optgroup');
    const seenNames = {};
    sorted.forEach(realm => {
        let o = realm.fromNative ? null :
            select.querySelector(`option[value="${realm.id}"]:not([data-native])`);
        if (o) {
            ee(o);
        } else {
            o = ce('option', {value: realm.id});
        }
        if (realm.fromNative) {
            o.dataset.native = 'true';
        }
        o.label = realm.name;

        if (seenNames[realm.name]) {
            if (seenNames[realm.name] !== true) {
                const opt = seenNames[realm.name];
                opt.label += ' ' + Realms.getRealm(parseInt(opt.value)).region.toUpperCase();
                ee(opt);
                opt.appendChild(ct(opt.label));

                seenNames[realm.name] = true;
            }
            o.label += ' ' + realm.region.toUpperCase();
        } else {
            seenNames[realm.name] = o;
        }
        o.appendChild(ct(o.label));

        if (!realm.fromNative && realm.id === savedRealmId) {
            o.selected = true;
        }

        if (og.dataset.region !== realm.region) {
            og = select.querySelector(`optgroup[data-region="${realm.region}"]`);
        }

        og.appendChild(o);
    });
}
