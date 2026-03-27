import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { InterviewProvider } from './context/InterviewContext';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import PreferencesPage from './pages/PreferencesPage';
import InterviewPage from './pages/InterviewPage';
import ReportPage from './pages/ReportPage';

// ProtectedRoute component
const ProtectedRoute = ({ children }) => {
  const isLoggedIn = localStorage.getItem("token");

  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function App() {
  return (
    <AuthProvider>
      <InterviewProvider>
        <div className="app">
          <Routes>
            <Route path="/" element={<LoginPage />} />

            <Route
              path="/setup"
              element={
                <ProtectedRoute>
                  <SetupPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/preferences"
              element={
                <ProtectedRoute>
                  <PreferencesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interview"
              element={
                <ProtectedRoute>
                  <InterviewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/report"
              element={
                <ProtectedRoute>
                  <ReportPage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </InterviewProvider>
    </AuthProvider>
  );
}

export default App;