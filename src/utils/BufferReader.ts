export class BufferReader {
    readonly buffer: Buffer;
    private _offset = 0;

    constructor(buffer: Buffer) {
        this.buffer = buffer;
    }

    readUInt8() {
        if (this.buffer.length < this._offset + 1) {
            throw Error('EOF');
        }
        let res = this.buffer.readUInt8(this._offset);
        this._offset++;
        return res;
    }

    readUInt16() {
        if (this.buffer.length < this._offset + 2) {
            throw Error('EOF');
        }
        let res = this.buffer.readUInt16BE(this._offset);
        this._offset += 2;
        return res;
    }

    readAsciiString(length: number) {
        if (this.buffer.length < this._offset + length) {
            throw Error('EOF');
        }
        let res = this.buffer.subarray(this._offset, this._offset + length);
        this._offset += length;
        return res.toString('ascii');
    }

    readBuffer(length: number) {
        if (this.buffer.length < this._offset + length) {
            throw Error('EOF');
        }
        let res = this.buffer.subarray(this._offset, this._offset + length);
        this._offset += length;
        return res;
    }
}