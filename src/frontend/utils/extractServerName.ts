// Ported from go: 
// https://github.com/fangdingjun/sniproxy/blob/00812ec79f0a3eb8d85b87af26124720ecbb647f/handshake_messages.go

export function extractServerName(data: Buffer): string | null {
    if (data.length < 42) {
        return null;
    }

    // Is TLS handshake
    let recordType = data.readUInt8(0);
    if (recordType !== 22 /* TLS Handshake */) {
        return null;
    }

    // Is TLS Major Version
    let tlsMajorVersion = data.readUInt8(1);
    if (tlsMajorVersion < 3 /* TLS 3+ required */) {
        return null;
    }

    // Is Client Helllo
    let type = data.readUInt8(5);
    if (type !== 1 /* ClientHello */) {
        return null;
    }
    data = data.subarray(5);

    // Header
    // let vers = data.readUInt16BE(4);
    // let random = data.subarray(6, 38);
    let sessionIDLen = data.readUInt8(38);
    // let sessionID = data.subarray(39, 39 + sessionIDLen);
    if (sessionIDLen > 32 || data.length < 39 + sessionIDLen) {
        return null;
    }
    data = data.subarray(39 + sessionIDLen);
    if (data.length < 2) {
        return null;
    }

    // Chiphers
    // cipherSuiteLen is the number of bytes of cipher suite numbers. Since
    // they are uint16s, the number must be even.
    let cipherSuiteLen = data.readUInt16BE(0)
    if (cipherSuiteLen % 2 == 1 || data.length < 2 + cipherSuiteLen) {
        return null;
    }
    // NOTE: Actual reading is skipped
    data = data.subarray(2 + cipherSuiteLen);

    // Compression methods
    let compressionMethodsLen = data.readUInt8(0);
    if (data.length < 1 + compressionMethodsLen) {
        return null;
    }
    data = data.subarray(1 + compressionMethodsLen);

    if (data.length == 0) {
        // ClientHello is optionally followed by extension data
        return null;
    }
    if (data.length < 2) {
        return null;
    }

    // Extensions
    let extensionsLength = (data.readUInt8(0) << 8) | data.readUInt8(1);
    data = data.subarray(2);
    if (extensionsLength != data.length) {
        return null;
    }

    while (data.length > 0) {
        let extension = (data.readUInt8(0) << 8) | data.readUInt8(1);
        let length = (data.readUInt8(2) << 8) | data.readUInt8(3);
        data = data.subarray(4);
        if (data.length < length) {
            return null
        }

        if (extension === 0 /* server name */) {
            let d = data.subarray(0, length);
            if (d.length < 2) {
                return null;
            }
            let namesLen = (data.readUInt8(0) << 8) | data.readUInt8(1);
            d = d.subarray(2);
            if (d.length !== namesLen) {
                return null;
            }
            while (d.length > 0) {
                if (d.length < 3) {
                    return null;
                }
                let nameType = d.readInt8(0);
                let nameLen = (d.readUInt8(0) << 8) | d.readUInt8(1);
                d = d.subarray(3);
                if (d.length < nameLen) {
                    return null;
                }
                if (nameType === 0) {
                    let serverName = d.subarray(nameLen).toString('ascii');
                    // An SNI value may not include a
                    // trailing dot. See
                    // https://tools.ietf.org/html/rfc6066#section-3.
                    if (serverName.endsWith('.')) {
                        return null;
                    }
                    return serverName;
                }
                d = d.subarray(nameLen);
            }
        }

        data = data.subarray(length);
    }

    return null;
}