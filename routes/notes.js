const express = require('express');
const multer = require('multer');
const path = require('path');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const {
  uploadNote,
  getAllNotes,
  getNoteById,
  updateNote,
  deleteNote,
  downloadNote
} = require('../controllers/noteController');

const router = express.Router();

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/msword', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, and TXT files are allowed'));
    }
  }
});

router.post('/upload', verifyAdmin, upload.single('file'), uploadNote);
router.get('/', verifyToken, getAllNotes);
router.get('/:id', verifyToken, getNoteById);
router.put('/:id', verifyAdmin, updateNote);
router.delete('/:id', verifyAdmin, deleteNote);
router.put('/:id/download', verifyToken, downloadNote);

module.exports = router;