import fs from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { v2 as cloudinary } from 'cloudinary';
import config from '../config/index.js';
import { downloadCloudinaryFile } from '../config/cloudinary.js';
import logger from '../utils/logger.js';

const PREVIEW_PAGE_COUNT = 7;
const PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;

const previewDir = path.resolve(config.uploadPath, 'previews');

const ensurePreviewDir = async () => {
  await fs.promises.mkdir(previewDir, { recursive: true });
};

const getPreviewPath = (noteId) => path.join(previewDir, `${noteId}.pdf`);

const isPreviewFresh = async (filePath) => {
  try {
    const stat = await fs.promises.stat(filePath);
    return Date.now() - stat.mtimeMs < PREVIEW_TTL_MS;
  } catch (error) {
    return false;
  }
};

const loadSourceBuffer = async (note) => {
  if (note.storageType === 'cloudinary' && note.cloudinaryPublicId) {
    // Strategy 1: Cloudinary Admin API download (Basic Auth)
    try {
      const response = await downloadCloudinaryFile(note.cloudinaryPublicId);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }
      logger.warn('Cloudinary admin download failed, trying signed URL', {
        status: response.status,
        publicId: note.cloudinaryPublicId,
      });
    } catch (err) {
      logger.warn('Cloudinary admin download threw, trying signed URL', { error: err.message });
    }

    // Strategy 2: Signed CDN URL (direct delivery)
    try {
      const expiresAt = Math.floor(Date.now() / 1000) + 600; // 10 min
      const signedUrl = cloudinary.url(note.cloudinaryPublicId, {
        resource_type: 'raw',
        type: 'upload',
        secure: true,
        sign_url: true,
        expires_at: expiresAt,
      });
      const res2 = await fetch(signedUrl);
      if (res2.ok) {
        const arrayBuffer = await res2.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }
      throw new Error(`Signed URL fetch failed with HTTP ${res2.status}`);
    } catch (err) {
      throw new Error(`Could not download note from Cloudinary: ${err.message}`);
    }
  }

  if (note.filePath) {
    return fs.promises.readFile(note.filePath);
  }

  throw new Error('Preview source file not available');
};

const generatePreviewBuffer = async (sourceBuffer) => {
  const sourcePdf = await PDFDocument.load(sourceBuffer);
  const previewDoc = await PDFDocument.create();

  const pageCount = Math.min(sourcePdf.getPageCount(), PREVIEW_PAGE_COUNT);
  const pageIndices = Array.from({ length: pageCount }, (_, index) => index);
  const pages = await previewDoc.copyPages(sourcePdf, pageIndices);
  pages.forEach((page) => previewDoc.addPage(page));

  // ── Watermark ────────────────────────────────────────────────────────────────
  const font      = await previewDoc.embedFont(StandardFonts.HelveticaBold);
  const fontLight = await previewDoc.embedFont(StandardFonts.Helvetica);

  const line1 = 'NotesMitra - PREVIEW ONLY';
  const line2 = 'Purchase to unlock full content';
  const tileW = 220;
  const tileH = 150;

  for (const page of previewDoc.getPages()) {
    const { width, height } = page.getSize();

    // Diagonal tiled watermark
    for (let ty = -tileH; ty < height + tileH * 2; ty += tileH) {
      for (let tx = -tileW; tx < width + tileW * 2; tx += tileW) {
        page.drawText(line1, {
          x: tx, y: ty + 18,
          size: 13, font,
          color: rgb(0.55, 0.55, 0.55),
          opacity: 0.22,
          rotate: degrees(35),
        });
        page.drawText(line2, {
          x: tx, y: ty,
          size: 10, font: fontLight,
          color: rgb(0.55, 0.55, 0.55),
          opacity: 0.18,
          rotate: degrees(35),
        });
      }
    }

    // Top banner
    page.drawRectangle({ x: 0, y: height - 22, width, height: 22, color: rgb(0.95, 0.95, 0.95), opacity: 0.92 });
    page.drawText('[PREVIEW] NotesMitra.com - Purchase to access all pages', {
      x: 8, y: height - 16,
      size: 8, font: fontLight,
      color: rgb(0.35, 0.35, 0.35), opacity: 1,
    });

    // Bottom banner
    page.drawRectangle({ x: 0, y: 0, width, height: 18, color: rgb(0.95, 0.95, 0.95), opacity: 0.92 });
    page.drawText('This is a free preview. Redistribution prohibited. © NotesMitra', {
      x: 8, y: 5,
      size: 7, font: fontLight,
      color: rgb(0.35, 0.35, 0.35), opacity: 1,
    });
  }

  const previewBytes = await previewDoc.save();
  return Buffer.from(previewBytes);
};

export const getOrCreatePreview = async (note, tenantId) => {
  if (!note.fileName || !note.fileName.toLowerCase().endsWith('.pdf')) {
    throw new Error('Preview is only available for PDF files');
  }

  await ensurePreviewDir();
  const previewPath = getPreviewPath(note._id.toString());

  if (await isPreviewFresh(previewPath)) {
    return previewPath;
  }

  const sourceBuffer = await loadSourceBuffer(note);
  const previewBuffer = await generatePreviewBuffer(sourceBuffer);

  await fs.promises.writeFile(previewPath, previewBuffer);
  return previewPath;
};
