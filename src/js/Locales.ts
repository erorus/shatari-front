/**
 * Methods to handle locale changes, to show localized names and fields.
 */

import {createElement as ce, querySelector as qs} from "./utils";

export enum Locale {
    enus = 'enus',
    dede = 'dede',
    eses = 'eses',
    esmx = 'esmx',
    frfr = 'frfr',
    itit = 'itit',
    ptbr = 'ptbr',
    ruru = 'ruru',
    zhtw = 'zhtw',
    kokr = 'kokr',
}

const POPULATION_NAMES: {[key in Locale]: [string, string, string, string, string, string, string, string]} = {
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

const NAMES: {[key in Locale]: string} = {
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

const WOWHEAD_DOMAINS: {[key in Locale]: string} = {
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

type ModuleVars = {
    changeCallbacks: Array<(locale: Locale) => void>,
    locale: Locale,
}
const my: ModuleVars = {
    changeCallbacks: [],
    locale: Locale.enus,
};

/**
 * Returns the current 4-letter lowercase locale code.
 */
export const getCurrent = (): Locale => my.locale;

/**
 * Returns an ordered list of population names for the current locale.
 */
export const getPopulationNames = (): [string, string, string, string, string, string, string, string] => POPULATION_NAMES[my.locale];

/**
 * Returns the Wowhead subdomain for the current locale.
 */
export const getWowheadDomain = (): string => WOWHEAD_DOMAINS[my.locale];

/**
 * Returns the Wowhead path prefix for the current locale.
 */
export const getWowheadPathPrefix = (): string => my.locale === Locale.enus ? '' : (getWowheadDomain() + '/');

/**
 * Sets up any controls and reads the user's preferred locale from local storage.
 */
export function init() {
    let storedLocale = localStorage.getItem('locale') ?? '';
    if (isLocale(storedLocale)) {
        my.locale = storedLocale;
    }

    const sel = qs('.main .bottom-bar select.locales') as HTMLSelectElement;
    Object.values(Locale).forEach(locale => {
        sel.appendChild(ce('option', {
            value: locale,
            label: NAMES[locale],
            selected: locale === my.locale,
        }, document.createTextNode(NAMES[locale])));
    });
    sel.addEventListener('change', () => changeLocale(sel));
}

/**
 * Registers a callback function for when the locale changes. The new locale is given as the first param.
 */
export function registerCallback(callback: (locale: Locale) => void) {
    if (!my.changeCallbacks.includes(callback)) {
        my.changeCallbacks.push(callback);
    }
}

/**
 * Change the locale to the currently-selected locale in the given select element.
 */
function changeLocale(sel: HTMLSelectElement) {
    const chosenLocale = sel.options[sel.selectedIndex].value;
    if (!isLocale(chosenLocale)) {
        return;
    }

    my.locale = chosenLocale;

    try {
        localStorage.setItem('locale', my.locale);
    } catch (e) {
        // Ignore
    }

    my.changeCallbacks.forEach(f => f(my.locale));
}

/**
 * Returns whether the given string is a valid locale enum value.
 */
function isLocale(value: string): value is Locale {
    return Object.values(Locale).includes(value as Locale);
}
