const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const USERS_FILE = path.join(__dirname, "users.json");
const AUDIT_FILE = path.join(__dirname, "activity.json");

// Hash password using PBKDF2
function hashPassword(password, salt = null) {
  const generatedSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, generatedSalt, 100000, 64, "sha512")
    .toString("hex");
  return { salt: generatedSalt, hash };
}

// Verify password
function verifyPassword(password, salt, storedHash) {
  const { hash } = hashPassword(password, salt);
  return hash === storedHash;
}

// Get all users
function getUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    const data = fs.readFileSync(USERS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading users.json:", err);
    return [];
  }
}

// Save users
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

// Audit logger
function logActivity(userEmail, action, details = {}, ip = "") {
  try {
    let logs = [];
    if (fs.existsSync(AUDIT_FILE)) {
      const data = fs.readFileSync(AUDIT_FILE, "utf-8");
      logs = JSON.parse(data);
    }
    const logEntry = {
      id: "act_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
      user: userEmail || "Anonymous",
      action,
      details,
      ip: ip || "127.0.0.1",
    };
    logs.unshift(logEntry); // Most recent first
    if (logs.length > 500) logs = logs.slice(0, 500); // Cap at 500 records
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(logs, null, 2), "utf-8");
    return logEntry;
  } catch (err) {
    console.error("Error writing activity.json:", err);
  }
}

// Get activity logs
function getActivityLogs(limit = 100) {
  try {
    if (!fs.existsSync(AUDIT_FILE)) return [];
    const data = fs.readFileSync(AUDIT_FILE, "utf-8");
    const logs = JSON.parse(data);
    return logs.slice(0, limit);
  } catch (err) {
    return [];
  }
}

// Authentication Middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ error: "Unauthorized. Please log in." });
}

// SuperAdmin / Developer Role Middleware
function requireSuperAdmin(req, res, next) {
  if (
    req.session &&
    req.session.user &&
    (req.session.user.role === "developer" || req.session.user.role === "admin")
  ) {
    return next();
  }
  return res
    .status(403)
    .json({ error: "Forbidden. Requires SuperAdmin or Developer privileges." });
}

// Initialize default users if users.json is empty
function initDefaultUsers() {
  const existing = getUsers();
  if (existing.length === 0) {
    const defaultAccounts = [
      {
        id: "usr_dev_01",
        email: "dev@impactworks.au",
        name: "Developer SuperAdmin",
        role: "developer",
        passwordPlain: "dev@impactworks2025",
        createdAt: new Date().toISOString(),
      },
      {
        id: "usr_adm_02",
        email: "admin@impactworks.au",
        name: "Impactworks Admin",
        role: "admin",
        passwordPlain: "admin@impactworks2025",
        createdAt: new Date().toISOString(),
      },
      {
        id: "usr_edt_03",
        email: "editor@impactworks.au",
        name: "Content Editor",
        role: "editor",
        passwordPlain: "editor@impactworks2025",
        createdAt: new Date().toISOString(),
      },
      {
        id: "usr_mng_04",
        email: "manager@impactworks.au",
        name: "Operations Manager",
        role: "manager",
        passwordPlain: "manager@impactworks2025",
        createdAt: new Date().toISOString(),
      },
    ];

    const users = defaultAccounts.map((u) => {
      const { salt, hash } = hashPassword(u.passwordPlain);
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        salt,
        hash,
        createdAt: u.createdAt,
      };
    });

    saveUsers(users);
    logActivity(
      "system",
      "INITIALIZE_USERS",
      { message: "Default CMS user accounts initialized" },
      "system"
    );
    console.log("Initialized default CMS users in users.json");
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  getUsers,
  saveUsers,
  logActivity,
  getActivityLogs,
  requireAuth,
  requireSuperAdmin,
  initDefaultUsers,
};

