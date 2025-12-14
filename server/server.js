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
  // This links to the User model
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

// 1. GET ALL USERS (The "Phonebook" for the dropdown)
app.get('/api/users', async (req, res) => {
  try {
    // Get all users, but hide their passwords
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

// 2. GET TASKS (Now with "Populate" to show real names)
app.get('/api/tasks', async (req, res) => {
  // .populate('assignedTo') swaps the ID number for the actual User object
  const tasks = await Task.find().populate('assignedTo', 'name email'); 
  res.json(tasks);
});

app.post('/api/tasks', async (req, res) => {
  const task = new Task(req.body);
  await task.save();
  // Return the saved task with populated names immediately
  const populatedTask = await Task.findById(task._id).populate('assignedTo', 'name email');
  res.json(populatedTask);
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { milestones, status } = req.body;
    
    let progress = 0;
    if (milestones && milestones.length > 0) {
      const completed = milestones.filter(m => m.status === 'Done').length;
      progress = Math.round((completed / milestones.length) * 100);
    }

    let newStatus = status;
    if (progress === 100) newStatus = 'Completed';
    else if (progress > 0 && newStatus === 'Not Started') newStatus = 'In Progress';

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id, 
      { milestones, progress, status: newStatus }, 
      { new: true }
    ).populate('assignedTo', 'name email'); // Populate on update too
    res.json(updatedTask);
  } catch (err) { res.status(500).send('Server Error'); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));