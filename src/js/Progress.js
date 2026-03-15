import {querySelector as qs} from "./utils";

const my = Object.seal({
    runningFetchCount: 0,
    totalFetchCount: 0,

    area: qs('.main .progress'),
    bar: qs('.main .progress .progress-bar-value'),
});

/**
 * Manages a progress bar during HTTP fetch operations.
 */
const Progress = {
    /**
     * Returns a Response promise from fetch() but monitors the download progress in the UI.
     *
     * @param {string|Request} resource
     * @param {object}         options
     * @returns {Promise<Response>}
     */
    async fetch(resource, options) {
        my.totalFetchCount++;
        my.runningFetchCount++;
        updateDisplay();

        const response = await fetch(resource, options);
        if (!response.ok || !response.body) {
            my.runningFetchCount--;
            updateDisplay();

            return response;
        }

        return new Response(new ReadableStream({
            start: async function (controller) {
                const reader = response.body.getReader();
                while (true) {
                    let {done, value} = await reader.read();
                    if (done) {
                        controller.close();

                        my.runningFetchCount--;
                        updateDisplay();

                        break;
                    }
                    controller.enqueue(value);
                }
            }
        }));
    }
};
export default Progress;

/**
 * Updates the UI to reflect how many fetches are in progress and how many have finished.
 */
function updateDisplay() {
    if (my.runningFetchCount === 0 || my.totalFetchCount === 0) {
        my.totalFetchCount = 0;
        delete my.area.dataset.shown;
        return;
    }

    let finishedCount = my.totalFetchCount - my.runningFetchCount;
    my.bar.style.width = (finishedCount / my.totalFetchCount * 100) + '%';
    my.area.dataset.shown = 1;
}
