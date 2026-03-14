/**
 * Handles migrating from oribos.exchange to undermine.exchange.
 */

import {createElement as ce} from './utils.js';

export const UndermineMigration = {
    /**
     * Executes any settings migration code. Returns true when we should abort further page initialization.
     *
     * @return {boolean}
     */
    abortInit() {
        switch (location.host) {
            case 'oribos.exchange':
                oribosPart();
                return true;

            case 'undermine.exchange':
                underminePart();
                break;
        }

        return false;
    }
};

/**
 * Receives all cross-document messages. Listens for those coming from oribos.exchange to receive local storage
 * migration information.
 *
 * @param {MessageEvent} event
 */
function migrationMessage(event) {
    if (event.origin !== 'https://oribos.exchange') {
        return;
    }

    if (event.data.action !== 'migration') {
        return;
    }

    const storage = event.data.storage || {};
    Object.keys(storage).forEach(key => {
        localStorage.setItem(key, storage[key]);
    });

    location.reload();
}

/**
 * Stuff to run on oribos.exchange for the migration.
 */
function oribosPart() {
    location.href = 'https://undermine.exchange/' + location.hash;
}

/**
 * Stuff to run on undermine.exchange for the migration.
 */
function underminePart() {
    // Quit if we've already attempted migration.
    if (localStorage.getItem('migrated')) {
        return;
    }

    // Mark migration as attempted. Quit if we can't write to localstorage.
    try {
        localStorage.setItem('migrated', '1');
    } catch (e) {
        console.log('Local storage not available.');
        return;
    }

    // Prepare to receive migration messages.
    window.addEventListener('message', migrationMessage);

    // Open the migration iframe.
    document.body.appendChild(ce('iframe', {
        style: {display: 'none'},
        src: 'https://oribos.exchange/migration.html',
    }));
}
