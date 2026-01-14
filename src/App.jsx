import { useState, useEffect, useRef } from "react";
import Dashboard from "./components/Dashboard";
import HouseholdCalculator from "./components/HouseholdCalculator";
import "./App.css";

const POLICIES = [
  { id: "scp_baby_boost", name: "SCP baby boost" },
  { id: "income_tax_threshold_uplift", name: "Income tax threshold uplift" },
];

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Initialize from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam === "personal") {
      setActiveTab("personal");
    }
  }, []);

  // Update URL when tab changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (activeTab === "personal") {
      params.set("tab", "personal");
    } else {
      params.delete("tab");
    }
    const newUrl = params.toString()
      ? `?${params.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, "", newUrl);
  }, [activeTab]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedPolicyName = POLICIES.find(p => p.id === selectedPolicy)?.name || "Choose policy";

  return (
    <div className="app">
      <header className="title-row">
        <div className="title-row-inner">
          <h1>Scottish Budget 2026</h1>
          <div className="policy-dropdown" ref={dropdownRef}>
            <button
              className="policy-dropdown-trigger"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <span>{selectedPolicyName}</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`dropdown-arrow ${dropdownOpen ? "open" : ""}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {dropdownOpen && (
              <div className="policy-dropdown-menu">
                {POLICIES.map((policy) => (
                  <button
                    key={policy.id}
                    className={`policy-dropdown-item ${selectedPolicy === policy.id ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedPolicy(policy.id);
                      setDropdownOpen(false);
                    }}
                  >
                    {policy.name}
                    {selectedPolicy === policy.id && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="main-content">
        {/* Tab navigation */}
        <div className="tab-navigation">
          <button
            className={`tab-button ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="7" height="9" />
              <rect x="14" y="3" width="7" height="5" />
              <rect x="14" y="12" width="7" height="9" />
              <rect x="3" y="16" width="7" height="5" />
            </svg>
            Population impact
          </button>
          <button
            className={`tab-button ${activeTab === "personal" ? "active" : ""}`}
            onClick={() => setActiveTab("personal")}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Personal impact
          </button>
        </div>

        {activeTab === "personal" ? (
          <div className="personal-impact-container">
            <HouseholdCalculator />
          </div>
        ) : selectedPolicy ? (
          <Dashboard selectedPolicy={selectedPolicy} />
        ) : (
          <div className="select-policy-prompt">
            <p>Please select a policy from the dropdown above to view the analysis.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
