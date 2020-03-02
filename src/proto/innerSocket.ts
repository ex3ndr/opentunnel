import { BufferWriter } from './../utils/BufferWriter';
import { BufferReader } from '../utils/BufferReader';

export type InnerSocketMessage = { type: 'connected' } | { type: 'aborted' } | { type: 'frame', frame: Buffer }

export function parseInnerSocketMessage(src: Buffer): InnerSocketMessage | null {
    let reader = new BufferReader(src);
    let header = reader.readUInt8();
    if (header === 0 /* Connected */) {
        return { type: 'connected' };
    } else if (header === 1 /* Frame */) {
        let length = reader.readUInt16();
        let body = reader.readBuffer(length);
        return { type: 'frame', frame: body };
    } else if (header === 2 /* Abort */) {
        return { type: 'aborted' };
    } else {
        return null;
    }
}

export function serializeInnerSocket(message: InnerSocketMessage): Buffer {
    let writer = new BufferWriter();
    if (message.type === 'connected') {
        writer.appendUInt8(0);
    } else if (message.type === 'frame') {
        writer.appendUInt8(1);
        writer.appendUInt16(message.frame.length);
        writer.appendBuffer(message.frame);
    } else if (message.type === 'aborted') {
        writer.appendUInt8(2);
    } else {
        throw Error('Invalid message');
    }

    return writer.build();
}