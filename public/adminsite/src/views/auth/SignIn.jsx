import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../../config'; 

const LoginPage = () => {
  const [nic, setNic] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Retrieve and set NIC from localStorage
    const storedNic = localStorage.getItem('nic');
    if (storedNic) {
      setNic(storedNic);
    }

    // Retrieve and set password from localStorage (not recommended)
    const storedPassword = localStorage.getItem('password');
    if (storedPassword) {
      setPassword(storedPassword);
    }
  }, []);


  const handleLogin = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nic: nic,
          password: password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.user.role === 'admin') {
          localStorage.setItem('token', data.token);
          localStorage.setItem('nic', nic);
          localStorage.setItem('password', password);
          window.location.href = '/admin';
        } else {
          setError('You do not have the required permissions');
        }
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (error) {
      setError('An error occurred');
      console.error('Login error:', error);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-purple-700">
      <div className="bg-white p-8 rounded-lg shadow-lg w-80">
        <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>
        {error && <div className="text-red-500 mb-4">{error}</div>}
        <div className="mb-4">
          <label className="block text-gray-700">Nic Number</label>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-lg"
            value={nic}
            onChange={(e) => setNic(e.target.value)}
          />
        </div>
        <div className="mb-6">
          <label className="block text-gray-700">Password</label>
          <input
            type="password"
            className="w-full px-3 py-2 border rounded-lg"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button
          className="w-full bg-purple-500 text-white py-2 rounded-lg"
          onClick={handleLogin}
        >
          Login
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
