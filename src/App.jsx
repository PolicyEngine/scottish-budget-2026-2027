import Dashboard from "./components/Dashboard";
import "./App.css";

function App() {
  return (
    <div className="app">
      <header className="title-row">
        <div className="title-row-inner">
          <h1>Scottish Budget 2026</h1>
        </div>
      </header>
      <main className="main-content">
        <Dashboard />
      </main>
    </div>
  );
}

export default App;
