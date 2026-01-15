import { useState, useEffect, useRef } from "react";
import Dashboard from "./components/Dashboard";
import HouseholdCalculator from "./components/HouseholdCalculator";
import ValidationTab from "./components/ValidationTab";
import "./App.css";

const POLICIES = [
  { id: "scp_baby_boost", name: "SCP Premium for under-ones" },
  { id: "income_tax_threshold_uplift", name: "Income tax threshold uplift" },
];

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedPolicies, setSelectedPolicies] = useState(["scp_baby_boost", "income_tax_threshold_uplift"]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const togglePolicy = (policyId) => {
    setSelectedPolicies(prev =>
      prev.includes(policyId)
        ? prev.filter(id => id !== policyId)
        : [...prev, policyId]
    );
  };

  // Initialize from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam === "personal") {
      setActiveTab("personal");
    } else if (tabParam === "validation") {
      setActiveTab("validation");
    }
  }, []);

  // Update URL when tab changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (activeTab === "personal") {
      params.set("tab", "personal");
    } else if (activeTab === "validation") {
      params.set("tab", "validation");
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

  const getDropdownLabel = () => {
    if (selectedPolicies.length === 0) return "Select policies";
    if (selectedPolicies.length === 2) return "2 policies selected";
    return POLICIES.find(p => p.id === selectedPolicies[0])?.name || "Select policies";
  };

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
              <span>{getDropdownLabel()}</span>
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
                  <label
                    key={policy.id}
                    className={`policy-dropdown-item checkbox ${selectedPolicies.includes(policy.id) ? "selected" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPolicies.includes(policy.id)}
                      onChange={() => togglePolicy(policy.id)}
                    />
                    <span className="checkmark">
                      {selectedPolicies.includes(policy.id) && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                    <span className="policy-name">{policy.name}</span>
                  </label>
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
          <button
            className={`tab-button ${activeTab === "validation" ? "active" : ""}`}
            onClick={() => setActiveTab("validation")}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            Validation
          </button>
        </div>

        {activeTab === "personal" ? (
          <div className="personal-impact-container">
            <HouseholdCalculator />
          </div>
        ) : activeTab === "validation" ? (
          <ValidationTab />
        ) : selectedPolicies.length > 0 ? (
          <Dashboard selectedPolicies={selectedPolicies} />
        ) : (
          <div className="select-policy-prompt">
            <p>Please select one or more policies from the dropdown above to view the analysis.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
