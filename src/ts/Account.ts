import {MS_HOUR} from "./constants";
import Progress from "./Progress";
import {querySelector as qs} from "./utils";

type User = {
    id: string,
    paid: boolean,
    // UNIX timestamp, milliseconds
    checked: number,
}

let user: User|null;

export function isEnabled(): boolean {
    return localStorage.getItem('account') != null;
}

export const isPaid = (): boolean => !isEnabled() || !!user?.paid;

export async function init(): Promise<void> {
    if (!isEnabled()) {
        return;
    }

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
