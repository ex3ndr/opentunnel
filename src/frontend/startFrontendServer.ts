import net from 'net';
import { extractServerName } from './utils/extractServerName';

export function startFrontendServer(port: number, handler: (host: string, socket: net.Socket, header: Buffer) => void) {

    let server = net.createServer((connection) => {
        let started = false;
        connection.on('data', (data) => {
            if (!started) {
                let sname = extractServerName(data);
                if (sname) {
                    console.log('New connection: ' + sname);
                    handler(sname, connection, data);
                } else {
                    if (!connection.destroyed) {
                        connection.destroy();
                        return;
                    }
                }
                started = true;
            }
        });
        connection.on('close', () => {
            console.log('Closed');
        });
    });

    server.listen(port, () => {
        console.log('Frontend started at port: ' + port);
    });
}