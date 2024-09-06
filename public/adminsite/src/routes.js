import React from "react";

// Admin Imports
import MainDashboard from "views/admin/default";
import NFTMarketplace from "views/admin/marketplace";
import Profile from "views/admin/profile";
import DataTables from "views/admin/tables";
// import RTLDefault from "views/rtl/default";

// Auth Imports
import SignIn from "views/auth/SignIn";

// Icon Imports
import {
  MdHome,
  MdSettingsBackupRestore ,
  MdBarChart,
  MdPerson,
  MdLock,
  MdGroupAdd ,
  MdGroup,
  MdReduceCapacity,
  MdPaid ,
  MdOutlineTipsAndUpdates,
  MdAssessment,
  MdWorkspacesFilled      

} from "react-icons/md";

const routes = [
  {
    name: "Dashbord",
    layout: "/admin",
    path: "default",
    icon: <MdHome className="h-6 w-6" />,
    component: <MainDashboard />,
  },
  {
    name: "New Users Verification",
    layout: "/admin",
    path: "nft-marketplace",
    icon: <MdGroupAdd className="h-6 w-6" />,
    component: <NFTMarketplace />,
    secondary: true,
  },
  {
    name: "User Details",
    layout: "/admin",
    icon: <MdGroup  className="h-6 w-6" />,
    path: "data-tables",
    component: <DataTables />,
  },
   {
    name: "User Re-verification",
    layout: "/admin",
    icon: <MdSettingsBackupRestore  className="h-6 w-6" />,
    path: "verification",
    component: <DataTables />,
  },
  {
    name: "Payment Details",
    layout: "/admin",
    icon: <MdAssessment   className="h-6 w-6" />,
    path: "Payment-Details",
    component: <DataTables />,
  },
  {
    name: "Subscription Packages",
    layout: "/admin",
    icon: <MdPaid  className="h-6 w-6" />,
    path: "Subscription-Packages",
    component: <DataTables />,
  },
  {
    name: "Backlist",
    layout: "/admin",
    icon: <MdReduceCapacity   className="h-6 w-6" />,
    path: "Backlist",
    component: <DataTables />,
  },
  {
    name: "Referral",
    layout: "/admin",
    icon: <MdWorkspacesFilled  className="h-6 w-6" />,
    path: "Referral",
    component: <DataTables />,
  },
  {
    name: "Profile",
    layout: "/admin",
    path: "profile",
    icon: <MdPerson className="h-6 w-6" />,
    component: <Profile />,
  },
  {
    name: "Support",
    layout: "/admin",
    path: "Support",
    icon: <MdOutlineTipsAndUpdates  className="h-6 w-6" />,
    component: <Profile />,
  },
  {
    name: "Sign In",
    layout: "/auth",
    path: "sign-in",
    icon: <MdLock className="h-6 w-6" />,
    component: <SignIn />,
  }
  
];
export default routes;
