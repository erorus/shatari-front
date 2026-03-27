import {
    createElement as ce,
    createSVGElement as svge,
    createText as ct,
    emptyElement as ee,
    priceElement,
    querySelector as qs,
    timeString,
    updateDeltaTimestamps,
    waitForHighstock,
} from "./utils";
import {COPPER_GOLD, COPPER_SILVER, ITEM_PET_CAGE, MS_DAY, MS_HOUR, NBSP} from "./constants";

import Auctions from "./Auctions";
import Categories from "./Categories";
import Hash from "./Hash";
import * as Items from "./Items";
import {getWowheadDomain, getWowheadPathPrefix} from "./Locales";
import Realms from "./Realms";
import Search from "./Search";
import * as Types from "./Types";

declare const Highcharts: any;

const BREED_STATS: Record<number, Types.BattlePetStats> = {
    3:  {stamina: 0.5, power: 0.5, speed: 0.5},
    4:  {stamina: 0.0, power: 2.0, speed: 0.0},
    5:  {stamina: 0.0, power: 0.0, speed: 2.0},
    6:  {stamina: 2.0, power: 0.0, speed: 0.0},
    7:  {stamina: 0.9, power: 0.9, speed: 0.0},
    8:  {stamina: 0.0, power: 0.9, speed: 0.9},
    9:  {stamina: 0.9, power: 0.0, speed: 0.9},
    10: {stamina: 0.4, power: 0.9, speed: 0.4},
    11: {stamina: 0.4, power: 0.4, speed: 0.9},
    12: {stamina: 0.9, power: 0.4, speed: 0.4},
}

/** All the section keys, in default order. */
const SECTION_KEYS: string[] = [
    'base-stats',
    'snapshots',
    'heat',
    'daily',
    'bulk',
    'regional-daily',
    'other-realms',
];

/** A map of stat ID to icon name. */
const STAT_TO_ICON: Record<Types.StatID, string> = {
    61: 'petbattle_speed',                    // Speed
    62: 'rogue_leeching_poison',              // Leech
    63: 'rogue_burstofspeed',                 // Avoidance
    64: 'spell_magic_greaterblessingofkings', // Indestructible
};

type ModuleVars = {
    everScrolled: boolean;
}

const my: ModuleVars = {
    everScrolled: false,
};

/**
 * Manages the display of an individual item's details.
 */
const Detail = {
    /**
     * Hides detail mode to revert to search result mode.
     */
    hide() {
        delete (qs('.main .main-result') as HTMLDivElement).dataset.detailMode;
        Search.setHash();
    },

    /**
     * Enters detail mode to show the given item's details.
     */
    async show(item: Types.Item, realm: Types.Realm|null) {
        (qs('.main .main-result') as HTMLDivElement).dataset.detailMode = '1';

        const itemDiv = qs('.main .main-result .item') as HTMLDivElement;
        ee(itemDiv);

        {
            let thisRealm = realm || Realms.getCurrentRealm();
            thisRealm && Hash.set(
                Hash.getItemDetailHash(item, thisRealm),
                `[${item.name}] - ${thisRealm.name} ${thisRealm.region.toUpperCase()}`,
            );
        }

        {
            const backBar = ce('div', {className: 'back-bar'});
            itemDiv.appendChild(backBar);

            const backButton = ce('button', {}, ct('Back'));
            backButton.addEventListener('click', Detail.hide);
            backBar.appendChild(ce('div', {className: 'button-border'}, backButton));

            if (realm && realm.id !== Realms.getCurrentRealm()?.id) {
                const span = ce('span', {className: 'alt-realm'}, ct(`Viewing Realm ${realm.name}`));
                if (realm.nativeName) {
                    span.appendChild(ce('span', {className: 'native-name'}, ct(realm.nativeName)));
                }
                backBar.appendChild(span);
            }

            backBar.appendChild(ce('span', {className: 'available'}));
        }

        const panels = ce('div', {className: 'panels'});
        itemDiv.appendChild(panels);

        const details = ce('div', {className: 'details'});
        panels.appendChild(details);
        const auctions = ce('div', {className: 'auctions'});
        panels.appendChild(auctions);

        const itemState = await Auctions.getItem(item, realm);

        populateAuctions(item, itemState);
        await populateDetails(item, itemState);
    },

    /**
     * Shows the WoW Token panel for the current region.
     */
    async showWowToken() {
        (qs('.main .main-result') as HTMLDivElement).dataset.detailMode = '1';
        Hash.set('', '');

        const itemDiv = qs('.main .main-result .item') as HTMLDivElement;
        ee(itemDiv);

        {
            const backBar = ce('div', {className: 'back-bar'});
            itemDiv.appendChild(backBar);

            const backButton = ce('button', {}, ct('Back'));
            backBar.appendChild(backButton);
            backButton.addEventListener('click', Detail.hide);
        }

        const panels = ce('div', {className: 'panels'});
        itemDiv.appendChild(panels);

        const details = ce('div', {className: 'details'});
        panels.appendChild(details);

        const scroller = ce('div', {className: 'scroller'});
        details.appendChild(scroller);
        scroller.scrollTop = 0;

        // Name panel
        {
            const namePanel = ce('span', {
                className: 'title q8',
            });
            scroller.appendChild(namePanel);

            const icon = ce('span', {className: 'icon', dataset: {quality: 8}});
            icon.style.backgroundImage = 'url("' + Items.getIconUrl('wow_token01', Items.IconSize.Large) + '")';
            namePanel.appendChild(icon);

            let itemName = Categories.getTokenName();
            const nameLink = ce('a', {
                href: `https://www.wowhead.com/${getWowheadPathPrefix()}item=122284`,
            }, ct(itemName));
            namePanel.appendChild(nameLink);
        }

        const tokenState = await Auctions.getToken();
        if (!tokenState.region) {
            scroller.appendChild(ct('Choose a realm first.'));

            return;
        }

        const regionName = tokenState.region.toUpperCase();
        const days = tokenState.snapshots.length ? Math.round(
            (tokenState.snapshots[tokenState.snapshots.length - 1].snapshot - tokenState.snapshots[0].snapshot) / MS_DAY
        ) : 0;

        // Stats
        (() => {
            const statsPanel = ce('div', {className: 'base-stats framed'});
            scroller.appendChild(statsPanel);

            statsPanel.appendChild(ce('span', {className: 'frame-title'}, ct('Base Stats')));

            const table = ce('table');
            statsPanel.appendChild(table);

            let tr;

            table.appendChild(tr = ce('tr', {className: 'header'}));
            tr.appendChild(ce('td'));
            tr.appendChild(ce('td', {}, ct(regionName)));

            table.appendChild(tr = ce('tr'));
            tr.appendChild(ce('td', {}, ct('Current')));
            tr.appendChild(ce('td', {
                dataset: {simpleTooltip: 'Price of a token in ' + regionName + ' right now.'}
            }, tokenState.price ? priceElement(tokenState.price) : undefined));

            table.appendChild(tr = ce('tr'));
            tr.appendChild(ce('td', {}, ct('Updated')));
            tr.appendChild(ce('td', {}, ce('span', {className: 'delta-timestamp', dataset: {timestamp: tokenState.snapshot}})));

            let prices: Types.Money[] = [];
            tokenState.snapshots.forEach(snapshot => {
                if (snapshot.price > 0) {
                    prices.push(snapshot.price);
                }
            });
            prices.sort((a, b) => a - b);

            let eleMedian: HTMLElement;
            let eleMean: HTMLElement;

            table.appendChild(tr = ce('tr'));
            tr.appendChild(ce('td', {}, ct('Median')));
            tr.appendChild(eleMedian = ce('td', {
                dataset: {simpleTooltip: 'Median price in ' + regionName + ' over the past ' + days + ' days.'}
            }));

            table.appendChild(tr = ce('tr'));
            tr.appendChild(ce('td', {}, ct('Mean')));
            tr.appendChild(eleMean = ce('td', {
                dataset: {simpleTooltip: 'Mean (average) price in ' + regionName + ' over the past ' + days + ' days.'}
            }));

            let statistics = getStatistics(prices);
            eleMedian.appendChild(priceElement(statistics.median));
            eleMean.appendChild(priceElement(statistics.mean));
        })();

        // Price chart
        (() => {
            // Chart container
            const chartContainer = ce('div', {
                className: 'charts-container framed',
            });
            scroller.appendChild(chartContainer);
            chartContainer.appendChild(ce('span', {className: 'frame-title'}, ct(days + '-Day History')));

            // Chart wrapper and parent SVG
            const constScale = 5;
            const xMax = 1000 * constScale;
            const yMaxPrice = 333 * constScale;
            const yMax = yMaxPrice;

            const chartWrapper = ce('div', {
                className: 'chart-wrapper',
                style: {
                    paddingBottom: (yMax / xMax * 100) + '%',
                }
            });
            chartContainer.appendChild(chartWrapper);
            const priceChart = svge('svg', {
                'viewBox': [0, 0, xMax, yMax].join(' '),
            });
            chartWrapper.appendChild(priceChart);

            // Determine scaling
            let maxPrice = 0;
            let firstTimestamp = Date.now();
            let lastTimestamp = 0;
            {
                let prices: Types.Money[] = [];
                tokenState.snapshots.forEach(snapshot => {
                    maxPrice = Math.max(maxPrice, snapshot.price);
                    firstTimestamp = Math.min(firstTimestamp, snapshot.snapshot);
                    lastTimestamp = Math.max(lastTimestamp, snapshot.snapshot);
                    if (snapshot.price > 0) {
                        prices.push(snapshot.price);
                    }
                });
                if (maxPrice === 0) {
                    return;
                }

                prices.sort((a, b) => a - b);
                let q1 = prices[Math.floor(prices.length * 0.25)];
                let q3 = prices[Math.floor(prices.length * 0.75)];
                let iqr = q3 - q1;

                maxPrice = Math.min(maxPrice, q3 + iqr * 1.5) * 1.15;
            }
            const timestampRange = lastTimestamp - firstTimestamp;

            type HoverPoint = Types.SummaryLine & {
                xCenter: number;
                xMin: number;
                xMax: number;
            };

            // Set point arrays.
            const pricePoints: string[] = [];
            const hoverData: HoverPoint[] = [];

            const xOffset = Math.round(1 / tokenState.snapshots.length * xMax / 2);
            const xRange = xMax - 2 * xOffset;

            tokenState.snapshots.forEach(snapshot => {
                const x = xOffset + Math.round((snapshot.snapshot - firstTimestamp) / timestampRange * xRange);
                const priceY = Math.round((maxPrice - snapshot.price) / maxPrice * yMaxPrice);
                pricePoints.push([x, priceY].join(','));

                const hoverPoint: HoverPoint = {
                    ...snapshot,
                    xCenter: x / xMax,
                    xMin: 0,
                    xMax: 1,
                };
                if (hoverData.length > 0) {
                    let prev = hoverData[hoverData.length - 1];
                    hoverPoint.xMin = prev.xMax = prev.xCenter + (hoverPoint.xCenter - prev.xCenter) / 2;
                }

                hoverData.push(hoverPoint);
            });

            // line + fill
            [
                {data: pricePoints, max: yMaxPrice, name: 'price'},
            ].forEach(dataset => {
                const firstY = dataset.data[0].split(',')[1];
                const lastY = dataset.data[dataset.data.length - 1].split(',')[1];

                const line = svge('polyline', {
                    points: '0,' + firstY + ' ' + dataset.data.join(' ') + ' ' + xMax + ',' + lastY,
                });
                line.classList.add(dataset.name);

                // Loop us back around to fill the shape.
                dataset.data.push([xMax, lastY].join(','));
                dataset.data.push([xMax, dataset.max].join(','));
                dataset.data.push([0, dataset.max].join(','));
                dataset.data.push([0, firstY].join(','));
                const fill = svge('polygon', {
                    points: dataset.data.join(' '),
                });
                fill.classList.add(dataset.name);

                priceChart.appendChild(fill);
                priceChart.appendChild(line);
            });

            const hoverLine = svge('line', {x1: -1000, x2: -1000, y1: 0, y2: yMax}) as SVGLineElement;
            hoverLine.classList.add('hover');
            priceChart.appendChild(hoverLine);

            const formatter = new Intl.DateTimeFormat([], {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                timeZoneName: 'short',
            });

            priceChart.addEventListener('mousemove', (event) => {
                let leftOffset = priceChart.getBoundingClientRect().left;
                let xPos = Math.min(0.9999, (event.clientX - leftOffset) / priceChart.clientWidth);

                hoverLine.x1.baseVal.value = hoverLine.x2.baseVal.value = xPos * xMax;

                let left = 0;
                let right = hoverData.length - 1;
                let mid = 0;
                while (left <= right) {
                    mid = Math.floor((left + right) / 2);
                    if (hoverData[mid].xMax < xPos) {
                        left = mid + 1;
                    } else if (hoverData[mid].xMin > xPos) {
                        right = mid - 1;
                    } else {
                        break;
                    }
                }

                let snapshot = hoverData[mid];

                const result = ce('table', {className: 'shatari-tooltip'});
                result.appendChild(ce('tr', {}, ce('td', {className: 'date', colSpan: 2}, ct(formatter.format(new Date(snapshot.snapshot))))));

                const priceLine = ce('tr');
                priceLine.appendChild(ce('td', {className: 'price'}, ct('Price')));
                priceLine.appendChild(ce('td', {}, priceElement(snapshot.price)));
                result.appendChild(priceLine);

                WH.Tooltips.showAtCursor(event, result.outerHTML);
            });
            priceChart.addEventListener('mouseout', WH.Tooltips.hide);
        })();

        updateDeltaTimestamps();
    }
};
export default Detail;

