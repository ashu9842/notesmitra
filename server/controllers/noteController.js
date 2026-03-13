import Note from '../models/Note.js';
import User from '../models/User.js';
import Purchase from '../models/Purchase.js';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import { emitAdminStatsUpdate } from '../services/paymentService.js';
import * as cache from '../utils/cache.js';
import config from '../config/index.js';
import { downloadCloudinaryFile, deleteFromCloudinary } from '../config/cloudinary.js';
import fileAccessService from '../services/fileAccessService.js';
import { getOrCreatePreview } from '../services/pdfPreviewService.js';
import AppError from '../utils/AppError.js';
import pdfQualityChecker from '../services/pdfQualityChecker.js';
import geminiQualityChecker from '../services/geminiQualityChecker.js';
import { applyWatermark } from '../utils/pdfWatermark.js';
import { summariseNote, chatAboutNote } from '../services/aiNotesAssistant.js';

// ── Gibberish / nonsense text detection ─────────────────────────────────────
// Returns true if the string looks like keyboard-mashing or random characters.
const isGibberish = (str) => {
  if (!str || str.length < 4) return false;
  const s = str.toLowerCase().replace(/[^a-z]/g, '');
  if (s.length < 4) return false;

  const letters = s.length;

  // 1. Vowel ratio — real words typically have 20–75% vowels
  const vowels = (s.match(/[aeiou]/g) || []).length;
  const vowelRatio = vowels / letters;
  if (vowelRatio < 0.10 || vowelRatio > 0.85) return true;

  // 2. Rare-letter overload — letters almost never dominating real words:
  //    v, x, z, j, q, w, y, k each > 20% of the word signals gibberish
  //    (e.g. "dvrvdvevef..." has v at 35%; "sgudfyy..." has y at 28%)
  const RARE = ['v','x','z','j','q','w','y','k'];
  for (const c of RARE) {
    const cnt = (s.match(new RegExp(c, 'g')) || []).length;
    if (cnt / letters > 0.20) return true;
  }

  // 3. Consecutive repeated character runs (e.g. "fffffy", "vvvvv")
  if (/(.)\1{3,}/.test(s)) return true;

  // 4. Long runs of consonants with no vowel break (>5 in a row)
  if (/[bcdfghjklmnpqrstvwxyz]{6,}/.test(s)) return true;

  // 5. Any single letter > 35% of all letters (mono-letter spam)
  const freq = {};
  for (const c of s) freq[c] = (freq[c] || 0) + 1;
  if (Math.max(...Object.values(freq)) / letters > 0.35) return true;

  return false;
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const cleanupUpload = async (req) => {
  if (req.cloudinaryFile) {
    await deleteFromCloudinary(req.cloudinaryFile.publicId, 'raw').catch(() => {});
  } else if (req.file && fs.existsSync(req.file.path)) {
    fs.unlinkSync(req.file.path);
  }
};

// @desc    Upload a new note
// @route   POST /api/notes/upload
// @access  Private (Seller)
export const uploadNote = async (req, res, next) => {
  try {
    if (!req.file && !req.cloudinaryFile) {
      return res.status(400).json({
        success: false,
        error: 'Please upload a PDF file'
      });
    }

    const { title, description, subject, semester, price, pages } = req.body;

    // Validate required fields
    if (!title || !description || !subject || !semester || !price || !pages) {
      await cleanupUpload(req);
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    // ── Gibberish / nonsense metadata detection ──────────────────────────────
    // Check each word of the title — majority must not be gibberish
    const titleWords = title.trim().split(/\s+/);
    const gibberishTitleWords = titleWords.filter(w => isGibberish(w));
    if (gibberishTitleWords.length > 0 && gibberishTitleWords.length >= Math.ceil(titleWords.length * 0.5)) {
      await cleanupUpload(req);
      return res.status(400).json({
        success: false,
        error: 'Title appears to contain random or nonsense text. Please enter a meaningful title.'
      });
    }

    const subjectWords = subject.trim().split(/\s+/);
    const gibberishSubjectWords = subjectWords.filter(w => isGibberish(w));
    if (gibberishSubjectWords.length > 0 && gibberishSubjectWords.length >= Math.ceil(subjectWords.length * 0.5)) {
      await cleanupUpload(req);
      return res.status(400).json({
        success: false,
        error: 'Subject appears to contain random or nonsense text. Please enter a valid subject name.'
      });
    }

    if (isGibberish(description.replace(/\s+/g, ' ').slice(0, 60))) {
      await cleanupUpload(req);
      return res.status(400).json({
        success: false,
        error: 'Description appears to contain random or nonsense text. Please enter a meaningful description.'
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Validate page count
    if (parseInt(pages) < 3) {
      await cleanupUpload(req);
      return res.status(400).json({
        success: false,
        error: 'Notes must have at least 3 pages'
      });
    }

    // Determine storage type and file info
    const useCloudinary = !!req.cloudinaryFile;
    const fileSize = useCloudinary ? req.cloudinaryFile.bytes : req.file.size;
    const fileName = useCloudinary ? req.cloudinaryFile.originalName : req.file.originalname;
    const filePath = useCloudinary ? null : req.file.path;

    // Run basic quality checks
    const basicChecks = {
      pageCount: parseInt(pages) >= 3,
      fileSize: fileSize <= config.maxFileSize,
      fileType: true, // Already validated by multer
      hasTitle: title.length >= 5,
      hasDescription: description.length >= 20
    };

    // Duplicate detection — same title + subject in this tenant already approved/pending
    const existingDuplicate = await Note.findOne({
      tenantId: req.user.tenantId,
      title: { $regex: new RegExp(`^${escapeRegex(title)}$`, 'i') },
      subject: { $regex: new RegExp(`^${escapeRegex(subject)}$`, 'i') },
      status: { $in: ['pending_review', 'approved'] }
    }).lean();
    const isDuplicate = !!existingDuplicate;

    // Run advanced PDF quality checks — works for both local and Cloudinary storage
    let advancedChecks = {
      copyrightCheck: true,
      blankPageCheck: true,
      qualityCheck: true,
      metadataCheck: true
    };
    
    let qualityCheckDetails = null;
    let qualityWarnings = [];

    // Get PDF buffer from local file or Cloudinary
    let pdfBuffer = null;
    if (filePath && fs.existsSync(filePath)) {
      pdfBuffer = fs.readFileSync(filePath);
    } else if (useCloudinary && req.cloudinaryFile?.publicId) {
      try {
        const upstream = await downloadCloudinaryFile(req.cloudinaryFile.publicId);
        if (upstream.ok) {
          pdfBuffer = Buffer.from(await upstream.arrayBuffer());
        }
      } catch (e) {
        logger.warn('Could not download Cloudinary file for quality check', { error: e.message });
      }
    }

    if (pdfBuffer) {
      try {
        logger.info('Running PDF quality checks...');

        // ── Step 1: NotesMitra watermark hard-check (rule-based, no API cost) ──
        const watermarkResult = await pdfQualityChecker.checkNotesMitraWatermark(pdfBuffer);
        if (!watermarkResult.passed) {
          if (req.cloudinaryFile) {
            await deleteFromCloudinary(req.cloudinaryFile.publicId, 'raw').catch(() => {});
          } else if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          return res.status(400).json({
            success: false,
            error: watermarkResult.message ||
              'This PDF contains a NotesMitra watermark. Re-uploading purchased notes is not allowed.',
          });
        }

        // ── Step 2: Metadata check (rule-based, quick) ───────────────────────
        const metadataResult = await pdfQualityChecker.checkMetadata(pdfBuffer);

        // ── Step 3: Gemini AI checks (blank pages, scan quality, copyright) ──
        const aiChecks = await geminiQualityChecker.runGeminiChecks(pdfBuffer);
        logger.info(`AI analysis: ${aiChecks.usedAI ? 'Gemini' : 'fallback rule-based'}`);

        qualityCheckDetails = {
          success: true,
          checks: {
            watermark:  aiChecks.watermark,
            copyright:  aiChecks.copyright,
            blankPages: aiChecks.blankPages,
            quality:    aiChecks.quality,
            metadata:   aiChecks.metadata,
          },
          usedAI: aiChecks.usedAI,
        };

        advancedChecks = {
          copyrightCheck: aiChecks.copyright.passed,
          blankPageCheck: aiChecks.blankPages.passed,
          qualityCheck:   aiChecks.quality.passed,
          metadataCheck:  aiChecks.metadata.passed,
        };

        if (!aiChecks.copyright.passed)  qualityWarnings.push(aiChecks.copyright.warning  || 'Copyrighted material detected');
        if (!aiChecks.blankPages.passed) qualityWarnings.push(aiChecks.blankPages.warning || 'Blank or empty pages detected');
        if (!aiChecks.quality.passed)    qualityWarnings.push(aiChecks.quality.warning    || 'Low quality scan or readability issues');
        if (!aiChecks.metadata.passed)   qualityWarnings.push(aiChecks.metadata.warning   || 'Suspicious content markers detected');

        logger.info('PDF quality checks completed', {
          watermark:  'pass',
          copyright:  advancedChecks.copyrightCheck  ? 'pass' : 'fail',
          blankPages: advancedChecks.blankPageCheck  ? 'pass' : 'fail',
          quality:    advancedChecks.qualityCheck    ? 'pass' : 'fail',
          metadata:   advancedChecks.metadataCheck   ? 'pass' : 'fail',
          duplicate:  isDuplicate ? 'fail' : 'pass',
          warnings:   qualityWarnings.length,
        });
      } catch (error) {
        logger.error('Advanced quality check failed', { error: error.message });
      }
    }

    // Combine all quality checks (including duplicate)
    const qualityChecks = {
      ...basicChecks,
      ...advancedChecks,
      duplicateCheck: !isDuplicate
    };

    const allChecksPassed = Object.values(qualityChecks).every(check => check);
    
    // Determine status based on checks
    let uploadStatus = 'pending_review';
    let rejectionReason = null;
    
    // Structured 5-check results for frontend display (Gemini AI powered)
    const checkResults = [
      {
        key: 'copyrightCheck',
        label: 'Copyright Check',
        passed: advancedChecks.copyrightCheck,
        failReason: !advancedChecks.copyrightCheck
          ? (qualityCheckDetails?.checks?.copyright?.failReason || 'Copyrighted or institutional material detected')
          : null
      },
      {
        key: 'blankPageCheck',
        label: 'Blank Page Check',
        passed: advancedChecks.blankPageCheck,
        failReason: !advancedChecks.blankPageCheck
          ? (qualityCheckDetails?.checks?.blankPages?.failReason || 'Document contains blank or empty pages')
          : null
      },
      {
        key: 'qualityCheck',
        label: 'Scan Quality Check',
        passed: advancedChecks.qualityCheck,
        failReason: !advancedChecks.qualityCheck
          ? (qualityCheckDetails?.checks?.quality?.failReason || 'Document is a low quality scan or has readability issues')
          : null
      },
      {
        key: 'metadataCheck',
        label: 'Content Authenticity',
        passed: advancedChecks.metadataCheck,
        failReason: !advancedChecks.metadataCheck
          ? (qualityCheckDetails?.checks?.metadata?.failReason || 'Suspicious or pirated content markers detected')
          : null
      },
      {
        key: 'duplicateCheck',
        label: 'Duplicate Detection',
        passed: !isDuplicate,
        failReason: isDuplicate ? 'Similar notes already exist in the system' : null
      },
    ];
    
    if (!allChecksPassed) {
      uploadStatus = 'rejected';
      const failedLabels = checkResults
        .filter(c => !c.passed)
        .map(c => c.label);
      rejectionReason = `Auto-rejected: Quality checks failed (${failedLabels.join(', ')})`;
    }

    // Get user subscription info for premium features
    const user = await User.findById(req.user._id).select(
      'subscriptionType isPremiumSeller subscriptionExpiry tenantId'
    );

    if (!user.tenantId) {
      if (req.cloudinaryFile) {
        await deleteFromCloudinary(req.cloudinaryFile.publicId, 'raw');
      } else if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        error: 'Tenant ID not found in user record. Please contact support.'
      });
    }

    const hasActiveSubscription = user.hasActiveSubscription();
    const isPremiumSeller = (user.isPremiumSeller || user.subscriptionType === 'combo') && hasActiveSubscription;

    // Map user subscription type to seller subscription type for notes
    let sellerSubscriptionType = 'free_seller';
    if (user.subscriptionType === 'premium_seller' || user.subscriptionType === 'combo') {
      sellerSubscriptionType = user.subscriptionType;
    }
    // If user has buyer subscription (free_buyer/premium_buyer), treat as free_seller for notes
    // This allows buyers to also sell notes at free tier

    // Prepare note data with tenantId
    const noteData = {
      tenantId: user.tenantId,
      sellerId: req.user._id,
      title,
      description,
      subject,
      semester,
      price: parseFloat(price),
      pages: parseInt(pages),
      fileName,
      fileSize,
      status: uploadStatus,
      qualityChecks,
      uploadedAt: new Date(),
      // Premium features
      isPriorityApproval: isPremiumSeller,
      isFeatured: isPremiumSeller,
      sellerSubscriptionType: sellerSubscriptionType
    };
    
    // Add rejection reason if quality checks failed
    if (rejectionReason) {
      noteData.rejectionReason = rejectionReason;
      noteData.adminNotes = rejectionReason;
    }

    // Add storage-specific fields
    if (useCloudinary) {
      noteData.cloudinaryUrl = req.cloudinaryFile.url;
      noteData.cloudinaryPublicId = req.cloudinaryFile.publicId;
      noteData.storageType = 'cloudinary';
    } else {
      noteData.filePath = req.file.path;
      noteData.storageType = 'local';
    }

    // Create note
    const note = await Note.create(noteData);

    // Increment monthly upload count only after successful creation
    if (!isPremiumSeller) {
      await User.findByIdAndUpdate(req.user._id, { $inc: { monthlyUploadsCount: 1 } });
    }

    // Populate seller info
    const populatedNote = await Note.findById(note._id).populate('sellerId', 'name email');

    // Invalidate cache
    await cache.delPattern('notes:*');
    await cache.del('admin:stats');

    // Emit admin stats update
    emitAdminStatsUpdate();

    res.status(201).json({
      success: true,
      note: {
        ...populatedNote.toObject(),
        sellerName: populatedNote.sellerId.name
      },
      qualityCheckSummary: {
        allPassed: allChecksPassed,
        warnings: qualityWarnings,
        status: uploadStatus,
        checkResults,
        usedAI: qualityCheckDetails?.usedAI ?? false,
        message: allChecksPassed 
          ? 'All quality checks passed. Your note is pending admin review.' 
          : 'Quality checks failed. Please review and re-upload.',
        details: qualityCheckDetails ? {
          copyrightRisk: qualityCheckDetails.checks?.copyright?.passed === false ? 'high' : 'low',
          qualityScore: qualityCheckDetails.checks?.quality?.passed === false ? 0 : 100,
          contentDensity: qualityCheckDetails.checks?.blankPages?.passed === false ? 0 : 100
        } : null
      }
    });
  } catch (error) {
    // Clean up uploaded file on error
    if (req.cloudinaryFile) {
      try {
        await deleteFromCloudinary(req.cloudinaryFile.publicId, 'raw');
      } catch (cleanupError) {
        // Silent cleanup error
      }
    } else if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        // Silent cleanup error
      }
    }
    next(error);
  }
};

// @desc    Get all notes with filters
// @route   GET /api/notes
// @access  Public
export const getNotes = async (req, res, next) => {
  try {
    const { status, subject, semester, sellerId, search } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const isAdmin = req.user?.role === 'admin';
    const maxLimit = isAdmin ? 500 : 50;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), maxLimit);
    const skip = (page - 1) * limit;

    // Generate cache key from query params
    const cacheKey = `notes:${JSON.stringify({ status, subject, semester, sellerId, search, page, limit })}`;

    // Check cache first
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    // Build query
    let query = {};

    if (status) query.status = status;
    if (subject) query.subject = subject;
    if (semester) query.semester = semester;
    if (sellerId) query.sellerId = sellerId;

    // Text search
    if (search) {
      const safeSearch = escapeRegex(search);
      query.$or = [
        { title: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } },
        { subject: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    const totalCount = await Note.countDocuments(query).maxTimeMS(5000);

    // Execute query with lean() for read-only performance
    const notes = await Note.find(query)
      .select('title description subject semester price pages status createdAt sellerId fileName fileSize downloads rating rejectionReason qualityChecks isFeatured isPriorityApproval sellerSubscriptionType')
      .populate('sellerId', 'name email')
      .sort({ isFeatured: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .maxTimeMS(5000)
      .lean();

    // Format response
    const formattedNotes = notes.map(note => ({
      ...note,
      sellerName: note.sellerId?.name || 'Unknown',
      sellerEmail: note.sellerId?.email || 'N/A'
    }));

    const response = {
      success: true,
      count: notes.length,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      page,
      limit,
      notes: formattedNotes
    };

    // Cache the response for 60 seconds
    await cache.set(cacheKey, response, 60);

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

// @desc    Get single note
// @route   GET /api/notes/:id
// @access  Public
export const getNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id).populate('sellerId', 'name email');

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    res.status(200).json({
      success: true,
      note: {
        ...note.toObject(),
        sellerName: note.sellerId.name,
        sellerEmail: note.sellerId.email
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin review note
// @route   POST /api/notes/:id/review
// @access  Private (Admin)
export const reviewNote = async (req, res, next) => {
  try {
    const { status, adminNotes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be approved or rejected'
      });
    }

    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    note.status = status;
    note.adminNotes = adminNotes;
    note.reviewedAt = new Date();
    note.reviewedBy = req.user._id;
    if (status === 'rejected' && adminNotes) {
      note.rejectionReason = adminNotes;
    }

    await note.save();

    // Invalidate notes cache so the updated status is visible immediately
    await cache.delPattern('notes:*');
    await cache.del('admin:stats');

    const populatedNote = await Note.findById(note._id).populate('sellerId', 'name email');

    // Emit admin stats update
    emitAdminStatsUpdate();

    res.status(200).json({
      success: true,
      note: populatedNote
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get preview URL for note
// @route   GET /api/notes/:id/preview
// @access  Public
export const previewNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);
    const tenantId = note?.tenantId || req.tenant?.id;

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    if (note.tenantId && note.tenantId.toString() !== tenantId?.toString()) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    if (note.status !== 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Note is not available for preview'
      });
    }

    try {
      await getOrCreatePreview(note, tenantId);
    } catch (previewError) {
      logger.error('Preview generation failed', {
        noteId: note._id,
        error: previewError.message,
        storageType: note.storageType
      });
      return res.status(500).json({
        success: false,
        error: config.isDevelopment
          ? `Preview error: ${previewError.message}`
          : 'Failed to generate preview. Please try again later.'
      });
    }

    // Prefer X-Forwarded-Proto (set by Render/Heroku/nginx) so the URL is
    // always HTTPS in production, even though SSL is terminated at the proxy.
    const proto = req.headers['x-forwarded-proto']?.split(',')[0].trim() || req.protocol;
    const baseUrl = `${proto}://${req.get('host')}`;
    return res.status(200).json({
      success: true,
      previewUrl: `${baseUrl}/api/notes/${note._id}/preview/file`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Stream preview file for local storage
// @route   GET /api/notes/:id/preview/file
// @access  Public
export const previewNoteFile = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);
    const tenantId = note?.tenantId || req.tenant?.id;

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    if (note.tenantId && note.tenantId.toString() !== tenantId?.toString()) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    if (note.status !== 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Note is not available for preview'
      });
    }

    try {
      const previewPath = await getOrCreatePreview(note, tenantId);
      res.setHeader('Content-Type', 'application/pdf');
      // 'inline' with no filename  discourages the browser from offering a Save dialog
      res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
      // Prevent caching — the client must not store a copy of the preview bytes
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // Prevent the browser from embedding this response in any <object>/<embed>
      res.setHeader('X-Frame-Options', 'DENY');
      // Block search-engine caching / archiving of the preview bytes
      res.setHeader('X-Robots-Tag', 'noindex, noarchive, nosnippet');
      return res.sendFile(path.resolve(previewPath));
    } catch (previewError) {
      logger.error('Preview file streaming failed', {
        noteId: note._id,
        error: previewError.message,
        storageType: note.storageType
      });
      return res.status(500).json({
        success: false,
        error: config.isDevelopment
          ? `Preview stream error: ${previewError.message}`
          : 'Failed to stream preview. Please try again later.'
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Rate a note
// @route   POST /api/notes/:id/rate
// @access  Private
export const rateNote = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    const ratingValue = Number(rating);

    if (!ratingValue || ratingValue < 1 || ratingValue > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }

    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    const purchase = await Purchase.findOne({
      buyerId: req.user._id,
      noteId: note._id,
      status: 'completed'
    });

    if (!purchase) {
      return res.status(403).json({
        success: false,
        error: 'You must purchase this note before rating'
      });
    }

    const existingReviewIndex = note.reviews.findIndex(
      (review) => review.userId.toString() === req.user._id.toString()
    );

    if (existingReviewIndex >= 0) {
      note.reviews[existingReviewIndex].rating = ratingValue;
      note.reviews[existingReviewIndex].comment = comment;
      note.reviews[existingReviewIndex].createdAt = new Date();
    } else {
      note.reviews.push({
        userId: req.user._id,
        rating: ratingValue,
        comment
      });
    }

    const totalRatings = note.reviews.reduce((sum, review) => sum + review.rating, 0);
    note.rating = totalRatings / note.reviews.length;

    await note.save();
    await cache.delPattern('notes:*');

    res.status(200).json({
      success: true,
      rating: note.rating,
      reviewsCount: note.reviews.length
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Download note
// @route   GET /api/notes/:id/download
// @access  Private
export const downloadNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);
    const tenantId = req.tenant?.id || req.user?.tenantId;

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    // Verify note belongs to user's tenant
    if (note.tenantId && note.tenantId.toString() !== tenantId?.toString()) {
      logger.warn('Cross-tenant note access attempted', {
        requestTenant: tenantId,
        noteTenant: note.tenantId,
        noteId: note._id,
        userId: req.user?._id
      });

      return next(new AppError('Note not found in your tenant', 404));
    }

    // Check if user purchased this note
    let purchase = await Purchase.findOne({
      buyerId: req.user._id,
      noteId: note._id,
      status: 'completed'
    });

    if (!purchase) {
      const reconciledPurchase = await Purchase.findOneAndUpdate(
        {
          buyerId: req.user._id,
          noteId: note._id,
          paymentMethod: 'razorpay',
          razorpayPaymentId: { $exists: true, $ne: null },
          status: { $in: ['pending', 'processing'] }
        },
        {
          status: 'completed',
          purchasedAt: new Date()
        },
        {
          new: true,
          sort: { createdAt: -1 }
        }
      );

      if (reconciledPurchase) {
        purchase = reconciledPurchase;
        logger.warn('downloadNote: reconciled non-completed Razorpay purchase', {
          purchaseId: reconciledPurchase._id,
          noteId: note._id,
          userId: req.user?._id
        });
      }
    }

    if (!purchase) {
      return res.status(403).json({
        success: false,
        error: 'You must purchase this note before downloading'
      });
    }

    // Increment download count only once per unique user
    const userId = req.user._id;
    const alreadyCounted = note.downloadedBy?.some(id => id.toString() === userId.toString());
    if (!alreadyCounted) {
      note.downloadedBy = note.downloadedBy || [];
      note.downloadedBy.push(userId);
      note.downloads = (note.downloads || 0) + 1;
      await note.save();
      await cache.delPattern('notes:*');
    }
    res.setHeader('X-Download-Counted', alreadyCounted ? '0' : '1');

    // Handle Cloudinary storage — proxy via Admin API (same approach as pdfProxy).
    // Raw resources on Cloudinary CDN return 401 when fetched directly; the
    // Admin API with Basic Auth always works.
    if (note.storageType === 'cloudinary' && note.cloudinaryPublicId) {
      let upstream;
      try {
        upstream = await downloadCloudinaryFile(note.cloudinaryPublicId);
      } catch (fetchErr) {
        logger.error('downloadNote: network error fetching Cloudinary', { error: fetchErr.message });
        return res.status(502).json({ success: false, error: 'Could not reach file storage' });
      }

      if (!upstream.ok) {
        const errBody = await upstream.text().catch(() => '');
        logger.error('downloadNote: Cloudinary returned non-200', {
          status: upstream.status,
          publicId: note.cloudinaryPublicId,
          body: errBody.slice(0, 200)
        });
        return res.status(502).json({ success: false, error: `Storage returned ${upstream.status}` });
      }

      const rawBuffer = Buffer.from(await upstream.arrayBuffer());
      const fileName = note.fileName || 'document.pdf';

      // Burn personalised watermark into every page
      let buffer;
      try {
        buffer = await applyWatermark(rawBuffer, {
          buyerName: req.user.name,
          buyerEmail: req.user.email,
          purchaseId: purchase._id,
          noteTitle: note.title,
        });
      } catch (wmErr) {
        logger.warn('downloadNote: watermark failed, falling back to original', { error: wmErr.message });
        buffer = rawBuffer;
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      // Downloaded files must not be cached by the browser or any proxy
      res.setHeader('Cache-Control', 'no-store, private');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Robots-Tag', 'noindex, noarchive');
      return res.send(buffer);
    }

    // Handle local storage
    if (note.storageType === 'local' && note.filePath) {
      // Check if file exists
      if (!fs.existsSync(note.filePath)) {
        return res.status(404).json({
          success: false,
          error: 'File not found on server'
        });
      }

      // Read, watermark, then send
      let fileBuffer = fs.readFileSync(note.filePath);
      try {
        fileBuffer = await applyWatermark(fileBuffer, {
          buyerName: req.user.name,
          buyerEmail: req.user.email,
          purchaseId: purchase._id,
          noteTitle: note.title,
        });
      } catch (wmErr) {
        logger.warn('downloadNote: watermark failed for local file, sending original', { error: wmErr.message });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', fileBuffer.length);
      res.setHeader('Content-Disposition', `attachment; filename="${note.fileName || 'document.pdf'}"`);
      res.setHeader('Cache-Control', 'no-store, private');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Robots-Tag', 'noindex, noarchive');
      return res.send(fileBuffer);
    }

    // Neither storage type available
    return res.status(500).json({
      success: false,
      error: 'File storage information not available'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete note
// @route   DELETE /api/notes/:id
// @access  Private (Seller/Admin)
export const deleteNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    // Check ownership or admin
    if (note.sellerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this note'
      });
    }

    // Delete file based on storage type
    if (note.storageType === 'cloudinary' && note.cloudinaryPublicId) {
      try {
        await deleteFromCloudinary(note.cloudinaryPublicId, 'raw');
        logger.info('File deleted from Cloudinary', { noteId: note._id });
      } catch (error) {
        logger.error('Error deleting from Cloudinary', { noteId: note._id, error: error.message });
        // Continue with note deletion even if file deletion fails
      }
    } else if (note.storageType === 'local' && note.filePath) {
      // Delete file from local filesystem
      if (fs.existsSync(note.filePath)) {
        try {
          fs.unlinkSync(note.filePath);
          logger.info('File deleted from local storage', { noteId: note._id });
        } catch (error) {
          logger.error('Error deleting local file', { noteId: note._id, error: error.message });
          // Continue with note deletion
        }
      }
    }

    await note.deleteOne();

    // Invalidate cache
    await cache.delPattern('notes:*');
    await cache.del('admin:stats');

    // Emit admin stats update
    emitAdminStatsUpdate();

    res.status(200).json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get full PDF URL for admin review
// @route   GET /api/notes/:id/admin-view
// @access  Private/Admin
export const getAdminFullPDF = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);
    const tenantId = req.user?.tenantId;

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    // Verify tenant access (skip for admins without tenantId or if note has no tenantId)
    if (note.tenantId && tenantId && note.tenantId.toString() !== tenantId?.toString()) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    // Route all PDFs through the backend proxy.
    // For Cloudinary, the proxy generates a signed URL server-side and fetches it with Node fetch
    // (signed URLs must be fetched by the server; browser fetches return 401).
    // For local files, the proxy streams from disk.
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return res.status(200).json({
      success: true,
      downloadUrl: `${baseUrl}/api/notes/${note._id}/pdf-proxy`,
      isDirect: false,
      fileName: note.fileName,
      fileSize: note.fileSize,
      pages: note.pages,
      message: 'Full PDF URL for admin review'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Proxy-stream the full PDF for admin iframe preview
// @route   GET /api/notes/:id/pdf-proxy
// @access  Private (Admin)
export const pdfProxy = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    // ── Local storage ──────────────────────────────────────────────────────────
    if (note.storageType === 'local' || !note.cloudinaryPublicId) {
      if (!note.filePath || !fs.existsSync(note.filePath)) {
        return res.status(404).json({ success: false, error: 'PDF file not found' });
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${note.fileName || 'document.pdf'}"`);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      fs.createReadStream(note.filePath).pipe(res);
      return;
    }

    // ── Cloudinary storage ─────────────────────────────────────────────────────
    // Use the Cloudinary Admin API download endpoint with Basic Auth.
    // CDN signed URLs return 401 for raw resources on accounts with strict delivery
    // (raw files cannot embed expiry via e_at: transformation). The Admin API
    // accepts the same credentials as every other Admin API call and works reliably.
    let upstream;
    try {
      upstream = await downloadCloudinaryFile(note.cloudinaryPublicId);
    } catch (fetchErr) {
      logger.error('pdfProxy: network error fetching Cloudinary', { error: fetchErr.message });
      return res.status(502).json({ success: false, error: 'Could not reach file storage' });
    }

    if (!upstream.ok) {
      const errBody = await upstream.text().catch(() => '');
      logger.error('pdfProxy: Cloudinary returned non-200', {
        status: upstream.status,
        publicId: note.cloudinaryPublicId,
        body: errBody.slice(0, 300)
      });
      return res.status(502).json({
        success: false,
        error: `Storage returned ${upstream.status} — check server logs`
      });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Content-Disposition', `inline; filename="${note.fileName || 'document.pdf'}"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(buffer);
  } catch (error) {
    next(error);
  }
};

// ─── AI Notes Assistant ───────────────────────────────────────────────────────

/**
 * Helper: fetch the raw PDF buffer for a note (works for both Cloudinary & local).
 * Returns null if the file cannot be retrieved.
 */
const fetchNotePdfBuffer = async (note) => {
  try {
    if (note.storageType === 'cloudinary' && note.cloudinaryPublicId) {
      try {
        const upstream = await downloadCloudinaryFile(note.cloudinaryPublicId);
        if (!upstream?.ok) {
          logger.warn('fetchNotePdfBuffer: Cloudinary response not ok', {
            status: upstream?.status,
            statusText: upstream?.statusText,
            publicId: note.cloudinaryPublicId
          });
          return null;
        }
        const buffer = Buffer.from(await upstream.arrayBuffer());
        logger.debug('fetchNotePdfBuffer: Cloudinary PDF downloaded', { bufferSize: buffer.length });
        return buffer;
      } catch (cloudinaryErr) {
        logger.warn('fetchNotePdfBuffer: Cloudinary fetch failed', { 
          error: cloudinaryErr.message,
          publicId: note.cloudinaryPublicId
        });
        return null;
      }
    }
    
    if (note.filePath && fs.existsSync(note.filePath)) {
      const buffer = fs.readFileSync(note.filePath);
      logger.debug('fetchNotePdfBuffer: Local file read', { bufferSize: buffer.length, filePath: note.filePath });
      return buffer;
    }
    
    logger.warn('fetchNotePdfBuffer: No valid storage location', { 
      storageType: note.storageType,
      hasCloudinaryId: !!note.cloudinaryPublicId,
      hasFilePath: !!note.filePath,
      filePathExists: note.filePath ? fs.existsSync(note.filePath) : false
    });
    return null;
  } catch (err) {
    logger.error('fetchNotePdfBuffer: unexpected error', { error: err.message });
    return null;
  }
};

// @desc    Generate an AI exam-ready summary for a purchased note
// @route   GET /api/notes/:id/ai-summary
// @access  Private (Buyer who purchased)
export const getAISummary = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id).lean();
    if (!note) return next(new AppError('Note not found', 404));

    const purchase = await Purchase.findOne({
      buyerId: req.user._id,
      noteId: note._id,
      status: 'completed',
    });
    if (!purchase) {
      return res.status(403).json({ success: false, error: 'You must purchase this note to use AI features' });
    }

    const pdfBuffer = await fetchNotePdfBuffer(note);
    if (!pdfBuffer) {
      return res.status(404).json({ success: false, error: 'Could not load note file for AI analysis' });
    }

    const result = await summariseNote(pdfBuffer, { title: note.title, subject: note.subject });
    return res.json({ success: true, ...result });
  } catch (error) {
    logger.error('getAISummary error', { error: error.message });
    next(error);
  }
};

// @desc    Chat with AI about a purchased note
// @route   POST /api/notes/:id/ai-chat
// @access  Private (Buyer who purchased)
export const aiChatAboutNote = async (req, res, next) => {
  try {
    const { question, history } = req.body;
    if (!question || typeof question !== 'string' || question.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Please provide a valid question.' });
    }

    const note = await Note.findById(req.params.id).lean();
    if (!note) return next(new AppError('Note not found', 404));

    const purchase = await Purchase.findOne({
      buyerId: req.user._id,
      noteId: note._id,
      status: 'completed',
    });
    if (!purchase) {
      return res.status(403).json({ success: false, error: 'You must purchase this note to use AI features' });
    }

    const pdfBuffer = await fetchNotePdfBuffer(note);
    if (!pdfBuffer) {
      return res.status(404).json({ success: false, error: 'Could not load note file for AI chat' });
    }

    const answer = await chatAboutNote(
      pdfBuffer,
      { title: note.title, subject: note.subject },
      question.trim(),
      Array.isArray(history) ? history : []
    );

    return res.json({ success: true, answer });
  } catch (error) {
    logger.error('aiChatAboutNote error', { error: error.message });
    next(error);
  }
};

