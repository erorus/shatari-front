import {
    createElement as ce,
    createText as ct,
    emptyElement as ee,
    querySelector as qs,
    querySelectorAll as qsa
} from "./utils";
import Detail from "./Detail";
import {ItemClass} from "./Items";
import {registerCallback as registerLocaleCallback, getCurrent as getCurrentLocale} from "./Locales";
import Progress from "./Progress";
import * as Types from "./Types";

type Category = {
    class: Types.ClassID;
    detailColumn?: DetailColumn;
    name: string;
    subcategories?: Subcategory[];
}

export type DetailColumn = {
    name: string;
    // The field in an Item with the value for this column
    prop: 'itemLevel'|'reqLevel'|'skill'|'slots';
}

type Subcategory = {
    bonusStat?: Types.StatID;
    class: Types.ClassID;
    extraFilters?: number[];
    invTypes?: Types.InventoryType[];
    name: string;
    subClass?: Types.SubclassID;
    subClasses?: Types.SubclassID[];
    subcategories?: Subcategory[];
}

type ModuleVars = {
    bonusStat: Types.StatID|undefined;
    classId: Types.ClassID|undefined;
    extraFilters: number[]|undefined;
    invTypes: Types.InventoryType[]|undefined;
    subClassId: Types.SubclassID|undefined;
    subClassIds: Types.SubclassID[]|undefined;
    detailColumn: DetailColumn|undefined;
    hashCode: string|undefined;
    categories: Category[];
    battlePetTypes: Record<number, string>;
}

const my: ModuleVars = {
    categories: [],
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
     * Returns the name of the given battle pet type.
     */
    getBattlePetTypeName(typeId: number): string|undefined {
        return my.battlePetTypes[typeId];
    },

    /**
     * Returns the bonus stat ID to use in search filtering, or undefined for none.
     */
    getBonusStat(): Types.StatID|undefined {
        return my.bonusStat;
    },

    /**
     * Returns the class ID to use in search filtering, or undefined for none.
     */
    getClassId(): Types.ClassID|undefined {
        return my.classId;
    },

    /**
     * Returns the detail column to show in the item list, based on the selected category.
     */
    getDetailColumn(): DetailColumn|undefined {
        if (!my.detailColumn) {
            return;
        }

        return {...my.detailColumn};
    },

    /**
     * Returns extra filter IDs to use in search filtering, or undefined for none.
     */
    getExtraFilters(): number[]|undefined {
        return my.extraFilters && my.extraFilters.slice(0) || undefined;
    },

    /**
     * Returns the hash code of the currently-selected category/subcategory/subsubcategory.
     */
    getHashCode(): string {
        return my.hashCode || '';
    },

    /**
     * Returns the inventory type IDs to use in search filtering, or undefined for none.
     */
    getInvTypes(): Types.InventoryType[]|undefined {
        return my.invTypes && my.invTypes.slice(0) || undefined;
    },

    /**
     * Returns the subclass IDs to use in search filtering, or undefined for none.
     */
    getSubClassIds(): Types.SubclassID[]|undefined {
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
    getTokenName(): string {
        let tokenName = 'WoW Token';

        my.categories.forEach(category => {
            if (category['class'] === ItemClass.WowToken) {
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

        const categoriesParent = qs('.main .categories') as HTMLDivElement;
        ee(categoriesParent);

        /**
         * Sets a unique hash code dataset property, based on other dataset properties of the given div.
         */
        let setHashCode = function (catDiv: HTMLDivElement) {
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
            ) as HTMLDivElement;
            if (cat.detailColumn) {
                catDiv.dataset.detailColumn = JSON.stringify(cat.detailColumn);
            }
            setHashCode(catDiv);
            categoriesParent.appendChild(catDiv);
            catDiv.addEventListener('click', clickCategory.bind(null, catDiv));
            if (cat['class'] === ItemClass.WowToken) {
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
                ) as HTMLDivElement;
                if (subcat.subClass != null) {
                    subcatDiv.dataset.subClassId = `${subcat.subClass}`;
                } else if (subcat.subClasses != null) {
                    subcatDiv.dataset.subClassIds = subcat.subClasses.join(',');
                }
                if (subcat.invTypes != null) {
                    subcatDiv.dataset.invTypes = subcat.invTypes.join(',');
                }
                if (subcat.extraFilters != null) {
                    subcatDiv.dataset.extraFilters = subcat.extraFilters.join(',');
                }
                if (subcat.bonusStat != null) {
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
                    ) as HTMLDivElement;
                    if (subsubcat.subClass != null) {
                        subsubcatDiv.dataset.subClassId = `${subsubcat.subClass}`;
                    } else if (subsubcat.subClasses != null) {
                        subsubcatDiv.dataset.subClassIds = subsubcat.subClasses.join(',');
                    }
                    if (subsubcat.invTypes != null) {
                        subsubcatDiv.dataset.invTypes = subsubcat.invTypes.join(',');
                    }
                    if (subsubcat.extraFilters != null) {
                        subsubcatDiv.dataset.extraFilters = subsubcat.extraFilters.join(',');
                    }
                    if (subsubcat.bonusStat != null) {
                        subsubcatDiv.dataset.bonusStat = `${subsubcat.bonusStat}`;
                    }
                    setHashCode(subsubcatDiv);
                    categoriesParent.appendChild(subsubcatDiv);
                    subsubcatDiv.addEventListener('click', clickSubSubCategory.bind(null, subsubcatDiv));
                });
            });
        });

        registerLocaleCallback(onLocaleChange);
    },

    /**
     * Resets all category selections, then selects the category leaf matching the given hash code.
     */
    setHashCode(hashCode: string) {
        deselectAll();

        hashCode = hashCode.replace(/[^-\d._]/g, '');
        if (!hashCode) {
            return;
        }

        let node = qs(`.main .categories > div[data-hash-code="${hashCode}"]`) as HTMLDivElement|undefined;
        if (!node) {
            return;
        }

        let subsubCatDiv: HTMLDivElement|undefined;
        let subCatDiv: HTMLDivElement|undefined;
        let catDiv: HTMLDivElement|undefined;
        if (node.classList.contains('subsubcategory')) {
            subsubCatDiv = node;

            {
                let selector = '.main .categories .subcategory';
                selector += `[data-parent-class="${subsubCatDiv.dataset.parentClass}"]`;
                selector += `[data-sub-category-index="${subsubCatDiv.dataset.parentSubCategory}"]`;

                subCatDiv = qs(selector) as HTMLDivElement|undefined;
            }

            {
                let selector = '.main .categories .category';
                selector += `[data-class-id="${subsubCatDiv.dataset.parentClass}"]`;
                catDiv = qs(selector) as HTMLDivElement|undefined;
            }
        } else if (node.classList.contains('subcategory')) {
            subCatDiv = node;

            {
                let selector = '.main .categories .category';
                selector += `[data-class-id="${subCatDiv.dataset.parentClass}"]`;
                catDiv = qs(selector) as HTMLDivElement|undefined;
            }
        } else if (node.classList.contains('category')) {
            catDiv = node;
        }

        catDiv && clickCategory(catDiv);
        subCatDiv && clickSubCategory(subCatDiv);
        subsubCatDiv && clickSubSubCategory(subsubCatDiv);
    },
}
export default Categories;

