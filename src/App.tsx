import { CloseDialog } from "./components/common";
import { useAutoTheme } from "./hooks/useAutoTheme";
import { useICloudEndpointSync } from "./hooks/useICloudEndpointSync";
import { useThemeSync } from "./hooks/useThemeSync";
import { useTrayActions } from "./hooks/useTrayActions";
import { useUpdate } from "./hooks/useUpdate";
import { AppLayout } from "./layouts/AppLayout";

function App() {
  useThemeSync();
  useAutoTheme();
  useTrayActions();
  useUpdate();
  // macOS：端点变更自动备份到 iCloud；启动差异仅提示，具体方向在同步页选择
  useICloudEndpointSync();

  return (
    <>
      <AppLayout />
      <CloseDialog />
    </>
  );
}

export default App;
