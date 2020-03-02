import { BackendSession } from './BackendSession';
import * as uuid from 'uuid';
import { connect, Payload } from 'ts-nats';
import { NodeTracker } from '../utils/NodeTracker';
import { startAuthenticatedServer } from './startAuthenticatedServer';
import { createLogger } from '../utils/createLogger';
import { startHealthcheck } from '../utils/startHealthCheck';

const logger = createLogger('backend');
export async function startBackend(publicKey: string, port: number, nats?: string[]) {
    let id = uuid.v4();
    let nc = await connect({ payload: Payload.BINARY, servers: nats });

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
    startAuthenticatedServer(publicKey, port, (host, ws) => {
        let backendSession = new BackendSession(ws, host, nc, id);
        backendSession.onDestroy = () => {
            connections.delete(backendSession.id);
        }
        connections.set(backendSession.id, backendSession);
        backendSession.start();
    });

    startHealthcheck(9003);
}