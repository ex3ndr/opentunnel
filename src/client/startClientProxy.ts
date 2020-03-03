import net from 'net';
import WebSocket from 'ws';
import fetch from 'node-fetch';
import { BufferWriter } from './../utils/BufferWriter';
import { parseClientProto, serializeClientProto } from '../proto/clientProto';

class ProtoConnection {
    readonly ws: WebSocket;
    readonly uid: string;
    readonly port: number;
    private _socket!: net.Socket;

    constructor(ws: WebSocket, port: number, uid: string) {
        this.ws = ws;
        this.uid = uid;
        this.port = port;
        this._start();
    }

    private _start = () => {
        this._socket = new net.Socket();
        let closed = false;
        this._socket.on('connect', () => {
            if (!closed) {
                console.log(this.uid + ': Connected');
                this.ws.send(serializeClientProto({ type: 'connected', id: this.uid }));
            }
        });
        this._socket.on('data', (data) => {
            if (!closed) {
                console.log(this.uid + ': << ' + data.length);
                this.ws.send(serializeClientProto({ type: 'frame', id: this.uid, frame: data }));
            }
        });
        this._socket.on('error', () => {
            if (!closed) {
                closed = true;

                console.log(this.uid + ': Error');
                this.ws.send(serializeClientProto({ type: 'aborted', id: this.uid }));
            }
        });
        this._socket.on('close', () => {
            if (!closed) {
                closed = true;
                console.log(this.uid + ': Closed');
                this.ws.send(serializeClientProto({ type: 'aborted', id: this.uid }));
            }
        });
        this._socket.connect(this.port);
    }

    onFrame = (buffer: Buffer) => {
        console.log(this.uid + ': >> ' + buffer.length);
        this._socket.write(buffer); // Handle result??
    }

    close = () => {
        try {
            if (!this._socket.destroyed) {
                this._socket.destroy();
            }
        } catch (e) {
            // Ignore
        }
    }
}

class ProtoSession {
    private ws: WebSocket;
    private port: number;
    private httpPort: number;
    private key: Buffer;
    private connections = new Map<string, ProtoConnection>();

    constructor(ws: WebSocket, port: number, httpPort: number, key: Buffer) {
        this.ws = ws;
        this.port = port;
        this.httpPort = httpPort;
        this.key = key;
        this._start();
    }

    private _start = () => {
        this.ws.on('message', this._handleMessage);
        let builder = new BufferWriter();
        builder.appendUInt8(0);
        builder.appendUInt16(this.key.length);
        builder.appendBuffer(this.key);
        this.ws.send(builder.build());
    }

    //
    // Session Logic
    //

    private _handleMessage = (buffer: Buffer) => {
        if (!Buffer.isBuffer(buffer)) {
            return;
        }
        let message = parseClientProto(buffer);
        if (!message) {
            return;
        }

        if (message.type === 'connected') {
            console.log(message.id + ': Request connect');
            this.connections.set(message.id, new ProtoConnection(this.ws, this.port, message.id));
        } else if (message.type === 'frame') {
            this.connections.get(message.id)!.onFrame(message.frame);
        } else if (message.type === 'aborted') {
            this.connections.get(message.id)!.close();
        } else if (message.type === 'wk-request') {
            console.log(message.requestId + ': Well-known request at ' + message.path);
            (async () => {
                try {
                    let res = await fetch('http://localhost:' + this.httpPort + '/.well-known' + message.path);
                    if (res.ok) {
                        console.log(res);
                        let ex = await res.buffer();
                        this.ws.send(serializeClientProto({ type: 'wk-response', requestId: message.requestId, content: ex }));
                    } else {
                        this.ws.send(serializeClientProto({ type: 'wk-response', requestId: message.requestId, content: null }));
                    }
                } catch (e) {
                    this.ws.send(serializeClientProto({ type: 'wk-response', requestId: message.requestId, content: null }));
                }
            })();
        }
    }

    destroy() {
        this.ws.off('message', this._handleMessage);
    }
}

export function startClientProxy(proxyUrl: string, port: number, httpPort: number, key: string) {
    let _ws: WebSocket | null = null;
    let session: ProtoSession | null = null;
    let keyValue = Buffer.from(key, 'base64');

    function onStart() {
        session = new ProtoSession(_ws!, port, httpPort, keyValue);
    }

    function onClose() {

        try {
            session!.destroy();
        } catch (e) {
            // Ignore
        }
        session = null;

        try {
            _ws!.close();
        } catch (e) {
            // Ignore
        }
        _ws = null;

        setTimeout(() => {
            _start();
        }, 1000);
    }

    function _start() {
        console.log('trying to connect');
        let ws = new WebSocket(proxyUrl);
        ws.on('open', () => {
            if (_ws === ws) {
                console.log('open');
                onStart();
            }
        });
        ws.on('close', () => {
            if (_ws === ws) {
                console.log('close');
                onClose();
            }
        });
        ws.on('error', () => {
            if (_ws === ws) {
                console.log('error');
                onClose();
            }
        });
        _ws = ws;
    }

    _start();
}