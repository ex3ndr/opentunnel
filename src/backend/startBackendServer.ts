import WebSocket from 'ws';

export function startBackendServer(port: number,
    handler: (host: string, key: string, ws: WebSocket) => void
) {
    const wss = new WebSocket.Server({
        port: port
    });

    wss.on('connection', (ws) => {
        let first = true;
        ws.on('message', (message) => {
            if (!Buffer.isBuffer(message)) {
                ws.close();
                return;
            }
            if (first) {
                first = false;
                let msg = message.readUInt8(0);
                if (msg === 0) {
                    let hostNameLength = message.readUInt16BE(1);
                    let hostname = message.subarray(3, 3 + hostNameLength).toString('ascii');
                    let keyLength = message.readUInt16BE(3 + hostNameLength);
                    let key = message.subarray(3 + hostNameLength + 2, 3 + hostNameLength + 2 + keyLength).toString('ascii');
                    // Handshake
                    handler(hostname, key, ws);
                } else {
                    ws.close();
                    return;
                }
            }
        });
    });

    wss.on('listening', () => {
        console.log('Backend started at port: ' + port);
    });
}