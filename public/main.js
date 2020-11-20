(function () {
    const ct = document.createTextNode.bind(document);
    const qs = document.body.querySelector.bind(document.body);
    const qsa = document.body.querySelectorAll.bind(document.body);

    const my = {
        categories: undefined,

        classId: undefined,
        subClassId: undefined,
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
            catDiv.addEventListener('click', clickCategory.bind(null, catDiv));

            (cat.subcategories || []).forEach(function (subcat) {
                const subcatDiv = ce(
                    'div',
                    {
                        className: 'subcategory',
                        dataset: {
                            parentClass: cat['class'],
                            classId: subcat['class'],
                            subClassId: subcat.subClass,
                        },
                    },
                    ct(subcat.name)
                );
                categoriesParent.appendChild(subcatDiv);
                subcatDiv.addEventListener('click', clickSubCategory.bind(null, subcatDiv));

            });
        });
    }

    /**
     * Event handler for clicking a primary category.
     *
     * @param {HTMLElement} catDiv
     */
    function clickCategory(catDiv) {
        const classId = parseInt(catDiv.dataset.classId);
        let wasSelected = !!catDiv.dataset.selected;

        // De-select everything.
        qsa('.main .categories > div').forEach(function (node) {
            delete node.dataset.selected;
            delete node.dataset.visible;
        });
        my.classId = undefined;
        my.subClassId = undefined;

        if (!wasSelected) {
            // Select this category.
            catDiv.dataset.selected = 1;
            my.classId = classId;

            // Show any subcategories under this category.
            qsa('.main .categories .subcategory[data-parent-class="' + classId + '"]').forEach(function (node) {
                node.dataset.visible = 1;
            });
        }
    }

    /**
     * Event handler for clicking a subcategory.
     *
     * @param {HTMLElement} subCatDiv
     */
    function clickSubCategory(subCatDiv) {
        let wasSelected = !!subCatDiv.dataset.selected;

        // De-select every subcategory.
        qsa('.main .categories .subcategory[data-selected]').forEach(function (node) {
            delete node.dataset.selected;
        });

        if (!wasSelected) {
            // Select this subcategory.
            subCatDiv.dataset.selected = 1;

            my.classId = parseInt(subCatDiv.dataset.classId);
            my.subClassId = parseInt(subCatDiv.dataset.subClassId);
        } else {
            // De-select this subcategory, reverting back to the parent category criteria.
            my.classId = parseInt(subCatDiv.dataset.parentClass);
            my.subClassId = undefined;
        }
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
