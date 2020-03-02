import { BufferWriter } from './../utils/BufferWriter';
import { BufferReader } from './../utils/BufferReader';
export type ClientMessage = { id: string, type: 'connected' } | { id: string, type: 'aborted' } | { id: string, type: 'frame', frame: Buffer };

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
    } else {
        throw Error('Invalid message');
    }

    return writer.build();
}