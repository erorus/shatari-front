import {createElement as ce, querySelector as qs, updateDeltaTimestamps} from "./utils";
import {MS_MINUTE} from "./constants";

import * as Account from "./Account";
import Auctions from "./Auctions";
import Categories from "./Categories";
import Detail from "./Detail";
import Hash from "./Hash";
import {init as ItemsInit} from "./Items";
import {init as LocalesInit} from "./Locales";
import Realms from "./Realms";
import Search from "./Search";
import UndermineMigration from "./UndermineMigration";

async function init() {
    const welcome = qs('.main .welcome') as HTMLElement|null;
    const inMaintenance = !!welcome?.dataset.maintenance;
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
            toReplace.parentNode?.replaceChild(df, toReplace);
        }
    }

    let hsTag = ce('script', {
        src: 'highstock-10.3.3.js',
        id: 'highstock-script',
    });
    hsTag.addEventListener('load', () => hsTag.dataset.loaded = '1');
    document.head.appendChild(hsTag);

    document.head.appendChild(ce('script', {src: 'power.js'}));

    if (!('userAgentData' in navigator) &&
        navigator.userAgent.indexOf('Safari') > -1 &&
        navigator.userAgent.indexOf('Chrome') < 0 &&
        navigator.userAgent.indexOf('Chromium') < 0
    ) {
        // Safari applies TR backgrounds to each TD.
        document.body.classList.add('no-row-backgrounds');
    }

    const fsDiv = qs('.main .welcome .full-screen') as HTMLElement;
    const doc = document as Document & {webkitFullscreenEnabled?: boolean};
    if (
        (document.fullscreenEnabled || doc.webkitFullscreenEnabled) &&
        (window.innerWidth === window.screen.availWidth || window.innerHeight === window.screen.availHeight)
    ) {
        fsDiv.style.display = '';
        fsDiv.querySelector('button')?.addEventListener('click', () => {
            if (document.fullscreenEnabled) {
                qs('.main')?.requestFullscreen();
            } else if (doc.webkitFullscreenEnabled) {
                // @ts-ignore
                qs('.main')?.webkitRequestFullscreen();
            }
        });
    }

    LocalesInit();

    await Promise.all([
        Categories.init(),
        ItemsInit(),
        Realms.init(),
        Account.init(),
    ]);

    const filterButton = qs('.main .search-bar .filter');
    filterButton?.addEventListener('mouseup', (event) => {
        const div = filterButton.querySelector('div');
        if (!div || div.style.display === 'block') {
            return;
        }

        div.style.display = 'block';
        const outside = document.body;
        /**
         * Called on mouseup to close the filter tooltip.
         */
        const closeDiv = function (event: Event) {
            let target = event.target;
            while ((target instanceof Node) && target.parentNode) {
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
        const rarityClassFix = (select: HTMLSelectElement) =>
            select.querySelectorAll('option').forEach(option => {
                if (option.selected) {
                    select.classList.add(option.className);
                } else {
                    select.classList.remove(option.className);
                }
            });
        const rarityFrom = qs('.main .search-bar .filter select.rarity[name="rarity-from"]') as HTMLSelectElement|null;
        const rarityTo = qs('.main .search-bar .filter select.rarity[name="rarity-to"]') as HTMLSelectElement|null;
        if (rarityFrom && rarityTo) {
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
    }

    qs('.main .bottom-bar .links a.home')?.addEventListener('click', event => {
        event.preventDefault();
        Detail.hide();
        Search.hide();
        welcome && (welcome.style.display = '');
    });

    setInterval(updateDeltaTimestamps, MS_MINUTE);

    Search.init();
    if (!(await Hash.init()) && Realms.getCurrentRealm()) {
        // Preload realm and region state if we can.
        Auctions.getRealmState();
        Auctions.getRegionState();
    }
}

init().catch(alert);