/**
 * Given a pet's base stats and an auction's modifiers, return the actual stats of the pet.
 */
function getBattlePetStats(baseStats: Types.BattlePetStats, modifiers: Record<Items.Modifier, number>): Types.BattlePetStats {
    const quality = modifiers[Items.Modifier.BattlePetQuality];
    const rawBreed = modifiers[Items.Modifier.BattlePetBreed];
    const level = modifiers[Items.Modifier.BattlePetLevel];

    if (quality == null) {
        throw "Missing pet quality";
    }
    if (rawBreed == null) {
        throw "Missing pet breed";
    }
    if (level == null) {
        throw "Missing pet level";
    }

    // Squash gender
    const breed = ((rawBreed - 3) % 10) + 3;

    let breedStats = BREED_STATS[breed];
    if (!breedStats) {
        throw "Invalid breed";
    }

    return {
        stamina: roundToOdd((baseStats.stamina + breedStats.stamina) * 5 * level * (1 + quality / 10) + 100),
        power: roundToOdd((baseStats.power + breedStats.power) * level * (1 + quality / 10)),
        speed: roundToOdd((baseStats.speed + breedStats.speed) * level * (1 + quality / 10)),
    };
}

/**
 * Returns the median and mean of a sorted list of numbers.
 */
function getStatistics(values: number[]): {median: number, mean: number} {
    let median;
    if (values.length % 2 === 1) {
        median = values[Math.floor(values.length / 2)];
    } else {
        let value1 = values[values.length / 2 - 1];
        let value2 = values[values.length / 2];
        median = Math.round((value1 + value2) / 2);
    }

    let mean;
    let sum = 0;
    values.forEach(value => sum += value);
    mean = Math.round(sum / values.length);

    return {median, mean};
}

/**
 * Returns a list of item states for the given item for all realms in the given region.
 */
async function fetchOtherRealms(item: Types.Item, region: Types.Region): Promise<Types.ItemState[]> {
    const currentRealm = Realms.getCurrentRealm();
    const connectedRealms = Realms.getRegionConnectedRealms(region);

    const toFetch: Promise<Types.ItemState>[] = [];
    connectedRealms.forEach(connectedRealm => {
        toFetch.push(Auctions.getItem(
            item,
            connectedRealm.id === currentRealm?.connectedId ? currentRealm : connectedRealm.canonical
        ));
    });

    return await Promise.all(toFetch);
}

/**
 * Populate the auctions list in the rightmost panel.
 */
