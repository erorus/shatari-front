import {
    copyObject as co,
    createElement as ce,
    createText as ct,
    emptyElement as ee,
    querySelector as qs,
    querySelectorAll as qsa
} from "./utils";
import Detail from "./Detail";
import Items from "./Items";
import Locales from "./Locales";
import Progress from "./Progress";

/**
 * @typedef {Object} Category
 * @property {string}        name
 * @property {ClassID}       class
 * @property {DetailColumn}  [detailColumn]
 * @property {Subcategory[]} [subcategories]
 */

/**
 * @typedef {Object} DetailColumn
 * @property {string} prop  The field in an Item with the value for this column
 * @property {string} name
 */

/**
 * @typedef {Object} Subcategory
 * @property {string}          name
 * @property {ClassID}         class
 * @property {StatID}          [bonusStat]
 * @property {number[]}        [extraFilters]
 * @property {InventoryType[]} [invTypes]
 * @property {SubclassID}      [subClass]
 * @property {SubclassID[]}    [subClasses]
 * @property {Subcategory[]}   [subcategories]
 */

/**
 * @type {{
 *  bonusStat: StatID|undefined,
 *  classId: ClassID|undefined,
 *  extraFilters: number[]|undefined,
 *  invTypes: InventoryType[]|undefined,
 *  subClassId: SubclassID|undefined,
 *  subClassIds: SubclassID[]|undefined,
 *  detailColumn: DetailColumn|undefined,
 *  hashCode: string|undefined,
 *  categories: Category[],
 *  battlePetTypes: Object.<number, string>,
 *  }}
 */
const my = {
    categories: undefined,
    battlePetTypes: {},

    classId: undefined,
    bonusStat: undefined,
    extraFilters: undefined,
    invTypes: undefined,
    subClassId: undefined,
    subClassIds: undefined,
    hashCode: undefined,

    detailColumn: undefined,
};

/**
 * Manages the categories sidebar list.
 */
