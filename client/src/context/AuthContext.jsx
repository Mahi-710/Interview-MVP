// import { createContext, useContext, useState } from 'react';

// const AuthContext = createContext(null);

// export function AuthProvider({ children }) {
//   const [user, setUser] = useState(null);

//   const login = (credentialResponse) => {
//     const payload = JSON.parse(atob(credentialResponse.credential.split('.')[1]));
//     setUser({
//       name: payload.name,
//       email: payload.email,
//       picture: payload.picture,
//       token: credentialResponse.credential,
//     });
//   };

//   const logout = () => setUser(null);

//   return (
//     <AuthContext.Provider value={{ user, login, logout }}>
//       {children}
//     </AuthContext.Provider>
//   );
// }

// export const useAuth = () => useContext(AuthContext);


import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // ✅ important

  // ✅ 1. Restore user on app load
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  // ✅ 2. Persist user whenever it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  const login = (credentialResponse) => {
    const payload = JSON.parse(atob(credentialResponse.credential.split('.')[1]));

    const userData = {
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
      token: credentialResponse.credential,
    };

    setUser(userData); // ✅ same as before
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user'); // ✅ ensure cleanup
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);