import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Header } from './components/Header';
import { Spinner } from './components/ui/Primitives';
import './styles/theme.css';

const Home = lazy(async () => import('./pages/Home').then((module) => ({ default: module.Home })));
const Tools = lazy(async () => import('./pages/Tools').then((module) => ({ default: module.Tools })));
const ToolPage = lazy(async () => import('./pages/ToolPage').then((module) => ({ default: module.ToolPage })));
const Login = lazy(async () => import('./pages/Login').then((module) => ({ default: module.Login })));
const Signup = lazy(async () => import('./pages/Signup').then((module) => ({ default: module.Signup })));
const DashboardLayout = lazy(async () => import('./pages/dashboard/DashboardLayout').then((module) => ({ default: module.DashboardLayout })));
const DashboardHome = lazy(() => import('./pages/dashboard/DashboardHome'));
const MyFiles = lazy(() => import('./pages/dashboard/MyFiles'));
const RecentFiles = lazy(() => import('./pages/dashboard/RecentFiles'));
const Favorites = lazy(() => import('./pages/dashboard/Favorites'));
const Settings = lazy(() => import('./pages/dashboard/Settings'));
const NotFound = lazy(async () => import('./pages/NotFound').then((module) => ({ default: module.NotFound })));

function App() {
  return (
    <>
      <Header />
      <Suspense fallback={<div className="flex justify-center p-20"><Spinner /></div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/tool/:slug" element={<ToolPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="files" element={<MyFiles />} />
            <Route path="recent" element={<RecentFiles />} />
            <Route path="favorites" element={<Favorites />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<BrowserRouter><App /></BrowserRouter>);
