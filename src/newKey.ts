import { BufferWriter } from './utils/BufferWriter';
import fs from 'fs';
import nacl from 'tweetnacl';
let keypair = nacl.sign.keyPair();
fs.writeFileSync('auth_public.key', Buffer.from(keypair.publicKey).toString('base64'));
fs.writeFileSync('auth_secret.key', Buffer.from(keypair.secretKey).toString('base64'));

let writer = new BufferWriter();
let host = 'test.iofshit.com';
writer.appendUInt16(host.length);
writer.appendAsciiString(host);
writer.appendUInt32(0);
let signed = Buffer.from(nacl.sign(writer.build(), keypair.secretKey));
fs.writeFileSync('auth_client.key', Buffer.from(signed).toString('base64'));