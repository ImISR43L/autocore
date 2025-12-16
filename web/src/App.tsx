import React from "react"; // <--- 1. Adicione a importação do React
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ClassroomView from "./pages/ClassroomView";
import CreateProblem from "./pages/CreateProblem";

// 2. Altere o tipo de JSX.Element para React.ReactNode
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  // O ReactNode pode ser retornado diretamente
  return token ? <>{children}</> : <Navigate to="/" />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" data-testid="login-route" element={<Login />} />

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
