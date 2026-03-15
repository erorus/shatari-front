import {COPPER_GOLD, COPPER_SILVER, MS_DAY, MS_HOUR, MS_MINUTE} from "./constants";

/**
 * Returns true when the primary input can hover.
 *
 * @return {boolean}
 */
export function canHover() {
    return window.matchMedia('(hover: hover)').matches;
}

/**
 * Copy Object. Properties from source are set onto dest.
 *
 * @param {object} dest
 * @param {object} source
 */
export function copyObject(dest, source) {
    for (let k in source) {
        if (!source.hasOwnProperty(k)) {
            continue;
        }
        if (typeof source[k] === 'object') {
            if (Array.isArray(source[k])) {
                dest[k] = source[k].slice(0);
            } else {
                if (!(k in dest)) {
                    dest[k] = {};
                }
                copyObject(dest[k], source[k]);
            }
        } else {
            dest[k] = source[k];
        }
    }
}

/**
 * Creates an element.
 *
 * @param {string} tag
 * @param {object} [props]
 * @param {Node} [child]
 * @return {HTMLElement}
 */
export function createElement(tag, props, child) {
    const result = document.createElement(tag);

    copyObject(result, props || {});

    if (child) {
        result.appendChild(child);
    }

    return result;
}

/**
 * Create SVG Element.
 *
 * @param {string} tag
 * @param {object} [attributes]
 * @param {Node} [child]
 * @return {Node}
 */
export function createSVGElement(tag, attributes, child) {
    const result = document.createElementNS('http://www.w3.org/2000/svg', tag);

    if (attributes) {
        for (let key in attributes) {
            if (attributes.hasOwnProperty(key)) {
                result.setAttribute(key, attributes[key]);
            }
        }
    }

    if (child) {
        result.appendChild(child);
    }

    return result;
}

/**
 * Creates a text node.
 *
 * @param {string} data
 * @return {Text}
 */
export const createText = data => document.createTextNode(data);

/**
 * Empties an element of all children.
 *
 * @param {Node} ele
 */
export function emptyElement(ele) {
    while (ele.hasChildNodes()) {
        ele.removeChild(ele.firstChild);
    }
}

/**
 * Returns an element for the given price.
 *
 * @param {Money} coppers
 * @return {HTMLSpanElement}
 */
export function priceElement(coppers) {
    const df = document.createElement('span');
    df.style.whiteSpace = 'nowrap';
    coppers = Math.abs(coppers);
    const silver = Math.floor(coppers / COPPER_SILVER) % COPPER_SILVER;
    const gold = Math.floor(coppers / COPPER_GOLD);

    if (gold > 0) {
        let goldSpan = document.createElement('span');
        goldSpan.className = 'gold';
        goldSpan.appendChild(createText(gold.toLocaleString()));
        df.appendChild(goldSpan);
    }
    let silverSpan = document.createElement('span');
    silverSpan.className = 'silver';
    silverSpan.appendChild(createText(`${silver}`));
    df.appendChild(silverSpan);

    return df;
}

/**
 * Queries a selector in the document body, returning one.
 *
 * @param {string} selectors
 * @return {HTMLElement|null}
 */
export const querySelector = selectors => document.body.querySelector(selectors);

/**
 * Queries a selector in the document body, returning all matches.
 *
 * @param {string} selectors
 * @return {NodeListOf<HTMLElementTagNameMap[keyof HTMLElementTagNameMap]>}
 */
export const querySelectorAll = selectors => document.body.querySelectorAll(selectors);

/**
 * Returns a string describing the timestamp relative to now. e.g. "2 hours ago".
 *
 * @param {number} timestamp
 * @return {string}
 */
export function timeString(timestamp) {
    let now = Date.now();
    let delta = now - timestamp;
    let sign = Math.sign(delta);
    delta = Math.abs(delta);
    let ago = sign > 0 ? 'ago' : 'away';

    if (sign === 0) {
        return 'now';
    }
    if (delta < 2 * MS_HOUR) {
        return Math.round(delta / MS_MINUTE) + ' minutes ' + ago;
    }
    if (delta < 2 * MS_DAY) {
        return Math.round(delta / MS_HOUR) + ' hours ' + ago;
    }
    if (delta < 14 * MS_DAY) {
        return Math.round(delta / MS_DAY) + ' days ' + ago;
    }

    const shortFormatter = new Intl.DateTimeFormat([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

    return shortFormatter.format(new Date(timestamp));
}

/**
 * Updates all delta timestamp elements on the page with values for the current time.
 */
export function updateDeltaTimestamps() {
    const longFormatter = new Intl.DateTimeFormat([], {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        timeZoneName: 'short',
    });

    querySelectorAll('.delta-timestamp[data-timestamp]').forEach(ele => {
        const timestamp = parseInt(ele.dataset.timestamp);
        emptyElement(ele);
        if (timestamp <= 0) {
            delete ele.dataset.simpleTooltip;
            ele.appendChild(createText('Never'));

            return;
        }
        ele.dataset.simpleTooltip = longFormatter.format(new Date(timestamp));

        ele.appendChild(createText(timeString(timestamp)));
    });
}

/**
 * Waits for Highstock to be loaded.
 */
export async function waitForHighstock() {
    let tag = document.getElementById('highstock-script');
    if (!tag.dataset.loaded) {
        await new Promise(resolve => {
            tag.addEventListener('load', () => resolve());
        });
    }
}
