import net from 'net';
import { extractServerName } from './extractServerName';
import { createLogger } from '../../utils/createLogger';

const logger = createLogger('frontend:proxy:')

export function startTLSProxy(port: number, handler: (socket: net.Socket, host: string, header: Buffer) => void) {

    let server = net.createServer((connection) => {
        let started = false;
        connection.on('data', (data) => {
            if (!started) {
                let sname = extractServerName(data);
                if (sname) {
                    logger.info('New connection for ' + sname);
                    handler(connection, sname, data);
                } else {
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