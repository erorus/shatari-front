(function () {
    const ct = document.createTextNode.bind(document);
    const qs = document.body.querySelector.bind(document.body);
    const qsa = document.body.querySelectorAll.bind(document.body);

    const my = {
        categories: undefined,
    };

    /**
     * Fetches the category list data and creates its elements in the category div.
     */
    async function addCategories() {
        const data = await getCategories();
        console.log(data);

        const categoriesParent = qs('.main .categories');
        data.forEach(function (cat) {
            const catDiv = ce(
                'div',
                {
                    className: 'category',
                    dataset: {
                        classId: cat['class'],
                    },
                },
                ct(cat.name)
            );
            categoriesParent.appendChild(catDiv);

            (cat.subcategories || []).forEach(function (subcat) {
                const subcatDiv = ce(
                    'div',
                    {
                        className: 'category subcategory',
                        dataset: {
                            classId: cat['class'],
                            subClassId: cat.subClass,
                        },
                    },
                    ct(subcat.name)
                );
                categoriesParent.appendChild(subcatDiv);
            });
        });
    }

    /**
     * Fetches (if necessary) and returns the categories list.
     *
     * @returns {{object}[]}
     */
    async function getCategories() {
        if (my.categories) {
            return my.categories;
        }

        const response = await fetch('json/categories.enus.json', {mode:'same-origin'});
        if (!response.ok) {
            throw 'Cannot get list of categories!';
        }

        return my.categories = await response.json();
    }

    //                           //
    // Generic Utility Functions //
    //                           //

    /**
     * Create Element.
     *
     * @param {string} tag
     * @param {object} [props]
     * @param {HTMLElement} [child]
     * @returns {HTMLElement}
     */
    function ce(tag, props, child) {
        const result = document.createElement(tag);

        co(result, props || {});

        if (child) {
            result.appendChild(child);
        }

        return result;
    }

    /**
     * Copy Object. Properties from source are set onto dest.
     *
     * @param {object} dest
     * @param {object} source
     */
    function co(dest, source) {
        for (let k in source) {
            if (!source.hasOwnProperty(k)) {
                continue;
            }
            if (typeof source[k] === 'object') {
                if (Array.isArray(source[k])) {
                    dest[k] = source[k].slice(0);
                } else {
                    if (!dest.hasOwnProperty(k)) {
                        dest[k] = {};
                    }
                    co(dest[k], source[k]);
                }
            } else {
                dest[k] = source[k];
            }
        }
    }

    //      //
    // Init //
    //      //

    async function init() {
        await addCategories();
    }

    init().catch(alert);
})();
