import { BufferReader } from './utils/BufferReader';
import { BufferWriter } from './utils/BufferWriter';
import WebSocket from 'ws';
import { ResouceTracker } from './utils/ResourceTracker';
import { startBackendServer } from "./backend/startBackendServer";
import { connect, Client, Subscription } from 'ts-nats';
import * as uuid from 'uuid';
import crc from 'node-crc';

class BackendSession {
    readonly id = uuid.v4();
    readonly host: string;
    readonly ws: WebSocket;
    readonly nc: Client;
    private _timer: any;
    private _started = false;
    private _stopped = false;
    private _discoverSubscription!: Subscription;
    private _connectSubscription!: Subscription;

    constructor(ws: WebSocket, host: string, nc: Client) {
        this.ws = ws;
        this.nc = nc;
        this.host = host;
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
                this.nc.publish(data.reply!, this.id);
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
            this.nc.publish('connection-frontend-' + uid, writer.build().toString('hex'));
        } else if (header === 1 /* Frame */) {
            let uidLength = reader.readUInt16();
            let uid = reader.readAsciiString(uidLength);
            let frameLength = reader.readUInt16();
            let frame = reader.readBuffer(frameLength);
            console.log(uid + ': << ' + frameLength + ', crc:' + (crc.crc32(frame) as Buffer).toString('hex'));

            // Send Frame
            let writer = new BufferWriter();
            writer.appendUInt8(1);
            writer.appendUInt16(frameLength);
            writer.appendBuffer(frame)
            this.nc.publish('connection-frontend-' + uid, writer.build().toString('hex'));
        } else if (header === 2 /* Abort */) {
            let uidLength = reader.readUInt16();
            let uid = reader.readAsciiString(uidLength);
            console.log(uid + ': Abort');

            // Send abort
            let writer = new BufferWriter();
            writer.appendUInt8(2);
            this.nc.publish('connection-frontend-' + uid, writer.build().toString('hex'));
        }
    }

    private onNewConnection = (id: string, reply: string) => {
        // Create new connection
        (async () => {
            await this.nc.subscribe('connection-backend-' + id, (error, data) => {
                let body = Buffer.from(data.data, 'hex');
                let writer = new BufferWriter();
                writer.appendUInt8(1);
                writer.appendUInt16(id.length);
                writer.appendAsciiString(id);
                writer.appendUInt16(body.length);
                writer.appendBuffer(body);
                this.ws.send(writer.build());
                console.log(id + ': >> ' + body.length + ', crc:' + (crc.crc32(body) as Buffer).toString('hex'));
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
    let nc = await connect();

    // Tracking frontends
    let activeFrontends = new Set<string>();
    let frontendsTracker = new ResouceTracker((key: string) => {
        console.log('Frontend disappeared: ' + key);
    });
    nc.subscribe('frontends', (err, msg) => {
        if (typeof msg.data !== 'string') {
            return;
        }
        if (!activeFrontends.has(msg.data)) {
            activeFrontends.add(msg.data);
            console.log('Frontend appeared: ' + msg.data);
        }
        frontendsTracker.addResource(msg.data);
    });

    // Broadcasting keep alive
    nc.publish('backends', id);
    setInterval(() => {
        nc.publish('backends', id);
    }, 1000);


    // Start backend WS server

    let connections = new Map<string, BackendSession>();

    startBackendServer(9001, (host, key, ws) => {
        host = host.toLowerCase();
        console.log('Received: ' + host + ', ' + key);
        if (host === 'test.iofshit.com') {
            if (key === 'randomkey') {
                if (connections.has(host)) {
                    let ex = connections.get(host)!;
                    connections.delete(host);
                    ex.destroy();
                }
                connections.set(host, new BackendSession(ws, host, nc));
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
                return;
            }
        }
        ws.close();
    });
})();