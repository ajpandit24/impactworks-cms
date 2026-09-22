const express = require("express");
const path = require("path");
const cookieSession = require("cookie-session");
const cors = require("cors");
const { initDefaultUsers } = require("./auth");
const apiRoutes = require("./routes/api");
const usersRoutes = require("./routes/users");

const app = express();
const PORT = process.env.CMS_PORT || process.env.PORT || 5000;

// Initialize default users on startup
initDefaultUsers();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Session configuration
app.use(
  cookieSession({
    name: "impactworks_cms_session",
    keys: [process.env.SESSION_SECRET || "impactworks_secret_key_2025_secure_cms"],
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: "lax",
  })
);

// Serve static dashboard assets
app.use(express.static(path.join(__dirname, "public")));

// API Routers
app.use("/api", apiRoutes);
app.use("/api/users", usersRoutes);

// Page Routing
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/", (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect("/login");
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Fallback to index.html for dashboard SPA navigation
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  if (!req.session || !req.session.user) {
    return res.redirect("/login");
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

function startServer(port) {
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`====================================================`);
    console.log(`  Impactworks CMS Panel Server Running`);
    console.log(`  Local URL:   http://localhost:${port}`);
    console.log(`  Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`====================================================`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`[Warning] Port ${port} is already in use. Trying port ${Number(port) + 1}...`);
      startServer(Number(port) + 1);
    } else {
      console.error("Server error:", err);
    }
  });
}

startServer(PORT);

