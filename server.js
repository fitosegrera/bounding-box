const { SerialPort } = require("serialport");
const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const { parse } = require("path");
const io = new Server(server);

const port = 3000;

app.use(express.static("public"));

server.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

// SERIAL PORT
let serial_port = new SerialPort({
  path: "/dev/ttyACM0",
  baudRate: 115200,
});

serial_port.on("error", function (err) {
  console.log("Error: ", err.message);
});

// SOCKETS
io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on("serialPort", (msg) => {
    console.log(msg);

    serial_port.isOpen && serial_port.close();
    serial_port.baudRate = parseInt(msg.baudRate);
    serial_port.path = msg.path;
    serial_port.open(function (err) {
      if (err) {
        return console.log("Error opening port: ", err.message);
      }
      console.log("port opened");
    });
  });

  socket.on("hit", (msg) => {
    serial_port.isOpen &&
      serial_port.write(msg + "%", function (err) {
        if (err) {
          return console.log("Error on write: ", err.message);
        }
      });
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});
