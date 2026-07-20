import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase.js";

export function useProjects(user) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef(null);

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("date", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false });
    if (!error && data) setProjects(data);
  }, []);

  useEffect(() => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      await refetch();
      if (!cancelled) setLoading(false);
    })();

    const channel = supabase
      .channel("projects-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => refetch())
      .subscribe();
    channelRef.current = channel;

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, refetch]);

  const createProject = useCallback(async (name, venue, date) => {
    const { data, error } = await supabase.rpc("create_project_bootstrap", {
      p_name: name,
      p_venue: venue || "",
      p_date: date || null,
    });
    if (error) throw error;
    await refetch();
    return data; // new project id
  }, [refetch]);

  const deleteProject = useCallback(async (id) => {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw error;
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { projects, loading, createProject, deleteProject, refetch };
}