const Categories = {
    /**
     * Given a battle pet type ID, return its name.
     *
     * @param {number} typeId
     * @return {string|undefined}
     */
    getBattlePetTypeName(typeId) {
        return my.battlePetTypes[typeId];
    },

    /**
     * Returns bonus stat ID to use in search filtering, or undefined for none.
     *
     * @return {number[]}
     */
    getBonusStat() {
        return my.bonusStat;
    },

    /**
     * Returns the class ID to use in search filtering, or undefined for none.
     *
     * @return {ClassID|undefined}
     */
    getClassId() {
        return my.classId;
    },

    /**
     * Returns the detail column to show in the item list, based on the selected category.
     *
     * @return {DetailColumn|undefined}
     */
    getDetailColumn() {
        if (!my.detailColumn) {
            return;
        }

        let result = {};
        co(result, my.detailColumn);

        return result;
    },

    /**
     * Returns extra filter IDs to use in search filtering, or undefined for none.
     *
     * @return {number[]}
     */
    getExtraFilters() {
        return my.extraFilters && my.extraFilters.slice(0);
    },

    /**
     * Returns the hash code of the currently-selected category/subcategory/subsubcategory.
     *
     * @return {string}
     */
    getHashCode() {
        return my.hashCode || '';
    },

    /**
     * Returns the inventory type IDs to use in search filtering, or undefined for none.
     *
     * @return {InventoryType[]}
     */
    getInvTypes() {
        return my.invTypes && my.invTypes.slice(0);
    },

    /**
     * Returns the subclass IDs to use in search filtering, or undefined for none.
     *
     * @return {SubclassID[]|undefined}
     */
    getSubClassIds() {
        return my.subClassIds && my.subClassIds.slice(0) ||
            my.subClassId !== undefined && [my.subClassId] ||
            undefined;
    },

    /**
     * Returns the name of the WoW Token in the current locale, since it's a BoP item (and not included in our item
     * names) but is a category name.
     *
     * @return {string}
     */
    getTokenName() {
        let tokenName = 'WoW Token';

        my.categories.forEach(category => {
            if (category['class'] === Items.CLASS_WOW_TOKEN) {
                tokenName = category.name;
            }
        });

        return tokenName;
    },

    /**
     * Fetches the category list data and creates its elements in the category div.
     */
    async init() {
        const data = await getCategories();

        const categoriesParent = qs('.main .categories');
        ee(categoriesParent);

        /**
         * Sets a unique hash code dataset property, based on other dataset properties of the given div.
         *
         * @param {HTMLElement} catDiv
         */
        let setHashCode = function (catDiv) {
            let hashCode = catDiv.dataset.classId + '.';
            if (catDiv.dataset.subClassId) {
                hashCode += catDiv.dataset.subClassId;
            } else if (catDiv.dataset.subClassIds) {
                hashCode += catDiv.dataset.subClassIds.replace(/,/g, '_');
            }
            hashCode += '.';
            hashCode += (catDiv.dataset.invTypes || '').replace(/,/g, '_') + '.';
            hashCode += (catDiv.dataset.extraFilters || '').replace(/,/g, '_') + '.';
            hashCode += (catDiv.dataset.bonusStat || '');
            hashCode = hashCode.replace(/\.+$/, '');

            catDiv.dataset.hashCode = hashCode;
        };

        data.forEach(function (cat) {
            const catDiv = ce(
                'div',
                {
                    className: 'category',
                    dataset: {
                        classId: cat['class'],
                    },
                },
                getNameNode(cat)
            );
            if (cat.detailColumn) {
                catDiv.dataset.detailColumn = JSON.stringify(cat.detailColumn);
            }
            setHashCode(catDiv);
            categoriesParent.appendChild(catDiv);
            catDiv.addEventListener('click', clickCategory.bind(null, catDiv));
            if (cat['class'] === Items.CLASS_WOW_TOKEN) {
                catDiv.classList.add('q8');
            }

            if (!cat.subcategories) {
                return;
            }

            let subCatIndex = -1;
            cat.subcategories.forEach(function (subcat) {
                const subcatDiv = ce(
                    'div',
                    {
                        className: 'subcategory',
                        dataset: {
                            parentClass: cat['class'],
                            classId: subcat['class'],
                            subCategoryIndex: ++subCatIndex,
                        },
                    },
                    getNameNode(subcat)
                );
                if (subcat.hasOwnProperty('subClass')) {
                    subcatDiv.dataset.subClassId = subcat.subClass;
                } else if (subcat.hasOwnProperty('subClasses')) {
                    subcatDiv.dataset.subClassIds = subcat.subClasses.join(',');
                }
                if (subcat.hasOwnProperty('invTypes')) {
                    subcatDiv.dataset.invTypes = subcat.invTypes.join(',');
                }
                if (subcat.hasOwnProperty('extraFilters')) {
                    subcatDiv.dataset.extraFilters = subcat.extraFilters.join(',');
                }
                if (subcat.hasOwnProperty('bonusStat')) {
                    subcatDiv.dataset.bonusStat = `${subcat.bonusStat}`;
                }
                setHashCode(subcatDiv);
                categoriesParent.appendChild(subcatDiv);
                subcatDiv.addEventListener('click', clickSubCategory.bind(null, subcatDiv));

                if (!subcat.subcategories) {
                    return;
                }

                subcat.subcategories.forEach(function (subsubcat) {
                    const subsubcatDiv = ce(
                        'div',
                        {
                            className: 'subsubcategory',
                            dataset: {
                                parentClass: cat['class'],
                                parentSubCategory: subCatIndex,
                                classId: subsubcat['class'],
                            },
                        },
                        getNameNode(subsubcat)
                    );
                    if (subsubcat.hasOwnProperty('subClass')) {
                        subsubcatDiv.dataset.subClassId = subsubcat.subClass;
                    } else if (subsubcat.hasOwnProperty('subClasses')) {
                        subsubcatDiv.dataset.subClassIds = subsubcat.subClasses.join(',');
                    }
                    if (subsubcat.hasOwnProperty('invTypes')) {
                        subsubcatDiv.dataset.invTypes = subsubcat.invTypes.join(',');
                    }
                    if (subsubcat.hasOwnProperty('extraFilters')) {
                        subsubcatDiv.dataset.extraFilters = subsubcat.extraFilters.join(',');
                    }
                    if (subsubcat.hasOwnProperty('bonusStat')) {
                        subsubcatDiv.dataset.bonusStat = `${subsubcat.bonusStat}`;
                    }
                    setHashCode(subsubcatDiv);
                    categoriesParent.appendChild(subsubcatDiv);
                    subsubcatDiv.addEventListener('click', clickSubSubCategory.bind(null, subsubcatDiv));
                });
            });
        });

        Locales.registerCallback(onLocaleChange);
    },

    /**
     * Resets all category selections, then selects the category leaf matching the given hash code.
     *
     * @param {string} hashCode
     */
    setHashCode(hashCode) {
        deselectAll();

        hashCode = hashCode.replace(/[^-\d._]/g, '');
        if (!hashCode) {
            return;
        }

        let node = qs('.main .categories > div[data-hash-code="' + hashCode + '"]');
        if (!node) {
            return;
        }

        let subsubCatDiv;
        let subCatDiv;
        let catDiv;
        if (node.classList.contains('subsubcategory')) {
            subsubCatDiv = node;

            {
                let selector = '.main .categories .subcategory';
                selector += '[data-parent-class="' + subsubCatDiv.dataset.parentClass + '"]';
                selector += '[data-sub-category-index="' + subsubCatDiv.dataset.parentSubCategory + '"]';

                subCatDiv = qs(selector);
            }

            {
                let selector = '.main .categories .category';
                selector += '[data-class-id="' + subsubCatDiv.dataset.parentClass + '"]';
                catDiv = qs(selector);
            }
        } else if (node.classList.contains('subcategory')) {
            subCatDiv = node;

            {
                let selector = '.main .categories .category';
                selector += '[data-class-id="' + subCatDiv.dataset.parentClass + '"]';
                catDiv = qs(selector);
            }
        } else if (node.classList.contains('category')) {
            catDiv = node;
        }

        if (catDiv) {
            clickCategory(catDiv);
        }
        if (subCatDiv) {
            clickSubCategory(subCatDiv);
        }
        if (subsubCatDiv) {
            clickSubSubCategory(subsubCatDiv);
        }
    },
}
export default Categories;

