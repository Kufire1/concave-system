import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Plus, User, ArrowLeft, CheckSquare, Square, Loader2, 
  Calendar, ChevronRight, Clock
} from 'lucide-react';

// Live Backend Link
axios.defaults.baseURL = 'https://concave-system.onrender.com/api';

function App() {
  const [view, setView] = useState('login'); 
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // --- FILTERS STATE ---
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterDept, setFilterDept] = useState('All');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Login/Register Inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('staff');

  // New Task Inputs
  const [newTask, setNewTask] = useState({ 
    title: '', 
    department: 'Management', 
    description: '', 
    deadline: '' 
  });
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

  // --- CALCULATE PROGRESS ---
  const getProgress = (task) => {
    if (!task.milestones || task.milestones.length === 0) return 0;
    const completed = task.milestones.filter(m => m.status === 'Done').length;
    return Math.round((completed / task.milestones.length) * 100);
  };

  // --- DETERMINE STATUS ---
  const getStatus = (task) => {
    const progress = getProgress(task);
    if (progress === 100) return 'Completed';
    if (progress > 0) return 'In Progress';
    return 'Not Done';
  };

  // --- FILTER LOGIC ---
  const getFilteredTasks = () => {
    return tasks.filter(task => {
      // 1. Department Filter
      if (filterDept !== 'All' && task.department !== filterDept) return false;

      // 2. Status Filter
      const status = getStatus(task);
      if (filterStatus === 'Completed' && status !== 'Completed') return false;
      if (filterStatus === 'Started' && status !== 'In Progress') return false;
      if (filterStatus === 'Not Done' && status !== 'Not Done') return false;

      // 3. Date Filter
      if (dateRange.start) {
         const taskDate = new Date(task.createdAt);
         const startDate = new Date(dateRange.start);
         if (taskDate < startDate) return false;
      }
      if (dateRange.end) {
         const taskDate = new Date(task.createdAt);
         const endDate = new Date(dateRange.end);
         endDate.setHours(23, 59, 59); 
         if (taskDate > endDate) return false;
      }
      return true;
    });
  };

  // --- HANDLERS ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post('/login', { email, password });
      localStorage.setItem('user', JSON.stringify(res.data));
      setUser(res.data);
      setView('dashboard');
    } catch (err) { alert('Login Failed.'); } 
    finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('/register', { name: regName, email: regEmail, password: regPassword, role: regRole });
      alert('Account Created! Please Login.');
      setView('login');
    } catch (err) { alert('Registration Failed.'); } 
    finally { setLoading(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setView('login');
    setUser(null);
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('/tasks', newTask);
      setShowCreate(false);
      fetchTasks();
    } catch (err) { alert('Error creating task'); } 
    finally { setLoading(false); }
  };

  const openTask = (task) => {
    setSelectedTask({ ...task, progress: getProgress(task) });
    setView('task-detail');
  };

  const addMilestone = async () => {
    if (!newMilestone) return;
    const updatedMilestones = [...selectedTask.milestones, { title: newMilestone, status: 'Not Done' }];
    setSelectedTask({ ...selectedTask, milestones: updatedMilestones });
    setNewMilestone('');
    await axios.put(`/tasks/${selectedTask._id}`, { milestones: updatedMilestones });
    fetchTasks();
  };

  const toggleMilestone = async (index) => {
    const updatedMilestones = [...selectedTask.milestones];
    updatedMilestones[index].status = updatedMilestones[index].status === 'Done' ? 'Not Done' : 'Done';
    setSelectedTask({ ...selectedTask, milestones: updatedMilestones });
    await axios.put(`/tasks/${selectedTask._id}`, { milestones: updatedMilestones });
    fetchTasks();
  };

  // --- VIEWS ---

  if (view === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark text-white">
        <div className="bg-card p-8 rounded-xl shadow-lg w-96 border border-gray-800 m-4">
          <h1 className="text-2xl font-bold text-primary mb-6 text-center">THE CONCAVE</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input className="w-full p-3 bg-dark border border-gray-700 rounded focus:border-primary outline-none" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <input type="password" className="w-full p-3 bg-dark border border-gray-700 rounded focus:border-primary outline-none" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
            <button disabled={loading} className="w-full bg-primary py-3 rounded font-bold hover:opacity-90 disabled:opacity-50 flex justify-center gap-2">
              {loading ? <Loader2 className="animate-spin" /> : "Login"}
            </button>
          </form>
          <button onClick={() => setView('register')} className="w-full mt-4 text-xs text-gray-500 hover:text-primary underline">Create Account</button>
        </div>
      </div>
    );
  }

  if (view === 'register') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark text-white">
        <div className="bg-card p-8 rounded-xl shadow-lg w-96 border border-gray-800 m-4">
          <h1 className="text-2xl font-bold text-primary mb-6 text-center">CREATE ACCOUNT</h1>
          <form onSubmit={handleRegister} className="space-y-4">
            <input required className="w-full p-3 bg-dark border border-gray-700 rounded" placeholder="Full Name" value={regName} onChange={e => setRegName(e.target.value)} />
            <input required className="w-full p-3 bg-dark border border-gray-700 rounded" placeholder="Email" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
            <input required type="password" className="w-full p-3 bg-dark border border-gray-700 rounded" placeholder="Password" value={regPassword} onChange={e => setRegPassword(e.target.value)} />
            <select className="w-full p-3 bg-dark border border-gray-700 rounded text-white" value={regRole} onChange={e => setRegRole(e.target.value)}>
               <option value="creator">Creator (Boss)</option>
               <option value="admin">Admin</option>
               <option value="hod">HOD</option>
               <option value="staff">Staff</option>
            </select>
            <button disabled={loading} className="w-full bg-primary py-3 rounded font-bold hover:opacity-90 disabled:opacity-50 flex justify-center gap-2">
               {loading ? <Loader2 className="animate-spin" /> : "Register"}
            </button>
          </form>
          <button onClick={() => setView('login')} className="w-full mt-4 text-sm text-gray-400 hover:text-white">Back to Login</button>
        </div>
      </div>
    );
  }

  if (view === 'task-detail' && selectedTask) {
    const progress = getProgress(selectedTask);
    return (
      <div className="min-h-screen bg-dark text-white p-4 md:p-8">
         <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6">
           <ArrowLeft size={20} /> Back to Dashboard
         </button>

         <div className="max-w-3xl mx-auto bg-card p-6 md:p-8 rounded-xl border border-gray-800">
            <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
               <div>
                  <span className="text-primary font-bold uppercase tracking-wider text-sm">{selectedTask.department}</span>
                  <h1 className="text-2xl md:text-3xl font-bold mt-2">{selectedTask.title}</h1>
                  <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
                    <Clock size={14} /> Deadline: {selectedTask.deadline ? new Date(selectedTask.deadline).toLocaleDateString() : 'No Deadline'}
                  </p>
               </div>
               <div className="text-left md:text-right w-full md:w-auto bg-gray-900 md:bg-transparent p-4 md:p-0 rounded-lg">
                  <span className="block text-3xl md:text-4xl font-bold text-primary">{progress}%</span>
                  <span className="text-sm text-gray-500">Completed</span>
               </div>
            </div>

            <p className="text-gray-300 mb-8 p-4 bg-dark rounded border border-gray-700 whitespace-pre-wrap">
               {selectedTask.description}
            </p>

            <h3 className="text-xl font-bold mb-4">Milestones</h3>
            <div className="space-y-3 mb-8">
               {selectedTask.milestones?.map((ms, index) => (
                  <div key={index} onClick={() => toggleMilestone(index)} className="flex items-center gap-4 p-4 rounded bg-dark border border-gray-800 hover:border-primary cursor-pointer transition-all">
                     {ms.status === 'Done' ? <CheckSquare className="text-green-500 shrink-0" /> : <Square className="text-gray-500 shrink-0" />}
                     <span className={ms.status === 'Done' ? "text-gray-500 line-through" : "text-white"}>{ms.title}</span>
                  </div>
               ))}
               {(!selectedTask.milestones || selectedTask.milestones.length === 0) && <p className="text-gray-500 italic">No milestones set yet.</p>}
            </div>

            <div className="flex gap-2">
               <input className="flex-1 p-3 bg-dark border border-gray-700 rounded text-white" placeholder="Add milestone..." value={newMilestone} onChange={e => setNewMilestone(e.target.value)} />
               <button onClick={addMilestone} className="bg-primary px-6 rounded font-bold hover:opacity-90">Add</button>
            </div>
         </div>
      </div>
    );
  }

  // --- DASHBOARD ---
  return (
    <div className="min-h-screen bg-dark text-white font-sans pb-10">
      <nav className="border-b border-gray-800 p-4 flex justify-between items-center bg-card sticky top-0 z-50">
        <h1 className="text-lg md:text-xl font-bold text-primary tracking-wider">CONCAVE</h1>
        <div className="flex gap-4 items-center">
          <div className="hidden md:flex items-center gap-2 text-sm text-gray-300">
            <User size={16} />
            <span>{user?.name} <span className="text-primary">({user?.role})</span></span>
          </div>
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-white">Logout</button>
        </div>
      </nav>

      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between md:items-end mb-6 gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-1">Dashboard</h2>
            <p className="text-gray-400 text-sm">Task Overview & Management</p>
          </div>
          {['creator', 'admin', 'hod'].includes(user.role) && (
            <button onClick={() => setShowCreate(!showCreate)} className="bg-primary px-4 py-3 md:py-2 rounded flex justify-center items-center gap-2 font-bold hover:bg-purple-600 transition w-full md:w-auto shadow-lg shadow-purple-900/20">
              <Plus size={18} /> New Task
            </button>
          )}
        </div>

        {/* --- FILTERS TOOLBAR --- */}
        <div className="flex flex-col md:flex-row md:flex-wrap gap-4 mb-6 bg-card p-4 rounded-lg border border-gray-800 md:items-end">
           <div className="flex flex-col gap-1 w-full md:w-auto">
              <label className="text-xs text-gray-500 uppercase font-bold">Department</label>
              <select className="bg-dark border border-gray-700 text-white p-2 rounded text-sm w-full md:w-40" 
                 value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                 <option value="All">All Departments</option>
                 <option value="Management">Management</option>
                 <option value="Operation">Operation</option>
                 <option value="Marketing">Marketing</option>
                 <option value="Finance">Finance</option>
                 <option value="Media">Media</option>
                 <option value="Research and Development">R&D</option>
              </select>
           </div>

           <div className="flex flex-col gap-1 w-full md:w-auto">
              <label className="text-xs text-gray-500 uppercase font-bold">Completion</label>
              <select className="bg-dark border border-gray-700 text-white p-2 rounded text-sm w-full md:w-32" 
                 value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                 <option value="All">All Status</option>
                 <option value="Not Done">Not Done</option>
                 <option value="Started">Started</option>
                 <option value="Completed">Completed</option>
              </select>
           </div>

           <div className="flex flex-col gap-1 w-full md:w-auto">
              <label className="text-xs text-gray-500 uppercase font-bold">Date Created</label>
              <div className="flex gap-2 items-center">
                 <input type="date" className="bg-dark border border-gray-700 text-gray-400 p-2 rounded text-sm w-full" 
                   value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
                 <span className="text-gray-600">-</span>
                 <input type="date" className="bg-dark border border-gray-700 text-gray-400 p-2 rounded text-sm w-full" 
                   value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
              </div>
           </div>
        </div>

        {/* --- CREATE TASK FORM --- */}
        {showCreate && (
          <div className="bg-card p-6 rounded-xl border border-gray-700 mb-8 animate-fade-in shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-white border-b border-gray-700 pb-2">Assign New Task</h3>
            <form onSubmit={handleCreateTask} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input required placeholder="Task Title" className="p-3 bg-dark border border-gray-700 rounded text-white focus:border-primary outline-none" 
                onChange={e => setNewTask({...newTask, title: e.target.value})} />
              
              <select className="p-3 bg-dark border border-gray-700 rounded text-white focus:border-primary outline-none"
                onChange={e => setNewTask({...newTask, department: e.target.value})}>
                <option>Management</option>
                <option>Operation</option>
                <option>Marketing</option>
                <option>Finance</option>
                <option>Media</option>
                <option>Research and Development</option>
              </select>

              <div className="col-span-1">
                 <label className="text-xs text-gray-500 block mb-1">Deadline (Optional)</label>
                 <input type="date" className="w-full p-3 bg-dark border border-gray-700 rounded text-white focus:border-primary outline-none"
                   onChange={e => setNewTask({...newTask, deadline: e.target.value})} />
              </div>

              <textarea placeholder="Description..." className="col-span-1 md:col-span-1 p-3 bg-dark border border-gray-700 rounded text-white h-24 md:h-full focus:border-primary outline-none"
                onChange={e => setNewTask({...newTask, description: e.target.value})}></textarea>
              
              <button disabled={loading} className="col-span-1 md:col-span-2 bg-primary py-3 rounded font-bold flex justify-center items-center gap-2 hover:opacity-90 disabled:opacity-50">
                 {loading ? <Loader2 className="animate-spin" /> : "Assign Task"}
              </button>
            </form>
          </div>
        )}

        {/* --- MOBILE VIEW (CARDS) - Visible only on small screens --- */}
        <div className="md:hidden space-y-4">
          {getFilteredTasks().map(task => {
            const progress = getProgress(task);
            return (
              <div key={task._id} onClick={() => openTask(task)} className="bg-card p-5 rounded-xl border border-gray-800 active:scale-[0.98] transition-transform shadow-lg">
                 <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-primary uppercase bg-purple-900/20 px-2 py-1 rounded">{task.department}</span>
                    <span className={`text-xs px-2 py-1 rounded font-bold ${progress === 100 ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                      {progress === 100 ? 'Done' : `${progress}%`}
                    </span>
                 </div>
                 <h3 className="text-lg font-bold text-white mb-1">{task.title}</h3>
                 <p className="text-sm text-gray-500 mb-4 flex items-center gap-2">
                   <Calendar size={14}/> {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'No Deadline'}
                 </p>
                 
                 {/* Mini Progress Bar */}
                 <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden mb-4">
                     <div className={`h-full ${progress === 100 ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${progress}%` }}></div>
                 </div>

                 <div className="flex justify-between items-center text-sm text-gray-400 border-t border-gray-800 pt-3">
                    <span>View Details</span>
                    <ChevronRight size={16} />
                 </div>
              </div>
            )
          })}
           {getFilteredTasks().length === 0 && (
             <div className="text-center text-gray-500 py-10">No tasks found.</div>
           )}
        </div>

        {/* --- DESKTOP VIEW (TABLE) - Visible only on medium screens and up --- */}
        <div className="hidden md:block bg-card rounded-lg border border-gray-800 overflow-hidden shadow-xl">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="bg-gray-900 text-gray-200 uppercase font-bold text-xs tracking-wider">
               <tr>
                  <th className="p-4 border-b border-gray-800">Task Name</th>
                  <th className="p-4 border-b border-gray-800">Department</th>
                  <th className="p-4 border-b border-gray-800">Assigned Staff</th>
                  <th className="p-4 border-b border-gray-800">Progress</th>
                  <th className="p-4 border-b border-gray-800">Date Created</th>
                  <th className="p-4 border-b border-gray-800">Deadline</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
               {getFilteredTasks().map((task) => {
                  const progress = getProgress(task);
                  return (
                    <tr key={task._id} onClick={() => openTask(task)} className="hover:bg-gray-800/50 cursor-pointer transition-colors group">
                       <td className="p-4 text-white font-medium relative max-w-[200px]">
                          <div className="truncate" title={task.title}>{task.title}</div>
                          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-card to-transparent group-hover:from-gray-800 pointer-events-none"></div>
                       </td>
                       <td className="p-4"><span className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-xs border border-gray-700">{task.department}</span></td>
                       <td className="p-4 text-gray-500 italic">{task.department} Team</td>
                       <td className="p-4">
                          <div className="flex items-center gap-2">
                             <span className={`font-bold ${progress === 100 ? 'text-green-500' : 'text-primary'}`}>{progress}%</span>
                             <div className="w-20 bg-gray-800 h-1.5 rounded-full overflow-hidden">
                                <div className={`h-full ${progress === 100 ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${progress}%` }}></div>
                             </div>
                          </div>
                       </td>
                       <td className="p-4">{new Date(task.createdAt || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                       <td className="p-4 text-gray-300">{task.deadline ? new Date(task.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '-'}</td>
                    </tr>
                  );
               })}
               {getFilteredTasks().length === 0 && (
                  <tr><td colSpan="6" className="p-8 text-center text-gray-500 italic">No tasks found matching your filters.</td></tr>
               )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;