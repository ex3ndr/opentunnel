import fs from 'fs';
import nacl from 'tweetnacl';
let keypair = nacl.sign.keyPair();
fs.writeFileSync('auth_public.key', Buffer.from(keypair.publicKey).toString('base64'));
fs.writeFileSync('auth_secret.key', Buffer.from(keypair.secretKey).toString('base64'));