import { createContext, useContext, useReducer, type ReactNode } from "react";

// 1. 定义状态类型
interface CounterState {
  count: number;
}

// 2. 定义 action 类型
type CounterAction =
  | { type: "increment" }
  | { type: "decrement" }
  | { type: "reset" }
  | { type: "set"; payload: number };

// 3. 定义 reducer
function counterReducer(state: CounterState, action: CounterAction): CounterState {
  switch (action.type) {
    case "increment":
      return { count: state.count + 1 };
    case "decrement":
      return { count: state.count - 1 };
    case "reset":
      return { count: 0 };
    case "set":
      return { count: action.payload };
    default:
      return state;
  }
}

// 4. 定义 Context 值的类型（状态 + dispatch）
interface CounterContextValue {
  state: CounterState;
  dispatch: React.Dispatch<CounterAction>;
}

// 5. 创建 Context
const CounterContext = createContext<CounterContextValue | null>(null);

// 6. 定义 Provider 组件
export function CounterProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(counterReducer, { count: 0 });

  return (
    <CounterContext.Provider value={{ state, dispatch }}>
      {children}
    </CounterContext.Provider>
  );
}

// 7. 定义自定义 Hook（封装读取逻辑）
export function useCounterContext() {
  const context = useContext(CounterContext);
  if (!context) {
    throw new Error("useCounterContext must be used within CounterProvider");
  }
  return context;
}
