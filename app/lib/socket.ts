import { io, Socket } from 'socket.io-client';

const BACKEND_URL = "https://backend-game-szli.onrender.com";

const socket: Socket = io(BACKEND_URL, {
  transports: ["websocket"],
  path: "/socket.io/",
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  autoConnect: true,
  withCredentials: false,
});

socket.on("connect_error", (err) => {
  console.error("❌ Error de conexión Socket.IO:", err.message);
});

socket.on("connect", () => {
  console.log("✅ Conectado al servidor Socket.IO:", socket.id);
});

export default socket;
