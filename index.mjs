import { createServer } from "http";
import crypto from "crypto";

const PORT = 1337;
const WEBSOCKET_MAGIC_STRING_KEY = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

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
  console.log({ headers })
}

function prepareHandShakeHeaders(id) {
  const acceptKey = createSocketAccept(id);
  return acceptKey;
}


/**
  * create sha1 + concat the id to the magic string and return base64 result
  */
function createSocketAccept(id) {
  const shaum = crypto.createHash("sha1");
  shaum.update(id + WEBSOCKET_MAGIC_STRING_KEY);
  return shaum.digest('base64');
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
