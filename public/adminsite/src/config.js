// src/config.js
// const API_BASE_URL = 'https://lovebird4u.com/api';
const API_BASE_URL = 'http://localhost:3000/api';

export const API_ENDPOINTS = {
  Base_Url: API_BASE_URL,
  LOGIN: `${API_BASE_URL}/user/login`,
  NewUsersFetch: `${API_BASE_URL}/admin/getAllNewUsers`,
  NewUsersStatusChange: `${API_BASE_URL}/admin/UpdateUserStatusForAdmin/`,
  NewUsersBulkStatusChange: `${API_BASE_URL}/admin/UpdateUserBulkStatusForAdmin`,
  NewUsersDetete: `${API_BASE_URL}/admin/deleteuser/`,
  // Add other endpoints here as needed
};