/**
 * Event handler for clicking a primary category.
 */
function clickCategory(catDiv: HTMLDivElement) {
    const classId = parseInt(catDiv.dataset.classId || '-1');
    const wasSelected = !!catDiv.dataset.selected;
    const oldClassId = my.classId;

    deselectAll();

    if (!wasSelected) {
        // Select this category.
        catDiv.dataset.selected = '1';
        my.classId = classId;
        my.detailColumn = catDiv.dataset.detailColumn ? JSON.parse(catDiv.dataset.detailColumn) : undefined;
        my.hashCode = catDiv.dataset.hashCode;

        // Show any subcategories under this category.
        (qsa('.main .categories .subcategory[data-parent-class="' + classId + '"]') as NodeListOf<HTMLDivElement>)
            .forEach(node => {
                node.dataset.visible = '1';
            });
    }

    if (my.classId === ItemClass.WowToken) {
        // Jump straight to the WoW Token detail panel.
        Detail.showWowToken();
    } else if (oldClassId === ItemClass.WowToken) {
        // Exit WoW Token mode.
        Detail.hide();
    }
}

/**
 * Event handler for clicking a subcategory.
 */
function clickSubCategory(subCatDiv: HTMLDivElement) {
    const wasSelected = !!subCatDiv.dataset.selected;

    // De-select every subcategory.
    (qsa('.main .categories .subcategory[data-selected]') as NodeListOf<HTMLDivElement>).forEach(function (node) {
        delete node.dataset.selected;
    });

    // De-select and hide every subsubcategory.
    (qsa('.main .categories .subsubcategory') as NodeListOf<HTMLDivElement>).forEach(function (node) {
        delete node.dataset.selected;
        delete node.dataset.visible;
    });

    if (!wasSelected) {
        // Select this subcategory.
        subCatDiv.dataset.selected = '1';

        my.classId = parseInt(subCatDiv.dataset.classId || '-1');
        if (subCatDiv.dataset.subClassId != null) {
            my.subClassId = parseInt(subCatDiv.dataset.subClassId);
        } else {
            my.subClassId = undefined;
        }
        my.subClassIds = subCatDiv.dataset.subClassIds?.split(',').map(value => parseInt(value));
        my.invTypes = subCatDiv.dataset.invTypes?.split(',').map(value => parseInt(value));
        my.extraFilters = subCatDiv.dataset.extraFilters?.split(',').map(value => parseInt(value));
        my.bonusStat = subCatDiv.dataset.bonusStat != null && parseInt(subCatDiv.dataset.bonusStat) || undefined;
        my.hashCode = subCatDiv.dataset.hashCode;

        // Show any subsubcategories under this subcategory.
        let selector = '.main .categories .subsubcategory';
        selector += '[data-parent-class="' + subCatDiv.dataset.classId + '"]';
        selector += '[data-parent-sub-category="' + subCatDiv.dataset.subCategoryIndex + '"]';
        (qsa(selector) as NodeListOf<HTMLDivElement>).forEach(node => {
            node.dataset.visible = '1';
        });
    } else {
        // De-select this subcategory, reverting back to the parent category criteria.
        my.classId = parseInt(subCatDiv.dataset.parentClass || '-1');
        my.subClassId = undefined;
        my.subClassIds = undefined;
        my.invTypes = undefined;
        my.extraFilters = undefined;
        my.bonusStat = undefined;

        const selector = `.main .categories .category[data-class-id="${subCatDiv.dataset.parentClass}"]`;
        const catDiv = qs(selector) as HTMLDivElement|undefined;
        my.hashCode = catDiv ? catDiv.dataset.hashCode : subCatDiv.dataset.parentClass;
    }
}

