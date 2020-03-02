import * as uuid from 'uuid';
import { connect, Payload } from 'ts-nats';
import { NodeTracker } from '../utils/NodeTracker';
import { FrontendSession } from './FrontendSession';
import { startTLSProxy } from "./utils/startTLSProxy";
import { createLogger } from '../utils/createLogger';
import { startHealthcheck } from '../utils/startHealthCheck';

const logger = createLogger('frontend');

export async function startFrontend(port: number, nats?: string[]) {
    // Configure
    let id = uuid.v4();
    let nc = await connect({ payload: Payload.BINARY, servers: nats });

    // State
    let activeSockets = new Map<string, FrontendSession>();

    // Node tracking
    let nodeTracker = new NodeTracker(id, nc);
    nodeTracker.onNodeConnected = (id: string) => {
        logger.info('Node connected: ' + id);
    }
    nodeTracker.onNodeDisconnected = (id: string) => {
        logger.info('Node disconnected: ' + id);
    }
    await nodeTracker.start();

    // Start
    startTLSProxy(port, (socket, host, header) => {
        let frontendSocket = new FrontendSession(nc, host, header, socket);
        frontendSocket.onDestroy = () => {
            activeSockets.delete(frontendSocket.id);
        }
        activeSockets.set(frontendSocket.id, frontendSocket);
        frontendSocket.start();
    });

    startHealthcheck(9002);
}