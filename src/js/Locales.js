import {createElement as ce, querySelector as qs} from "./utils";

const POPULATION_NAMES = {
    enus: ['', 'New', 'New Players', 'Low', 'Medium', 'High', 'Full', 'Locked'],
    dede: ['', 'Neu', 'Empfohlen', 'Niedrig', 'Mittel', 'Hoch', 'Voll', 'Verschl.'],
    eses: ['', 'Nuevo', 'Jugadores nuevos', 'Bajo', 'Medio', 'Alto', 'Lleno', 'Bloqueado'],
    esmx: ['', 'Nuevo', 'Jugadores nuevos', 'Bajo', 'Medio', 'Alto', 'Lleno', 'Bloqueado'],
    frfr: ['', 'Nouveau', 'Recommandé', 'Faible', 'Moyenne', 'Élevée', 'Complet', 'Verrouillé'],
    itit: ['', 'Nuovo', 'Nuovi giocatori', 'Bassa', 'Media', 'Alta', 'Saturo', 'Bloccato'],
    ptbr: ['', 'Novo', 'Novos jogadores', 'Baixo', 'Médio', 'Alto', 'Completo', 'Trancado'],
    ruru: ['', 'Новый', 'Новые игроки', 'Низкая', 'Средняя', 'Высокая', 'Нет мест', 'Доступ ограничен'],
    zhtw: ['', '新', '新', '低', '中', '高', '滿', '已鎖定'],
    kokr: ['', '신규', '신규 플레이어', '쾌적', '보통', '혼잡', '정원초과', '잠김'],
};

const NAMES = {
    enus: 'English',
    dede: 'Deutsch',
    eses: 'Español',
    esmx: 'Español (Latino)',
    frfr: 'Français',
    itit: 'Italiano',
    ptbr: 'Português',
    ruru: 'Русский',
    zhtw: '中文',
    kokr: '한국어',
};

const WOWHEAD_DOMAINS = {
    enus: 'www',
    dede: 'de',
    eses: 'es',
    esmx: 'mx',
    frfr: 'fr',
    itit: 'it',
    ptbr: 'pt',
    ruru: 'ru',
    zhtw: 'tw',
    kokr: 'ko',
};

const my = {
    changeCallbacks: [],

    locale: 'enus',
};

/**
 * Methods to handle locale changes, to show localized names and fields.
 */
const Locales = {
    /**
     * Returns the current 4-letter lowercase locale code.
     *
     * @return {string}
     */
    getCurrent: () => my.locale,

    /**
     * Returns an ordered list of population names for the current locale.
     *
     * @return {string[]}
     */
    getPopulationNames: () => POPULATION_NAMES[my.locale],

    /**
     * Returns the Wowhead subdomain for the current locale.
     *
     * @return {string}
     */
    getWowheadDomain: () => WOWHEAD_DOMAINS[my.locale],

    /**
     * Returns the Wowhead path prefix for the current locale.
     *
     * @return {string}
     */
    getWowheadPathPrefix: () => my.locale === 'enus' ? '' : (Locales.getWowheadDomain() + '/'),

    /**
     * Sets up any controls and reads the user's preferred locale from local storage.
     */
    init() {
        let curLocale = localStorage.getItem('locale') || my.locale;
        if (!NAMES.hasOwnProperty(curLocale)) {
            curLocale = my.locale;
        }
        my.locale = curLocale;

        const sel = qs('.main .bottom-bar select.locales');
        for (let id in NAMES) {
            if (!NAMES.hasOwnProperty(id)) {
                continue;
            }

            let o = ce('option', {
                value: id,
                label: NAMES[id],
                selected: id === my.locale,
            }, document.createTextNode(NAMES[id]));

            sel.appendChild(o);
        }
        sel.addEventListener('change', () => changeLocale(sel));
    },

    /**
     * Registers a callback function for when the locale changes. The new locale is given as the first param.
     *
     * @param {function} callback
     */
    registerCallback(callback) {
        if (!my.changeCallbacks.includes(callback)) {
            my.changeCallbacks.push(callback);
        }
    },
};
export default Locales;

/**
 * Change the locale to the currently-selected locale in the given select element.
 *
 * @param {HTMLSelectElement} sel
 */
function changeLocale(sel) {
    my.locale = sel.options[sel.selectedIndex].value;

    try {
        localStorage.setItem('locale', my.locale);
    } catch (e) {
        // Ignore
    }

    my.changeCallbacks.forEach(f => f(Locales.getCurrent()));
}
