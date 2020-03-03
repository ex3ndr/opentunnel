import nacl from 'tweetnacl';
import { BufferWriter } from './utils/BufferWriter';

export function newToken(privateKey: string, host: string, expire: number = 0) {
    let writer = new BufferWriter();
    writer.appendUInt16(host.length);
    writer.appendAsciiString(host);
    writer.appendUInt32(expire);
    let signed = Buffer.from(nacl.sign(writer.build(), Buffer.from(privateKey, 'base64')));
    return Buffer.from(signed).toString('base64');
}