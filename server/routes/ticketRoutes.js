import express from 'express';
import {
  createTicket,
  createGuestTicket,
  getTickets,
  getTicket,
  replyToTicket,
  updateTicketStatus,
  deleteTicket
} from '../controllers/ticketController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.post('/guest', createGuestTicket);
router.post('/', protect, createTicket);
router.get('/', protect, getTickets);
router.get('/:id', protect, getTicket);
router.post('/:id/reply', protect, replyToTicket);
router.put('/:id/status', protect, authorize('admin'), updateTicketStatus);
router.delete('/:id', protect, authorize('admin'), deleteTicket);

export default router;
