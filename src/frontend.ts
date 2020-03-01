import { BufferWriter } from './utils/BufferWriter';
import { BufferReader } from './utils/BufferReader';
import net from 'net';
import { ResouceTracker } from './utils/ResourceTracker';
import { startFrontendServer } from "./frontend/startFrontendServer";
import { connect, Client } from 'ts-nats';
import * as uuid from 'uuid';
import crc from 'node-crc';

class FrontendSession {
    private id: string = uuid.v4();
    private backendSessionId: string;
    private socket: net.Socket;
    private header: Buffer;
    private nc: Client;

    constructor(socket: net.Socket, header: Buffer, backendSessionId: string, nc: Client) {
        this.backendSessionId = backendSessionId;
        this.socket = socket;
        this.header = header;
        this.nc = nc;
        this._start();
    }

    private async _start() {
        try {
            await this.nc.subscribe('connection-frontend-' + this.id, (error, data) => {
                let reader = new BufferReader(Buffer.from(data.data, 'hex'));
                let header = reader.readUInt8();
                if (header === 0 /* Connected */) {
                    console.log(this.id + ': Connected' + ', crc:' + (crc.crc32(this.header) as Buffer).toString('hex'));
                    this.nc.publish('connection-backend-' + this.id, this.header.toString('hex'));
                } else if (header === 1 /* Frame */) {
                    let length = reader.readUInt16();
                    let body = reader.readBuffer(length);
                    console.log(this.id + ': << ' + length + ', crc:' + (crc.crc32(body) as Buffer).toString('hex'));
                    this.socket.write(body);
                } else if (header === 2 /* Closed */) {
                    console.log(this.id + ': Aborted');
                    this.socket.destroy();
                } else {
                    // Just ignore
                }
            });

            this.socket.on('data', (data) => {
                console.log(this.id + ': >> ' + data.length + ', crc:' + (crc.crc32(data) as Buffer).toString('hex'));
                this.nc.publish('connection-backend-' + this.id, data.toString('hex'));
            });

            // Try to connect
            await this.nc.request('connect-' + this.backendSessionId, 5000, this.id);

        } catch (e) {
            console.warn(e);
            this._destroy();
        }
    }

    private _destroy() {

    }
}

(async () => {
    let id = uuid.v4();
    let nc = await connect();

    // Tracking backends
    let activeBackends = new Set<string>();
    let frontendsTracker = new ResouceTracker((key: string) => {
        console.log('Backend disappeared: ' + key);
    });
    nc.subscribe('backends', (err, msg) => {
        if (typeof msg.data !== 'string') {
            return;
        }
        if (!activeBackends.has(msg.data)) {
            activeBackends.add(msg.data);
            console.log('Backend appeared: ' + msg.data);
        }
        frontendsTracker.addResource(msg.data);
    });

    // Broadcasting keep alive
    nc.publish('frontends', id);
    setInterval(() => {
        nc.publish('frontends', id);
    }, 1000);

    // Start frontend server
    startFrontendServer(9000, (host, socket, header) => {
        (async () => {
            try {
                let response = await nc.request('discover-' + host, 5000);
                let backendSessionId = response.data as string;
                new FrontendSession(socket, header, backendSessionId, nc);
            } catch (e) {
                console.warn(e);
                try {
                    socket.destroy();
                } catch (e) {
                    // Ignore
                }
            }
        })();
    });
})();