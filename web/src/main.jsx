import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { getToken, setToken } from './api.js';
import AgentEdit from './pages/AgentEdit.jsx';
import Agents from './pages/Agents.jsx';
import CallDetail from './pages/CallDetail.jsx';
import Calls from './pages/Calls.jsx';
import CampaignDetail from './pages/CampaignDetail.jsx';
import Campaigns from './pages/Campaigns.jsx';
import Login from './pages/Login.jsx';
import './styles.css';

function Layout() {
  const navigate = useNavigate();
  if (!getToken()) return <Navigate to="/login" replace />;
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <i /><i /><i /><i />
          </span>
          CallAgent
        </div>
        <nav>
          <NavLink to="/agents">Agentlar</NavLink>
          <NavLink to="/calls">Qo‘ng‘iroqlar</NavLink>
          <NavLink to="/campaigns">Kampaniyalar</NavLink>
        </nav>
        <button
          className="link side-exit"
          onClick={() => {
            setToken(null);
            navigate('/login');
          }}
        >
          Chiqish
        </button>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/agents" replace />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/agents/new" element={<AgentEdit />} />
        <Route path="/agents/:id" element={<AgentEdit />} />
        <Route path="/calls" element={<Calls />} />
        <Route path="/calls/:id" element={<CallDetail />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
      </Route>
    </Routes>
  </BrowserRouter>,
);
