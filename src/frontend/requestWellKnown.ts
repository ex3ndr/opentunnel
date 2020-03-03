import { Client } from 'ts-nats';
import { parseDiscoverMessage } from '../proto/discover';
import { createLogger } from '../utils/createLogger';

let logger = createLogger('frontend:discover');

export async function requestWellKnown(nc: Client, host: string, path: string) {
    logger.info('Received well known request for ' + host + '/.well-known' + path);
    let backendSocketId: string | null = null;
    let backendId: string | null = null;
    for (let i = 0; i < 3; i++) {
        try {
            let response = await nc.request('discover-' + host, 5000);
            let src = parseDiscoverMessage(response.data);
            backendSocketId = src.socket;
            backendId = src.backend;
            break;
        } catch (e) {
            // Ignore
        }
    }
    if (!backendSocketId || !backendId) {
        logger.info('Failed to discover backend socket for ' + host);
        throw Error('Unable to find host');
    }
    logger.info('Found backend');
    let res = await nc.request('wk-' + backendSocketId, 5000, Buffer.from(path, 'ascii'));

    return res.data as Buffer;
}