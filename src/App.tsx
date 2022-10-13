import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import LoadingModal from './component/LoadingModal';
import AppLayout from './component/AppLayout';

import About from './page/About';
import Dashboard from './page/Dashboard';
import Repo from './page/Repo';

import { useAppSelector } from './redux/store';
import { isAuthSelector } from './redux/selector';

function App() {
  const isAuth = useAppSelector(isAuthSelector);

  return (
    <Suspense fallback={<LoadingModal />}>
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<About />} />
            <Route
              path="/dashboard"
              element={isAuth ? <Dashboard /> : <Navigate to="/" replace />}
            />
            <Route
              path="/repo"
              element={isAuth ? <Repo /> : <Navigate to="/" replace />}
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </Suspense>
  );
}

export default App;
