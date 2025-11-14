const Note = require('../models/Note');
const fs = require('fs');
const path = require('path');

const uploadNote = async (req, res) => {
  try {
    const { title, subject, department, semester, description } = req.body;

    if (!title || !subject || !department || !semester) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a file' });
    }

    const note = new Note({
      title,
      subject,
      department,
      semester: parseInt(semester),
      uploadedBy: req.user.id,
      fileUrl: `/uploads/${req.file.filename}`,
      description
    });

    await note.save();

    res.status(201).json({
      success: true,
      message: 'Note uploaded successfully',
      note
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAllNotes = async (req, res) => {
  try {
    const { department, semester, subject } = req.query;
    let filter = {};

    if (department) filter.department = department;
    if (semester) filter.semester = parseInt(semester);
    if (subject) filter.subject = { $regex: subject, $options: 'i' };

    const notes = await Note.find(filter)
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: notes.length, notes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getNoteById = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id).populate('uploadedBy', 'name email');

    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    res.json({ success: true, note });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateNote = async (req, res) => {
  try {
    const { title, subject, description } = req.body;

    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    if (note.uploadedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this note' });
    }

    if (title) note.title = title;
    if (subject) note.subject = subject;
    if (description) note.description = description;
    note.updatedAt = Date.now();

    await note.save();

    res.json({ success: true, message: 'Note updated successfully', note });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteNote = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    if (note.uploadedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this note' });
    }

    const filePath = path.join(__dirname, '..', note.fileUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await Note.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Note deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const downloadNote = async (req, res) => {
  try {
    const note = await Note.findByIdAndUpdate(
      req.params.id,
      { $inc: { downloads: 1 } },
      { new: true }
    );

    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    res.json({ success: true, message: 'Download recorded', note });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  uploadNote,
  getAllNotes,
  getNoteById,
  updateNote,
  deleteNote,
  downloadNote
};