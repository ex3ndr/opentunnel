import { Client, Subscription } from "ts-nats";
import * as uuid from 'uuid';
import net from 'net';
import { parseInnerSocketMessage, serializeInnerSocket } from '../proto/innerSocket';
import { createLogger } from "../utils/createLogger";
import { parseDiscoverMessage } from "../proto/discover";

export class FrontendSession {

    readonly id = uuid.v4();
    onDestroy?: () => void;
    onBackendSelected?: (id: string) => void;

    private pendingFrames: Buffer[] = [];
    private nc: Client;
    private host: string;
    private socket: net.Socket;
    private destroyed = false;
    private backendId: string | null = null;
    private backendSocketId: string | null = null;
    private started = false;
    private incomingSubscription!: Subscription;
    private connectionTimer: any;
    private logger = createLogger('frontend:connection:' + this.id);

    constructor(
        nc: Client,
        host: string,
        header: Buffer,
        socket: net.Socket
    ) {
        this.nc = nc;
        this.host = host;
        this.pendingFrames.push(header);
        this.socket = socket;

        this.logger.info('сreated');

        this.socket.on('data', this._onSocketFrame);
        this.socket.on('close', this._onSocketClose);
        this.socket.on('error', this._onSocketClose);
    }

    start() {
        this.logger.info('started');
        this._init();
    }

    private _init = async () => {
        //
        // Try to find appropriate backend socket
        // 
        // Making 3 attempts with 5 seconds timeout to mimic web browsers behaviour
        // and not to throw error too early because of network fluctuations
        //
        //
        // NOTE: Theoretically always picks optimal 
        // one if multiple backends available.
        //
        for (let i = 0; i < 3; i++) {
            try {
                let response = await this.nc.request('discover-' + this.host, 5000);
                let src = parseDiscoverMessage(response.data);
                this.backendSocketId = src.socket;
                this.backendId = src.backend;
                break;
            } catch (e) {
                // Ignore
            }
        }
        if (this.destroyed) {
            return;
        }
        if (!this.backendSocketId || !this.backendId) {
            this.logger.info('Failed to discover backend socket for ' + this.host);
            this.destroy();
            return;
        }
        this.logger.info('Discovered backend: ' + this.backendId);
        if (this.onBackendSelected) {
            this.onBackendSelected(this.backendId);
        }

        //
        // Subscribe for device->client messages
        //
        try {
            this.incomingSubscription = await this.nc.subscribe('connection-frontend-' + this.id, (error, data) => {
                if (this.destroyed) {
                    return;
                }

                let msg = parseInnerSocketMessage(data.data);
                if (!msg) { // Ignore unknown message
                    return;
                }

                if (msg.type === 'connected') {
                    if (!this.started) { // Protect from retransmits
                        this.started = true;
                        clearTimeout(this.connectionTimer);

                        this.logger.info('connected');

                        // Send pending frames
                        for (let p of this.pendingFrames) {
                            this.nc.publish('connection-backend-' + this.id, serializeInnerSocket({ type: 'frame', frame: p }));
                        }
                        this.pendingFrames = [];
                    }
                } else if (msg.type === 'frame') {
                    this.logger.debug('<< ', msg.frame.length);
                    this.socket.write(msg.frame);
                } else if (msg.type === 'aborted') {
                    this.logger.info('aborted');
                    this.destroy();
                }
            });
        } catch (e) {
            this.destroy();
            return;
        }
        if (this.destroyed) {
            this.incomingSubscription.unsubscribe();
            return;
        }

        //
        // Initialize connection
        // No retrying here since we don't want to create multiple connections
        //
        try {
            await this.nc.request('connect-' + this.backendSocketId, 5000, Buffer.from(this.id, 'ascii'));
        } catch (e) {
            this.destroy();
            return;
        }
        if (this.destroyed) {
            // Notify about destroying of a connection
            this.nc.publish('connection-backend-' + this.id, serializeInnerSocket({ type: 'aborted' }));
            return;
        }

        //
        // Start connection timer to 10 seconds.
        // We expect connection to be already established with backend 
        // and there are no new actual conenction happens and latency should be much shorter
        this.connectionTimer = setTimeout(() => {
            this.destroy();
        }, 10000);
    }

    private _onSocketFrame = (frame: Buffer) => {
        this.logger.debug(' >> ' + frame.length);
        if (!this.started) {
            this.pendingFrames.push(frame);
        } else {
            this.nc.publish('connection-backend-' + this.id, serializeInnerSocket({ type: 'frame', frame }));
        }
    }

    private _onSocketClose = () => {
        this.destroy();
    }

    destroy() {
        if (!this.destroyed) {
            this.destroyed = true;
            this.logger.info('destroy');

            // Destroy socket
            this.socket.off('data', this._onSocketFrame);
            this.socket.off('close', this._onSocketClose);
            this.socket.off('error', this._onSocketClose);
            try {
                if (!this.socket.destroyed) {
                    this.socket.destroy();
                }
            } catch (e) {
                // Ignore
            }

            // Unsubscribe
            if (this.incomingSubscription) {
                this.incomingSubscription.unsubscribe();
            }

            // Notify about destroying of a connection
            this.nc.publish('connection-backend-' + this.id, serializeInnerSocket({ type: 'aborted' }));

            // Clear timeout timer
            clearTimeout(this.connectionTimer);

            if (this.onDestroy) {
                this.onDestroy();
            }
        }
    }
}