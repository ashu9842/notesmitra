import { useEffect, useCallback } from 'react';
import SocketClient from './socketClient';

export interface TicketUpdateEvent {
  ticketId: string;
  userId: string;
  userName: string;
  subject: string;
  status: string;
  eventType: 'created' | 'replied' | 'status_updated' | 'deleted';
  initiatorRole: 'user' | 'admin';
  action: string;
  messageCount?: number;
  lastMessage?: any;
  target?: 'user' | 'admin';
  timestamp: string;
}

/**
 * Hook to listen for real-time ticket updates
 * @param callback - Function to call when a ticket update is received
 * @param dependencies - Dependencies for the callback
 */
export const useTicketUpdates = (
  callback: (event: TicketUpdateEvent) => void,
  dependencies: any[] = []
) => {
  useEffect(() => {
    const socketUrl = (import.meta.env.VITE_API_URL || 'https://notesmitra-backend-2026-dhcuh8b8dnb7bgbm.centralindia-01.azurewebsites.net').replace(/\/api\/?$/, '');
    const socketClient = new SocketClient(socketUrl);

    socketClient
      .connect('')
      .then(() => {
        // Listen for ticket:update events
        socketClient.on('ticket:update', (event: TicketUpdateEvent) => {
          callback(event);
        });
      })
      .catch((error: any) => {
      });

    return () => {
      socketClient.disconnect();
    };
  }, dependencies);
};

/**
 * Get toast notification content for ticket update event
 */
export const getTicketUpdateNotification = (event: TicketUpdateEvent) => {
  switch (event.action) {
    case 'new_ticket':
      return {
        title: 'New Support Ticket',
        message: `${event.userName} created a new ticket: "${event.subject}"`
      };
    case 'admin_replied':
      return {
        title: 'Admin Response',
        message: `Support team replied to your ticket: "${event.subject}"`
      };
    case 'user_replied':
      return {
        title: 'New User Reply',
        message: `${event.userName} replied to ticket: "${event.subject}"`
      };
    case 'status_changed':
      return {
        title: 'Ticket Status Updated',
        message: `Your ticket status changed to: ${event.status}`
      };
    case 'ticket_deleted':
      return {
        title: 'Ticket Deleted',
        message: `The ticket "${event.subject}" has been deleted`
      };
    default:
      return {
        title: 'Ticket Update',
        message: `Update for ticket: "${event.subject}"`
      };
  }
};
