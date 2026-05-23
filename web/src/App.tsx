import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import ClassroomView from "./pages/ClassroomView";
import CreateProblem from "./pages/CreateProblem";
import EditProblem from "./pages/EditProblem";
import { SettingsModal } from "./components/SettingsModal";

// 1. Importe o componente principal da sua nova feature
// (Ajuste o caminho conforme a estrutura que você definiu)
import { MoleculeWorkspace } from "./features/molecule-env";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;

  return session ? <>{children}</> : <Navigate to="/" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors expand={true} />
      <SettingsModal />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/home" element={<Home />} />

        {/* 2. Adicione a rota de desenvolvimento para as moléculas */}
        <Route path="/molecules" element={<MoleculeWorkspace />} />

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
          path="/class/:classroomId/problem/:id/edit"
          element={
            <PrivateRoute>
              <EditProblem />
            </PrivateRoute>
          }
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
