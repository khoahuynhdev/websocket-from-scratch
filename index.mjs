import { createServer } from "http";

const PORT = 1337;

createServer((req, res) => {
  res.writeHead(200);
  throw new Error("test");
  res.end("Hi there!");
}).listen(
  (PORT,
  () => {
    console.log(("Server liste to ", PORT));
  })
);

// error handling

["uncaughtException", "unhandledRejection"].forEach((event) => {
  process.on(event, (err) => {
    console.error(
      `Something bad happened! event: ${event}, msg: ${err.stack || err}`
    );
  });
});
