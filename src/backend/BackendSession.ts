import * as uuid from 'uuid';
import WebSocket from 'ws';
import { Client, Subscription } from 'ts-nats';
import { serializeDiscoverMessage } from '../proto/discover';
import { serializeInnerSocket, parseInnerSocketMessage } from '../proto/innerSocket';
import { ClientMessage, parseClientProto, serializeClientProto } from '../proto/clientProto';
import { createLogger } from "../utils/createLogger";

export class BackendSession {
    readonly id = uuid.v4();
    readonly host: string;
    readonly ws: WebSocket;
    readonly nc: Client;
    readonly backendId: string;
    onDestroy?: () => void;
    private _started = false;
    private _stopped = false;
    private _discoverSubscription!: Subscription;
    private _wkSubscription!: Subscription;
    private _connectSubscription!: Subscription;
    private _connections = new Map<string, Subscription>();
    private _logger = createLogger('backend:session:' + this.id);
    private _wkRequests = new Map<string, string>();

    constructor(ws: WebSocket, host: string, nc: Client, backendId: string) {
        this.ws = ws;
        this.nc = nc;
        this.host = host;
        this.backendId = backendId;
    }

    async start() {
        this._logger.info('started');

        // Watch for websocket
        this.ws.on('message', (msg) => {
            if (!Buffer.isBuffer(msg)) {
                return;
            }
            let m = parseClientProto(msg);
            if (m) {
                this._onBackendMessage(m);
            }
        });
        this.ws.on('close', () => {
            this._onBackendClosed();
        });
        this.ws.on('error', () => {
            this._onBackendClosed();
        });

        // Subscribe for discover for host backends
        try {
            this._discoverSubscription = await this.nc.subscribe('discover-' + this.host, (err, data) => {
                if (!this._started || this._stopped) {
                    return;
                }
                if (data.reply) {
                    this.nc.publish(data.reply!, serializeDiscoverMessage({ backend: this.backendId, socket: this.id }));
                }
            });
        } catch (e) {
            this.destroy();
            return;
        }
        if (this._stopped) {
            this._discoverSubscription.unsubscribe();
            return;
        }

        // Subscribe for wellknown
        try {
            this._wkSubscription = await this.nc.subscribe('wk-' + this.id, (err, data) => {
                if (!this._started || this._stopped) {
                    return;
                }
                if (data.reply) {
                    let id = uuid.v4();
                    this._wkRequests.set(id, data.reply);

                    let path = (data.data as Buffer).toString('ascii');
                    this.ws.send(serializeClientProto({ type: 'wk-request', requestId: id, path }));
                }
            });
        } catch (e) {
            this.destroy();
            return;
        }
        if (this._stopped) {
            this._wkSubscription.unsubscribe();
            return;
        }

        // Subscribe for incoming request for this session
        try {
            this._connectSubscription = await this.nc.subscribe('connect-' + this.id, (err, data) => {
                if (!this._started || this._stopped) {
                    return;
                }
                if (data.reply) {
                    let id = data.data as Buffer;
                    this._onNewConnection(id.toString('ascii'), data.reply);
                }
            });
        } catch (e) {
            this.destroy();
            return;
        }
        if (this._stopped) {
            this._connectSubscription.unsubscribe();
            return;
        }

        // Start
        this._started = true;
    }

    //
    // Backend messages
    //

    private _onBackendClosed = () => {
        this.destroy();
    }

    private _onBackendMessage = (msg: ClientMessage) => {
        if (msg.type === 'connected') {
            if (!this._connections.has(msg.id)) {
                return;
            }
            this.nc.publish('connection-frontend-' + msg.id, serializeInnerSocket({ type: 'connected' }));
        } else if (msg.type === 'frame') {
            if (!this._connections.has(msg.id)) {
                return;
            }
            this.nc.publish('connection-frontend-' + msg.id, serializeInnerSocket({ type: 'frame', frame: msg.frame }));
        } else if (msg.type === 'aborted') {
            if (!this._connections.has(msg.id)) {
                return;
            }
            this.nc.publish('connection-frontend-' + msg.id, serializeInnerSocket({ type: 'aborted' }));
            this._logger.info('connection aborted');
            this._connections.get(msg.id)!.unsubscribe();
            this._connections.delete(msg.id);
        } else if (msg.type === 'wk-response') {
            // Just ignore
            if (this._wkRequests.has(msg.requestId)) {
                let reply = this._wkRequests.get(msg.requestId)!;
                this._wkRequests.delete(msg.requestId);
                this.nc.publish(reply, msg.content);
            }
        }
    }

    //
    // Frontend messages
    //

    private _onNewConnection = (id: string, reply: string) => {
        // Create new connection
        (async () => {
            this._logger.info('new connection');

            // Subscribe for frontend messages
            let subs = await this.nc.subscribe('connection-backend-' + id, (error, data) => {
                let msg = parseInnerSocketMessage(data.data);
                if (!msg) {
                    return; // Just ignore unknown
                }
                if (msg.type === 'frame') {
                    this._logger.debug('>> ' + msg.frame.length);
                    this.ws.send(serializeClientProto({ type: 'frame', id, frame: msg.frame }));
                } else if (msg.type === 'aborted') {
                    this.ws.send(serializeClientProto({ type: 'aborted', id }));
                    this._logger.info('connection aborted');
                    this._connections.get(id)!.unsubscribe();
                    this._connections.delete(id);
                } else {
                    // Ignore connected message since it is not used here
                }
            });
            if (this._stopped) {
                subs.unsubscribe();
                return;
            }

            this._connections.set(id, subs);

            // Init connection
            this.ws.send(serializeClientProto({ type: 'connected', id: id }));

            // Response
            this.nc.publish(reply);
        })();
    }

    destroy() {
        if (!this._stopped) {
            this._stopped = true;

            this._logger.info('destroy');

            // Stop subscriptions
            if (this._discoverSubscription) {
                this._discoverSubscription.unsubscribe();
            }
            if (this._connectSubscription) {
                this._connectSubscription.unsubscribe();
            }
            if (this._wkSubscription) {
                this._wkSubscription.unsubscribe();
            }
            for (let c of this._connections.values()) {
                c.unsubscribe();
            }

            if (this.onDestroy) {
                this.onDestroy();
            }
        }
    }
}