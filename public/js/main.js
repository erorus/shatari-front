import {createElement as ce, querySelector as qs, updateDeltaTimestamps} from './utils.js';
import {MS_MINUTE} from './constants.js';

import Categories from './Categories.js';
import Detail from './Detail.js';
import Hash from './Hash.js';
import Items from './Items.js';
import Locales from './Locales.js';
import Realms from './Realms.js';
import Search from './Search.js';
import UndermineMigration from './UndermineMigration.js';

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

