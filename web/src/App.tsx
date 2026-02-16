// web/src/App.tsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ClassroomView from "./pages/ClassroomView";
import CreateProblem from "./pages/CreateProblem";
import EditProblem from "./pages/EditProblem";
import { ThemeToggle } from "./components/ThemeToggle";
import { ColorblindToggle } from "./components/ColorblindToggle"; // <--- NOVO IMPORT

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  return token ? <>{children}</> : <Navigate to="/" />;
}

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors expand={true} />
      <ThemeToggle />
      <ColorblindToggle /> {/* <--- INJEÇÃO */}
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/class/:id"
          element={
            <PrivateRoute>
              <ClassroomView />
            </PrivateRoute>
          }
        />
        <Route
          path="/class/:classroomId/create-problem"
          element={
            <PrivateRoute>
              <CreateProblem />
            </PrivateRoute>
          }
        />
        <Route
          path="/class/:classroomId/problem/:problemId/edit"
          element={
            <PrivateRoute>
              <EditProblem />
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
