import net from 'net';
import { extractServerName } from './extractServerName';
import { createLogger } from '../../utils/createLogger';

const logger = createLogger('frontend:tls:')

export function startTLSProxy(port: number, handler: (socket: net.Socket, host: string, header: Buffer) => void) {

    let server = net.createServer((connection) => {
        logger.info('New connection');
        let started = false;
        connection.on('data', (data) => {
            if (!started) {
                let sname = extractServerName(data);
                if (sname) {
                    logger.info('New connection for ' + sname);
                    handler(connection, sname, data);
                } else {
                    logger.info('No hostname provided!');
                    if (!connection.destroyed) {
                        connection.destroy();
                        return;
                    }
                }
                started = true;
            }
        });
        connection.on('error', () => {
            logger.warn('Connection error');
        });
        connection.on('close', () => {
            logger.info('Connection closed');
        });
    });

    server.listen(port, () => {
        logger.info('TLS proxy started at port: ' + port);
    });
}