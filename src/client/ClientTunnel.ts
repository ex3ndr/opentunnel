import { ClientSession } from './ClientSession';
import WebSocket from 'ws';

export class ClientTunnel {
    readonly port: number;
    readonly key: Buffer;
    readonly endpoint: string;
    readonly wkHandler: (path: string) => Promise<Buffer | null>;
    onConnected?: () => void;
    onDisconnected?: () => void;

    private _session: ClientSession | null = null;
    private _ws: WebSocket | null = null;
    private _started = false;

    constructor(
        port: number,
        key: Buffer,
        endpoint: string,
        wkHandler: (path: string) => Promise<Buffer | null>
    ) {
        this.port = port;
        this.key = key;
        this.endpoint = endpoint;
        this.wkHandler = wkHandler;
    }

    start = () => {
        if (!this._started) {
            this._started = true;
            this._start();
        }
    }

    private _start = () => {
        let ws = new WebSocket(this.endpoint);
        ws.on('open', () => {
            if (this._ws === ws) {
                if (this.onConnected) {
                    this.onConnected();
                }
                this._session = new ClientSession(this.port, this.key, this.wkHandler, ws);
            }
        });
        ws.on('close', () => {
            if (this._ws === ws) {
                if (this.onDisconnected) {
                    this.onDisconnected();
                }
                this._disconnected();
            }
        });
        ws.on('error', (e) => {
            if (this._ws === ws) {
                this._disconnected();
            }
        });
        this._ws = ws;
    }

    private _disconnected = () => {
        // Destroy session
        if (this._session) {
            try {
                this._session!.destroy();
            } catch (e) {
                // Ignore
            }
            this._session = null;
        }

        // Destroy ws
        if (this._ws) {
            try {
                this._ws!.close();
            } catch (e) {
                // Ignore
            }
            this._ws = null;
        }

        // Retry after randomized period
        setTimeout(() => {
            this._start();
        }, 1000 + Math.random() * 5000);
    }
}