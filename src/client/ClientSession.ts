import WebSocket from 'ws';
import fetch from 'node-fetch';
import { ClientConnection } from './ClientConnection';
import { BufferWriter } from './../utils/BufferWriter';
import { parseClientProto, serializeClientProto } from '../proto/clientProto';
import { createLogger } from '../utils/createLogger';

const logger = createLogger('client');

export class ClientSession {
    private ws: WebSocket;
    private port: number;
    private httpPort: number;
    private key: Buffer;
    private connections = new Map<string, ClientConnection>();

    constructor(port: number, httpPort: number, key: Buffer, ws: WebSocket) {
        this.port = port;
        this.httpPort = httpPort;
        this.key = key;
        this.ws = ws;

        // Initialize session
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
            logger.info(message.id + ': New connection');
            let id = message.id;
            let connection = new ClientConnection(this.port, id, this.ws);
            connection.onAborted = () => {
                this.connections.delete(id);
            };
            this.connections.set(message.id, connection);
            connection.start();
        } else if (message.type === 'frame') {
            if (!this.connections.has(message.id)) {
                return;
            }
            this.connections.get(message.id)!.onFrame(message.frame);
        } else if (message.type === 'aborted') {
            if (!this.connections.has(message.id)) {
                return;
            }
            this.connections.get(message.id)!.close();
        } else if (message.type === 'wk-request') {
            logger.info(message.requestId + ': Well-known request at ' + message.path);
            (async () => {
                try {
                    let res = await fetch('http://localhost:' + this.httpPort + '/.well-known' + message.path);
                    if (res.ok) {
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
        for (let c of this.connections) {
            c[1].close();
        }
    }
}