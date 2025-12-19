// web/src/App.tsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner"; // <--- 1. IMPORTAR

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ClassroomView from "./pages/ClassroomView";
import CreateProblem from "./pages/CreateProblem";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  return token ? <>{children}</> : <Navigate to="/" />;
}

function App() {
  return (
    <BrowserRouter>
      {/* 2. ADICIONAR O TOASTER AQUI (pode ser antes ou depois das Routes) */}
      <Toaster position="top-right" richColors expand={true} />

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
          path="/create-problem"
          element={
            <PrivateRoute>
              <CreateProblem />
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
