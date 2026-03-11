/**
 * Socket.io client utility with JWT authentication
 * Handles secure WebSocket connections with automatic token refresh
 */

import io, { Socket } from 'socket.io-client';

const SOCKET_EVENTS = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',

  // Custom events
  ERROR: 'error'
};

interface SocketClientOptions {
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
}

class SocketClient {
  private serverUrl: string;
  private socket: Socket | null;
  private token: string | null;
  private reconnectAttempts: number;
  private maxReconnectAttempts: number;
  private reconnectDelay: number;

  constructor(serverUrl: string, options: SocketClientOptions = {}) {
    this.serverUrl = serverUrl;
    this.socket = null;
    this.token = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
    this.reconnectDelay = options.reconnectDelay ?? 1000;
  }

  /**
   * Connect to Socket.io server with JWT authentication
   * @param token - JWT access token from authentication
   */
  connect(token?: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.token = token || null;

      // Create socket connection with auth token
      const authPayload = this.token ? { token: this.token } : undefined;

      this.socket = io(this.serverUrl, {
        auth: authPayload,
        withCredentials: true,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 10000,
        reconnectionAttempts: this.maxReconnectAttempts,
        forceNew: true
      });

      // Handle successful connection
      this.socket.on(SOCKET_EVENTS.CONNECT, () => {
        this.reconnectAttempts = 0;
        resolve();
      });

      // Handle authentication errors
      this.socket.on(SOCKET_EVENTS.CONNECT_ERROR, (error: Error) => {
        this.reconnectAttempts++;

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.socket?.disconnect();
          reject(error);
        }
      });

      // Handle disconnection
      this.socket.on(SOCKET_EVENTS.DISCONNECT, (_reason: string) => {
      });

      // Handle socket errors
      this.socket.on(SOCKET_EVENTS.ERROR, (_error: Error) => {
      });

      // Set a timeout for connection attempt
      setTimeout(() => {
        if (!this.socket?.connected) {
          reject(new Error('Socket connection timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Update authentication token (for refresh scenarios)
   * @param token - New JWT access token
   */
  updateToken(token: string): void {
    this.token = token;
    if (this.socket?.connected) {
      // Optionally re-authenticate if socket supports it
      this.socket.emit('auth:update', { token });
    }
  }

  /**
   * Subscribe to a Socket.io event with callback
   * @param event - Event name
   * @param callback - Event handler
   */
  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.socket) {
      return;
    }
    this.socket.on(event, callback);
  }

  /**
   * Emit an event to the server
   * @param event - Event name
   * @param data - Event data
   */
  emit(event: string, data: Record<string, unknown> = {}): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit(event, data, (response: unknown) => {
        resolve(response);
      });
    });
  }

  /**
   * Disconnect from socket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Get socket instance (for advanced usage)
   */
  getSocket(): Socket | null {
    return this.socket;
  }
}

export default SocketClient;
export { SOCKET_EVENTS };
