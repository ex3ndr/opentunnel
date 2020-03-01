import { ResouceTracker } from './utils/ResourceTracker';
import { startBackendServer } from "./backend/startBackendServer";
import { connect } from 'ts-nats';
import * as uuid from 'uuid';

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
    startBackendServer(9001, (host, key, ws) => {
        //
    });
})();