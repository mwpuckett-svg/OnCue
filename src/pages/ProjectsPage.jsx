import React, { useState } from "react";
import { Trash2, LogOut, Plus } from "lucide-react";
import { Button, IconBtn, ThemeToggle, UpdateButton } from "../components/ui.jsx";
import { todayLocalStr, formatDateShort } from "../lib/scheduleUtils.js";

function ShowList({ title, shows, onOpen, onDelete }) {
  if (shows.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-1 text-sm font-semibold text-mute">{title}</h2>
      <ul className="border-t border-rule-strong">
        {shows.map((p) => (
          <li key={p.id} className="group relative border-b border-rule">
            <button type="button" onClick={() => onOpen(p.id)} className="flex w-full items-baseline gap-5 px-1 py-3 text-left transition-colors hover:bg-ink/[0.04]">
              <span className="clock num w-36 shrink-0 text-lg text-mute">{p.date ? formatDateShort(p.date) : "No date"}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-2xl font-semibold leading-7">{p.name || "Untitled show"}</span>
                {p.venue && <span className="block truncate text-sm text-mute">{p.venue}</span>}
              </span>
            </button>
            <IconBtn
              onClick={() => onDelete(p.id)}
              title={`Delete ${p.name || "show"}`}
              danger
              className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
            >
              <Trash2 size={15} />
            </IconBtn>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ProjectsPage({ projects, onOpen, onCreate, onDelete, onSignOut, userEmail }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const id = await onCreate(name, date);
      setName("");
      setDate("");
      if (id) onOpen(id);
    } finally {
      setBusy(false);
    }
  };

  const today = todayLocalStr();
  const byDate = (a, b) => (a.date || "").localeCompare(b.date || "");
  const upcoming = projects.filter((p) => p.date && p.date >= today).sort(byDate);
  const past = projects.filter((p) => p.date && p.date < today).sort((a, b) => byDate(b, a));
  const undated = projects.filter((p) => !p.date).sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
      <header className="flex items-center justify-between py-3">
        <span className="font-display text-[1.375rem] font-bold leading-none">OnCue</span>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="quiet" size="sm" onClick={onSignOut}><LogOut size={13} /> Sign out ({userEmail})</Button>
          <UpdateButton />
        </div>
      </header>

      <main className="border border-rule bg-paper px-5 pb-8 pt-6 sm:px-8">
        <h1 className="font-display text-[2.75rem] font-semibold leading-[3rem]">Shows</h1>

        <form className="mb-8 mt-5 flex flex-wrap items-end gap-3 border-y border-rule py-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="min-w-[14rem] flex-1">
            <label htmlFor="show-name" className="mb-1 block text-sm font-medium">New show</label>
            <input id="show-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, for example Fall General Session" className="field-boxed" />
          </div>
          <div>
            <label htmlFor="show-date" className="mb-1 block text-sm font-medium">Date</label>
            <input id="show-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field-boxed" />
          </div>
          <Button variant="primary" size="lg" type="submit" disabled={busy}><Plus size={15} strokeWidth={2.25} /> Create show</Button>
        </form>

        {projects.length === 0 ? (
          <div className="py-10">
            <p className="font-display text-2xl font-semibold">No shows yet</p>
            <p className="mt-1 max-w-md text-sm text-mute">Name your first show above. You'll start with one day and nine crew positions ready to rename.</p>
          </div>
        ) : (
          <>
            <ShowList title="Upcoming" shows={upcoming} onOpen={onOpen} onDelete={onDelete} />
            <ShowList title="No date yet" shows={undated} onOpen={onOpen} onDelete={onDelete} />
            <ShowList title="Past" shows={past} onOpen={onOpen} onDelete={onDelete} />
          </>
        )}
      </main>
    </div>
  );
}
