import { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart2, Plus, CheckCircle, User, ArrowLeft, CheckSquare, Square } from 'lucide-react';

axios.defaults.baseURL = 'http://localhost:5000/api';

function App() {
  const [view, setView] = useState('login'); // login, dashboard, task-detail
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null); // The task currently open
  const [showCreate, setShowCreate] = useState(false);
  
  // Inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newTask, setNewTask] = useState({ title: '', department: 'Management', description: '' });
  const [newMilestone, setNewMilestone] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setView('dashboard');
    }
  }, []);

  useEffect(() => {
    if (view === 'dashboard') fetchTasks();
  }, [view]);

  const fetchTasks = () => {
    axios.get('/tasks').then(res => setTasks(res.data));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/login', { email, password });
      localStorage.setItem('user', JSON.stringify(res.data));
      setUser(res.data);
      setView('dashboard');
    } catch (err) { alert('Login Failed'); }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setView('login');
    setUser(null);
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/tasks', newTask);
      setShowCreate(false);
      fetchTasks();
      alert('Task Assigned!');
    } catch (err) { alert('Error creating task'); }
  };

  // --- NEW: Open a Task ---
  const openTask = (task) => {
    setSelectedTask(task);
    setView('task-detail');
  };

  // --- NEW: Add a Milestone ---
  const addMilestone = async () => {
    if (!newMilestone) return;
    const updatedMilestones = [...selectedTask.milestones, { title: newMilestone, status: 'Not Done' }];
    
    // Save to Backend
    const res = await axios.put(`/tasks/${selectedTask._id}`, { milestones: updatedMilestones });
    
    setSelectedTask(res.data); // Update UI
    setNewMilestone('');
  };

  // --- NEW: Tick a Box ---
  const toggleMilestone = async (index) => {
    const updatedMilestones = [...selectedTask.milestones];
    const currentStatus = updatedMilestones[index].status;
    updatedMilestones[index].status = currentStatus === 'Done' ? 'Not Done' : 'Done';

    // Save to Backend
    const res = await axios.put(`/tasks/${selectedTask._id}`, { milestones: updatedMilestones });
    setSelectedTask(res.data);
  };

  // --- LOGIN PAGE ---
  if (view === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark text-white">
        <div className="bg-card p-8 rounded-xl shadow-lg w-96 border border-gray-800">
          <h1 className="text-2xl font-bold text-primary mb-6 text-center">THE CONCAVE</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input className="w-full p-3 bg-dark border border-gray-700 rounded" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <input type="password" className="w-full p-3 bg-dark border border-gray-700 rounded" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
            <button className="w-full bg-primary py-3 rounded font-bold hover:opacity-90">Login</button>
          </form>
        </div>
      </div>
    );
  }

  // --- TASK DETAIL PAGE (The Workspace) ---
  if (view === 'task-detail' && selectedTask) {
    return (
      <div className="min-h-screen bg-dark text-white p-8">
         <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6">
           <ArrowLeft size={20} /> Back to Dashboard
         </button>

         <div className="max-w-3xl mx-auto bg-card p-8 rounded-xl border border-gray-800">
            <div className="flex justify-between items-start mb-6">
               <div>
                  <span className="text-primary font-bold uppercase tracking-wider text-sm">{selectedTask.department}</span>
                  <h1 className="text-3xl font-bold mt-2">{selectedTask.title}</h1>
               </div>
               <div className="text-right">
                  <span className="block text-4xl font-bold text-primary">{selectedTask.progress}%</span>
                  <span className="text-sm text-gray-500">Completed</span>
               </div>
            </div>

            <p className="text-gray-300 mb-8 p-4 bg-dark rounded border border-gray-700">
               {selectedTask.description}
            </p>

            <h3 className="text-xl font-bold mb-4">Milestones & Checklist</h3>
            
            {/* List Milestones */}
            <div className="space-y-3 mb-8">
               {selectedTask.milestones.map((ms, index) => (
                  <div key={index} 
                       onClick={() => toggleMilestone(index)}
                       className="flex items-center gap-4 p-4 rounded bg-dark border border-gray-800 hover:border-primary cursor-pointer transition-all">
                     {ms.status === 'Done' 
                        ? <CheckSquare className="text-green-500" /> 
                        : <Square className="text-gray-500" />}
                     <span className={ms.status === 'Done' ? "text-gray-500 line-through" : "text-white"}>
                        {ms.title}
                     </span>
                  </div>
               ))}
               {selectedTask.milestones.length === 0 && <p className="text-gray-500 italic">No milestones set yet.</p>}
            </div>

            {/* Add Milestone Input */}
            <div className="flex gap-2">
               <input 
                  className="flex-1 p-3 bg-dark border border-gray-700 rounded text-white" 
                  placeholder="Add a new milestone (e.g. 'Upload Receipt')"
                  value={newMilestone}
                  onChange={e => setNewMilestone(e.target.value)}
               />
               <button onClick={addMilestone} className="bg-primary px-6 rounded font-bold hover:opacity-90">Add</button>
            </div>
         </div>
      </div>
    );
  }

  // --- DASHBOARD ---
  return (
    <div className="min-h-screen bg-dark text-white font-sans">
      <nav className="border-b border-gray-800 p-4 flex justify-between items-center bg-card sticky top-0 z-50">
        <h1 className="text-xl font-bold text-primary tracking-wider">CONCAVE SYSTEM</h1>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <User size={16} />
            <span>{user?.name} <span className="text-primary">({user?.role})</span></span>
          </div>
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-white">Logout</button>
        </div>
      </nav>

      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold">Dashboard</h2>
            <p className="text-gray-400">Overview of departmental performance</p>
          </div>
          {user.role === 'creator' && (
            <button onClick={() => setShowCreate(!showCreate)} className="bg-primary px-4 py-2 rounded flex items-center gap-2 font-bold hover:bg-purple-600 transition">
              <Plus size={18} /> Assign New Task
            </button>
          )}
        </div>

        {showCreate && (
          <div className="bg-card p-6 rounded-xl border border-gray-700 mb-8 animate-fade-in">
            <h3 className="text-xl font-bold mb-4">Assign Task to Department</h3>
            <form onSubmit={handleCreateTask} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input required placeholder="Task Title" className="p-3 bg-dark border border-gray-700 rounded text-white" 
                onChange={e => setNewTask({...newTask, title: e.target.value})} />
              
              <select className="p-3 bg-dark border border-gray-700 rounded text-white"
                onChange={e => setNewTask({...newTask, department: e.target.value})}>
                <option>Management</option>
                <option>Operation</option>
                <option>Marketing</option>
                <option>Finance</option>
                <option>Media</option>
                <option>Research and Development</option>
              </select>

              <textarea placeholder="Description" className="col-span-2 p-3 bg-dark border border-gray-700 rounded text-white h-24"
                onChange={e => setNewTask({...newTask, description: e.target.value})}></textarea>
              
              <button className="col-span-2 bg-primary py-3 rounded font-bold">Assign Task</button>
            </form>
          </div>
        )}

        {/* Task Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasks.map(task => (
            <div key={task._id} onClick={() => openTask(task)} className="bg-card p-6 rounded-xl border border-gray-800 hover:border-primary transition-all shadow-lg hover:shadow-purple-900/10 cursor-pointer group">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-primary uppercase tracking-wider bg-purple-900/20 px-2 py-1 rounded">{task.department}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${task.status === 'Completed' ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-400'}`}>{task.status}</span>
              </div>
              
              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-primary transition-colors">{task.title}</h3>
              
              <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden mb-2">
                <div className="bg-primary h-full transition-all duration-500" style={{ width: `${task.progress}%` }}></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Progress</span>
                <span className="text-white font-bold">{task.progress}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;