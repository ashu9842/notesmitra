import express from 'express';
import {
  uploadNote,
  getNotes,
  getNote,
  reviewNote,
  rateNote,
  previewNote,
  previewNoteFile,
  downloadNote,
  deleteNote,
  getAdminFullPDF,
  pdfProxy,
  getAISummary,
  aiChatAboutNote,
} from '../controllers/noteController.js';
import { protect, authorize } from '../middleware/auth.js';
import upload, { handleUploadError, uploadToCloud } from '../middleware/upload.js';
import { checkUploadLimit, markPriorityApproval } from '../middleware/premium.js';

const router = express.Router();

router.post('/upload', protect, checkUploadLimit, markPriorityApproval, upload.single('file'), handleUploadError, uploadToCloud, uploadNote);
router.get('/', getNotes);
router.get('/:id', getNote);
router.get('/:id/preview', previewNote);
router.get('/:id/preview/file', previewNoteFile);
router.get('/:id/admin-view', protect, authorize('admin'), getAdminFullPDF);
router.get('/:id/pdf-proxy', protect, authorize('admin'), pdfProxy);
router.post('/:id/review', protect, authorize('admin'), reviewNote);
router.post('/:id/rate', protect, rateNote);
router.get('/:id/download', protect, downloadNote);
router.get('/:id/ai-summary', protect, getAISummary);
router.post('/:id/ai-chat', protect, aiChatAboutNote);
router.delete('/:id', protect, deleteNote);

export default router;
