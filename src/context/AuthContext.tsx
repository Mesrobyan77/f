import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { authAPI } from "../services/api";
import { getSocket, disconnectSocket } from "../services/socket";
import type { User } from "../types";
import type { Socket } from "socket.io-client";

interface AuthContextType {
  user: User | null;
  token: string | null;
  socket: Socket | null;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      authAPI
        .me()
        .then((res) => {
          setUser(res.data.user);
          const s = getSocket(token);
          setSocket(s);
        })
        .catch(() => {
          localStorage.removeItem("token");
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await authAPI.login({ email, password });
    localStorage.setItem("token", res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    const s = getSocket(res.data.token);
    setSocket(s);
  };

  const register = async (username: string, email: string, password: string) => {
    const res = await authAPI.register({ username, email, password });
    localStorage.setItem("token", res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    const s = getSocket(res.data.token);
    setSocket(s);
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch {
      // ignore
    }
    disconnectSocket();
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setSocket(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, socket, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
