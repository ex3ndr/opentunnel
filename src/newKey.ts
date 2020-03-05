import nacl from 'tweetnacl';

export function newKey() {
    let keypair = nacl.sign.keyPair();
    return {
        publicKey: Buffer.from(keypair.publicKey),
        secretKey: Buffer.from(keypair.secretKey)
    };
}