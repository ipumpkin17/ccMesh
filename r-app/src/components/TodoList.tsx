import { useState } from "react";
import { useTodoStore } from "../stores/todo";
import { useCounterStore } from "../stores/counter";

export function TodoList() {
  const todos = useTodoStore((state) => state.todos);
  const addTodo = useTodoStore((state) => state.addTodo);
  const toggleTodo = useTodoStore((state) => state.toggleTodo);
  const removeTodo = useTodoStore((state) => state.removeTodo);

  const count = useCounterStore((state) => state.count);
  const setCount = useCounterStore((state) => state.setCount);

  const [lastSubmitTime, setLastSubmitTime] = useState<string | null>(null);

  return (
    <>
      <h2>Todo List</h2>
      {<p>上次提交时间: {lastSubmitTime}</p>}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          addTodo(`Todo-${count}`);
          setLastSubmitTime(new Date().toLocaleTimeString());
        }}
      >
        <input
          type="number"
          value={count}
          onChange={(e) => setCount(Number(e.currentTarget.value))}
        />
        <button type="submit">Add</button>
      </form>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>
            <span
              style={{ textDecoration: todo.done ? "line-through" : "none", cursor: "pointer" }}
              onClick={() => toggleTodo(todo.id)}
            >
              {todo.text}
            </span>
            <button onClick={() => removeTodo(todo.id)}>×</button>
          </li>
        ))}
      </ul>
    </>
  );
}
