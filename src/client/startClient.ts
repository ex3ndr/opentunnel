import { ClientTunnel } from './ClientTunnel';
import { createLogger } from '../utils/createLogger';
import fetch from 'node-fetch';

const logger = createLogger('client');

export function startClient(proxyUrl: string, port: number, httpPort: number, key: string) {

    let keyValue = Buffer.from(key, 'base64');
    async function _wkHandler(path: string) {
        let res = await fetch('http://localhost:' + httpPort + '/.well-known' + path);
        if (res.ok) {
            return await res.buffer();
        } else {
            return null;
        }

    }
    let tunnel = new ClientTunnel(port, keyValue, proxyUrl, _wkHandler);
    tunnel.onConnected = () => {
        logger.info('Connected');
    };
    tunnel.onDisconnected = () => {
        logger.info('Connection lost');
    };
    tunnel.start();
}