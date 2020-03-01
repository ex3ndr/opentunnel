export class BufferWriter {
    private _buffer: Buffer = Buffer.alloc(0);

    appendUInt8(value: number) {
        let b = Buffer.alloc(1);
        b.writeUInt8(value, 0);
        this._buffer = Buffer.concat([this._buffer, b]);
    }

    appendUInt16(value: number) {
        let b = Buffer.alloc(2);
        b.writeUInt16BE(value, 0);
        this._buffer = Buffer.concat([this._buffer, b]);
    }

    appendAsciiString(value: string) {
        let b = Buffer.from(value, 'ascii');
        this._buffer = Buffer.concat([this._buffer, b]);
    }

    appendBuffer(buffer: Buffer) {
        this._buffer = Buffer.concat([this._buffer, buffer]);
    }

    build() {
        return this._buffer;
    }
}