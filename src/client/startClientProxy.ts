import { BufferReader } from './../utils/BufferReader';
import { BufferWriter } from './../utils/BufferWriter';
import WebSocket from 'ws';
import net from 'net';
import crc from 'node-crc';

class ProtoConnection {
    readonly ws: WebSocket;
    readonly uid: string;
    readonly port: number;
    private _socket!: net.Socket;

    constructor(ws: WebSocket, port: number, uid: string) {
        this.ws = ws;
        this.uid = uid;
        this.port = port;
        this._start();
    }

    private _start = () => {
        this._socket = new net.Socket();
        let closed = false;
        this._socket.on('connect', () => {
            if (!closed) {
                console.log(this.uid + ': Connected');
                let buffer = new BufferWriter();
                buffer.appendUInt8(0);
                buffer.appendUInt16(this.uid.length);
                buffer.appendAsciiString(this.uid);
                this.ws.send(buffer.build());
            }
        });
        this._socket.on('data', (data) => {
            if (!closed) {
                console.log(this.uid + ': << ' + data.length + ', crc:' + (crc.crc32(data) as Buffer).toString('hex'));
                let buffer = new BufferWriter();
                buffer.appendUInt8(1);
                buffer.appendUInt16(this.uid.length);
                buffer.appendAsciiString(this.uid);
                buffer.appendUInt16(data.length);
                buffer.appendBuffer(data);
                this.ws.send(buffer.build());
            }
        });
        this._socket.on('error', () => {
            if (!closed) {
                closed = true;

                console.log(this.uid + ': Error');
                let buffer = new BufferWriter();
                buffer.appendUInt8(2);
                buffer.appendUInt16(this.uid.length);
                buffer.appendAsciiString(this.uid);
                this.ws.send(buffer.build());
            }
        });
        this._socket.on('close', () => {
            if (!closed) {
                closed = true;

                console.log(this.uid + ': Closed');
                let buffer = new BufferWriter();
                buffer.appendUInt8(2);
                buffer.appendUInt16(this.uid.length);
                buffer.appendAsciiString(this.uid);
                this.ws.send(buffer.build());
            }
        });
        this._socket.connect(this.port);
    }

    onFrame = (buffer: Buffer) => {
        console.log(this.uid + ': >> ' + buffer.length + ', crc:' + (crc.crc32(buffer) as Buffer).toString('hex'));
        let r = this._socket.write(buffer); // Handle result??
        console.log(this.uid + ': ' + r);
    }

    close = () => {
        try {
            if (!this._socket.destroyed) {
                this._socket.destroy();
            }
        } catch (e) {
            // Ignore
        }
    }
}

class ProtoSession {
    private ws: WebSocket;
    private port: number;
    private hostname: string;
    private key: string;
    private connections = new Map<string, ProtoConnection>();

    constructor(ws: WebSocket, port: number, hostname: string, key: string) {
        this.ws = ws;
        this.port = port;
        this.hostname = hostname;
        this.key = key;
        this._start();
    }

    private _start = () => {
        this.ws.on('message', this._handleMessage);

        let builder = new BufferWriter();
        builder.appendUInt8(0);
        builder.appendUInt16(this.hostname.length);
        builder.appendAsciiString(this.hostname);
        builder.appendUInt16(this.key.length);
        builder.appendAsciiString(this.key);
        this.ws.send(builder.build());
    }

    //
    // Session Logic
    //

    private _handleMessage = (buffer: Buffer) => {
        if (!Buffer.isBuffer(buffer)) {
            return;
        }
        let reader = new BufferReader(buffer);
        let header = reader.readUInt8();
        if (header === 0) {
            let size = reader.readUInt16();
            let uid = reader.readAsciiString(size);
            console.log(uid + ': Request connect');
            this.connections.set(uid, new ProtoConnection(this.ws, this.port, uid));
        } else if (header === 1) {
            let size = reader.readUInt16();
            let uid = reader.readAsciiString(size);
            let len = reader.readUInt16();
            let frame = reader.readBuffer(len);
            this.connections.get(uid)!.onFrame(frame);
        } else if (header === 2) {
            let size = reader.readUInt16();
            let uid = reader.readAsciiString(size);
            this.connections.get(uid)!.close();
        }
    }

    destroy() {
        this.ws.off('message', this._handleMessage);
    }
}

export function startClientProxy(proxyUrl: string, port: number, hostname: string, key: string) {
    let _ws: WebSocket | null = null;
    let session: ProtoSession | null = null;

    function onStart() {
        session = new ProtoSession(_ws!, port, hostname, key);
    }

    function onClose() {

        try {
            session!.destroy();
        } catch (e) {
            // Ignore
        }
        session = null;

        try {
            _ws!.close();
        } catch (e) {
            // Ignore
        }
        _ws = null;

        setTimeout(() => {
            _start();
        }, 1000);
    }

    function _start() {
        console.log('trying to connect');
        let ws = new WebSocket(proxyUrl);
        ws.on('open', () => {
            if (_ws === ws) {
                console.log('open');
                onStart();
            }
        });
        ws.on('close', () => {
            if (_ws === ws) {
                console.log('close');
                onClose();
            }
        });
        ws.on('error', () => {
            if (_ws === ws) {
                console.log('error');
                onClose();
            }
        });
        _ws = ws;
    }

    _start();
}