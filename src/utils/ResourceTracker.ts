export class ResouceTracker {
    private _onDestroyed: (key: string) => void;
    private _resources = new Map<string, any>();

    constructor(onDestroyed: (key: string) => void) {
        this._onDestroyed = onDestroyed;
    }

    addResource(key: string) {
        let ex = this._resources.get(key);
        if (ex) {
            clearTimeout(ex);
        }
        this._resources.set(key, setTimeout(() => {
            this._resources.delete(key);
            this._onDestroyed(key);
        }, 5000));
    }
}