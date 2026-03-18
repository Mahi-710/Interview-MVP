import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();

  // 🔐 Only check auth — nothing else
  if (!user) {
    return <Navigate to="/" />;
  }

  return children;
};

export default ProtectedRoute;