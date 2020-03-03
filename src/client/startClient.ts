import { ClientSession } from './ClientSession';
import WebSocket from 'ws';
import { createLogger } from '../utils/createLogger';

const logger = createLogger('client');

export function startClient(proxyUrl: string, port: number, httpPort: number, key: string) {
    let _ws: WebSocket | null = null;
    let session: ClientSession | null = null;
    let keyValue = Buffer.from(key, 'base64');

    function onClose() {

        // Destroy session
        if (session) {
            try {
                session!.destroy();
            } catch (e) {
                // Ignore
            }
            session = null;
        }

        // Destroy ws
        if (_ws) {
            try {
                _ws!.close();
            } catch (e) {
                // Ignore
            }
            _ws = null;
        }

        // Retry after randomized period
        setTimeout(() => {
            _start();
        }, 1000 + Math.random() * 5000);
    }

    function _start() {
        logger.info('Connecting to backhaul');
        let ws = new WebSocket(proxyUrl);
        ws.on('open', () => {
            if (_ws === ws) {
                logger.log('Connected');
                session = new ClientSession(port, httpPort, keyValue, ws);
            }
        });
        ws.on('close', () => {
            if (_ws === ws) {
                logger.log('Backhaul disconnected');
                onClose();
            }
        });
        ws.on('error', () => {
            if (_ws === ws) {
                logger.log('Backhaul connection error');
                onClose();
            }
        });
        _ws = ws;
    }

    _start();
}