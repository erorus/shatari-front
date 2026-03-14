import {
    createElement as ce,
    querySelector as qs,
    updateDeltaTimestamps,
} from './js/utils.js';
import {MS_MINUTE} from './js/constants.js';

import Categories from './js/Categories.js';
import Detail from './js/Detail.js';
import Hash from './js/Hash.js';
import Items from './js/Items.js';
import Locales from './js/Locales.js';
import Realms from './js/Realms.js';
import Search from './js/Search.js';
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

        Search.init();
        Hash.init();
    }

    init().catch(alert);

