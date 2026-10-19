import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "./AuthContext";
import { useBreakpoint } from "../utils/useBreakpoint";
import { saveTutorialDone } from "../../api/service/userSettingsService";
import { TUTORIAL_HOME, TUTORIAL_ROLES, stepsFor, type TutorialStep } from "../tutorial/tutorialSteps";
import TutorialOverlay from "../tutorial/TutorialOverlay";

type TutorialMode = "first" | "replay";

interface TutorialContextValue {
  active: boolean;
  step: TutorialStep | null;
  available: boolean;
  start: () => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const { user, markTutorialDone } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const breakpoint = useBreakpoint();
  const [active, setActive] = useState(false);
  const [steps, setSteps] = useState<TutorialStep[]>([]);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<TutorialMode>("replay");
  const direction = useRef(1);
  const autoStarted = useRef(false);

  let available = false;
  if (user && TUTORIAL_ROLES.includes(user.activeRole)) available = true;

  let step: TutorialStep | null = null;
  if (active && index < steps.length) step = steps[index];

  function begin(newMode: TutorialMode) {
    setSteps(stepsFor(breakpoint));
    setIndex(0);
    setMode(newMode);
    direction.current = 1;
    setActive(true);
  }

  function end() {
    setActive(false);
    setSteps([]);
    setIndex(0);
    navigate(TUTORIAL_HOME);
    if (mode !== "first") return;
    saveTutorialDone()
      .then(() => markTutorialDone())
      .catch((err: any) => {
        console.error(
          "[tutorial] PATCH /api/user/tutorial falhou — o tutorial vai aparecer de novo no próximo login.",
          err?.detail ?? err?.message ?? err,
        );
      });
  }

  function next() {
    direction.current = 1;
    if (index + 1 >= steps.length) {
      end();
      return;
    }
    setIndex(index + 1);
  }

  function prev() {
    direction.current = -1;
    if (index > 0) setIndex(index - 1);
  }

  function skipMissing() {
    if (direction.current === -1 && index > 0) {
      setIndex(index - 1);
      return;
    }
    next();
  }

  function start() {
    begin("replay");
  }

  useEffect(() => {
    if (autoStarted.current) return;
    if (!user || !user.isFirstLogin) return;
    if (!TUTORIAL_ROLES.includes(user.activeRole)) return;
    autoStarted.current = true;
    begin("first");
  }, [user]);

  useEffect(() => {
    if (!step) return;
    if (location.pathname !== step.route) navigate(step.route);
  }, [step]);

  return (
    <TutorialContext.Provider value={{ active, step, available, start }}>
      {children}
      {step && (
        <TutorialOverlay
          step={step}
          stepIndex={index}
          totalSteps={steps.length}
          onNext={next}
          onPrev={prev}
          onSkip={end}
          onMissing={skipMissing}
        />
      )}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error("useTutorial must be used inside TutorialProvider");
  return ctx;
}
