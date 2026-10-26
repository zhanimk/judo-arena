#!/usr/bin/env node

import { io } from "socket.io-client";

const WS_URL =
  process.env.WS_URL ?? process.env.API_URL ?? "http://localhost:4000";
const CLIENTS = Number(process.env.SOCKET_CLIENTS ?? 50);
const DURATION_SEC = Number(process.env.SOCKET_DURATION_SEC ?? 60);
const ROOM = process.env.SOCKET_ROOM ?? "tournament:smoke";
const RECONNECT_EVERY_SEC = Number(
  process.env.SOCKET_RECONNECT_EVERY_SEC ?? 15,
);

let connected = 0;
let connectErrors = 0;
let reconnects = 0;
let subscribeErrors = 0;
const subscribedSockets = new Set();

const sockets = [];

function openSocket(index) {
  const socket = io(WS_URL, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 500,
    timeout: 5000,
  });

  socket.on("connect", () => {
    connected += 1;
    socket.timeout(5000).emit("subscribe", [ROOM], (error, responseError) => {
      if (error || responseError) subscribeErrors += 1;
      else if (socket.connected) subscribedSockets.add(socket);
    });
  });
  socket.on("connect_error", () => {
    connectErrors += 1;
  });
  socket.on("reconnect", () => {
    reconnects += 1;
  });
  socket.on("subscribe:error", () => {
    subscribeErrors += 1;
  });
  socket.on("disconnect", () => {
    connected = Math.max(0, connected - 1);
    subscribedSockets.delete(socket);
  });

  sockets[index] = socket;
}

for (let i = 0; i < CLIENTS; i += 1) openSocket(i);

const reconnectTimer = setInterval(() => {
  const socket = sockets[Math.floor(Math.random() * sockets.length)];
  if (socket) {
    socket.disconnect();
    reconnects += 1;
    setTimeout(() => socket.connect(), 500);
  }
}, RECONNECT_EVERY_SEC * 1000);

await new Promise((resolve) => setTimeout(resolve, DURATION_SEC * 1000));
clearInterval(reconnectTimer);
const connectedAtEnd = connected;
const subscribedAtEnd = subscribedSockets.size;
for (const socket of sockets) socket.disconnect();

console.log(
  `Socket load test: clients=${CLIENTS}, duration=${DURATION_SEC}s, room=${ROOM}`,
);
console.log(`Connected at end: ${connectedAtEnd}`);
console.log(`Subscribed at end: ${subscribedAtEnd}`);
console.log(`Connect errors: ${connectErrors}`);
console.log(`Reconnect attempts: ${reconnects}`);
console.log(`Subscribe errors: ${subscribeErrors}`);

if (connectedAtEnd < CLIENTS * 0.9 || subscribedAtEnd < CLIENTS * 0.9 || connectErrors > CLIENTS * 0.1 || subscribeErrors > 0) process.exit(1);
