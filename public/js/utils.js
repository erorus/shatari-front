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
 * Create Element.
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
