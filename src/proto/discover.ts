import { BufferWriter } from './../utils/BufferWriter';
import { BufferReader } from './../utils/BufferReader';

export type DiscoverMessage = { socket: string, backend: string };

export function parseDiscoverMessage(buffer: Buffer): DiscoverMessage {
    let reader = new BufferReader(buffer);
    let backendLength = reader.readUInt16();
    let backend = reader.readAsciiString(backendLength);
    let socketLength = reader.readUInt16();
    let socket = reader.readAsciiString(socketLength);
    return { backend, socket };
}

export function serializeDiscoverMessage(message: DiscoverMessage): Buffer {
    let writer = new BufferWriter();
    writer.appendUInt16(message.backend.length);
    writer.appendAsciiString(message.backend);
    writer.appendUInt16(message.socket.length);
    writer.appendAsciiString(message.socket);
    return writer.build();
}