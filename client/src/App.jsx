// import { Routes, Route, Navigate } from 'react-router-dom';
// import { AuthProvider } from './context/AuthContext';
// import { InterviewProvider } from './context/InterviewContext';
// import LoginPage from './pages/LoginPage';
// import SetupPage from './pages/SetupPage';
// import PreferencesPage from './pages/PreferencesPage';
// import InterviewPage from './pages/InterviewPage';
// import ReportPage from './pages/ReportPage';

// function App() {
//   return (
//     <AuthProvider>
//       <InterviewProvider>
//         <div className="app">
//           <Routes>
//             <Route path="/" element={<LoginPage />} />
//             <Route path="/setup" element={<SetupPage />} />
//             <Route path="/preferences" element={<PreferencesPage />} />
//             <Route path="/interview" element={<InterviewPage />} />
//             <Route path="/report" element={<ReportPage />} />
//             <Route path="*" element={<Navigate to="/" />} />
//           </Routes>
//         </div>
//       </InterviewProvider>
//     </AuthProvider>
//   );
// }

// export default App;


import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { InterviewProvider } from "./context/InterviewContext";

import LoginPage from "./pages/LoginPage";
import SetupPage from "./pages/SetupPage";
import PreferencesPage from "./pages/PreferencesPage";
import InterviewPage from "./pages/InterviewPage";
import ReportPage from "./pages/ReportPage";
import ProtectedRoute from "./components/ProtectedRoute";

// 🔁 Redirect root based on auth
const RootRedirect = () => {
  const { user } = useAuth();
  return user ? <Navigate to="/setup" /> : <Navigate to="/" />;
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

  <Route path="*" element={<Navigate to="/" />} />
</Routes>
        </div>
      </InterviewProvider>
    </AuthProvider>
  );
}

export default App;