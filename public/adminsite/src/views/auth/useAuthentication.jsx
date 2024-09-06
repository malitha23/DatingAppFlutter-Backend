// src/hooks/useAuthentication.js
import { useState, useEffect } from 'react';

const useAuthentication = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check localStorage for the token
    const token = localStorage.getItem("token");
    // Set authentication status based on token presence
    setIsAuthenticated(!!token);
  }, []);

  return isAuthenticated;
};

export default useAuthentication;
