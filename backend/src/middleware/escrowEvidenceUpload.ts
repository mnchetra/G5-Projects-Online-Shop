import multer from 'multer';
import { HttpError } from '../utils/http.js';

const allowedTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime'
]);

export const uploadEscrowEvidence = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
  fileFilter: (_req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) {
      return callback(new HttpError(400, 'Evidence must be a JPEG, PNG, WebP, GIF, MP4, WebM, or MOV file'));
    }
    callback(null, true);
  }
}).array('evidence', 3);
