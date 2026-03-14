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
 * @param {HTMLElement} [child]
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
 * Creates a text node.
 *
 * @param {string} data
 * @return {Text}
 */
export const createText = data => document.createTextNode(data);

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
