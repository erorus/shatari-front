import {MS_HOUR} from "./constants";
import Detail from "./Detail";
import Hash from "./Hash";
import Progress from "./Progress";
import Search from "./Search";
import {querySelector as qs, querySelectorAll as qsa} from "./utils";

type User = {
    id: string,
    paid: boolean,
    // UNIX timestamp, milliseconds
    checked: number,
}

let user: User|null;
let filterButton: HTMLAnchorElement;
let welcomeElement: HTMLDivElement|null;

function isEnabled(): boolean {
    return location.hostname === 'undermine.exchange' || localStorage.getItem('account') != null;
}

export const showBenefitsText = (event?: MouseEvent) => {
    event && event.preventDefault();

    Detail.hide();
    Search.hide();
    WH.Tooltips.hide();
    (qs('.main .welcome') as HTMLElement).style.display = '';

    welcomeElement && welcomeElement.scrollIntoView();
};

export const isPaid = (): boolean => !isEnabled() || !!user?.paid;

export async function init(): Promise<void> {
    if (!isEnabled()) {
        return;
    }

    welcomeElement = qs('.welcome .account') as HTMLDivElement;
    welcomeElement && (welcomeElement.style.display = '');
    filterButton = qs('.main .search-bar .filter') as HTMLAnchorElement;
    (filterButton.querySelector(':scope > div') as HTMLDivElement).addEventListener('click', () => {
        if (!isPaid()) {
            showBenefitsText();
        }
    });

    qsa('.main .bottom-bar .account form').forEach(ele =>
        (ele as HTMLFormElement).addEventListener('submit', () => Hash.storeInSession())
    );

    (qs('.main .bottom-bar .account form.logout .red-button') as HTMLButtonElement)
        ?.addEventListener('click', () => {
            location.href = 'https://www.patreon.com/checkout/erorus?rid=6189924&is_free_trial=true';
        });

    await updateUser();
}

async function updateUser(): Promise<void> {
    const mainElement = qs('.main') as HTMLDivElement;
    user = await fetchUser();
    if (user?.id) {
        mainElement.dataset.account = user.paid ? 'paid' : 'free';
    } else {
        mainElement.dataset.account = 'none';
    }

    const paid = isPaid();

    filterButton.querySelectorAll(':scope > div input, :scope > div select').forEach(ele => {
        (ele as HTMLInputElement|HTMLSelectElement).disabled = !paid;
    });

    setTimeout(updateUser, 4 * MS_HOUR);
}

async function fetchUser(): Promise<User|null> {
    const response = await Progress.fetch('/account/user', {
        mode: 'same-origin',
        priority: 'high',
        redirect: 'error',
    });

    if (!response.ok) {
        return null;
    }

    const record = await response.json() as User;

    return record?.id ? record : null;
}
