const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const {
  verifyPassword,
  getUsers,
  logActivity,
  getActivityLogs,
  requireAuth,
} = require("../auth");

const router = express.Router();

const ROOT_DATA_FILE = path.join(__dirname, "../../data.json");
const BACKUPS_DIR = path.join(__dirname, "../backups");

// Ensure backups directory exists
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Multer storage for JSON file imports
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Helper to create timestamped backup
function createBackupFile(prefix = "auto_save", note = "") {
  try {
    if (!fs.existsSync(ROOT_DATA_FILE)) return null;
    const content = fs.readFileSync(ROOT_DATA_FILE, "utf-8");
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .replace("Z", "");
    const filename = `data_${prefix}_${timestamp}.json`;
    const dest = path.join(BACKUPS_DIR, filename);

    fs.writeFileSync(dest, content, "utf-8");
    return { filename, timestamp, size: Buffer.byteLength(content, "utf-8") };
  } catch (err) {
    console.error("Backup creation failed:", err);
    return null;
  }
}

// -------------------------------------------------------------
// AUTHENTICATION ROUTES
// -------------------------------------------------------------

// POST /api/auth/login
router.post("/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const users = getUsers();
  const user = users.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase()
  );

  if (!user || !verifyPassword(password, user.salt, user.hash)) {
    logActivity(
      email,
      "LOGIN_FAILED",
      { reason: "Invalid credentials" },
      req.ip
    );
    return res.status(401).json({ error: "Invalid email or password." });
  }

  // Set session
  req.session.user = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };

  logActivity(
    user.email,
    "LOGIN_SUCCESS",
    { role: user.role, name: user.name },
    req.ip
  );

  res.json({
    message: "Login successful",
    user: req.session.user,
  });
});

// GET /api/auth/me
router.get("/auth/me", (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ authenticated: true, user: req.session.user });
  }
  return res.json({ authenticated: false, user: null });
});

// POST /api/auth/logout
router.post("/auth/logout", (req, res) => {
  const userEmail = req.session?.user?.email || "unknown";
  logActivity(userEmail, "LOGOUT", {}, req.ip);
  req.session = null;
  res.json({ message: "Logged out successfully" });
});

// -------------------------------------------------------------
// CONTENT CRUD ROUTES
// -------------------------------------------------------------

// GET /api/content
router.get("/content", requireAuth, (req, res) => {
  try {
    if (!fs.existsSync(ROOT_DATA_FILE)) {
      return res.status(404).json({ error: "data.json not found on server." });
    }
    const rawData = fs.readFileSync(ROOT_DATA_FILE, "utf-8");
    const json = JSON.parse(rawData);
    res.json(json);
  } catch (err) {
    res.status(500).json({ error: "Failed to read data.json: " + err.message });
  }
});

// POST /api/content (Save content & auto-create backup)
router.post("/content", requireAuth, (req, res) => {
  try {
    const updatedData = req.body;
    if (!updatedData || typeof updatedData !== "object") {
      return res.status(400).json({ error: "Invalid JSON content." });
    }

    // Create automatic pre-save backup
    const backupResult = createBackupFile(
      "before_save",
      `Saved by ${req.session.user.email}`
    );

    // Format with 2-space indentation
    const formatted = JSON.stringify(updatedData, null, 2);
    fs.writeFileSync(ROOT_DATA_FILE, formatted, "utf-8");

    const sectionsModified = Object.keys(updatedData);

    logActivity(
      req.session.user.email,
      "UPDATE_CONTENT",
      {
        sections: sectionsModified,
        backupFile: backupResult?.filename,
      },
      req.ip
    );

    res.json({
      success: true,
      message: "Content updated successfully and backup created.",
      backup: backupResult,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to save data.json: " + err.message });
  }
});

// -------------------------------------------------------------
// BACKUP & RESTORE ROUTES
// -------------------------------------------------------------

// GET /api/backups (List all backups)
router.get("/backups", requireAuth, (req, res) => {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      return res.json({ backups: [] });
    }

    const files = fs.readdirSync(BACKUPS_DIR);
    const backups = files
      .filter((f) => f.endsWith(".json"))
      .map((filename) => {
        const filePath = path.join(BACKUPS_DIR, filename);
        const stats = fs.statSync(filePath);
        return {
          filename,
          size: stats.size,
          createdAt: stats.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ backups });
  } catch (err) {
    res.status(500).json({ error: "Failed to list backups: " + err.message });
  }
});

// POST /api/backups/create (Manual snapshot)
router.post("/backups/create", requireAuth, (req, res) => {
  try {
    const { label } = req.body;
    const cleanLabel = (label || "manual").replace(/[^a-zA-Z0-9_-]/g, "_");
    const result = createBackupFile(cleanLabel);

    if (!result) {
      return res.status(500).json({ error: "Could not create backup snapshot." });
    }

    logActivity(
      req.session.user.email,
      "CREATE_BACKUP",
      { filename: result.filename, label },
      req.ip
    );

    res.json({
      success: true,
      message: `Backup ${result.filename} created successfully.`,
      backup: result,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create backup: " + err.message });
  }
});

// POST /api/backups/restore (Restore backup to live data.json)
router.post("/backups/restore", requireAuth, (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ error: "Filename is required." });
    }

    // Safety: prevent path traversal
    const safeFilename = path.basename(filename);
    const backupPath = path.join(BACKUPS_DIR, safeFilename);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: "Backup file does not exist." });
    }

    // Read and validate backup JSON
    const rawBackup = fs.readFileSync(backupPath, "utf-8");
    const parsed = JSON.parse(rawBackup);

    // Create a safety backup of current live state before restoring
    createBackupFile("pre_restore_safety");

    // Overwrite live data.json
    fs.writeFileSync(ROOT_DATA_FILE, JSON.stringify(parsed, null, 2), "utf-8");

    logActivity(
      req.session.user.email,
      "RESTORE_BACKUP",
      { restoredFrom: safeFilename },
      req.ip
    );

    res.json({
      success: true,
      message: `Successfully restored live content from ${safeFilename}.`,
    });
  } catch (err) {
    res.status(500).json({ error: "Restore failed: " + err.message });
  }
});

// GET /api/backups/download/:filename
router.get("/backups/download/:filename", requireAuth, (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(BACKUPS_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found." });
  }

  res.download(filePath, safeFilename);
});

// POST /api/backups/upload (Import external JSON file)
router.post(
  "/backups/upload",
  requireAuth,
  upload.single("jsonFile"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded." });
      }

      const fileContent = req.file.buffer.toString("utf-8");
      const parsed = JSON.parse(fileContent);

      // Save as backup first
      createBackupFile("imported_upload");

      // Apply to live data.json
      fs.writeFileSync(
        ROOT_DATA_FILE,
        JSON.stringify(parsed, null, 2),
        "utf-8"
      );

      logActivity(
        req.session.user.email,
        "IMPORT_JSON",
        { originalName: req.file.originalname },
        req.ip
      );

      res.json({
        success: true,
        message: "JSON imported and applied successfully.",
      });
    } catch (err) {
      res
        .status(400)
        .json({ error: "Invalid JSON upload file: " + err.message });
    }
  }
);

// -------------------------------------------------------------
// AUDIT & ACTIVITY HISTORY ROUTES (SuperAdmin / Developer)
// -------------------------------------------------------------

// GET /api/activity
router.get("/activity", requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 100;
  const logs = getActivityLogs(limit);
  res.json({ logs });
});

module.exports = router;
