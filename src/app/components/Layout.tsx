import { Outlet } from "react-router";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import PrivacyButton from "./PrivacyButton";
import { useNavLayout } from "../context/NavLayoutContext";
import { TutorialProvider } from "../context/TutorialContext";

export default function Layout() {
  const { navLayout } = useNavLayout();

  if (navLayout === "sidebar") {
    return (
      <TutorialProvider>
        <div className="flex h-[100dvh] bg-background overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
          <Sidebar />
          <div className="relative flex-1 min-w-0 overflow-hidden">
            <Outlet />
            <PrivacyButton />
          </div>
        </div>
      </TutorialProvider>
    );
  }

  return (
    <TutorialProvider>
      <div className="flex flex-col h-[100dvh] bg-background overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
        <Navbar />
        <div className="relative flex-1 overflow-hidden">
          <Outlet />
          <PrivacyButton />
        </div>
      </div>
    </TutorialProvider>
  );
}
