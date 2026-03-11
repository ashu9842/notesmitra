import Ticket from '../models/Ticket.js';
import User from '../models/User.js';
import Institution from '../models/Institution.js';
import { v4 as uuidv4 } from 'uuid';
import { emitAdminStatsUpdate } from '../services/paymentService.js';
import { emitToAdmins, emitToUser } from '../socketServer.js';
import logger from '../utils/logger.js';

/**
 * Get Socket.io instance (set by server during initialization)
 */
const getIO = () => {
  try {
    if (typeof global !== 'undefined' && global.io) {
      return global.io;
    }
  } catch (error) {
    logger.warn('Could not access Socket.io instance:', error.message);
  }
  return null;
};

/**
 * Emit ticket update to relevant party
 * @param {Object} ticket - The ticket document
 * @param {string} eventType - 'created', 'replied', 'status_updated', 'closed'
 * @param {string} initiatorRole - 'user' or 'admin' (who triggered the update)
 */
const emitTicketUpdate = async (ticket, eventType, initiatorRole = 'user') => {
  try {
    const io = getIO();

    if (!io) {
      logger.warn('Socket.io not available for ticket event emission');
      return;
    }

    // Populate ticket with user info
    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('userId', 'name email')
      .populate('relatedNoteId', 'title')
      .populate('messages.senderId', 'name email role');

    if (!populatedTicket) {
      logger.warn('Ticket not found for event emission');
      return;
    }

    const eventData = {
      ticketId: populatedTicket._id,
      userId: populatedTicket.userId._id,
      userName: populatedTicket.userId?.name || 'User',
      subject: populatedTicket.subject,
      status: populatedTicket.status,
      eventType,
      initiatorRole,
      messageCount: populatedTicket.messages.length,
      lastMessage: populatedTicket.messages[populatedTicket.messages.length - 1]
    };

    // Emit based on event type and who initiated
    if (eventType === 'created') {
      // New ticket created by user → notify all admins
      emitToAdmins(io, 'ticket:update', {
        ...eventData,
        target: 'admin',
        action: 'new_ticket'
      });
      logger.info('Ticket created event emitted to admins');
    } else if (eventType === 'replied') {
      if (initiatorRole === 'admin') {
        // Admin replied → notify user
        emitToUser(io, populatedTicket.userId._id, 'ticket:update', {
          ...eventData,
          target: 'user',
          action: 'admin_replied'
        });
        logger.info('Admin reply event emitted to user', { userName: populatedTicket.userId?.name });
      } else {
        // User replied → notify all admins
        emitToAdmins(io, 'ticket:update', {
          ...eventData,
          target: 'admin',
          action: 'user_replied'
        });
        logger.info('User reply event emitted to admins');
      }
    } else if (eventType === 'status_updated') {
      // Status updated → notify the user
      emitToUser(io, populatedTicket.userId._id, 'ticket:update', {
        ...eventData,
        target: 'user',
        action: 'status_changed'
      });
      logger.info('Status update event emitted to user', { userName: populatedTicket.userId?.name });
    } else if (eventType === 'deleted') {
      // Ticket deleted → notify the user
      emitToUser(io, populatedTicket.userId._id, 'ticket:update', {
        ...eventData,
        target: 'user',
        action: 'ticket_deleted'
      });
    }
  } catch (error) {
    // Silent error handling
  }
};

