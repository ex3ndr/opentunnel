import nacl from 'tweetnacl';
import { BufferWriter } from './utils/BufferWriter';

const reservedNames = ['backhaul', 'registrator', 'api'];

export function newToken(privateKey: string, host: string, expire: number = 0) {
    for (let r of reservedNames) {
        if (host.toLowerCase().startsWith(r.toLowerCase() + '.')) {
            throw Error('Reserved subdomain');
        }
    }
    let writer = new BufferWriter();
    writer.appendUInt16(host.length);
    writer.appendAsciiString(host);
    writer.appendUInt32(expire);
    let signed = Buffer.from(nacl.sign(writer.build(), Buffer.from(privateKey, 'base64')));
    return Buffer.from(signed).toString('base64');
}