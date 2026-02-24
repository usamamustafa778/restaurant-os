import { createContext, useContext, useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { getStoredAuth, getCurrentBranchId } from "../lib/apiClient";
import { useBranch } from "./BranchContext";

const SocketContext = createContext(null);

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export function SocketProvider({ children }) {
  const { currentBranch } = useBranch() || {};
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const branchId = currentBranch?.id ?? getCurrentBranchId();

  useEffect(() => {
    if (typeof window === "undefined" || !API_BASE) return;

    const auth = getStoredAuth();
    const token = auth?.token;
    const restaurantId = auth?.user?.restaurant || auth?.user?.restaurantId;
    if (!token || !restaurantId) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    const socketUrl = API_BASE.replace(/\/$/, "");
    const newSocket = io(socketUrl, {
      auth: { token, branchId: branchId || undefined },
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => setConnected(true));
    newSocket.on("disconnect", () => setConnected(false));
    newSocket.on("connect_error", () => setConnected(false));

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    };
  }, [branchId]); // Reconnect when branch changes (same tab or storage from another tab)

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
