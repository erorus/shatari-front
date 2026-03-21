declare const WH: {
    Tooltips: {
        cursorUpdate(mouseEvent: MouseEvent, padX?: number, padY?: number);
        hide();
        showAtCursor(event: MouseEvent, finalContent: Node|string);
    }
}

type WowheadDataset = {
    simpleTooltip?: string;
    wowhead?: string;
};
