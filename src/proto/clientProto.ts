import { BufferWriter } from './../utils/BufferWriter';
import { BufferReader } from './../utils/BufferReader';

export type ClientMessage =
    | { id: string, type: 'connected' }
    | { id: string, type: 'aborted' }
    | { id: string, type: 'frame', frame: Buffer }
    | { type: 'wk-request', requestId: string, path: string }
    | { type: 'wk-response', requestId: string, content: Buffer | null }
    | { type: 'ka' };

export function parseClientProto(buffer: Buffer): ClientMessage | null {
    let reader = new BufferReader(buffer);
    let header = reader.readUInt8();

    if (header === 0 /* Connected */) {
        let idLength = reader.readUInt16();
        let id = reader.readAsciiString(idLength);
        return { type: 'connected', id };
    } else if (header === 1 /* Frame */) {
        let idLength = reader.readUInt16();
        let id = reader.readAsciiString(idLength);
        let frameLength = reader.readUInt16();
        let frame = reader.readBuffer(frameLength);
        return { type: 'frame', id, frame };
    } else if (header === 2 /* Aborted */) {
        let idLength = reader.readUInt16();
        let id = reader.readAsciiString(idLength);
        return { type: 'aborted', id };
    } else if (header === 3 /* wk-request */) {
        let requestIdLength = reader.readUInt16();
        let requestId = reader.readAsciiString(requestIdLength);

        let pathLength = reader.readUInt16();
        let path = reader.readAsciiString(pathLength);
        return { type: 'wk-request', requestId, path };
    } else if (header === 4 /* wk-response */) {
        let requestIdLength = reader.readUInt16();
        let requestId = reader.readAsciiString(requestIdLength);
        let body: Buffer | null = null;
        if (reader.readUInt8()) {
            let bodyLength = reader.readUInt16();
            body = reader.readBuffer(bodyLength);
        }
        return { type: 'wk-response', requestId, content: body };
    } else if (header === 5 /* Keep Alive */) {
        return { type: 'ka' };
    }

    return null;
}

export function serializeClientProto(msg: ClientMessage): Buffer {
    let writer = new BufferWriter();
    if (msg.type === 'connected') {
        writer.appendUInt8(0);
        writer.appendUInt16(msg.id.length);
        writer.appendAsciiString(msg.id);
    } else if (msg.type === 'frame') {
        writer.appendUInt8(1);
        writer.appendUInt16(msg.id.length);
        writer.appendAsciiString(msg.id);
        writer.appendUInt16(msg.frame.length);
        writer.appendBuffer(msg.frame);
    } else if (msg.type === 'aborted') {
        writer.appendUInt8(2);
        writer.appendUInt16(msg.id.length);
        writer.appendAsciiString(msg.id);
    } else if (msg.type === 'wk-request') {
        writer.appendUInt8(3);
        writer.appendUInt16(msg.requestId.length);
        writer.appendAsciiString(msg.requestId);
        writer.appendUInt16(msg.path.length);
        writer.appendAsciiString(msg.path);
    } else if (msg.type === 'wk-response') {
        writer.appendUInt8(4);
        writer.appendUInt16(msg.requestId.length);
        writer.appendAsciiString(msg.requestId);
        if (msg.content !== null) {
            writer.appendUInt8(1);
            writer.appendUInt16(msg.content.length);
            writer.appendBuffer(msg.content);
        } else {
            writer.appendUInt8(0);
        }
    } else if (msg.type === 'ka') {
        writer.appendUInt8(5);
    } else {
        throw Error('Invalid message');
    }

    return writer.build();
}