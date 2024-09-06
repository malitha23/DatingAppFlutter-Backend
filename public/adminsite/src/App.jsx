import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Import your components
import AdminLayout from "layouts/admin"; // Assuming this is the main admin layout
import Signin from "../src/views/auth/SignIn"; // Your Signin component

const App = () => {
  // Define a function to check if the user is authenticated
  const isAuthenticated = () => {
    // Replace this with your actual authentication logic
    return !!localStorage.getItem("token"); // Example using a token in local storage
  };

  return (
    <Routes>
      {/* If the user is authenticated, navigate to AdminLayout */}
      {isAuthenticated() ? (
        <>
        <Route path="admin/*" element={<AdminLayout />} />
        <Route path="/" element={<Navigate to="/admin" replace />} />
      </>
        
      ) : (
        <>
          <Route path="signin" element={<Signin />} />
          <Route path="/" element={<Navigate to="/signin" replace />} />
        </>
      )}
    </Routes>
    
  );
};

export default App;



// import React from "react";
// import { Routes, Route, Navigate } from "react-router-dom";

// import RtlLayout from "layouts/rtl";
// import AdminLayout from "layouts/admin";
// import AuthLayout from "layouts/auth";
// import Signin from "../src/views/auth/SignIn";
// const App = () => {
//   return (
//     <Routes>
//       <Route path="auth/*" element={<AuthLayout />} />
//       <Route path="admin/*" element={<AdminLayout />} />
//       <Route path="rtl/*" element={<RtlLayout />} />
//       <Route path="signin/*" element={<Signin />} />
//       <Route path="/" element={<Navigate to="/signin" replace />} />
//     </Routes>
//   );
// };

// export default App;
