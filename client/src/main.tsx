import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Header } from './components/Header';
import { Spinner } from './components/ui/Primitives';
import './styles/theme.css';

const Home = lazy(async () => import('./pages/Pages').then((module) => ({ default: module.Home })));
const Tools = lazy(async () => import('./pages/Pages').then((module) => ({ default: module.Tools })));
const Tool = lazy(async () => import('./pages/Pages').then((module) => ({ default: module.Tool })));
const Auth = lazy(async () => import('./pages/Pages').then((module) => ({ default: module.Auth })));
const Dashboard = lazy(async () => import('./pages/Pages').then((module) => ({ default: module.Dashboard })));
const NotFound = lazy(async () => import('./pages/Pages').then((module) => ({ default: module.NotFound })));

function App() {
  return (
    <>
      <Header />
      <Suspense fallback={<div className="flex justify-center p-20"><Spinner /></div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/tool/:slug" element={<Tool />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/signup" element={<Auth signup />} />
          <Route path="/dashboard/*" element={<Dashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<BrowserRouter><App /></BrowserRouter>);
