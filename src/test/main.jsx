import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/hanken-grotesk/700.css";
import "../index.css";
import ShowPage from "../pages/ShowPage.jsx";
import { ConfirmHost } from "../components/ui.jsx";
import { useProjectData } from "../hooks/useProjectData.js";

const user = { id: "u1", email: "mike@example.com" };
function Harness() {
  const data = useProjectData("proj1", user);
  return <ShowPage data={data} user={user} onGoToProjects={() => {}} />;
}
ReactDOM.createRoot(document.getElementById("root")).render(<><Harness /><ConfirmHost /></>);
