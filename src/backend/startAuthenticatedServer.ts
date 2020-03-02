import WebSocket from 'ws';
import nacl from 'tweetnacl';
import { BufferReader } from '../utils/BufferReader';

export function startAuthenticatedServer(publicKey: string, port: number, handler: (host: string, ws: WebSocket) => void) {
    const wss = new WebSocket.Server({ port: port });
    const publicKeyVal = Buffer.from(publicKey, 'base64');

    wss.on('connection', (ws) => {
        let first = true;
        ws.on('message', (message) => {
            if (!Buffer.isBuffer(message)) {
                ws.close();
                return;
            }
            if (first) {
                first = false;
                let reader = new BufferReader(message);
                let header = reader.readUInt8();
                if (header === 0) {

                    // Check signed box
                    let bodyLength = reader.readUInt16();
                    let body = reader.readBuffer(bodyLength);
                    let openBox = nacl.sign.open(body, publicKeyVal);
                    if (!openBox) {
                        ws.close();
                        return;
                    }

                    // Retreive hostname
                    reader = new BufferReader(Buffer.from(openBox));
                    let hostNameLength = reader.readUInt16();
                    let hostName = reader.readAsciiString(hostNameLength);
                    let timeout = reader.readUInt32();
                    if (timeout !== 0 && timeout > Date.now() / 1000) { // Check for timeout
                        ws.close();
                        return;
                    }

                    // Invoke handler
                    handler(hostName.toLowerCase(), ws);
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