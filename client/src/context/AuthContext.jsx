import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const login = (credentialResponse) => {
    const payload = JSON.parse(atob(credentialResponse.credential.split('.')[1]));
    setUser({
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
      token: credentialResponse.credential,
    });
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
