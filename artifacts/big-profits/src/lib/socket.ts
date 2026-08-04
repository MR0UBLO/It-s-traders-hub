import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    socket = io(import.meta.env.VITE_API_URL, {
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
    });

    const user = localStorage.getItem("bp_user");

    if (user) {
      try {
        const parsed = JSON.parse(user);

        if (parsed?.id) {
          socket.emit("join-user", parsed.id);
        }
      } catch (err) {
        console.error(err);
      }
    }
  }

  return socket;
}