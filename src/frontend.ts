import { ResouceTracker } from './utils/ResourceTracker';
import { startFrontendServer } from "./frontend/startFrontendServer";
import { connect } from 'ts-nats';
import * as uuid from 'uuid';

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
        //
    });
})();