/**
 * Event handler for clicking a primary category.
 *
 * @param {HTMLElement} catDiv
 */
function clickCategory(catDiv) {
    const classId = parseInt(catDiv.dataset.classId);
    const wasSelected = !!catDiv.dataset.selected;
    const oldClassId = my.classId;

    deselectAll();

    if (!wasSelected) {
        // Select this category.
        catDiv.dataset.selected = 1;
        my.classId = classId;
        my.detailColumn = catDiv.dataset.detailColumn ? JSON.parse(catDiv.dataset.detailColumn) : undefined;
        my.hashCode = catDiv.dataset.hashCode;

        // Show any subcategories under this category.
        qsa('.main .categories .subcategory[data-parent-class="' + classId + '"]').forEach(function (node) {
            node.dataset.visible = 1;
        });
    }

    if (my.classId === Items.CLASS_WOW_TOKEN) {
        // Jump straight to the WoW Token detail panel.
        Detail.showWowToken();
    } else if (oldClassId === Items.CLASS_WOW_TOKEN) {
        // Exit WoW Token mode.
        Detail.hide();
    }
}

/**
 * Event handler for clicking a subcategory.
 *
 * @param {HTMLElement} subCatDiv
 */
function clickSubCategory(subCatDiv) {
    const wasSelected = !!subCatDiv.dataset.selected;

    // De-select every subcategory.
    qsa('.main .categories .subcategory[data-selected]').forEach(function (node) {
        delete node.dataset.selected;
    });

    // De-select and hide every subsubcategory.
    qsa('.main .categories .subsubcategory').forEach(function (node) {
        delete node.dataset.selected;
        delete node.dataset.visible;
    });

    if (!wasSelected) {
        // Select this subcategory.
        subCatDiv.dataset.selected = 1;

        my.classId = parseInt(subCatDiv.dataset.classId);
        if (subCatDiv.dataset.hasOwnProperty('subClassId')) {
            my.subClassId = parseInt(subCatDiv.dataset.subClassId);
        } else {
            my.subClassId = undefined;
        }
        my.subClassIds = subCatDiv.dataset.hasOwnProperty('subClassIds') &&
            subCatDiv.dataset.subClassIds.split(',').map(value => parseInt(value)) || undefined;
        my.invTypes = subCatDiv.dataset.hasOwnProperty('invTypes') &&
            subCatDiv.dataset.invTypes.split(',').map(value => parseInt(value)) || undefined;
        my.extraFilters = subCatDiv.dataset.hasOwnProperty('extraFilters') &&
            subCatDiv.dataset.extraFilters.split(',').map(value => parseInt(value)) || undefined;
        my.bonusStat = subCatDiv.dataset.hasOwnProperty('bonusStat') &&
            parseInt(subCatDiv.dataset.bonusStat) || undefined;
        my.hashCode = subCatDiv.dataset.hashCode;

        // Show any subsubcategories under this subcategory.
        let selector = '.main .categories .subsubcategory';
        selector += '[data-parent-class="' + subCatDiv.dataset.classId + '"]';
        selector += '[data-parent-sub-category="' + subCatDiv.dataset.subCategoryIndex + '"]';
        qsa(selector).forEach(function (node) {
            node.dataset.visible = 1;
        });
    } else {
        // De-select this subcategory, reverting back to the parent category criteria.
        my.classId = parseInt(subCatDiv.dataset.parentClass);
        my.subClassId = undefined;
        my.subClassIds = undefined;
        my.invTypes = undefined;
        my.extraFilters = undefined;
        my.bonusStat = undefined;

        let selector = '.main .categories .category';
        selector += '[data-class-id="' + subCatDiv.dataset.parentClass + '"]';
        const catDiv = qs(selector);
        my.hashCode = catDiv ? catDiv.dataset.hashCode : subCatDiv.dataset.parentClass;
    }
}

