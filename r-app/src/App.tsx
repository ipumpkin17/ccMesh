import { Counter } from "./components/Counter";
import { TodoList } from "./components/TodoList";
import "./App.css";

function App() {
  return (
    <main className="container">
      <hr />
      <Counter />
      <hr />
      <TodoList />
    </main>
  );
}

export default App;
