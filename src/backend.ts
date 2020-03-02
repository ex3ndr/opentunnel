import { NodeTracker } from './utils/NodeTracker';
import { BufferReader } from './utils/BufferReader';
import { BufferWriter } from './utils/BufferWriter';
import WebSocket from 'ws';
import { startAuthenticatedServer } from "./backend/startAuthenticatedServer";
import { connect, Client, Subscription, Payload } from 'ts-nats';
import * as uuid from 'uuid';
import { serializeDiscoverMessage } from './proto/discover';
import { parseInnerSocketMessage, serializeInnerSocket } from './proto/innerSocket';
import { createLogger } from './utils/createLogger';
import fs from 'fs';

const logger = createLogger('frontend');

class BackendSession {
    readonly id = uuid.v4();
    readonly host: string;
    readonly ws: WebSocket;
    readonly nc: Client;
    readonly backendId: string;
    private _timer: any;
    private _started = false;
    private _stopped = false;
    private _discoverSubscription!: Subscription;
    private _connectSubscription!: Subscription;

    constructor(ws: WebSocket, host: string, nc: Client, backendId: string) {
        this.ws = ws;
        this.nc = nc;
        this.host = host;
        this.backendId = backendId;
        this._start();
    }

    private async _start() {
        this.ws.on('message', (msg) => {
            if (!Buffer.isBuffer(msg)) {
                return;
            }
            this._onMessage(msg);
        });
        this._discoverSubscription = await this.nc.subscribe('discover-' + this.host, (err, data) => {
            if (!this._started || this._stopped) {
                return;
            }
            if (data.reply) {
                this.nc.publish(data.reply!, serializeDiscoverMessage({ backend: this.backendId, socket: this.id }));
            }
        });
        if (this._stopped) {
            this._discoverSubscription.unsubscribe();
            return;
        }
        this._connectSubscription = await this.nc.subscribe('connect-' + this.id, (err, data) => {
            if (!this._started || this._stopped) {
                return;
            }
            if (data.reply) {
                let id = data.data as string;
                this.onNewConnection(id, data.reply);
            }
        });
        if (this._stopped) {
            this._connectSubscription.unsubscribe();
            return;
        }

        // Start
        this._started = true;
        this.nc.publish('backend-' + this.host, JSON.stringify({ state: 'connected', id: this.id }));
        this._timer = setInterval(() => {
            this.nc.publish('backend-' + this.host, JSON.stringify({ state: 'ka', id: this.id }));
        }, 1000);
    }

    private _onMessage = (buffer: Buffer) => {
        let reader = new BufferReader(buffer);
        let header = reader.readUInt8();
        if (header === 0) {
            let uidLength = reader.readUInt16();
            let uid = reader.readAsciiString(uidLength);
            console.log(uid + ': Connected');

            // Send Connected
            let writer = new BufferWriter();
            writer.appendUInt8(0);
            this.nc.publish('connection-frontend-' + uid, serializeInnerSocket({ type: 'connected' }));
        } else if (header === 1 /* Frame */) {
            let uidLength = reader.readUInt16();
            let uid = reader.readAsciiString(uidLength);
            let frameLength = reader.readUInt16();
            let frame = reader.readBuffer(frameLength);
            console.log(uid + ': << ' + frameLength);

            // Send Frame
            this.nc.publish('connection-frontend-' + uid, serializeInnerSocket({ type: 'frame', frame }));
        } else if (header === 2 /* Abort */) {
            let uidLength = reader.readUInt16();
            let uid = reader.readAsciiString(uidLength);
            console.log(uid + ': Abort');

            // Send abort
            this.nc.publish('connection-frontend-' + uid, serializeInnerSocket({ type: 'aborted' }));
        }
    }

    private onNewConnection = (id: string, reply: string) => {
        // Create new connection
        (async () => {
            await this.nc.subscribe('connection-backend-' + id, (error, data) => {
                let msg = parseInnerSocketMessage(data.data);
                if (!msg) {
                    return; // Just ignore unknown
                }

                if (msg.type === 'frame') {
                    let writer = new BufferWriter();
                    writer.appendUInt8(1);
                    writer.appendUInt16(id.length);
                    writer.appendAsciiString(id);
                    writer.appendUInt16(msg.frame.length);
                    writer.appendBuffer(msg.frame);
                    this.ws.send(writer.build());
                    console.log(id + ': >> ' + msg.frame.length);
                }
            });

            // Init connection
            let writer = new BufferWriter();
            writer.appendUInt8(0);
            writer.appendUInt16(id.length);
            writer.appendAsciiString(id);
            this.ws.send(writer.build());

            // Response
            this.nc.publish(reply);
        })();
    }

    destroy() {
        if (!this._stopped) {
            this._stopped = true;

            // Stop keep alive
            clearInterval(this._timer);
            // Notify about disconnection
            this.nc.publish('backend-' + this.host, JSON.stringify({ state: 'disconnected', id: this.id }));

            // Stop subscriptions
            if (this._discoverSubscription) {
                this._discoverSubscription.unsubscribe();
            }
            if (this._connectSubscription) {
                this._connectSubscription.unsubscribe();
            }
        }
    }
}

(async () => {
    let id = uuid.v4();
    let nc = await connect({ payload: Payload.BINARY });
    let publicKey = fs.readFileSync('auth_public.key', 'ascii');

    // Tracking nodes
    let nodeTracker = new NodeTracker(id, nc);
    nodeTracker.onNodeConnected = (id: string) => {
        logger.info('Node connected: ' + id);
    }
    nodeTracker.onNodeDisconnected = (id: string) => {
        logger.info('Node disconnected: ' + id);
    }
    await nodeTracker.start();


    // Start backend WS server
    let connections = new Map<string, BackendSession>();
    startAuthenticatedServer(publicKey, 9001, (host, ws) => {
        host = host.toLowerCase();
        console.log('Received: ' + host);

        if (connections.has(host)) {
            let ex = connections.get(host)!;
            connections.delete(host);
            ex.destroy();
        }
        connections.set(host, new BackendSession(ws, host, nc, id));
        ws.on('close', () => {
            if (connections.has(host)) {
                let ex = connections.get(host)!;
                connections.delete(host);
                ex.destroy();
            }
        });
        ws.on('error', () => {
            if (connections.has(host)) {
                let ex = connections.get(host)!;
                connections.delete(host);
                ex.destroy();
            }
        });
    });
})();