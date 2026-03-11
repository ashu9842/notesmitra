/**
 * PDF Watermark Utility
 * Burns a personalised, tiling diagonal watermark into every page of a PDF.
 * The text is written directly into each page's content stream — it is NOT
 * stored as an annotation or optional-content layer, so standard "remove
 * watermark" tools cannot strip it without rasterising and re-OCR'ing the page.
 */

import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

/**
 * @param {Buffer} pdfBuffer      - Original PDF bytes
 * @param {object} opts
 *   @param {string} opts.buyerName      - Full name of the buyer
 *   @param {string} opts.buyerEmail     - Email of the buyer
 *   @param {string} opts.purchaseId     - MongoDB Purchase _id (hex string)
 *   @param {string} opts.noteTitle      - Title of the note
 * @returns {Promise<Buffer>} Watermarked PDF bytes
 */
export const applyWatermark = async (pdfBuffer, { buyerName, buyerEmail, purchaseId, noteTitle }) => {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontLight = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pages = pdfDoc.getPages();
  const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const shortPurchaseId = purchaseId ? purchaseId.toString().slice(-8).toUpperCase() : 'UNKNOWN';

  // Three lines of watermark text shown in a diagonal tile
  const line1 = `NotesMitra — Licensed Copy`;
  const line2 = `${buyerEmail}`;
  const line3 = `ID:${shortPurchaseId}  •  ${date}`;

  for (const page of pages) {
    const { width, height } = page.getSize();

    // ── Tiling diagonal watermark ─────────────────────────────────────────────
    // We tile every ~180pt horizontally and ~140pt vertically.
    // Each tile draws 3 lines rotated 35°.
    const tileW = 220;
    const tileH = 150;
    const mainSize = 11;
    const subSize = 9;
    const angle = degrees(35);
    const mainOpacity = 0.22;
    const subOpacity = 0.18;

    for (let ty = -tileH; ty < height + tileH * 2; ty += tileH) {
      for (let tx = -tileW; tx < width + tileW * 2; tx += tileW) {
        // Line 1 — bold brand
        page.drawText(line1, {
          x: tx,
          y: ty + 30,
          size: mainSize,
          font,
          color: rgb(0.55, 0.55, 0.55),
          opacity: mainOpacity,
          rotate: angle,
        });
        // Line 2 — buyer email (most important identifier)
        page.drawText(line2, {
          x: tx,
          y: ty + 15,
          size: mainSize,
          font,
          color: rgb(0.55, 0.55, 0.55),
          opacity: mainOpacity,
          rotate: angle,
        });
        // Line 3 — purchase ID + date
        page.drawText(line3, {
          x: tx,
          y: ty,
          size: subSize,
          font: fontLight,
          color: rgb(0.55, 0.55, 0.55),
          opacity: subOpacity,
          rotate: angle,
        });
      }
    }

    // ── Footer strip on every page ────────────────────────────────────────────
    // A compact single-line stamp at the very bottom — harder to crop/miss.
    const footerText = `© NotesMitra  |  Purchased by: ${buyerName} <${buyerEmail}>  |  Ref: ${shortPurchaseId}  |  ${date}  |  Redistribution prohibited`;
    const footerSize = 6.5;
    const footerColor = rgb(0.4, 0.4, 0.4);

    // Dark background band
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height: 14,
      color: rgb(0.93, 0.93, 0.93),
      opacity: 0.85,
    });

    page.drawText(footerText, {
      x: 6,
      y: 3,
      size: footerSize,
      font: fontLight,
      color: footerColor,
      opacity: 0.9,
    });

    // ── Top header strip ──────────────────────────────────────────────────────
    page.drawRectangle({
      x: 0,
      y: height - 14,
      width,
      height: 14,
      color: rgb(0.93, 0.93, 0.93),
      opacity: 0.85,
    });

    page.drawText(`NotesMitra — "${noteTitle}" — Licensed to ${buyerEmail}`, {
      x: 6,
      y: height - 11,
      size: footerSize,
      font: fontLight,
      color: footerColor,
      opacity: 0.9,
    });
  }

  const watermarkedBytes = await pdfDoc.save({ addDefaultPage: false });
  return Buffer.from(watermarkedBytes);
};
