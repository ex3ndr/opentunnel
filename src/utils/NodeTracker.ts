import { Client } from 'ts-nats';
import { ResouceTracker } from './ResourceTracker';

export class NodeTracker {

    readonly selfId: string;
    readonly nc: Client;
    onNodeConnected?: (src: string) => void;
    onNodeDisconnected?: (src: string) => void;

    constructor(selfId: string, nc: Client) {
        this.selfId = selfId;
        this.nc = nc;
    }

    async start() {
        let activeBackends = new Set<string>();
        let frontendsTracker = new ResouceTracker((key: string) => {
            if (this.onNodeDisconnected) {
                this.onNodeDisconnected(key);
            }
        });
        await this.nc.subscribe('nodes', (err, msg) => {
            if (!Buffer.isBuffer(msg.data)) {
                return;
            }
            let id = msg.data.toString('ascii');
            if (id === this.selfId) {
                return;
            }
            if (!activeBackends.has(id)) {
                activeBackends.add(id);
                if (this.onNodeConnected) {
                    this.onNodeConnected(id);
                }
            }
            frontendsTracker.addResource(id);
        });

        // Broadcasting keep alive
        this.nc.publish('nodes', Buffer.from(this.selfId, 'ascii'));
        setInterval(() => {
            this.nc.publish('nodes', Buffer.from(this.selfId, 'ascii'));
        }, 1000);
    }
}