const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(cors());

// DB Connection
mongoose.connect('mongodb+srv://kufire:kufivic1234@concavesystem.2chfah3.mongodb.net/?appName=ConcaveSystem')
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log('DB Error:', err));

// Models
const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: 'staff' },
  department: String
});
const User = mongoose.model('User', UserSchema);

const TaskSchema = new mongoose.Schema({
  title: String,
  description: String,
  department: String,
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], 
  status: { type: String, default: 'Not Started' },
  progress: { type: Number, default: 0 },
  milestones: [{
    title: String,
    status: { type: String, default: 'Not Done' }
  }],
  createdAt: { type: Date, default: Date.now },
  deadline: Date 
});
const Task = mongoose.model('Task', TaskSchema);

// Routes

// GET ALL USERS
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().select('-password'); 
    res.json(users);
  } catch (err) { res.status(500).send('Server Error'); }
});

app.post('/api/register', async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.json(user);
  } catch (err) { res.status(500).json(err); }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || user.password !== password) return res.status(400).json({ msg: "Invalid credentials" });
  res.json(user);
});

// GET TASKS
app.get('/api/tasks', async (req, res) => {
  const tasks = await Task.find().populate('assignedTo', 'name email'); 
  res.json(tasks);
});

// CREATE TASK
app.post('/api/tasks', async (req, res) => {
  const task = new Task(req.body);
  await task.save();
  const populatedTask = await Task.findById(task._id).populate('assignedTo', 'name email');
  res.json(populatedTask);
});

// --- UPDATED: EDIT TASK (Handles Text Updates AND Milestones) ---
app.put('/api/tasks/:id', async (req, res) => {
  try {
    // We now accept title, description, deadline, assignedTo, AND milestones
    const { title, description, department, deadline, assignedTo, milestones, status } = req.body;
    
    // Auto-calculate progress ONLY if milestones are being updated
    let updateData = { title, description, department, deadline, assignedTo, status };
    
    if (milestones) {
      updateData.milestones = milestones;
      if (milestones.length > 0) {
        const completed = milestones.filter(m => m.status === 'Done').length;
        updateData.progress = Math.round((completed / milestones.length) * 100);
      } else {
        updateData.progress = 0;
      }

      // Update status based on progress
      if (updateData.progress === 100) updateData.status = 'Completed';
      else if (updateData.progress > 0) updateData.status = 'In Progress';
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { new: true }
    ).populate('assignedTo', 'name email');
    
    res.json(updatedTask);
  } catch (err) { res.status(500).send('Server Error'); }
});

// --- NEW: DELETE TASK ROUTE ---
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: 'Task Deleted' });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));