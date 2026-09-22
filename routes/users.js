const express = require("express");
const {
  getUsers,
  saveUsers,
  hashPassword,
  logActivity,
  requireAuth,
  requireSuperAdmin,
} = require("../auth");

const router = express.Router();

// GET /api/users (List all users - passwords redacted)
router.get("/", requireAuth, (req, res) => {
  const users = getUsers().map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt,
  }));
  res.json({ users });
});

// POST /api/users (Create new user - SuperAdmin / Developer only)
router.post("/", requireAuth, (req, res) => {
  // Only developer, admin, or manager can add users
  const creatorRole = req.session.user.role;
  if (!["developer", "admin", "manager"].includes(creatorRole)) {
    return res
      .status(403)
      .json({ error: "You do not have permission to add new users." });
  }

  const { email, name, password, role } = req.body;

  if (!email || !password || !name) {
    return res
      .status(400)
      .json({ error: "Email, name, and password are required." });
  }

  const validRoles = ["developer", "admin", "editor", "manager", "viewer"];
  const userRole = validRoles.includes(role) ? role : "editor";

  // Only developer can create other developer accounts
  if (userRole === "developer" && creatorRole !== "developer") {
    return res
      .status(403)
      .json({ error: "Only Developer SuperAdmins can create developer roles." });
  }

  const users = getUsers();
  const existing = users.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase()
  );

  if (existing) {
    return res
      .status(400)
      .json({ error: "A user with this email address already exists." });
  }

  const { salt, hash } = hashPassword(password);
  const newUser = {
    id: "usr_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    email: email.trim().toLowerCase(),
    name: name.trim(),
    role: userRole,
    salt,
    hash,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsers(users);

  logActivity(
    req.session.user.email,
    "CREATE_USER",
    { createdUserEmail: newUser.email, role: newUser.role, name: newUser.name },
    req.ip
  );

  res.json({
    success: true,
    message: `User ${newUser.name} (${newUser.email}) created successfully.`,
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      createdAt: newUser.createdAt,
    },
  });
});

// DELETE /api/users/:id (Delete a user)
router.delete("/:id", requireAuth, (req, res) => {
  const creatorRole = req.session.user.role;
  if (!["developer", "admin"].includes(creatorRole)) {
    return res
      .status(403)
      .json({ error: "Only Admins and Developers can delete users." });
  }

  const userId = req.params.id;
  const users = getUsers();
  const targetUser = users.find((u) => u.id === userId);

  if (!targetUser) {
    return res.status(404).json({ error: "User not found." });
  }

  // Prevent self-deletion
  if (targetUser.id === req.session.user.id) {
    return res
      .status(400)
      .json({ error: "You cannot delete your own active account." });
  }

  // Prevent non-developers from deleting developer accounts
  if (targetUser.role === "developer" && creatorRole !== "developer") {
    return res
      .status(403)
      .json({ error: "Cannot delete a Developer SuperAdmin account." });
  }

  const filtered = users.filter((u) => u.id !== userId);
  saveUsers(filtered);

  logActivity(
    req.session.user.email,
    "DELETE_USER",
    { deletedUserEmail: targetUser.email, deletedUserId: targetUser.id },
    req.ip
  );

  res.json({
    success: true,
    message: `User ${targetUser.name} deleted successfully.`,
  });
});

// PUT /api/users/:id/password (Reset password)
router.put("/:id/password", requireAuth, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res
      .status(400)
      .json({ error: "New password must be at least 6 characters long." });
  }

  const userId = req.params.id;
  const isSelf = req.session.user.id === userId;
  const isPrivileged = ["developer", "admin"].includes(req.session.user.role);

  if (!isSelf && !isPrivileged) {
    return res
      .status(403)
      .json({ error: "You do not have permission to reset this password." });
  }

  const users = getUsers();
  const user = users.find((u) => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  const { salt, hash } = hashPassword(newPassword);
  user.salt = salt;
  user.hash = hash;
  saveUsers(users);

  logActivity(
    req.session.user.email,
    "RESET_PASSWORD",
    { targetUserEmail: user.email },
    req.ip
  );

  res.json({
    success: true,
    message: `Password updated successfully for ${user.email}.`,
  });
});

module.exports = router;
