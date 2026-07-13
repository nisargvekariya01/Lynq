import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useTheme } from './hooks/useTheme.js';
import { useToast } from './hooks/useToast.js';
import Home from './pages/Home.jsx';
import Unlock from './pages/Unlock.jsx';
import Preview from './pages/Preview.jsx';
import RedirectHandler from './pages/RedirectHandler.jsx';
import NotFound from './pages/NotFound.jsx';
import Toast from './components/Toast.jsx';
import ConnectionStatus from './components/ConnectionStatus.jsx';

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { toasts, addToast, removeToast } = useToast();

  return (
    <BrowserRouter>
      <div className="app" data-theme={theme}>
        <Routes>
          <Route 
            path="/" 
            element={<Home theme={theme} onToggleTheme={toggleTheme} addToast={addToast} />} 
          />
          <Route 
            path="/unlock/:shortCode" 
            element={<Unlock theme={theme} onToggleTheme={toggleTheme} addToast={addToast} />} 
          />
          <Route 
            path="/preview/:shortCode" 
            element={<Preview theme={theme} onToggleTheme={toggleTheme} />} 
          />
          <Route 
            path="/404" 
            element={<NotFound />} 
          />
          <Route 
            path="/:shortCode" 
            element={<RedirectHandler />} 
          />
          <Route 
            path="*" 
            element={<NotFound />} 
          />
        </Routes>
        <ConnectionStatus />
        <Toast toasts={toasts} onRemove={removeToast} />
      </div>
    </BrowserRouter>
  );
}
