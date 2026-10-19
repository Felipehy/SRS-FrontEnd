import { RouterProvider } from "react-router";
import { ThemeProvider } from "./context/ThemeContext";
import { NavLayoutProvider } from "./context/NavLayoutContext";
import { AuthProvider } from "./context/AuthContext";
import { EventsProvider } from "./context/EventsContext";
import { CategoryColorsProvider } from "./context/CategoryColorsContext";
import { router } from "./routes";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NavLayoutProvider>
          <CategoryColorsProvider>
            <EventsProvider>
              <RouterProvider router={router} />
            </EventsProvider>
          </CategoryColorsProvider>
        </NavLayoutProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
