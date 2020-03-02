import { BufferWriter } from './utils/BufferWriter';
import fs from 'fs';
import nacl from 'tweetnacl';
import { startClientProxy } from "./client/startClientProxy";

// Generate Access Token
let secretKey = Buffer.from(fs.readFileSync('auth_secret.key', 'ascii'), 'base64');
let writer = new BufferWriter();
let host = 'test.iofshit.com';
writer.appendUInt16(host.length);
writer.appendAsciiString(host);
writer.appendUInt32(0);
let signed = Buffer.from(nacl.sign(writer.build(), secretKey));

startClientProxy('ws://localhost:9001', 443, 'test.iofshit.com', signed);