// @desc    Create support ticket
// @route   POST /api/tickets
// @access  Private
export const createTicket = async (req, res, next) => {
  try {
    const { category, subject, message, relatedNoteId } = req.body;

    if (!category || !subject || !message) {
      return res.status(400).json({
        success: false,
        error: 'Please provide category, subject, and message'
      });
    }

    // Get user's tenantId
    const user = await User.findById(req.user._id).select('tenantId');
    if (!user?.tenantId) {
      return res.status(400).json({
        success: false,
        error: 'User tenant information not found'
      });
    }

    // Create initial message
    const initialMessage = {
      senderId: req.user._id,
      senderRole: 'user',
      message,
      timestamp: new Date()
    };

    // Create ticket
    const ticket = await Ticket.create({
      userId: req.user._id,
      tenantId: user.tenantId,
      category,
      subject,
      relatedNoteId: relatedNoteId || null,
      status: 'open',
      priority: 'medium',
      messages: [initialMessage]
    });

    // Populate user info
    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('userId', 'name email')
      .populate('relatedNoteId', 'title');

    // Emit admin stats update
    emitAdminStatsUpdate();

    // Emit ticket:update event to admins
    await emitTicketUpdate(ticket, 'created', 'user');

    res.status(201).json({
      success: true,
      ticket: populatedTicket
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create support ticket for guest (unauthenticated) users
// @route   POST /api/tickets/guest
// @access  Public
export const createGuestTicket = async (req, res, next) => {
  try {
    const { guestName, guestEmail, category, subject, message } = req.body;

    if (!category || !subject || !message) {
      return res.status(400).json({
        success: false,
        error: 'Please provide category, subject, and message'
      });
    }

    if (!guestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address'
      });
    }

    // Resolve institution the same way the auth service does (single-tenant: 'notesmitra')
    const institution = await Institution.findOne({ slug: 'notesmitra', isActive: true })
      || await Institution.findOne({ isActive: true });

    if (!institution) {
      return res.status(500).json({ success: false, error: 'Platform configuration error. Please try again later.' });
    }

    const ticket = await Ticket.create({
      tenantId: institution._id,
      isGuest: true,
      guestName: guestName?.trim() || 'Guest',
      guestEmail: guestEmail.trim().toLowerCase(),
      category,
      subject,
      priority: 'medium',
      status: 'open',
      messages: [{
        senderId: null,
        senderRole: 'user',
        message,
        timestamp: new Date()
      }]
    });

    emitAdminStatsUpdate();

    res.status(201).json({ success: true, ticket });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all tickets (admin) or user's tickets
// @route   GET /api/tickets
// @access  Private
export const getTickets = async (req, res, next) => {
  try {
    let query = {};
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const skip = (page - 1) * limit;

    // If not admin, only show user's own tickets
    if (req.user.role !== 'admin') {
      query.userId = req.user._id;
    }

    // Apply filters
    const { status, priority, category } = req.query;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;

    const totalCount = await Ticket.countDocuments(query).maxTimeMS(5000);

    const tickets = await Ticket.find(query)
      .populate('userId', 'name email')
      .populate('relatedNoteId', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .maxTimeMS(5000);

    res.status(200).json({
      success: true,
      count: tickets.length,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      page,
      limit,
      tickets
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single ticket
// @route   GET /api/tickets/:id
// @access  Private
export const getTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('relatedNoteId', 'title')
      .populate('messages.senderId', 'name email role');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    // Check authorization
    if (ticket.userId._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this ticket'
      });
    }

    res.status(200).json({
      success: true,
      ticket
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reply to ticket
// @route   POST /api/tickets/:id/reply
// @access  Private
export const replyToTicket = async (req, res, next) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a message'
      });
    }

    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    // Check authorization
    if (ticket.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to reply to this ticket'
      });
    }

    // Add message
    const newMessage = {
      senderId: req.user._id,
      senderRole: req.user.role === 'admin' ? 'admin' : 'user',
      message: message.trim(),
      timestamp: new Date()
    };

    ticket.messages.push(newMessage);
    ticket.updatedAt = new Date();

    // If admin replies, update status to in_progress
    if (req.user.role === 'admin' && ticket.status === 'open') {
      ticket.status = 'in_progress';
    }

    await ticket.save();

    // Populate ticket
    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('userId', 'name email')
      .populate('relatedNoteId', 'title')
      .populate('messages.senderId', 'name email role');

    // Emit admin stats update if admin replied
    if (req.user.role === 'admin') {
      emitAdminStatsUpdate();
    }

    // Emit ticket:update event to relevant party
    await emitTicketUpdate(ticket, 'replied', req.user.role);

    res.status(200).json({
      success: true,
      ticket: populatedTicket
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update ticket status/priority
// @route   PUT /api/tickets/:id/status
// @access  Private (Admin)
export const updateTicketStatus = async (req, res, next) => {
  try {
    const { status, priority } = req.body;

    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    // Update fields
    if (status) ticket.status = status;
    if (priority) ticket.priority = priority;
    ticket.updatedAt = new Date();

    await ticket.save();

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('userId', 'name email')
      .populate('relatedNoteId', 'title');

    // Emit admin stats update
    emitAdminStatsUpdate();

    // Emit ticket:update event for status change
    await emitTicketUpdate(ticket, 'status_updated', 'admin');

    res.status(200).json({
      success: true,
      ticket: populatedTicket
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete ticket
// @route   DELETE /api/tickets/:id
// @access  Private (Admin)
export const deleteTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    // Store ticket data before deletion for event emission
    const ticketData = ticket.toObject();
    const userId = ticket.userId;

    await ticket.deleteOne();

    // Emit admin stats update
    emitAdminStatsUpdate();

    // Emit ticket:update event for deletion
    try {
      const io = getIO();
      if (io) {
        emitToUser(io, userId, 'ticket:update', {
          ticketId: ticketData._id,
          userId: userId,
          subject: ticketData.subject,
          eventType: 'deleted',
          initiatorRole: 'admin',
          action: 'ticket_deleted'
        });
        logger.info('Ticket deleted event emitted to user');
      }
    } catch (error) {
      logger.error('Error emitting ticket deletion event:', { error: error.message });
    }

    res.status(200).json({
      success: true,
      message: 'Ticket deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
