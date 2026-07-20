import React, { useState } from "react";
import { useAuth } from "./hooks/useAuth.js";
import { useProjects } from "./hooks/useProjects.js";
import { useProjectData } from "./hooks/useProjectData.js";
import { theme } from "./lib/theme.js";
import { supabaseConfigured } from "./lib/supabase.js";
import { LoadingBlock } from "./components/ui.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import ProjectsPage from "./pages/ProjectsPage.jsx";
import ShowPage from "./pages/ShowPage.jsx";

function ShowPageContainer({ projectId, user, onGoToProjects }) {
  const data = useProjectData(projectId, user);
  return <ShowPage data={data} user={user} onGoToProjects={onGoToProjects} />;
}

function ConfigError() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: theme.bg }}>
      <div className="w-full max-w-md rounded-2xl p-6 sm:p-8" style={{ background: theme.panel, border: `1px solid ${theme.red}66` }}>
        <h1 className="font-display font-semibold text-xl mb-2" style={{ color: theme.red }}>Configuration missing</h1>
        <p className="text-sm mb-3" style={{ color: theme.textMuted }}>
          This app can't reach Supabase yet. Check that a <code style={{ color: theme.amber }}>.env</code> file exists in the
          project root (next to <code style={{ color: theme.amber }}>package.json</code>) with your real values:
        </p>
        <pre className="text-xs rounded-lg p-3 mb-3 overflow-x-auto" style={{ background: theme.panelAlt, color: theme.text, border: `1px solid ${theme.hairline}` }}>
{`VITE_SUPABASE_URL=https://your-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
        </pre>
        <p className="text-sm" style={{ color: theme.textMuted }}>
          Then stop the dev server (<code style={{ color: theme.amber }}>Ctrl+C</code>) and run{" "}
          <code style={{ color: theme.amber }}>npm run dev</code> again — Vite only reads <code style={{ color: theme.amber }}>.env</code> at startup.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading: authLoading, sendCode, verifyCode, signOut } = useAuth();
  const { projects, loading: projectsLoading, createProject, deleteProject } = useProjects(user);
  const [currentProjectId, setCurrentProjectId] = useState(null);

  const handleDelete = async (id) => {
    const target = projects.find((p) => p.id === id);
    if (!window.confirm(`Delete "${target ? target.name : "this show"}"? This removes its entire schedule and cannot be undone.`)) return;
    await deleteProject(id);
    if (currentProjectId === id) setCurrentProjectId(null);
  };

  return (
    <div className="min-h-screen ros-scrollbar font-body" style={{ background: theme.bg, color: theme.text }}>
      {!supabaseConfigured ? (
        <ConfigError />
      ) : authLoading ? (
        <LoadingBlock text="Loading…" />
      ) : !user ? (
        <LoginPage sendCode={sendCode} verifyCode={verifyCode} />
      ) : projectsLoading ? (
        <LoadingBlock text="Loading your shows…" />
      ) : currentProjectId == null ? (
        <ProjectsPage
          projects={projects}
          onOpen={setCurrentProjectId}
          onCreate={createProject}
          onDelete={handleDelete}
          onSignOut={signOut}
          userEmail={user.email}
        />
      ) : (
        <ShowPageContainer projectId={currentProjectId} user={user} onGoToProjects={() => setCurrentProjectId(null)} />
      )}
    </div>
  );
}
