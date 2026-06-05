import { CloseDialog } from "./components/common";
import { useAutoTheme } from "./hooks/useAutoTheme";
import { useThemeSync } from "./hooks/useThemeSync";
import { useTrayActions } from "./hooks/useTrayActions";
import { AppLayout } from "./layouts/AppLayout";

function App() {
  useThemeSync();
  useAutoTheme();
  useTrayActions();

  return (
    <>
      <AppLayout />
      <CloseDialog />
    </>
  );
}

export default App;
