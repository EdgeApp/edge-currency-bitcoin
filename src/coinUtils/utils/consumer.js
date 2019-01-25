// @flow

function Consumer (buffer: Buffer): any {
  this.writerOffset = 0
  this.readerOffset = 0
  this._buffer = buffer
}

// Get the "raw" buffer from the Consumer object
Consumer.prototype.getBuffer = function () {
  return this._buffer
}

// Create a 'writeBytes' function instead of fill to add raw bytes to a buffer
Consumer.prototype.writeBytes = function (
  value: Buffer,
  offset?: number,
  end?: number,
  encoding?: string
) {
  if (typeof offset !== 'number') offset = this.writerOffset
  if (typeof end !== 'number') end = offset + value.length
  this.writerOffset += end - offset
  return this._buffer.fill(value, offset, end, encoding)
}

Consumer.prototype.writeVarBytes = function (value: Buffer) {
  this.writeUInt32BE(this.value.length)
  return this.writeBytes(value)
}

// Create a 'readBytes' function instead of using slice to get raw bytes from a buffer
Consumer.prototype.readBytes = function (
  byteLength?: number,
  offset?: number,
  end?: number
) {
  if (typeof byteLength !== 'number') byteLength = this._buffer.length
  if (typeof offset !== 'number') offset = this.readerOffset
  if (typeof end !== 'number') end = this.readerOffset + byteLength
  this.readerOffset += end - offset
  return this._buffer.slice(offset, end)
}

Consumer.prototype.readVarBytes = function (value) {
  return this.readBytes(this.readUInt32BE())
}

for (const func: any of Object.values(Buffer.prototype)) {
  if (!func) continue
  const prop: string = func.name

  // Create custom readers that increase's the internal writerOffset
  if (prop.startsWith('write')) {
    Consumer.prototype[prop] = function (...args: any): number {
      args[1] = typeof args[1] === 'number' ? args[1] : this.writerOffset
      this.writerOffset = this._buffer[prop](...args)
      return this.writerOffset
    }
  }

  // Create custom readers that increase's the internal readerOffset
  if (prop.startsWith('read')) {
    const read = (defaultOffset: number) => {
      return function (offset?: number = 0) {
        const res = this._buffer[prop](this.readerOffset + offset)
        this.readerOffset += defaultOffset + offset
        return res
      }
    }
    if (prop.includes('32') || prop.includes('Float')) {
      Consumer.prototype[prop] = read(4)
    } else if (prop.includes('16') || prop.includes('Double')) {
      Consumer.prototype[prop] = read(2)
    } else if (prop.includes('8') || prop.includes('Int')) {
      Consumer.prototype[prop] = read(1)
    }
  }
}

Consumer.allocUnsafe = (...args) => new Consumer(Buffer.allocUnsafe(...args))
Consumer.alloc = (...args) => new Consumer(Buffer.alloc(...args))
Consumer.from = (...args) => new Consumer(Buffer.from(...args))

export default Consumer
