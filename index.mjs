import { createServer } from "http";

const PORT = 1337;

const server = createServer((req, res) => {
  res.writeHead(200);
  res.end("Hi there!");
}).listen(PORT, () => {
  console.log("Server listen to ", PORT);
});
server.on("upgrade", (req, socket, head) => {
  // Client will send the header: Sec-WebSocket-Key
  const { "sec-websocket-key": webClientSocketKey } = req.headers;
  console.log({ webClientSocketKey });
});

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