function populateAuctions(item: Types.Item, itemState: Types.ItemState) {
    const availableSpan = qs('.main .main-result .item .back-bar .available') as HTMLSpanElement;

    availableSpan.appendChild(ct(itemState.quantity.toLocaleString() + ' Available'));

    const auctionsPanel = qs('.main .main-result .item .auctions') as HTMLDivElement;
    const scroller = ce('div', {className: 'scroller'});
    auctionsPanel.appendChild(scroller);
    scroller.scrollTop = 0;

    const table = ce('table');
    scroller.appendChild(table);

    const onRowClick = (tr: HTMLTableRowElement) => {
        const input = qs('.main .main-result .item .details .quantity-calc input') as HTMLInputElement;
        input.value = tr.dataset.runningQuantity ?? '1';
        input.dispatchEvent(new Event('change'));
    };

    let runningQuantity = 0;
    itemState.auctions.forEach(auction => {
        const tr = ce('tr');
        table.appendChild(tr);

        tr.dataset.price = `${auction.price}`;
        tr.dataset.quantity = `${auction.quantity}`;
        runningQuantity += auction.quantity;
        tr.dataset.runningQuantity = `${runningQuantity}`;
        tr.appendChild(ce('td', {}, priceElement(auction.price)));
        tr.appendChild(ce('td', {}, ct(auction.quantity.toLocaleString())));

        tr.addEventListener('click', onRowClick.bind(null, tr));
    });

    itemState.specifics.forEach(specLine => {
        const tr = ce('tr');
        table.appendChild(tr);

        const td = ce('td');
        tr.appendChild(td);

        const datasetParams: WowheadDataset = {};
        if (item.id === ITEM_PET_CAGE) {
            // Build our own damn tooltip, with stats.
            let finalStats;
            try {
                finalStats = item.battlePetStats && getBattlePetStats(item.battlePetStats, specLine.modifiers);
            } catch (e) {
                console.debug("Could not get battle pet stats", item.battlePetStats, specLine.modifiers);
            }

            if (finalStats) {
                const quality = specLine.modifiers[Items.Modifier.BattlePetQuality];
                const level = specLine.modifiers[Items.Modifier.BattlePetLevel];
                const battlePetType = item.battlePetType ?? 0;

                let tooltip = ce('div');
                tooltip.appendChild(ce('b', {className: 'q' + quality}, ct(item.name)));
                tooltip.appendChild(ce('br'));
                let flexParent = ce('div', {className: 'battle-pet-tooltip'});
                tooltip.appendChild(flexParent);
                let flexLeft = ce('div');
                flexParent.appendChild(flexLeft);
                let flexRight = ce('div');
                flexParent.appendChild(flexRight);

                flexLeft.appendChild(ct('Battle Pet'));
                flexLeft.appendChild(ce('br'));
                flexLeft.appendChild(ct('Level ' + level));
                flexLeft.appendChild(ce('br'));
                flexLeft.appendChild(ce('img', {src: 'images/bpet-stamina.png'}));
                flexLeft.appendChild(ct(`${finalStats.stamina}`));
                flexLeft.appendChild(ce('br'));
                flexLeft.appendChild(ce('img', {src: 'images/bpet-power.png'}));
                flexLeft.appendChild(ct(`${finalStats.power}`));
                flexLeft.appendChild(ce('br'));
                flexLeft.appendChild(ce('img', {src: 'images/bpet-speed.png'}));
                flexLeft.appendChild(ct(`${finalStats.speed}`));

                flexRight.appendChild(ct(Categories.getBattlePetTypeName(battlePetType) ?? ''));
                flexRight.appendChild(ce('br'));
                flexRight.appendChild(ce('img', {
                    src: `https://wow.zamimg.com/images/pets/types-circle/original/${battlePetType}.png`,
                }));

                datasetParams.simpleTooltip = tooltip.innerHTML;
            }
        } else {
            const wowheadParams: string[] = [];
            wowheadParams.push('item=' + item.id);
            wowheadParams.push('domain=' + getWowheadDomain());
            if (specLine.bonuses.length) {
                wowheadParams.push('bonus=' + specLine.bonuses.join(':'));
            }
            let lvl = specLine.modifiers[Items.Modifier.TypeTimewalkerLevel];
            if (lvl) {
                wowheadParams.push('lvl=' + lvl);
            }
            if (item.bonusLevel) {
                wowheadParams.push('ilvl=' + item.bonusLevel);
            }
            const craftedStats = [];
            if (specLine.modifiers[Items.Modifier.TypeCraftingStat1]) {
                craftedStats[0] = specLine.modifiers[Items.Modifier.TypeCraftingStat1];
            }
            if (specLine.modifiers[Items.Modifier.TypeCraftingStat2]) {
                let stat2 = specLine.modifiers[Items.Modifier.TypeCraftingStat2];
                if (!craftedStats.length) {
                    craftedStats.push(0);
                }
                craftedStats[1] = stat2;
            }
            if (craftedStats.length) {
                wowheadParams.push('crafted-stats=' + craftedStats.join(':'));
            }
            if (specLine.modifiers[Items.Modifier.TypeCraftingQuality]) {
                wowheadParams.push('crafting-quality=' + specLine.modifiers[Items.Modifier.TypeCraftingQuality]);
            }

            datasetParams.wowhead = wowheadParams.join('&');
        }

        const a = ce('a', {dataset: datasetParams});

        const statIcons = ce('span');
        specLine.stats
            .sort((a, b) => a - b)
            .forEach(stat => {
                const iconName = STAT_TO_ICON[stat];
                if (!iconName) {
                    return;
                }

                const icon = ce('span', {className: 'icon'});
                icon.style.backgroundImage = 'url("' + Items.getIconUrl(iconName, Items.IconSize.Medium) + '")';

                statIcons.appendChild(icon);
            });
        switch (statIcons.children.length) {
            case 0:
                break;
            case 1:
                statIcons.firstChild && a.appendChild(statIcons.firstChild);
                break;
            default:
                a.appendChild(statIcons);
        }

        a.appendChild(ce('span', {}, priceElement(specLine.price)));

        td.appendChild(a);
    });
}

/**
 * Populate the empty details panel for the given item.
 */
