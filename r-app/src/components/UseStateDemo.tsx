import { useState } from "react";

// 惰性初始化：初始值计算成本高时，传函数只在首次渲染执行
function getInitialCount() {
  console.log("只在首次渲染执行一次");
  return 0;
}

export function UseStateDemo() {
  // 1. 基础用法：直接传初始值
  const [count, setCount] = useState(0);

  // 2. 惰性初始化：传函数，返回值作为初始值
  const [lazyCount, setLazyCount] = useState(getInitialCount);

  // 3. 对象状态
  const [user, setUser] = useState({ name: "Alice", age: 25 });

  // 4. 数组状态
  const [items, setItems] = useState<string[]>([]);

  // 5. 函数状态（存储函数本身）
  const [formatter, setFormatter] = useState(() => (n: number) => `Count: ${n}`);

  return (
    <div>
      <h2>useState 用法演示</h2>

      {/* 基础用法 */}
      <section>
        <h3>1. 基础用法</h3>
        <p>count: {count}</p>
        <button onClick={() => setCount(count + 1)}>直接更新</button>
        <button onClick={() => setCount((prev) => prev + 1)}>函数式更新</button>
        <button onClick={() => setCount(0)}>重置</button>
      </section>

      <hr />

      {/* 惰性初始化 */}
      <section>
        <h3>2. 惰性初始化</h3>
        <p>lazyCount: {lazyCount}</p>
        <button onClick={() => setLazyCount((prev) => prev + 1)}>+1</button>
        <p style={{ fontSize: 12, color: "#888" }}>
          打开控制台，"只在首次渲染执行一次" 只会出现一次
        </p>
      </section>

      <hr />

      {/* 对象状态 */}
      <section>
        <h3>3. 对象状态</h3>
        <p>{user.name}, {user.age}岁</p>
        <button onClick={() => setUser({ ...user, age: user.age + 1 })}>
          长一岁
        </button>
        <button onClick={() => setUser((prev) => ({ ...prev, name: "Bob" }))}>
          改名
        </button>
      </section>

      <hr />

      {/* 数组状态 */}
      <section>
        <h3>4. 数组状态</h3>
        <p>items: [{items.join(", ")}]</p>
        <button onClick={() => setItems([...items, `item-${items.length}`])}>
          添加
        </button>
        <button onClick={() => setItems((prev) => prev.slice(0, -1))}>
          删除最后一个
        </button>
        <button onClick={() => setItems([])}>清空</button>
      </section>

      <hr />

      {/* 函数状态 */}
      <section>
        <h3>5. 函数状态</h3>
        <p>{formatter(count)}</p>
        <button
          onClick={() =>
            setFormatter(() => (n: number) => `当前值是 ${n}`)
          }
        >
          切换格式
        </button>
      </section>

      <hr />

      {/* 批量更新 */}
      <section>
        <h3>6. 批量更新</h3>
        <p>count: {count}, lazyCount: {lazyCount}</p>
        <button
          onClick={() => {
            // React 18+ 自动批量，多次 setState 只触发一次渲染
            setCount((prev) => prev + 1);
            setLazyCount((prev) => prev + 1);
            setCount((prev) => prev + 10);
            console.log("三次 setState，只渲染一次");
          }}
        >
          批量 +1 +1 +10
        </button>
      </section>
    </div>
  );
}
