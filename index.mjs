import { createServer } from "http";
import crypto from "crypto";

// ref: https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers
const PORT = 1337;
const WEBSOCKET_MAGIC_STRING_KEY = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const SEVEN_BITS_INTEGER_MARKER = 125;
const SIXTEEN_BITS_INTEGER_MARKER = 126;
const SIXTYFOUR_BITS_INTEGER_MARKER = 127;

const MAXIMUM_SIXTEENBITS_INTEGER = 2 ** 16;

const MASK_KEY_BYTES_LENGTH = 4;
// parseInt('10000000', 2)
// how much is 1 bit in Javascript
// we have 1 byte = 8 bit
const FIRST_BIT = 128;

const server = createServer((req, res) => {
  res.writeHead(200);
  res.end("Hi there!");
}).listen(PORT, () => {
  console.log("Server listen to ", PORT);
});
server.on("upgrade", onSocketUpgrade);

function onSocketUpgrade(req, socket, head) {
  // Client will send the header: Sec-WebSocket-Key
  const { "sec-websocket-key": webClientSocketKey } = req.headers;
  console.log(`${webClientSocketKey} connected!`);
  const headers = prepareHandShakeHeaders(webClientSocketKey);
  socket.write(headers);
  socket.on("readable", () => onSocketReadable(socket));
}

function onSocketReadable(socket) {
  // consume optcode (firstbyte)
  // 1 = 1 byte = 8 bits
  socket.read(1);
  const [markerAndPayloadLength] = socket.read(1);
  // because the first bit is always 1 for client-to-server messages
  // u can substract one bit (128 or '10000000') from this byte to get rid of
  // the MASK bit
  const lengthIndicatorInBits = markerAndPayloadLength - FIRST_BIT;

  let messageLength = 0;
  if (lengthIndicatorInBits <= SEVEN_BITS_INTEGER_MARKER) {
    messageLength = lengthIndicatorInBits;
  } else if (lengthIndicatorInBits === SIXTEEN_BITS_INTEGER_MARKER) {
    messageLength = socket.read(2).readUint16BE(0);
  } else {
    throw new Error(
      "your message is too long! we don't handle 64-length message "
    );
  }

  const maskKey = socket.read(MASK_KEY_BYTES_LENGTH);
  const encoded = socket.read(messageLength);
  const decoded = unmask(encoded, maskKey);
  const received = decoded.toString("utf8");
  const data = JSON.parse(received);
  console.log("message received!", data);
  const msg = JSON.stringify({
    message: data,
    at: new Date().toISOString(),
  });
  sendMessage(msg, socket);
}

function unmask(encodedBuffer, maskKey) {
  // @NOTE: because the maskKey has only 4 byte
  // @NOTE: index % 4 == 0, 1, 2, 3 = index bits needed to decode the message
  // XOR ^
  // return 1 if both are different
  // return 0 if both are equals
  // (71).toString(2).padStart(8, "0") = 01000111
  // (53).toString(2).padStart(8, "0") = 00110101
  //                                     01110010
  //
  // String.fromCharCode(parseInt('01110010', 2))
  const finalBuffer = Buffer.from(encodedBuffer);
  const fillWithEightZeros = (t) => t.padStart(8, "0");
  const toBinary = (t) => fillWithEightZeros(t.toString(2));
  const fromBinaryToDecimal = (t) => parseInt(toBinary(t), 2);
  const getCharFromBinary = (t) => String.fromCharCode(fromBinaryToDecimal(t));
  for (let i = 0; i < encodedBuffer.length; i++) {
    finalBuffer[i] = encodedBuffer[i] ^ maskKey[i % MASK_KEY_BYTES_LENGTH];
    const logger = {
      unmaskingCalc: `${toBinary(encodedBuffer[i])} ^ ${toBinary(
        maskKey[i % MASK_KEY_BYTES_LENGTH]
      )} = ${toBinary(finalBuffer[i])}`,
      decoded: getCharFromBinary(finalBuffer[i]),
    };
    console.log(logger);
  }
  return finalBuffer;
}

function sendMessage(msg, socket) {
  const dataFrame = prepareMessage(msg);
  socket.write(dataFrame);
}

function prepareMessage(message) {
  const msg = Buffer.from(message);
  const messageSize = msg.length;

  let dataFrameBuffer;

  // 0x80 === 128 in binary
  // '0x' + Math.abs(128).toString() == 0x80
  const firstByte = 0x80 | 0x01; // single Frame + text
  if (messageSize <= SEVEN_BITS_INTEGER_MARKER) {
    const bytes = [firstByte];
    dataFrameBuffer = Buffer.from(bytes.concat(messageSize));
  } else if (messageSize <= MAXIMUM_SIXTEENBITS_INTEGER) {
    const offsetFourBytes = 4;
    const target = Buffer.allocUnsafe(offsetFourBytes)
    target[0] = firstByte;
    target[1] = SIXTEEN_BITS_INTEGER_MARKER | 0x0; // just to know the mask
    target.writeUint16BE(messageSize, 2); // content length is 2 bytes
    dataFrameBuffer = target;

    // alloc 4 bytes
    // [0] - 128 + 1 - 10000001 = 0x81 fin + optcode
    // [1] - 126 + 0 - payload length marker + mask indicator
    // [2] 0 - content length
    // [3] 171 - content length
    // [4 - ..] - the message itself
  } else {
    throw new Error("Message too long buddy");
  }
  const totalLength = dataFrameBuffer.byteLength + messageSize;
  const dataFrameResponse = concat([dataFrameBuffer, msg], totalLength);
  return dataFrameResponse;
}

function concat(bufferList, totalLength) {
  const target = Buffer.allocUnsafe(totalLength);
  let offset = 0;
  for (const buffer of bufferList) {
    target.set(buffer, offset);
    offset += buffer.length;
  }
  return target;
}

function prepareHandShakeHeaders(id) {
  const acceptKey = createSocketAccept(id);
  const headers = [
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${acceptKey}`,
    "",
  ]
    .map((line) => line.concat("\r\n"))
    .join(""); // HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade ...
  return headers;
}

/**
 * create sha1 + concat the id to the magic string and return base64 result
 */
function createSocketAccept(id) {
  const shaum = crypto.createHash("sha1");
  shaum.update(id + WEBSOCKET_MAGIC_STRING_KEY);
  return shaum.digest("base64");
}

[
  // error handling

  ("uncaughtException", "unhandledRejection"),
].forEach((event) => {
  process.on(event, (err) => {
    console.error(
      `Something bad happened! event: ${event}, msg: ${err.stack || err}`
    );
  });
});