async function populateDetails(item: Types.Item, itemState: Types.ItemState) {
    const parent = qs('.main .main-result .item .details') as HTMLDivElement;
    const scroller = ce('div', {className: 'scroller'});
    parent.appendChild(scroller);
    scroller.scrollTop = 0;

    await waitForHighstock();

    if (!my.everScrolled) {
        let indicator = makeScrollIndicator();
        scroller.appendChild(indicator);
        let hideIndicator = () => {
            indicator.dataset.hidden = '1';
            my.everScrolled = true;
            scroller.removeEventListener('scroll', hideIndicator);
        };
        scroller.addEventListener('scroll', hideIndicator);
    }

    const MIN_SNAPSHOT_COUNT = 6;

    const days = itemState.snapshots.length ? Math.round(
        (itemState.snapshots[itemState.snapshots.length - 1].snapshot - itemState.snapshots[0].snapshot) /
        MS_DAY
    ) : 0;
    const realmName = itemState.realm.name;
    const regionName = itemState.realm.region.toUpperCase();

    const houseName = (item.stack ?? 0) > 1 ? `${regionName} realms` : realmName;

    // Name panel
    let itemName;
    {
        let wowheadParams: string[] = [];

        const namePanel = ce('span', {
            className: 'title q' + item.quality,
        });
        scroller.appendChild(namePanel);

        const icon = ce('span', {className: 'icon', dataset: {quality: item.quality}});
        icon.style.backgroundImage = 'url("' + Items.getIconUrl(item.icon, Items.IconSize.Large) + '")';
        namePanel.appendChild(icon);

        // Model
        if (item.display) {
            let url = 'https://wow.zamimg.com/modelviewer/live/webthumbs/' +
                (item.id === ITEM_PET_CAGE ? 'npc' : 'item') + '/' +
                (item.display & 0xFF) + '/' + item.display;
            const pic = ce('picture', {className: 'model-thumbnail'});
            pic.appendChild(ce('source', {
                srcset: url + '.webp',
                type: 'image/webp',
            }));
            pic.appendChild(ce('img', {
                src: url + '.png',
            }));

            icon.addEventListener('mouseover', event => WH.Tooltips.showAtCursor(event, pic.outerHTML));
            icon.addEventListener('mousemove', WH.Tooltips.cursorUpdate);
            icon.addEventListener('mouseout', WH.Tooltips.hide);
        }

        itemName = item.name;
        if (item.bonusSuffix) {
            let suffix = Items.getSuffix(item.id, item.bonusSuffix);
            if (suffix) {
                itemName += ' ' + suffix.name;
                if (suffix.bonus) {
                    wowheadParams.push('bonus=' + suffix.bonus);
                }
            }
        }
        if (item.id !== ITEM_PET_CAGE && item.bonusLevel) {
            itemName += ' (' + item.bonusLevel + ')';
            wowheadParams.push('ilvl=' + item.bonusLevel);
        }
        const nameLink = ce('a', {}, ct(itemName));
        namePanel.appendChild(nameLink);

        if (item.id === ITEM_PET_CAGE) {
            nameLink.href = 'https://www.wowhead.com/' + getWowheadPathPrefix() + 'npc=' + item.npc;
        } else {
            nameLink.href = 'https://www.wowhead.com/' + getWowheadPathPrefix() + 'item=' + item.id;
        }
        nameLink.href += '/' + item.name
            .replace(/%\w|['#]|^\s*|\s*$/g, '')
            .replace(/ \/ |_|[^\u00C0-\u1FFF\u2C00-\uD7FF\w]+/g, '-')
            .toLocaleLowerCase()
            .replace(/-{2,}/g, '-')
            .replace(/^-+|-+$/g, '');
        if (wowheadParams.length) {
            nameLink.dataset.wowhead = wowheadParams.join('&');
        }

        if (item.craftingQualityId) {
            const craftingQuality = Items.getCraftingQuality(item.craftingQualityId);
            if (craftingQuality?.iconUrl) {
                nameLink.appendChild(ce('img', {
                    className: 'quality-tier',
                    src: craftingQuality?.iconUrl,
                }));
            }
        }

        // Favstar
        let itemKey = Items.stringifyKeyParts(item.id, item.bonusLevel, item.bonusSuffix);
        let favSpan = document.createElement('span');
        favSpan.className = 'favorite';
        if (Search.getFavorites().includes(itemKey)) {
            favSpan.dataset.favorite = '1';
        }
        favSpan.addEventListener('click', Search.toggleFavorite.bind(self, itemKey, favSpan));
        namePanel.appendChild(favSpan);
    }

    const sectionParent = ce('div', {className: 'section-parent'});
    scroller.appendChild(sectionParent);

    let regionElements: Record<string, HTMLElement> = {};
    let afterList: () => void;

    // Stats
    (() => {
        const statsPanel = ce('div', {className: 'base-stats framed', dataset: {sectionKey: 'base-stats'}});
        sectionParent.appendChild(statsPanel);

        statsPanel.appendChild(ce('span', {className: 'frame-title'}, ct('Base Stats')));

        const table = ce('table');
        statsPanel.appendChild(table);

        if ((item.stack ?? 0) > 1) {
            table.classList.add('hidden-region-details');
        }

        let tr;

        table.appendChild(tr = ce('tr', {className: 'header'}));
        tr.appendChild(ce('td'));
        tr.appendChild(ce('td', {}, ct(houseName)));
        tr.appendChild(ce('td', {}, ct(`${regionName} realms`)));

        table.appendChild(tr = ce('tr'));
        tr.appendChild(ce('td', {}, ct('Available')));
        tr.appendChild(ce('td', {
            dataset: {simpleTooltip: `Total quantity for sale on ${houseName} right now.`}
        }, ct(itemState.quantity.toLocaleString())));
        tr.appendChild(regionElements.quantity = ce('td', {
            dataset: {simpleTooltip: 'Total quantity for sale in all ' + regionName + ' realms right now.'}
        }));

        if (!itemState.quantity) {
            table.appendChild(tr = ce('tr'));
            tr.appendChild(ce('td', {}, ct('Last Seen')));
            tr.appendChild(ce('td', {}, ce('span', {className: 'delta-timestamp', dataset: {timestamp: itemState.snapshot}})));
            tr.appendChild(ce('td'));
        }

        table.appendChild(tr = ce('tr'));
        tr.appendChild(ce('td', {}, ct('Current')));
        tr.appendChild(ce('td', {
            dataset: {simpleTooltip: `Lowest price on ${houseName} right now.`}
        }, itemState.price ? priceElement(itemState.price) : undefined));
        tr.appendChild(regionElements.current = ce('td', {
            dataset: {simpleTooltip: 'Lowest price among all ' + regionName + ' realms right now.'}
        }));

        let prices: Types.Money[] = [];
        itemState.snapshots.forEach(snapshot => {
            if (snapshot.price > 0) {
                prices.push(snapshot.price);
            }
        });
        prices.sort((a, b) => a - b);

        let realmElements: Record<string, HTMLElement> = {};

        table.appendChild(tr = ce('tr'));
        tr.appendChild(ce('td', {}, ct('Median')));
        tr.appendChild(realmElements.median = ce('td', {
            dataset: {simpleTooltip: `Median price on ${houseName} over the past ${days} days.`}
        }));
        tr.appendChild(regionElements.median = ce('td', {
            dataset: {simpleTooltip: 'Median price among all ' + regionName + ' realms right now.'}
        }));

        table.appendChild(tr = ce('tr'));
        tr.appendChild(ce('td', {}, ct('Mean')));
        tr.appendChild(realmElements.mean = ce('td', {
            dataset: {simpleTooltip: `Mean (average) price on ${houseName} over the past ${days} days.`}
        }));
        tr.appendChild(regionElements.mean = ce('td', {
            dataset: {simpleTooltip: 'Mean (average) price among all ' + regionName + ' realms right now.'}
        }));

        if (prices.length >= MIN_SNAPSHOT_COUNT) {
            let statistics = getStatistics(prices);
            realmElements.median.appendChild(priceElement(statistics.median));
            realmElements.mean.appendChild(priceElement(statistics.mean));
        }

        const vendorSell = Items.getVendorSellPrice(item);
        if (vendorSell >= 100) {
            table.appendChild(tr = ce('tr'));
            tr.appendChild(ce('td', {}, ct('Vendor Sell')));
            tr.appendChild(ce('td', {
                dataset: {simpleTooltip: 'The amount you get when selling this item to a vendor.'}
            }, priceElement(vendorSell)));
            tr.appendChild(ce('td'));
        }

        if (item.vendorBuy) {
            table.appendChild(tr = ce('tr'));
            tr.appendChild(ce('td', {}, ct('Vendor Buy')));
            tr.appendChild(ce('td', {
                dataset: {simpleTooltip: 'The amount you pay when buying this item from a vendor.'}
            }, priceElement(Math.max(100, item.vendorBuy))));
            tr.appendChild(ce('td'));
        }
    })();

    /**
     * Renders a chart of summary lines.
     */
    let showPriceChart = function (
        snapshotList: Types.SummaryLine[],
        strings: Record<string, string>,
        // True if the snapshot list includes hourly data, false for daily data.
        withTimes: boolean,
        chartContainer?: HTMLDivElement,
    ): HTMLDivElement|undefined {
        // Chart container
        if (!chartContainer) {
            chartContainer = ce('div');
            sectionParent.appendChild(chartContainer);
        }
        chartContainer.classList.add('highcharts-container', 'framed');
        chartContainer.appendChild(ce('span', {className: 'frame-title'}, ct(strings.title)));

        if (strings.caption) {
            chartContainer.appendChild(ce('div', {className: 'caption'}, ct(strings.caption)));
        }

        // Highchart parent.
        const highchartParent = ce('div', {className: 'chart-wrapper'});
        chartContainer.appendChild(highchartParent);

        const addAxisLabels = highchartParent.clientWidth >= 600;

        // Determine scaling
        let maxPrice = 0;
        let maxQuantity = 0;
        let firstTimestamp = Date.now();
        let lastTimestamp = 0;
        let priceData: [snapshot: Types.Timestamp, price: Types.Money][] = [];
        let quantityData: [snapshot: Types.Timestamp, quantity: number][] = [];
        {
            let prices: Types.Money[] = [];
            snapshotList.forEach(snapshot => {
                maxPrice = Math.max(maxPrice, snapshot.price);
                maxQuantity = Math.max(maxQuantity, snapshot.quantity);
                firstTimestamp = Math.min(firstTimestamp, snapshot.snapshot);
                lastTimestamp = Math.max(lastTimestamp, snapshot.snapshot);
                if (snapshot.price > 0) {
                    prices.push(snapshot.price);
                }
                priceData.push([snapshot.snapshot, snapshot.price]);
                quantityData.push([snapshot.snapshot, snapshot.quantity]);
            });
            if (maxPrice === 0) {
                return;
            }

            prices.sort((a, b) => a - b);
            let p95 = prices[Math.floor(prices.length * 0.95)];

            maxPrice = Math.min(maxPrice, p95 * 1.1);
        }

        const priceFormatter = (point: {value: Types.Money}): string => {
            let money = point.value / COPPER_SILVER;
            let suffix = 's';
            if (money >= (COPPER_GOLD / COPPER_SILVER)) {
                money /= (COPPER_GOLD / COPPER_SILVER);
                suffix = 'g';
            }
            if (money > 1000) {
                money /= 1000;
                suffix = 'k';
            }
            if (money > 1000) {
                money /= 1000;
                suffix = 'm';
            }
            if (suffix !== 's' && money < 10) {
                return money.toPrecision(2) + suffix;
            } else {
                return `${Math.round(money)}${suffix}`;
            }
        };
        const dateFormatter = new Intl.DateTimeFormat([], withTimes ? {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            timeZoneName: 'short',
        } : {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
        });

        const labelFormatter = {
            minute: new Intl.DateTimeFormat([], {
                month: 'numeric',
                day: 'numeric',
                hour: 'numeric',
            }),
            day: new Intl.DateTimeFormat([], {
                month: 'short',
                day: 'numeric',
            }),
            month: new Intl.DateTimeFormat([], {
                year: 'numeric',
                month: 'short',
            }),
        };

        const priceSeries = {
            data: priceData,
            fillColor: 'rgba(136,136,255,0.5)',
            lineColor: '#8888FF',
            marker: {
                states: {
                    hover: {
                        fillColor: '#8888FF',
                    },
                },
            },
            name: strings.price,
            type: 'area',
            zIndex: 5,
        };
        const quantitySeries = {
            data: quantityData,
            lineColor: '#BB5555',
            marker: {
                states: {
                    hover: {
                        fillColor: '#FF8888',
                    },
                },
            },
            name: strings.quantity,
            type: 'line',
            yAxis: 1,
            zIndex: 10,
        };

        Highcharts.stockChart(highchartParent, {
            accessibility: {enabled: false},
            chart: {
                backgroundColor: 'rgba(0,0,0,0)',
                height: withTimes ? 325 : 400,
                style: {
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                },
                zoomType: 'x',
            },
            credits: {
                style: {
                    color: '#888',
                },
            },
            legend: {enabled: false},
            navigator: {
                enabled: !withTimes,
                outlineWidth: 0,
                series: priceSeries,
                xAxis: {
                    visible: false,
                },
                yAxis: {
                    max: maxPrice,
                    min: 0,
                },
            },
            plotOptions: {
                series: {
                    lineWidth: 2,
                    marker: {
                        enabled: false,
                        radius: 3,
                        states: {
                            hover: {
                                enabled: true,
                            },
                        },
                    },
                    states: {
                        hover: {
                            lineWidth: 2,
                        },
                    },
                },
            },
            rangeSelector: {
                buttons: [
                    {type: 'week', count: 2, text: '2w'},
                    {type: 'month', count: 1, text: '1m'},
                    {type: 'month', count: 3, text: '3m'},
                    {type: 'month', count: 6, text: '6m'},
                    {type: 'year', count: 1, text: '1y'},
                    {type: 'all', text: 'All'},
                ],
                enabled: !withTimes,
                inputStyle: {
                    color: '#CCCCCC',
                },
                selected: withTimes ? 5 : 4,
            },
            scrollbar: {
                // middle button
                barBackgroundColor: '#4a4644',
                barBorderRadius: 4,
                barBorderWidth: 0,

                // Left/right arrow buttons
                buttonArrowColor: 'rgba(0,0,0,0)',
                buttonBackgroundColor: 'rgba(0,0,0,0)',
                buttonBorderWidth: 0,

                rifleColor: 'rgba(0,0,0,0)',

                //showFull: false,

                // under all buttons
                trackBackgroundColor: 'rgba(0,0,0,0)',
                trackBorderColor: '#393433',
                trackBorderRadius: 4,
                trackBorderWidth: 1,
            },
            series: [quantitySeries, priceSeries],
            time: {useUTC: !withTimes},
            title: {text: undefined},
            tooltip: {
                backgroundColor: '#282322',
                borderColor: '#777',
                borderRadius: 4,
                formatter: function (this: {x: number, points: {x: number, y: number}[]}) {
                    const result = ce('div');
                    result.appendChild(ct(dateFormatter.format(new Date(this.x))));

                    if (this.points[1].y) {
                        result.appendChild(ce('br'));
                        result.appendChild(ce(
                            'span',
                            {style: {color: '#8888FF'}},
                            ct((strings.priceTooltip || strings.price) + ': ')
                        ));
                        result.appendChild(ct((this.points[1].y / COPPER_GOLD).toFixed(2) + 'g'));
                    }

                    result.appendChild(ce('br'));
                    result.appendChild(ce(
                        'span',
                        {style: {color: '#DD6666'}},
                        ct((strings.quantityTooltip || strings.quantity) + ': ')
                    ));
                    result.appendChild(ct(this.points[0].y.toLocaleString()));

                    return result.innerHTML;
                },
                shared: true,
                style: {
                    color: '#EEEEEE',
                    fontFamily: '"Friz Quadrata TT", sans-serif',
                    fontSize: '14px',
                    lineHeight: '20px',
                }
            },
            xAxis: {
                labels: {
                    formatter: (context: {value: number, tickPositionInfo: {unitName: string}}) => ({
                        second: labelFormatter.minute.format(new Date(context.value)),
                        minute: labelFormatter.minute.format(new Date(context.value)),
                        hour: labelFormatter.minute.format(new Date(context.value)),
                        day: labelFormatter.day.format(new Date(context.value)),
                        week: labelFormatter.day.format(new Date(context.value)),
                        month: labelFormatter.month.format(new Date(context.value)),
                        year: Highcharts.dateFormat('%Y', context.value),
                    }[context.tickPositionInfo.unitName].replace(/\s/g, NBSP)),
                    style: {
                        color: '#CCCCCC',
                        fontSize: 'inherit',
                    },
                },
                lineColor: '#393433',
                lineWidth: 1,
                minRange: 4 * MS_HOUR,
                tickColor: '#393433',
                type: 'datetime',
            },
            yAxis: [{
                gridLineColor: '#393433',
                labels: {
                    enabled: addAxisLabels,
                    formatter: priceFormatter,
                    style: {
                        color: '#CCCCCC',
                        fontSize: 'inherit',
                    },
                },
                max: maxPrice,
                min: 0,
                opposite: false,
                title: {
                    style: {
                        color: '#8888FF',
                    },
                    text: addAxisLabels ? strings.price : undefined,
                },
            }, {
                gridLineWidth: 0,
                labels: {
                    enabled: addAxisLabels,
                    formatter: (point: {value: number}) => point.value.toLocaleString(),
                    style: {
                        color: '#CCCCCC',
                        fontSize: 'inherit',
                    },
                },
                max: maxQuantity,
                min: 0,
                opposite: true,
                title: {
                    style: {
                        color: '#BB5555',
                    },
                    text: addAxisLabels ? strings.quantity : undefined,
                },
            }],
        });

        return chartContainer;
    };

    // Price charts
    if (itemState.snapshots.length >= MIN_SNAPSHOT_COUNT) {
        (showPriceChart(itemState.snapshots, {
            title: `Snapshots for ${houseName}`,
            caption: `This shows the lowest price and total quantity available of ${itemName} on ${houseName} every hour for the past few weeks.`,
            price: 'Lowest Price',
            quantity: 'Total Quantity',
        }, true) ?? ce('div')).dataset.sectionKey = 'snapshots';

        // Heat Map
        {
            let mapContainer = ce('div', {className: 'heat-container framed', dataset: {sectionKey: 'heat'}});
            sectionParent.appendChild(mapContainer);

            mapContainer.appendChild(ce('span', {className: 'frame-title'}, ct(`Hourly Heat Maps for ${houseName}`)));

            let startFrom = new Date();
            startFrom.setDate(startFrom.getDate() - 7);
            startFrom.setHours(0, 0, 0, 0);

            mapContainer.appendChild(ce('div', {className: 'caption'}, ct(`These heat maps show the lowest price and total quantity available of ${itemName} on ${houseName} each hour for the past week. Using your browser's time zone of ` +
                (new Intl.DateTimeFormat([], {year: 'numeric', timeZoneName: 'short'})).format(startFrom).replace(new RegExp('\\W*' + startFrom.getFullYear() + '\\W*'), '') + '.')));

            let dayFormatter = new Intl.DateTimeFormat([], {day: 'numeric', weekday: 'short'});

            type DayData = {
                name: string;
                date: number;
                prices: Array<Types.Money|undefined>;
                quantities: Array<number|undefined>;
            };

            let day = new Date(startFrom);
            let now = new Date();
            let days: DayData[] = [];
            let dayIndexes: Record<number, number> = {};
            while (day < now) {
                days.push({
                    name: dayFormatter.format(day),
                    date: day.getDate(),
                    prices: ([] as undefined[]).fill(undefined, 0, 23),
                    quantities: ([] as undefined[]).fill(undefined, 0, 23),
                });
                dayIndexes[day.getDate()] = days.length - 1;
                day.setDate(day.getDate() + 1);
            }
            itemState.snapshots
                .filter(summaryLine => summaryLine.snapshot >= startFrom.valueOf())
                .forEach(summaryLine => {
                    let now = new Date(summaryLine.snapshot);
                    let dayIndex = dayIndexes[now.getDate()];
                    if (dayIndex != null) {
                        days[dayIndex].prices[now.getHours()] = summaryLine.price;
                        days[dayIndex].quantities[now.getHours()] = summaryLine.quantity;
                    }
                });

            let prices: Types.Money[] = [];
            let quantities: number[] = [];
            days.forEach(day => {
                day.prices.forEach(amount => amount && prices.push(amount));
                day.quantities.forEach(amount => amount && quantities.push(amount));
            });
            prices.sort((a, b) => a - b);
            quantities.sort((a, b) => a - b);
            let priceMin = prices.length ? prices[Math.floor(prices.length * 0.15)] : 0;
            let priceMax = prices.length ? prices[Math.floor(prices.length * 0.85)] : 0;
            let quantityMin = quantities.length ? quantities[Math.floor(quantities.length * 0.15)] : 0;
            let quantityMax = quantities.length ? quantities[Math.floor(quantities.length * 0.85)] : 0;

            {
                let tableWrapper = ce('div', {className: 'table-wrapper'});
                mapContainer.appendChild(tableWrapper);

                let table = ce('table');
                tableWrapper.appendChild(table);

                let cellProperties = {};
                days.forEach(day => {
                    let tr = ce('tr', {}, ce('td', {}, ct(day.name.replace(/\s+/g, NBSP))));
                    table.appendChild(tr);
                    for (let hour = 0; hour < 24; hour++) {
                        let text = '';
                        let copper = day.prices[hour];
                        if (copper) {
                            let percentage = 1;
                            if (priceMin !== priceMax) {
                                percentage = (copper - priceMin) / (priceMax - priceMin);
                                percentage = Math.min(1, Math.max(0, percentage));
                            }
                            cellProperties = {style: {backgroundColor: 'rgba(136, 136, 255, ' + (percentage * 0.5 + 0.1) + ')'}};

                            let money = copper / COPPER_SILVER;
                            let suffix = 's';
                            if (money >= (COPPER_GOLD / COPPER_SILVER)) {
                                money /= (COPPER_GOLD / COPPER_SILVER);
                                suffix = 'g';
                            }
                            if (money > 1000) {
                                money /= 1000;
                                suffix = 'k';
                            }
                            if (money > 1000) {
                                money /= 1000;
                                suffix = 'm';
                            }
                            if (suffix !== 's' && money < 10) {
                                text = money.toPrecision(2) + suffix;
                            } else {
                                text = `${Math.round(money)}${suffix}`;
                            }
                        }
                        tr.appendChild(ce('td', cellProperties, ct(text)));
                    }
                });

                let timeFormatter = Intl.DateTimeFormat([], {hour: 'numeric', timeZone: 'UTC'});
                let tr = ce('tr', {}, ce('td'));
                table.appendChild(tr);
                for (let hour = 0; hour < 24; hour++) {
                    tr.appendChild(ce('td', {}, ct(timeFormatter.format(new Date(hour * MS_HOUR)).toLowerCase().replace(/\s+/g, ''))));
                }
            }

            {
                let tableWrapper = ce('div', {className: 'table-wrapper', dataset: {type: 'quantity'}});
                mapContainer.appendChild(tableWrapper);

                let table = ce('table');
                tableWrapper.appendChild(table);

                let cellProperties = {};
                days.forEach(day => {
                    let tr = ce('tr', {}, ce('td', {}, ct(day.name.replace(/\s+/g, NBSP))));
                    table.appendChild(tr);
                    for (let hour = 0; hour < 24; hour++) {
                        let text = '';
                        let amount = day.quantities[hour];
                        if (amount != null) {
                            let percentage = 1;
                            if (quantityMin !== quantityMax) {
                                percentage = (amount - quantityMin) / (quantityMax - quantityMin);
                                percentage = Math.min(1, Math.max(0, percentage));
                            }
                            cellProperties = {style: {backgroundColor: 'rgba(255, 136, 136, ' + (percentage * 0.5 + 0.1) + ')'}};

                            let scaled = amount;
                            let suffix = '';
                            if (scaled > 1000) {
                                scaled /= 1000;
                                suffix = 'k';
                            }
                            if (scaled > 1000) {
                                scaled /= 1000;
                                suffix = 'm';
                            }
                            if (suffix !== '' && scaled < 10) {
                                text = scaled.toPrecision(2) + suffix;
                            } else {
                                text = Math.round(scaled) + suffix;
                            }
                        }
                        tr.appendChild(ce('td', cellProperties, ct(text)));
                    }
                });

                let timeFormatter = Intl.DateTimeFormat([], {hour: 'numeric', timeZone: 'UTC'});
                let tr = ce('tr', {}, ce('td'));
                table.appendChild(tr);
                for (let hour = 0; hour < 24; hour++) {
                    tr.appendChild(ce('td', {}, ct(timeFormatter.format(new Date(hour * MS_HOUR)).toLowerCase().replace(/\s+/g, ''))));
                }
            }
        }
    }
    const showDailyChart = (data: Types.SummaryLine[], strings: Record<string, string>, target?: HTMLDivElement) => {
        let minDays = 15;
        let minPoints = MIN_SNAPSHOT_COUNT;

        let days = !data.length ? 0 :
            (Math.round((data[data.length - 1].snapshot - data[0].snapshot) / MS_DAY) + 1);
        if (days >= minDays && data.length >= minPoints) {
            return showPriceChart(data, strings, false, target);
        }

        return ce('div');
    }
    (showDailyChart(itemState.daily, {
        title: `Daily History for ${houseName}`,
        caption: `This shows the maximum observed available quantity, and the lowest price at that time, of ${itemName} on ${houseName} each day.`,
        price: 'Price at Max Quantity',
        priceTooltip: 'Price at Max Qty',
        quantity: 'Max Quantity',
    }) ?? ce('div')).dataset.sectionKey = 'daily';

    // Quantity calc
    if (itemState.auctions.length) {
        const quantityPanel = ce('div', {className: 'quantity-calc framed', dataset: {sectionKey: 'bulk'}});
        sectionParent.appendChild(quantityPanel);

        quantityPanel.appendChild(ce('span', {className: 'frame-title'}, ct('Bulk Pricing')));

        const table = ce('table');
        quantityPanel.appendChild(table);

        let tr: HTMLElement;
        let td: HTMLElement;

        table.appendChild(tr = ce('tr'));
        tr.appendChild(td = ce('td'));
        td.appendChild(ct('Quantity'));
        tr.appendChild(td = ce('td'));
        const input = ce('input', {type: 'text', value: 1});
        td.appendChild(input);

        table.appendChild(tr = ce('tr'));
        tr.appendChild(td = ce('td'));
        td.appendChild(ct('Unit Price'));
        const unitPriceTarget = ce('td');
        tr.appendChild(unitPriceTarget);

        table.appendChild(tr = ce('tr'));
        tr.appendChild(td = ce('td'));
        td.appendChild(ct('Total Price'));
        const totalPriceTarget = ce('td');
        tr.appendChild(totalPriceTarget);

        const validateAndRun = () => {
            let quantity = 0;
            let price = 0;
            if (input.value !== '') {
                if (/\D/.test(input.value)) {
                    input.value = input.value.replace(/\D+/g, '');
                }
                quantity = parseInt(input.value);
                if (quantity > itemState.quantity) {
                    quantity = itemState.quantity;
                    input.value = `${quantity}`;
                }
            }

            const auctionsTable = qs('.main .main-result .item .auctions table') as HTMLTableElement;
            (auctionsTable.querySelectorAll('tr[data-selected]') as NodeListOf<HTMLTableRowElement>).forEach(tr => {
                delete tr.dataset.selected;
            });

            let qtyRemaining = quantity;
            const rows = auctionsTable.querySelectorAll('tr') as NodeListOf<HTMLTableRowElement>;
            for (let row, index = 0; (qtyRemaining > 0) && (row = rows[index]); index++) {
                let aucPrice = parseInt(row.dataset.price ?? '0');
                let aucQty = parseInt(row.dataset.quantity ?? '0');
                if (aucQty <= qtyRemaining) {
                    price += aucPrice * aucQty;
                    qtyRemaining -= aucQty;
                    row.dataset.selected = 'full';
                } else {
                    price += aucPrice * qtyRemaining;
                    qtyRemaining = 0;
                    row.dataset.selected = 'part';
                }
            }

            ee(totalPriceTarget);
            ee(unitPriceTarget);
            if (!price) {
                return;
            }

            totalPriceTarget.appendChild(priceElement(price));
            unitPriceTarget.appendChild(priceElement(Math.round(price / quantity / 100) * 100));
        };
        input.addEventListener('keyup', validateAndRun);
        input.addEventListener('change', validateAndRun);
        validateAndRun();
    }

    updateDeltaTimestamps();

    if ((item.stack ?? 0) > 1) {
        makeSectionControls(sectionParent);

        return;
    }

    const regionalDailyHistoryContainer = ce('div', {dataset: {sectionKey: 'regional-daily'}});
    sectionParent.appendChild(regionalDailyHistoryContainer);

    // Create the "Current Regional Prices" bar chart area and data list.
    let otherRealmsChart: HTMLDivElement;
    (() => {
        // Both the bar chart and the list are in this topContainer.
        const topContainer = ce('div', {
            className: 'other-realms-container framed',
            dataset: {sectionKey: 'other-realms'},
        });
        sectionParent.appendChild(topContainer);

        // Add a title above this bar chart.
        topContainer.appendChild(ce('span', {className: 'frame-title'}, ct(`Current Regional Prices for ${regionName} realms`)));

        topContainer.appendChild(ce('div', {className: 'caption'}, ct(`This chart, and the following list, show the current price and available quantity of ${itemName} on each ${regionName} realm. The dashed line shows ${realmName}.`)));

        // Create the bar chart.
        otherRealmsChart = ce('div', {className: 'other-realms-bars chart-wrapper'});
        topContainer.appendChild(otherRealmsChart);
        otherRealmsChart.appendChild(ce('div', {className: 'bar-section price-bars'}));
        otherRealmsChart.appendChild(ce('div', {className: 'bar-section quantity-bars'}));
        otherRealmsChart.appendChild(ce('div', {className: 'bar-section links'}));

        // Create the list container header. ("Include Connected Realms")
        const otherRealmsContainer = ce('div', {className: 'check-container'});
        topContainer.appendChild(otherRealmsContainer);
        const otherRealmsLabel = ce('label', {}, ct('Include Connected Realms'));
        otherRealmsContainer.appendChild(otherRealmsLabel);
        const otherRealmsControl = ce('input', {type: 'checkbox'});
        otherRealmsLabel.appendChild(otherRealmsControl);

        // Create the list.
        const list = ce('div', {
            className: 'list',
        });
        topContainer.appendChild(list);

        const COL_POS_NAME = 1;
        const COL_POS_PRICE = 3;
        const COL_POS_QUANTITY = 4;

        /**
         * Sorts the result table by the given column.
         */
        const columnSort = function (
            // The header table cell for the column to sort.
            headerTd: HTMLTableCellElement,
            // True when this column has string values.
            isString: boolean,
        ) {
            let dir = 'asc';
            if (headerTd.dataset.sort === 'asc') {
                dir = 'desc';
            }

            const headerTr = headerTd.parentNode as HTMLTableRowElement;
            const headerTds = headerTr.querySelectorAll('td') as NodeListOf<HTMLTableCellElement>;
            const sortCol = parseInt(headerTd.dataset.sortCol ?? '0');
            let columnPos = 0;
            for (let x = 0; x < headerTds.length; x++) {
                delete headerTds[x].dataset.sort;
                if (headerTds[x] === headerTd) {
                    columnPos = x + 1;
                }
            }

            try {
                localStorage.setItem('other-realms-sort', `${sortCol * (dir === 'desc' ? -1 : 1)}`);
            } catch (e) {
                // Ignore
            }

            headerTd.dataset.sort = dir;
            let table = headerTr.closest('table') as HTMLTableElement;
            let rows = Array.from(table.querySelectorAll('tbody tr')) as HTMLTableRowElement[];
            rows.sort(function (a, b) {
                // **Always** sort 0-quantity rows at the end, except for realm name sort.
                if (columnPos !== COL_POS_NAME) {
                    const aZero = (a.querySelector(`td:nth-child(${COL_POS_QUANTITY})`) as HTMLTableCellElement).dataset.sortValue === '0';
                    const bZero = (b.querySelector(`td:nth-child(${COL_POS_QUANTITY})`) as HTMLTableCellElement).dataset.sortValue === '0';

                    if (aZero && !bZero) {
                        return 1;
                    }
                    if (!aZero && bZero) {
                        return -1;
                    }
                }

                const reversed = dir === 'desc' ? -1 : 1;
                const aTd = (a.querySelector('td:nth-child(' + columnPos + ')') as HTMLTableCellElement);
                const bTd = (b.querySelector('td:nth-child(' + columnPos + ')') as HTMLTableCellElement);

                const aVal = aTd.dataset.sortValue ?? ''
                const bVal = bTd.dataset.sortValue ?? '';

                if (isString) {
                    return reversed * aVal.localeCompare(bVal);
                }

                const valDiff = parseInt(aVal) - parseInt(bVal);
                if (valDiff) {
                    return reversed * valDiff;
                }

                if (aTd.dataset.sortValue2 && bTd.dataset.sortValue2) {
                    const valDiff = parseInt(aTd.dataset.sortValue2) - parseInt(bTd.dataset.sortValue2);
                    if (valDiff) {
                        return reversed * valDiff;
                    }
                }

                // Fallbacks.
                if (columnPos !== COL_POS_PRICE) {
                    const aPrice = (a.querySelector('td:nth-child(' + COL_POS_PRICE + ')') as HTMLTableCellElement).dataset.sortValue ?? '';
                    const bPrice = (b.querySelector('td:nth-child(' + COL_POS_PRICE + ')') as HTMLTableCellElement).dataset.sortValue ?? '';

                    const valDiff = parseInt(aPrice) - parseInt(bPrice);
                    if (valDiff) {
                        return valDiff;
                    }
                }

                if (columnPos !== COL_POS_NAME) {
                    const aName = (a.querySelector('td:nth-child(' + COL_POS_NAME + ')') as HTMLTableCellElement).dataset.sortValue ?? '';
                    const bName = (b.querySelector('td:nth-child(' + COL_POS_NAME + ')') as HTMLTableCellElement).dataset.sortValue ?? '';

                    const valDiff = aName.localeCompare(bName);
                    if (valDiff) {
                        return valDiff;
                    }
                }

                return 0;
            });

            rows.forEach(function (row) {
                row.parentNode?.appendChild(row);
            });
        }

        const table = ce('table');
        list.appendChild(table);
        const thead = ce('thead');
        table.appendChild(thead);
        const tbody = ce('tbody');
        table.appendChild(tbody);

        const tr = ce('tr');
        thead.appendChild(tr);

        let td: HTMLTableCellElement;
        tr.appendChild(td = ce('td', {dataset: {sortCol: '1'}}, ct('Realm')));
        td.addEventListener('click', columnSort.bind(null, td, true));
        tr.appendChild(td = ce('td', {dataset: {sortCol: '4'}}, ct('Pop')));
        td.addEventListener('click', columnSort.bind(null, td, false));
        tr.appendChild(td = ce('td', {dataset: {sortCol: '2'}}, ct('Price')));
        td.addEventListener('click', columnSort.bind(null, td, false));
        tr.appendChild(td = ce('td', {dataset: {sortCol: '3'}}, ct('Quantity')));
        td.addEventListener('click', columnSort.bind(null, td, false));

        regionElements.listTable = tbody;
        afterList = () => {
            let sortNum = parseInt(localStorage.getItem('other-realms-sort') ?? '');
            if (isNaN(sortNum)) {
                sortNum = 1;
            }
            const desc = sortNum < 0;
            if (desc) {
                sortNum *= -1;
            }

            const col =
                tr.querySelector(`td[data-sort-col="${sortNum}"]`) as HTMLTableCellElement|undefined ||
                tr.querySelector('td') as HTMLTableCellElement|undefined;
            if (!col) {
                return;
            }

            if (desc) {
                col.dataset.sort = 'asc';
            }

            col.click();
        }

        otherRealmsControl.addEventListener('click', () => {
            if (otherRealmsControl.checked) {
                table.dataset.withConnectedRealms = '1';
            } else {
                delete table.dataset.withConnectedRealms;
            }
        });
    })();

    // Fetch other realms
    const detailRealmId = itemState.realm.id;
    const stateRealmId = Realms.getCurrentRealm()?.id ?? detailRealmId;
    fetchOtherRealms(item, itemState.realm.region).then(otherRealms => {
        type ChartDataEntry = {
            realm: Types.Realm;
            price: Types.Money;
            quantity: number;
            lastSeen: Types.Timestamp;
        }
        type RegionDailyHistoryEntry = {
            quantitySum: number;
            prices: Types.Money[];
        }

        let quantitySum = 0;
        let prices: Types.Money[] = [];
        let lowestAvailablePrice: Types.Money = 0;
        let chartData: ChartDataEntry[] = [];
        let regionDailyHistory: Record<Types.Timestamp, RegionDailyHistoryEntry> = {};

        otherRealms.forEach(itemState => {
            // Collect stats for the base stats summary at the top.
            quantitySum += itemState.quantity;
            if (itemState.price && itemState.quantity) {
                prices.push(itemState.price);
                lowestAvailablePrice = Math.min(itemState.price, lowestAvailablePrice || itemState.price);
            }

            // Add rows to the current regional prices table.
            const connectedRealm = Realms.getConnectedRealm(itemState.realm);
            const ourRealms = [connectedRealm.canonical].concat(connectedRealm.secondary);
            ourRealms.sort((a, b) => {
                return ((a.id === detailRealmId ? 0 : 1) - (b.id === detailRealmId ? 0 : 1)) ||
                    ((a.id === stateRealmId ? 0 : 1) - (b.id === stateRealmId ? 0 : 1)) ||
                    ((a.id === connectedRealm.canonical.id ? 0 : 1) - (b.id === connectedRealm.canonical.id ? 0 : 1)) ||
                    a.name.localeCompare(b.name);
            });
            for (let realm, index = 0; realm = ourRealms[index]; index++) {
                const tr = ce('tr');
                let td, a;
                tr.appendChild(td = ce('td', {className: 'text', dataset: {sortValue: realm.name}}, ct(realm.name)));
                if (realm.nativeName) {
                    td.appendChild(ce('span', {className: 'native-name'}, ct(realm.nativeName)));
                }
                td.appendChild(a = ce('a', {
                    href: 'javascript:',
                }));
                if (index > 0) {
                    tr.dataset.connectedRealm = '1';
                }
                a.addEventListener('click', () => Detail.show(item, realm));
                tr.appendChild(td = ce('td', {
                    className: 'text',
                    dataset: {pop: realm.population, sortValue: realm.population},
                }, ct(realm.populationName)));
                tr.appendChild(ce('td', {dataset: {sortValue: itemState.price}}, itemState.price ? priceElement(itemState.price) : undefined));
                tr.appendChild(td = ce('td', {dataset: {
                        sortValue: itemState.quantity,
                        sortValue2: itemState.snapshot,
                    }}, ct(itemState.quantity.toLocaleString())));
                if (itemState.quantity === 0) {
                    td.classList.add('q0');
                    if (itemState.snapshot) {
                        td.insertBefore(
                            ce('span', {className: 'delta-timestamp', dataset: {timestamp: itemState.snapshot}}),
                            td.firstChild,
                        );
                    }
                }

                regionElements.listTable.appendChild(tr);
            }

            // Add an entry for the current regional prices bar chart.
            chartData.push({
                realm: itemState.realm,
                price: itemState.price,
                quantity: itemState.quantity,
                lastSeen: itemState.snapshot,
            });

            // Scan all daily data, add nonzero quantities to regionDailyHistory.
            itemState.daily.filter(summaryLine => summaryLine.quantity > 0).forEach(summaryLine => {
                regionDailyHistory[summaryLine.snapshot] = regionDailyHistory[summaryLine.snapshot] || {
                    quantitySum: 0,
                    prices: [],
                };

                regionDailyHistory[summaryLine.snapshot].quantitySum += summaryLine.quantity;
                regionDailyHistory[summaryLine.snapshot].prices.push(summaryLine.price);
            });
        });

        // The table has finished being filled, now sort it.
        afterList();
        updateDeltaTimestamps();

        // Update the base stats summary.
        regionElements.quantity.appendChild(ct(quantitySum.toLocaleString()));
        if (lowestAvailablePrice) {
            regionElements.current.appendChild(priceElement(lowestAvailablePrice));
        }
        if (prices.length >= 5) {
            prices.sort((a, b) => a - b);
            let statistics = getStatistics(prices);
            regionElements.median.appendChild(priceElement(statistics.median));
            regionElements.mean.appendChild(priceElement(statistics.mean));
        }

        // Fill out the Regional Daily History chart.
        showDailyChart(
            Object.keys(regionDailyHistory)
                .map(key => parseInt(key))
                .sort((a, b) => a - b)
                .map(snapshot => ({
                    snapshot: snapshot,
                    quantity: regionDailyHistory[snapshot].quantitySum,
                    price: getStatistics(regionDailyHistory[snapshot].prices).mean,
                })),
            {
                title: `Regional Daily History for ${regionName} realms`,
                caption: `This shows the total daily max available quantity, and the average daily price, of ${itemName} from all ${regionName} realms.`,
                price: 'Average Price',
                quantity: 'Total Quantity',
            },
            regionalDailyHistoryContainer,
        );

        // Fill out the Current Regional Prices chart.
        {
            chartData.sort((a, b) =>
                b.price - a.price ||
                b.quantity - a.quantity ||
                a.realm.name.localeCompare(b.realm.name)
            );

            (['price', 'quantity'] as Array<'price'|'quantity'>).forEach(type => {
                let container = otherRealmsChart.querySelector(`.${type}-bars`) as HTMLDivElement;
                let max = chartData.reduce((prev, cur) => Math.max(cur[type], prev), 0);
                chartData.forEach(entry => {
                    let bar = ce('div', {
                        className: 'bar',
                        style: {
                            height: `${entry[type] / max * 100}%`,
                        }
                    });
                    container.appendChild(bar);
                });
            });
            let container = otherRealmsChart.querySelector('.links') as HTMLDivElement;
            chartData.forEach(entry => {
                const result = ce('table', {className: 'shatari-tooltip'});
                const realmTitle = ce('b', {}, ct(entry.realm.name));
                if (entry.realm.nativeName) {
                    realmTitle.appendChild(ce('span', {className: 'native-name'}, ct(entry.realm.nativeName)));
                }
                result.appendChild(ce('tr', {}, ce('td', {colSpan: 2}, realmTitle)));

                if (entry.price) {
                    const priceLine = ce('tr');
                    priceLine.appendChild(ce('td', {className: 'price'}, ct('Current Price')));
                    priceLine.appendChild(ce('td', {}, priceElement(entry.price)));
                    result.appendChild(priceLine);
                }

                const quantityLine = ce('tr');
                quantityLine.appendChild(ce('td', {className: 'quantity'}, ct('Quantity')));
                quantityLine.appendChild(ce('td', {}, ct(entry.quantity.toLocaleString())));
                result.appendChild(quantityLine);

                if (entry.quantity === 0 && entry.lastSeen) {
                    const dateLine = ce('tr');
                    dateLine.appendChild(ce('td', {}, ct('Last Seen')));
                    dateLine.appendChild(ce('td', {}, ct(timeString(entry.lastSeen))));
                    result.appendChild(dateLine);
                }

                let link = ce('a', {
                    className: 'link',
                    dataset: {
                        simpleTooltip: result.outerHTML,
                    }
                }, ce('div', {className: 'hover-line'}));
                if (entry.realm.connectedId === itemState.realm.connectedId) {
                    link.dataset.shown = '1';
                }
                container.appendChild(link);
            });
        }

        makeSectionControls(sectionParent);
    });
}

/**
 * Returns an element for the scroll indicator to appear at the bottom of the scrollable panel.
 */
function makeScrollIndicator(): HTMLElement {
    let result = ce('div', {className: 'scroll-indicator'});
    result.appendChild(ce('div', {className: 'chevron'}));
    result.appendChild(ce('div', {className: 'chevron'}));
    result.appendChild(ce('div', {className: 'chevron'}));

    return result;
}

/**
 * Adds section control elements to all elements with section keys in the parent. Orders those sections to user
 * preferences.
 */
function makeSectionControls(parent: HTMLElement) {
    /**
     * Returns an ordered list of section keys.
     */
    const getSectionOrder = (): string[] => {
        const result = SECTION_KEYS;
        try {
            const orderString = localStorage.getItem('detail-section-order');
            const savedOrder = orderString?.split(',') || [];
            result.sort((a, b) => {
                const aSaved = savedOrder.indexOf(a);
                const bSaved = savedOrder.indexOf(b);
                if (aSaved >= 0 && bSaved >= 0) {
                    return aSaved - bSaved;
                }

                return SECTION_KEYS.indexOf(a) - SECTION_KEYS.indexOf(b);
            });
        } catch (e) {
            // Use default.
        }

        return result;
    };

    /**
     * Sets the CSS order of the section elements in the DOM to match the given section order.
     */
    const updateSections = (sectionOrder: string[]) => {
        (parent.childNodes as NodeListOf<HTMLElement>).forEach(ele => {
            ele.style.order = `${sectionOrder.indexOf(ele.dataset.sectionKey ?? 'null') + 1}`;
            delete ele.dataset.ordered;
        });
        (parent.childNodes as NodeListOf<HTMLElement>).forEach(ele => {
            if (!getAdjacentSection(sectionOrder, ele.dataset.sectionKey ?? 'null', -1)) {
                ele.dataset.ordered = 'first';
            } else if (!getAdjacentSection(sectionOrder, ele.dataset.sectionKey ?? 'null', 1)) {
                ele.dataset.ordered = 'last';
            }
        });
    };

    /**
     * Returns the next node in the given direction starting at sectionKey.
     */
    const getAdjacentSection = (sectionOrder: string[], sectionKey: string, direction: -1|1): HTMLElement|undefined => {
        let index = sectionOrder.indexOf(sectionKey);
        let nextKey;
        do {
            index += direction;
            nextKey = sectionOrder[index];
            if (nextKey) {
                const node = parent.querySelector(`[data-section-key="${nextKey}"]`) as HTMLElement|undefined;
                if (node) {
                    return node;
                }
            }
        } while (nextKey);
    };

    /**
     * Updates the section order to adjust sectionKey in the given direction.
     */
    const move = (sectionKey: string, direction: -1|1) => {
        const sectionOrder = getSectionOrder();
        const relativeNode = getAdjacentSection(sectionOrder, sectionKey, direction);
        if (!relativeNode) {
            return;
        }
        const oldIndex = sectionOrder.indexOf(sectionKey);
        sectionOrder.splice(oldIndex, 1);
        const relativeIndex = sectionOrder.indexOf(relativeNode.dataset.sectionKey ?? 'null');
        sectionOrder.splice(relativeIndex + Math.max(0, direction), 0, sectionKey);

        try {
            localStorage.setItem('detail-section-order', sectionOrder.join(','));
        } catch (e) {
            // do nothing.
        }

        updateSections(sectionOrder);
        const sectionNode = parent.querySelector(`[data-section-key="${sectionKey}"]`) as HTMLElement;
        const scroller = sectionNode.closest('.scroller') as HTMLElement|null;
        if (scroller) {
            scroller.scrollTop = Math.max(0, sectionNode.offsetTop - (scroller.offsetHeight / 2));
        }
    };

    (parent.querySelectorAll(':scope > [data-section-key]:empty') as NodeListOf<HTMLElement>).forEach(
        section => section.parentNode?.removeChild(section)
    );

    (parent.querySelectorAll(':scope > [data-section-key]') as NodeListOf<HTMLElement>).forEach(section => {
        const controls = ce('span', {className: 'section-controls'});
        section.appendChild(controls);

        const directions: Array<[direction: -1|1, name: string]> = [[-1, 'up'], [1, 'down']];
        directions.forEach(([offset, name]) => {
            const control = ce('span', {className: 'move', dataset: {
                    direction: name,
                    simpleTooltip: `Move this section ${name}.`,
                }});
            control.addEventListener('click', () => move(section.dataset.sectionKey ?? 'null', offset));
            controls.appendChild(control);
        });
    });

    updateSections(getSectionOrder());
}

/**
 * Rounds a value, but halves always round towards the odd number.
 */
function roundToOdd(value: number): number {
    let floored = Math.floor(value);
    if (Math.floor((value - floored) * 1000000) === 500000) {
        if (floored % 2 === 0) {
            return floored + 1;
        }

        return floored;
    }

    return Math.floor(value + 0.5);
}
