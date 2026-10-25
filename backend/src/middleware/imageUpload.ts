import multer from 'multer';
import { HttpError } from '../utils/http.js';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export const uploadProductImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) return callback(new HttpError(400, 'Upload a JPEG, PNG, WebP, or GIF image'));
    callback(null, true);
  }
}).single('image');