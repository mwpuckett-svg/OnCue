import React, { useState } from "react";
import { useAuth } from "./hooks/useAuth.js";
import { useProjects } from "./hooks/useProjects.js";
import { useProjectData } from "./hooks/useProjectData.js";
import { supabaseConfigured } from "./lib/supabase.js";
import { LoadingBlock, ConfirmHost } from "./components/ui.jsx";
import { ask } from "./lib/confirm.js";
import LoginPage from "./pages/LoginPage.jsx";
import ProjectsPage from "./pages/ProjectsPage.jsx";
import ShowPage from "./pages/ShowPage.jsx";

function ShowPageContainer({ projectId, user, onGoToProjects }) {
  const data = useProjectData(projectId, user);
  return <ShowPage data={data} user={user} onGoToProjects={onGoToProjects} />;
}

function ConfigError() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg border border-rule-strong bg-paper p-6 sm:p-8">
        <h1 className="font-display text-3xl font-semibold leading-9">OnCue can't reach its database yet</h1>
        <p className="mb-4 mt-2 text-mute">
          Create a file named <code className="rounded-[2px] bg-sunk px-1">.env</code> in the project folder, next to <code className="rounded-[2px] bg-sunk px-1">package.json</code>, with your Supabase values:
        </p>
        <pre className="mb-4 overflow-x-auto border border-rule bg-sunk p-3 text-sm">{`VITE_SUPABASE_URL=https://your-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}</pre>
        <p className="text-mute">
          Then stop the dev server with <code className="rounded-[2px] bg-sunk px-1">Ctrl+C</code> and run <code className="rounded-[2px] bg-sunk px-1">npm run dev</code> again. Vite only reads <code className="rounded-[2px] bg-sunk px-1">.env</code> when it starts.
          On Vercel, add the same two values under Settings, then Environment Variables, and redeploy.
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
    const ok = await ask({
      title: `Delete ${target?.name || "this show"}?`,
      body: "Its days, cues, notes, positions and invites are all deleted. This can't be undone.",
      confirmLabel: "Delete show", danger: true,
    });
    if (!ok) return;
    await deleteProject(id);
    if (currentProjectId === id) setCurrentProjectId(null);
  };

  return (
    <div className="min-h-screen font-body">
      <ConfirmHost />
      {!supabaseConfigured ? (
        <ConfigError />
      ) : authLoading ? (
        <LoadingBlock text="Loading" />
      ) : !user ? (
        <LoginPage sendCode={sendCode} verifyCode={verifyCode} />
      ) : projectsLoading ? (
        <LoadingBlock text="Loading your shows" />
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
