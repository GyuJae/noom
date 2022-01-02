import http from "http";
import express from "express";
import { Server } from "socket.io";
import path from "path";
import { instrument } from "@socket.io/admin-ui";

const app = express();
const PORT = 3000;
const __dirname = path.resolve();

app.set("view engine", "pug");
app.set("views", __dirname + "/src/views");
app.use("/public", express.static(__dirname + "/src/public"));
app.get("/", (_, res) => res.render("home"));
app.get("/*", (_, res) => res.redirect("/"));

const httpServer = http.createServer(app);
const wsServer = new Server(httpServer, {
  cors: {
    origin: ["https://admin.socket.io"],
    credentials: true,
  },
});

instrument(wsServer, {
  auth: false,
});

wsServer.on("connection", (socket) => {
  socket.on("join_room", (roomName, done) => {
    socket.join(roomName);
    socket.to(roomName).emit("welcome");
  });
  socket.on("offer", (offer, roomName) => {
    socket.to(roomName).emit("offer", offer);
  });
  socket.on("answer", (answer, roomName) => {
    socket.to(roomName).emit("answer", answer);
  });
  socket.on("ice", (ice, roomName) => {
    socket.to(roomName).emit("ice", ice);
  });
  socket.on("disconnecting", (data) => {
    console.log(data);
    socket.rooms.forEach((room) => socket.to(room).emit("bye"));
  });
});

httpServer.listen(process.env.PORT || PORT, () => {
  console.log(`Listening http://localhost:${process.env.PORT || PORT}`);
});
