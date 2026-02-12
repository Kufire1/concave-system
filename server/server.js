const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// -------------------------
// TEMP DEBUG (REMOVE AFTER FIX)
// -------------------------
// This prints what Render is REALLY using (password masked), so we can stop guessing.
if (process.env.MONGO_URI) {
  const masked = process.env.MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@");
  console.log("MONGO_URI (masked):", masked);
} else {
  console.log("MONGO_URI is NOT set");
}

console.log("CORS_ORIGIN:", process.env.CORS_ORIGIN || "(empty)");

const app = express();

app.use(express.json());

// -------------------------
// CORS (launch-ready)
// -------------------------
// In production set: CORS_ORIGIN=https://your-frontend.com,https://admin.your-frontend.com
// In dev, you can omit CORS_ORIGIN to allow all (or set it to your localhost frontend).
const rawOrigins = (process.env.CORS_ORIGIN || "").trim();
const allowedOrigins = rawOrigins
  ? rawOrigins.split(",").map((s) => s.trim()).filter(Boolean)
  : [];

app.use(
  cors({
    origin: (origin, cb) => {
      // allow non-browser requests (curl/postman) with no origin
      if (!origin) return cb(null, true);

      // if no allowlist provided, allow all (dev convenience)
      if (allowedOrigins.length === 0) return cb(null, true);

      // enforce allowlist
      if (allowedOrigins.includes(origin)) return cb(null, true);

      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// -------------------------
// Roles & Departments
// -------------------------
const ROLES = ["creator", "admin", "hod", "project_lead", "staff", "contract"];

const DEPARTMENTS = [
  "Management",
  "Finance",
  "Contract Staff",
  "Project Management",
  // add other real departments you use...
];

// -------------------------
// Models
// -------------------------
const UserSchema = new mongoose.Schema({
  name: { type: String, default: "" },
  email: { type: String, unique: true, lowercase: true, trim: true },
  password: { type: String, default: "" },
  role: { type: String, enum: ROLES, default: "staff" },
  department: { type: String, enum: DEPARTMENTS, default: "Management" },
});

const User = mongoose.model("User", UserSchema);

const TaskSchema = new mongoose.Schema({
  title: { type: String, default: "" },
  description: { type: String, default: "" },
  department: { type: String, enum: DEPARTMENTS },
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // optional (task-level assignment)
  status: { type: String, default: "Not Started" },
  progress: { type: Number, default: 0 },

  milestones: [
    {
      title: { type: String, default: "" },
      status: { type: String, default: "Not Done" },

      // for staff/contract
      assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      // for project leads/team
      assignedDepartment: { type: String, default: null },

      completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      completedAt: { type: Date, default: null },
    },
  ],

  createdAt: { type: Date, default: Date.now },
  deadline: Date,
});

const Task = mongoose.model("Task", TaskSchema);

// Ensure indexes build (launch stability: makes email uniqueness reliable)
User.init().catch((e) => console.log("Index init error:", e));

// -------------------------
// DB Connection
// -------------------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("DB Error:", err));

// -------------------------
// Helpers
// -------------------------
function sanitizeUser(user) {
  const u = user.toObject ? user.toObject() : user;
  delete u.password;
  return u;
}

function recalcTaskProgress(taskDoc) {
  const ms = taskDoc.milestones || [];
  if (ms.length === 0) {
    taskDoc.progress = 0;
    taskDoc.status = "Not Started";
    return;
  }

  const doneCount = ms.filter((m) => m.status === "Done").length;
  taskDoc.progress = Math.round((doneCount / ms.length) * 100);

  if (taskDoc.progress === 100) taskDoc.status = "Completed";
  else if (taskDoc.progress > 0) taskDoc.status = "In Progress";
  else taskDoc.status = "Not Started";
}

function handleDuplicateEmail(err, res) {
  if (err && (err.code === 11000 || String(err).includes("E11000"))) {
    return res.status(400).json({ msg: "Email already exists" });
  }
  return null;
}

// -------------------------
// Auth Middleware
// -------------------------
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ msg: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, department, email, name }
    next();
  } catch (err) {
    return res.status(401).json({ msg: "Invalid token" });
  }
}

// -------------------------
// Permission Rules
// -------------------------
function canManageUsers(user) {
  return user.role === "creator";
}

function canViewAnalytics(user) {
  if (user.role === "creator") return true;
  if (user.role === "admin") return true;
  if (user.role === "project_lead") return true;
  if (user.role === "hod") return true;
  return false;
}

function canSeeTask(user, task) {
  if (user.role === "creator" || user.role === "admin") return true;
  if (user.role === "project_lead") return true;
  if (user.role === "hod") return task.department === user.department;
  if (user.role === "staff") return task.department === user.department;

  if (user.role === "contract") {
    return (task.milestones || []).some(
      (m) => m.assignedTo && String(m.assignedTo) === String(user.id)
    );
  }

  return false;
}

function canCreateOrDeleteTask(user, taskDepartment) {
  if (user.role === "creator" || user.role === "admin") return true;
  if (user.role === "project_lead") return true;
  if (user.role === "hod") return taskDepartment === user.department;
  return false;
}

function canEditMilestones(user, task) {
  if (user.role === "creator" || user.role === "admin") return true;
  if (user.role === "project_lead") return true;
  if (user.role === "hod") return task.department === user.department;
  return false;
}

function canTickMilestone(user, task, milestone) {
  if (user.role === "creator" || user.role === "admin") return true;

  if (user.role === "hod") {
    return task.department === user.department;
  }

  if (user.role === "project_lead") {
    return milestone.assignedDepartment && milestone.assignedDepartment === user.department;
  }

  if (user.role === "staff" || user.role === "contract") {
    return milestone.assignedTo && String(milestone.assignedTo) === String(user.id);
  }

  return false;
}

// -------------------------
// Basic Health Routes
// -------------------------
app.get("/", (req, res) => res.send("OK ✅ Server is running"));
app.get("/health", (req, res) => res.json({ ok: true, status: "healthy" }));

// -------------------------
// ✅ Bootstrap creator (NO TOKEN)
// Works ONLY if no creator exists.
// -------------------------
app.post("/api/bootstrap-creator", async (req, res) => {
  try {
    const creatorExists = await User.findOne({ role: "creator" });
    if (creatorExists) return res.status(403).json({ msg: "Bootstrap disabled" });

    const { name, email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ msg: "Email and password are required" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({
      name: name || "System Creator",
      email,
      password: hashed,
      role: "creator",
      department: "Management",
    });

    await user.save();
    res.json({ msg: "Creator created", user: sanitizeUser(user) });
  } catch (err) {
    console.log("bootstrap-creator error:", err);
    const dup = handleDuplicateEmail(err, res);
    if (dup) return;
    res.status(500).json({ msg: "Server Error" });
  }
});

// -------------------------
// Auth Routes
// -------------------------

// Creator-only: create/register users
app.post("/api/register", auth, async (req, res) => {
  try {
    if (!canManageUsers(req.user)) return res.status(403).json({ msg: "Forbidden" });

    const { name, email, password, role, department } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ msg: "Email and password are required" });
    }
    if (role && !ROLES.includes(role)) {
      return res.status(400).json({ msg: "Invalid role" });
    }
    if (department && !DEPARTMENTS.includes(department)) {
      return res.status(400).json({ msg: "Invalid department" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = new User({
      name: name || "",
      email,
      password: hashed,
      role: role || "staff",
      department: department || "Management",
    });

    await user.save();
    res.json(sanitizeUser(user));
  } catch (err) {
    console.log("register error:", err);
    const dup = handleDuplicateEmail(err, res);
    if (dup) return;
    res.status(500).json({ msg: "Server Error" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const user = await User.findOne({ email: (email || "").toLowerCase().trim() });
    if (!user) return res.status(400).json({ msg: "Invalid credentials" });

    const ok = await bcrypt.compare(password || "", user.password || "");
    if (!ok) return res.status(400).json({ msg: "Invalid credentials" });

    const payload = {
      id: user._id.toString(),
      role: user.role,
      department: user.department,
      email: user.email,
      name: user.name,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.log("login error:", err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// -------------------------
// User Routes (Creator-only)
// -------------------------
app.get("/api/users", auth, async (req, res) => {
  try {
    if (!canManageUsers(req.user)) return res.status(403).json({ msg: "Forbidden" });

    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    console.log("get users error:", err);
    res.status(500).json({ msg: "Server Error" });
  }
});

app.put("/api/users/:id", auth, async (req, res) => {
  try {
    if (!canManageUsers(req.user)) return res.status(403).json({ msg: "Forbidden" });

    const { name, role, department } = req.body || {};

    if (role && !ROLES.includes(role)) return res.status(400).json({ msg: "Invalid role" });
    if (department && !DEPARTMENTS.includes(department))
      return res.status(400).json({ msg: "Invalid department" });

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { name, role, department },
      { new: true }
    ).select("-password");

    res.json(updated);
  } catch (err) {
    console.log("update user error:", err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Creator-only: set/reset a user's password
app.post("/api/users/:id/set-password", auth, async (req, res) => {
  try {
    if (!canManageUsers(req.user)) return res.status(403).json({ msg: "Forbidden" });

    const { newPassword } = req.body || {};
    if (!newPassword) return res.status(400).json({ msg: "newPassword is required" });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ msg: "Password updated OK", userId: user._id.toString(), email: user.email });
  } catch (err) {
    console.log("set password error:", err);
    res.status(500).json({ msg: "Server Error" });
  }
});

app.delete("/api/users/:id", auth, async (req, res) => {
  try {
    if (!canManageUsers(req.user)) return res.status(403).json({ msg: "Forbidden" });

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User Deleted" });
  } catch (err) {
    console.log("delete user error:", err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// -------------------------
// Task Routes
// -------------------------

// ✅ Launch-ready: filter in Mongo, not in JS (no full table scan)
app.get("/api/tasks", auth, async (req, res) => {
  try {
    const u = req.user;
    let query = {};

    if (u.role === "creator" || u.role === "admin" || u.role === "project_lead") {
      query = {};
    } else if (u.role === "hod" || u.role === "staff") {
      query = { department: u.department };
    } else if (u.role === "contract") {
      query = { "milestones.assignedTo": u.id };
    } else {
      return res.json([]);
    }

    const tasks = await Task.find(query).populate("assignedTo", "name email role department");
    res.json(tasks);
  } catch (err) {
    console.log("get tasks error:", err);
    res.status(500).json({ msg: "Server Error" });
  }
});

app.post("/api/tasks", auth, async (req, res) => {
  try {
    const { department } = req.body || {};

    if (!department || !DEPARTMENTS.includes(department)) {
      return res.status(400).json({ msg: "Valid department is required" });
    }

    if (!canCreateOrDeleteTask(req.user, department)) {
      return res.status(403).json({ msg: "Forbidden" });
    }

    const task = new Task(req.body);
    await task.save();

    const populatedTask = await Task.findById(task._id).populate(
      "assignedTo",
      "name email role department"
    );

    res.json(populatedTask);
  } catch (err) {
    console.log("create task error:", err);
    res.status(500).json({ msg: "Server Error" });
  }
});

app.put("/api/tasks/:id", auth, async (req, res) => {
  try {
    const existing = await Task.findById(req.params.id);
    if (!existing) return res.status(404).json({ msg: "Task not found" });

    if (!canSeeTask(req.user, existing)) return res.status(403).json({ msg: "Forbidden" });

    const { title, description, department, deadline, assignedTo, milestones, status } = req.body || {};

    if (department && !DEPARTMENTS.includes(department)) {
      return res.status(400).json({ msg: "Invalid department" });
    }

    const canEditTask =
      req.user.role === "creator" ||
      req.user.role === "admin" ||
      req.user.role === "project_lead" ||
      (req.user.role === "hod" && existing.department === req.user.department);

    if (!canEditTask) return res.status(403).json({ msg: "Forbidden" });

    if (milestones && !canEditMilestones(req.user, existing)) {
      return res.status(403).json({ msg: "Forbidden (milestones)" });
    }

    let updateData = { title, description, department, deadline, assignedTo, status };

    if (milestones) {
      updateData.milestones = milestones;

      const ms = milestones || [];
      if (ms.length > 0) {
        const completed = ms.filter((m) => m.status === "Done").length;
        updateData.progress = Math.round((completed / ms.length) * 100);
      } else {
        updateData.progress = 0;
      }

      if (updateData.progress === 100) updateData.status = "Completed";
      else if (updateData.progress > 0) updateData.status = "In Progress";
      else updateData.status = "Not Started";
    }

    const updatedTask = await Task.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    }).populate("assignedTo", "name email role department");

    res.json(updatedTask);
  } catch (err) {
    console.log("update task error:", err);
    res.status(500).json({ msg: "Server Error" });
  }
});

app.delete("/api/tasks/:id", auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ msg: "Task not found" });

    if (!canCreateOrDeleteTask(req.user, task.department)) {
      return res.status(403).json({ msg: "Forbidden" });
    }

    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: "Task Deleted" });
  } catch (err) {
    console.log("delete task error:", err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// ASSIGN A MILESTONE (to a user OR to a department)
app.post("/api/tasks/:taskId/milestones/:milestoneId/assign", auth, async (req, res) => {
  try {
    const { assignedTo, assignedDepartment } = req.body || {};

    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ msg: "Task not found" });

    if (!canSeeTask(req.user, task)) return res.status(403).json({ msg: "Forbidden" });

    if (!canEditMilestones(req.user, task)) {
      return res.status(403).json({ msg: "Forbidden (milestones)" });
    }

    const milestone = task.milestones.id(req.params.milestoneId);
    if (!milestone) return res.status(404).json({ msg: "Milestone not found" });

    if (!!assignedTo && !!assignedDepartment) {
      return res.status(400).json({ msg: "Use assignedTo OR assignedDepartment, not both" });
    }
    if (!assignedTo && !assignedDepartment) {
      return res.status(400).json({ msg: "assignedTo or assignedDepartment is required" });
    }

    if (assignedDepartment && !DEPARTMENTS.includes(assignedDepartment)) {
      return res.status(400).json({ msg: "Invalid department" });
    }

    if (assignedTo) {
      const u = await User.findById(assignedTo);
      if (!u) return res.status(404).json({ msg: "Assigned user not found" });

      milestone.assignedTo = u._id;
      milestone.assignedDepartment = null;
    } else {
      milestone.assignedDepartment = assignedDepartment;
      milestone.assignedTo = null;
    }

    await task.save();
    res.json({ msg: "Milestone assigned", task });
  } catch (err) {
    console.log("assign milestone error:", err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// TICK A MILESTONE
app.post("/api/tasks/:taskId/milestones/:milestoneId/tick", auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ msg: "Task not found" });

    if (!canSeeTask(req.user, task)) return res.status(403).json({ msg: "Forbidden" });

    const milestone = task.milestones.id(req.params.milestoneId);
    if (!milestone) return res.status(404).json({ msg: "Milestone not found" });

    if (!canTickMilestone(req.user, task, milestone)) {
      return res.status(403).json({ msg: "Forbidden" });
    }

    if (milestone.status === "Done") {
      return res.status(400).json({ msg: "Milestone already done" });
    }

    milestone.status = "Done";
    milestone.completedBy = req.user.id;
    milestone.completedAt = new Date();

    recalcTaskProgress(task);
    await task.save();

    res.json({ msg: "Milestone ticked", task });
  } catch (err) {
    console.log("tick milestone error:", err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Analytics
app.get("/api/analytics", auth, async (req, res) => {
  try {
    if (!canViewAnalytics(req.user)) return res.status(403).json({ msg: "Forbidden" });

    const u = req.user;
    let query = {};

    if (u.role === "creator" || u.role === "admin" || u.role === "project_lead") {
      query = {};
    } else if (u.role === "hod" || u.role === "staff") {
      query = { department: u.department };
    } else if (u.role === "contract") {
      query = { "milestones.assignedTo": u.id };
    } else {
      return res.json({ totalTasks: 0, completedTasks: 0, completionRate: 0 });
    }

    const visible = await Task.find(query);

    const totalTasks = visible.length;
    const completedTasks = visible.filter((t) => t.status === "Completed").length;

    res.json({
      totalTasks,
      completedTasks,
      completionRate: totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100),
    });
  } catch (err) {
    console.log("analytics error:", err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Fallback 404
app.use((req, res) => res.status(404).json({ msg: "Route not found" }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));