/**
 * Event handler for clicking a subsubcategory.
 */
function clickSubSubCategory(subsubCatDiv: HTMLDivElement) {
    const wasSelected = !!subsubCatDiv.dataset.selected;

    // De-select every subsubcategory.
    (qsa('.main .categories .subsubcategory[data-selected]') as NodeListOf<HTMLDivElement>).forEach(node => {
        delete node.dataset.selected;
    });

    if (!wasSelected) {
        // Select this subsubcategory.
        subsubCatDiv.dataset.selected = '1';

        my.classId = parseInt(subsubCatDiv.dataset.classId || '-1');
        my.subClassId = parseInt(subsubCatDiv.dataset.subClassId || '-1');
        my.subClassIds = subsubCatDiv.dataset.subClassIds?.split(',').map(value => parseInt(value));
        my.invTypes = subsubCatDiv.dataset.invTypes?.split(',').map(value => parseInt(value));
        my.extraFilters = subsubCatDiv.dataset.extraFilters?.split(',').map(value => parseInt(value));
        my.bonusStat = subsubCatDiv.dataset.bonusStat != null && parseInt(subsubCatDiv.dataset.bonusStat) || undefined;
        my.hashCode = subsubCatDiv.dataset.hashCode;
    } else {
        // De-select this subsubcategory, reverting back to the parent subcategory criteria.
        let selector = '.main .categories .subcategory';
        selector += `[data-parent-class="${subsubCatDiv.dataset.parentClass}"]`;
        selector += `[data-sub-category-index="${subsubCatDiv.dataset.parentSubCategory}"]`;

        const subCatDiv = qs(selector) as HTMLDivElement|undefined;
        if (subCatDiv) {
            delete subCatDiv.dataset.selected;
            clickSubCategory(subCatDiv);
        }
    }
}

/**
 * De-selects all categories, returning to the initial state.
 */
function deselectAll() {
    (qsa('.main .categories > div') as NodeListOf<HTMLDivElement>).forEach(function (node) {
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
 */
async function getCategories(): Promise<Category[]> {
    if (my.categories.length) {
        return my.categories;
    }

    const locale = getCurrentLocale();
    const response = await Progress.fetch(`json/categories.${locale}.json`, {mode: 'same-origin'});
    if (!response.ok) {
        throw 'Cannot get list of categories!';
    }

    my.categories = await response.json();
    my.categories.forEach(category => {
        if (category['class'] === ItemClass.BattlePet) {
            category.subcategories?.forEach(subcategory => {
                if (subcategory.subClass) {
                    my.battlePetTypes[subcategory.subClass] = subcategory.name;
                }
            });
        }
    });

    return my.categories;
}

/**
 * Parses the colors out of a name string and returns a node to use in the category div.
 */
function getNameNode(cat: Category|Subcategory): Node {
    const nameString = cat.name;
    let match = /^\|c([0-9a-f]{2})([0-9a-f]{6})(.*)\|r$/.exec(nameString);
    if (match) {
        return ce('span', {style: {color: '#' + match[2] + match[1]}}, ct(match[3]));
    }
    if ('bonusStat' in cat && cat.bonusStat) {
        return ce('span', {className: 'q2'}, ct(nameString));
    }

    return ct(nameString);
}

/**
 * Called when the user changes their preferred locale, this updates the UI with the new names.
 */
async function onLocaleChange() {
    my.categories = [];
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
