import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // ✅ Load user from localStorage on refresh
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = (credentialResponse) => {
    const payload = JSON.parse(atob(credentialResponse.credential.split('.')[1]));

    const userData = {
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
      token: credentialResponse.credential,
    };

    setUser(userData);

    // ✅ Save to localStorage
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", credentialResponse.credential);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);