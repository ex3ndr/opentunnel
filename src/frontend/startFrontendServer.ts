import * as uuid from 'uuid';
import { NodeTracker } from '../utils/NodeTracker';
import { FrontendSession } from '../frontend/FrontendSession';
import { startTLSProxy } from "../frontend/startTLSProxy";
import { connect, Payload } from 'ts-nats';
import { createLogger } from '../utils/createLogger';

const logger = createLogger('frontend');

export async function startFrontendServer(port: number) {
    // Configure
    let id = uuid.v4();
    let nc = await connect({ payload: Payload.BINARY });

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
}