import {createElement as ce, emptyElement as ee, querySelector as qs} from "./utils";
import Auctions from "./Auctions";
import * as Items from "./Items";

const searchBox = qs('.main .search-bar input[type="text"]') as HTMLInputElement;
const textContainer = searchBox.parentNode as HTMLElement;
const datalist = qs('.main .search-bar .datalist') as HTMLElement;

const MIN_SEARCH_LENGTH = 2;
const MAX_SUGGESTIONS = 10;
const SEARCH_DELAY = 150;

let searchTimer: number|undefined;
let lastSearch: string;
let blurTimeout: number|undefined;

/** Manages the search suggestions list. */
const Suggestions = {
    /**
     * Adds event listeners.
     */
    init() {
        const queueUpdate = () => {
            if (searchTimer !== undefined) {
                clearTimeout(searchTimer);
            }
            searchTimer = setTimeout(update, SEARCH_DELAY);
        };

        searchBox.addEventListener('keydown', event => {
            if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
                // Avoid the up/down arrows from moving the cursor.
                event.preventDefault();
            }
        });
        searchBox.addEventListener('keyup', event => {
            let typedLetter = event.key.length === 1;
            if (event.key === 'Backspace' || typedLetter || searchBox.value.length < MIN_SEARCH_LENGTH) {
                // Updates are queued with a short delay, so fast typing doesn't have earlier results overwriting
                // later ones.
                queueUpdate();
            } else if (event.key === 'Enter') {
                // The actual search functionality was added in the keyup listener in the main init.
                searchBox.blur();
            } else if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
                navigateList(event.key === 'ArrowDown');
            }
        });
        searchBox.addEventListener('blur', event => {
            if (blurTimeout !== undefined) {
                clearTimeout(blurTimeout);
            }
            // We set a blur timeout so if you click the data list, the click actually lands (instead of the click
            // blurring the text box, which then immediately hides the data list, which causes the click to land
            // under where the list was.
            blurTimeout = setTimeout(() => {
                blurTimeout = undefined;
                delete textContainer.dataset.withFocus;
            }, SEARCH_DELAY);
        });
        searchBox.addEventListener('focus', function (event) {
            if (blurTimeout) {
                // We might get a blur then immediate focus when the "clear all" button is clicked, causing the
                // button to gain focus, then immediately set it back to the search box. Clear the blur timeout
                // so we don't keep the data list hidden once we start typing.
                clearTimeout(blurTimeout);
                blurTimeout = undefined;
            }
            queueUpdate();
            delete datalist.dataset.withItems;
            textContainer.dataset.withFocus = '1';
        });

        const onOptionClick = (option: HTMLElement) => {
            searchBox.value = option.dataset.value ?? '';
            searchBox.dispatchEvent(new KeyboardEvent('keyup', {key: 'Enter'}));
        };
        for (let x = 0; x < MAX_SUGGESTIONS; x++) {
            let option = ce('div');
            option.addEventListener('click', onOptionClick.bind(null, option));
            datalist.appendChild(option);
        }
    },
};
export default Suggestions;

function navigateList(down: boolean) {
    if (!datalist.dataset.withItems) {
        return;
    }

    let curSelection = datalist.querySelector('div.selected') as HTMLDivElement|null;
    let newSelection: HTMLDivElement|null;
    if (!curSelection) {
        if (down) {
            newSelection = datalist.querySelector('div');
        } else {
            return;
        }
    } else {
        newSelection = (down ? curSelection.nextSibling : curSelection.previousSibling) as HTMLDivElement|null;
    }
    if (!newSelection || !newSelection.textContent) {
        return;
    }

    if (curSelection) {
        curSelection.classList.remove('selected');
    }
    newSelection.classList.add('selected');
    const parent = newSelection.parentNode as HTMLElement;
    const firstSibling = parent.firstChild as HTMLElement;
    parent.scrollTop = newSelection.offsetTop - firstSibling.offsetTop;

    searchBox.value = newSelection.dataset.value ?? '';
    searchBox.selectionStart = searchBox.value.length;
}

/**
 * Updates the search suggestions datalist element.
 */
async function update() {
    searchTimer = undefined;
    datalist.querySelectorAll('div.selected').forEach(div => {
        div.classList.remove('selected');
    });
    const options = datalist.querySelectorAll('div');

    const typed = searchBox.value.toLowerCase().replace(/^\s+|\s+$/, '');
    if (typed.length < MIN_SEARCH_LENGTH) {
        options.forEach(option => ee(option));
        delete datalist.dataset.withItems;

        return;
    }

    lastSearch = typed;
    const items = await Auctions.hydrateList(await Items.search(Items.SearchMode.Suggestions), {});
    if (lastSearch !== typed) {
        return;
    }
    items.sort((a, b) => {
        let aFullName = a.name + (a.bonusSuffix ? ' ' + Items.getSuffix(a.id, a.bonusSuffix)?.name : '');
        let bFullName = b.name + (b.bonusSuffix ? ' ' + Items.getSuffix(b.id, b.bonusSuffix)?.name : '');
        let aFirst = aFullName.toLowerCase().startsWith(typed) ? 0 : 1;
        let bFirst = bFullName.toLowerCase().startsWith(typed) ? 0 : 1;

        return (aFirst - bFirst) || (b.quantity - a.quantity) || aFullName.localeCompare(bFullName);
    });
    items.splice(MAX_SUGGESTIONS);

    let index = 0;
    for (let item; item = items[index]; index++) {
        let name = item.name + (item.bonusSuffix ? ' ' + Items.getSuffix(item.id, item.bonusSuffix)?.name : '');
        let option = options[index];
        ee(option);
        option.dataset.value = name;
        option.appendChild(ce('img', {
            src: Items.getIconUrl(item.icon, Items.IconSize.Medium),
            loading: 'lazy',
        }));
        option.appendChild(document.createTextNode(name));
    }
    while (index < MAX_SUGGESTIONS) {
        ee(options[index++]);
    }
    if (options[0].firstChild) {
        datalist.dataset.withItems = '1';
    } else {
        delete datalist.dataset.withItems;
    }
}