/**
 * Event handler for clicking a subsubcategory.
 *
 * @param {HTMLElement} subsubCatDiv
 */
function clickSubSubCategory(subsubCatDiv) {
    const wasSelected = !!subsubCatDiv.dataset.selected;

    // De-select every subsubcategory.
    qsa('.main .categories .subsubcategory[data-selected]').forEach(function (node) {
        delete node.dataset.selected;
    });

    if (!wasSelected) {
        // Select this subsubcategory.
        subsubCatDiv.dataset.selected = 1;

        my.classId = parseInt(subsubCatDiv.dataset.classId);
        my.subClassId = parseInt(subsubCatDiv.dataset.subClassId);
        my.subClassIds = subsubCatDiv.dataset.hasOwnProperty('subClassIds') &&
            subsubCatDiv.dataset.subClassIds.split(',').map(value => parseInt(value)) || undefined;
        my.invTypes = subsubCatDiv.dataset.hasOwnProperty('invTypes') &&
            subsubCatDiv.dataset.invTypes.split(',').map(value => parseInt(value)) || undefined;
        my.extraFilters = subsubCatDiv.dataset.hasOwnProperty('extraFilters') &&
            subsubCatDiv.dataset.extraFilters.split(',').map(value => parseInt(value)) || undefined;
        my.bonusStat = subsubCatDiv.dataset.hasOwnProperty('bonusStat') &&
            parseInt(subsubCatDiv.dataset.bonusStat) || undefined;
        my.hashCode = subsubCatDiv.dataset.hashCode;
    } else {
        // De-select this subsubcategory, reverting back to the parent subcategory criteria.
        let selector = '.main .categories .subcategory';
        selector += '[data-parent-class="' + subsubCatDiv.dataset.parentClass + '"]';
        selector += '[data-sub-category-index="' + subsubCatDiv.dataset.parentSubCategory + '"]';

        const subCatDiv = qs(selector);
        delete subCatDiv.dataset.selected;
        clickSubCategory(subCatDiv);
    }
}

/**
 * De-selects all categories, returning to the initial state.
 */
function deselectAll() {
    qsa('.main .categories > div').forEach(function (node) {
        delete node.dataset.selected;
        delete node.dataset.visible;
    });
    my.classId = undefined;
    my.subClassId = undefined;
    my.subClassIds = undefined;
    my.invTypes = undefined;
    my.extraFilters = undefined;
    my.bonusStat = undefined;
    my.detailColumn = undefined;
    my.hashCode = undefined;
}

/**
 * Fetches (if necessary) and returns the categories list.
 *
 * @return {Promise<Category[]>}
 */
async function getCategories() {
    if (my.categories) {
        return my.categories;
    }

    const locale = Locales.getCurrent();
    const response = await Progress.fetch('json/categories.' + locale + '.json', {mode:'same-origin'});
    if (!response.ok) {
        throw 'Cannot get list of categories!';
    }

    my.categories = await response.json();
    my.categories.forEach(category => {
        if (category['class'] === Items.CLASS_BATTLE_PET) {
            category.subcategories.forEach(subcategory => {
                if (subcategory.subClass > 0) {
                    my.battlePetTypes[subcategory.subClass] = subcategory.name;
                }
            });
        }
    });

    return my.categories;
}

/**
 * Parses the colors out of a name string and returns a node to use in the category div.
 *
 * @param {Category|Subcategory} cat
 * @return {Node}
 */
function getNameNode(cat) {
    const nameString = cat.name;
    let match = /^\|c([0-9a-f]{2})([0-9a-f]{6})(.*)\|r$/.exec(nameString);
    if (match) {
        return ce('span', {style: {color: '#' + match[2] + match[1]}}, ct(match[3]));
    }
    if (cat.bonusStat) {
        return ce('span', {className: 'q2'}, ct(nameString));
    }

    return ct(nameString);
}

/**
 * Called when the user changes their preferred locale, this updates the UI with the new names.
 *
 * @param {string} locale
 */
async function onLocaleChange(locale) {
    my.categories = undefined;
    my.battlePetTypes = {};

    my.classId = undefined;
    my.subClassId = undefined;
    my.subClassIds = undefined;
    my.invTypes = undefined;
    my.extraFilters = undefined;
    my.bonusStat = undefined;
    my.detailColumn = undefined;

    await Categories.init();
}
