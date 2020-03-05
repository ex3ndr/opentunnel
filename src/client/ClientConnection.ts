import net from 'net';
import WebSocket from 'ws';
import { serializeClientProto } from '../proto/clientProto';

export class ClientConnection {
    readonly ws: WebSocket;
    readonly uid: string;
    readonly port: number;
    onAborted?: () => void;

    private _socket!: net.Socket;
    private _interval: any;

    constructor(port: number, uid: string, ws: WebSocket) {
        this.ws = ws;
        this.uid = uid;
        this.port = port;
    }

    start = () => {
        this._socket = new net.Socket();
        let closed = false;
        this._socket.on('connect', () => {
            if (!closed) {
                this.ws.send(serializeClientProto({ type: 'connected', id: this.uid }));
                this._interval = setInterval(() => {
                    this.ws.send(serializeClientProto({ type: 'ka' }));
                }, 15000);
            }
        });
        this._socket.on('data', (data) => {
            if (!closed) {
                this.ws.send(serializeClientProto({ type: 'frame', id: this.uid, frame: data }));
            }
        });
        this._socket.on('error', (e) => {
            if (!closed) {
                closed = true;
                this.ws.send(serializeClientProto({ type: 'aborted', id: this.uid }));
                if (this.onAborted) {
                    this.onAborted();
                }
            }
        });
        this._socket.on('close', () => {
            if (!closed) {
                closed = true;
                this.ws.send(serializeClientProto({ type: 'aborted', id: this.uid }));
                if (this.onAborted) {
                    this.onAborted();
                }
            }
        });
        this._socket.connect(this.port);
    }

    onFrame = (buffer: Buffer) => {
        this._socket.write(buffer); // Handle result??
    }

    close = () => {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
        try {
            if (!this._socket.destroyed) {
                this._socket.destroy();
            }
        } catch (e) {
            // Ignore
        }
    }
}