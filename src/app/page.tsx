"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";

// Interface Definitions
interface User {
  id: string;
  name: string;
  email: string;
  targetCalories: number;
  targetActiveMinutes: number;
  targetSteps: number;
  stravaAccessToken?: string | null;
}

interface DailyLog {
  id: string;
  userId: string;
  date: string;
  steps: number;
  activeMinutes: number;
  caloriesBurned: number;
  foodLog: string;
  caloriesConsumed: number;
  proteinConsumed: number;
  carbsConsumed: number;
  fatConsumed: number;
}

interface Workout {
  id: string;
  userId: string;
  date: string;
  title: string;
  type: string;
  duration: number;
  distance: number;
  avgHeartRate?: number | null;
  calories?: number | null;
  source: string;
}

interface DailyScore {
  id: string;
  userId: string;
  date: string;
  score: number;
  rationale: string;
  socialMessage: string;
}

interface LeaderboardUser {
  userId: string;
  name: string;
  email: string;
  totalScore: number;
  averageScore: number;
  stats: {
    avgSteps: number;
    avgActiveMinutes: number;
    avgCaloriesBurned: number;
    avgCaloriesConsumed: number;
    workoutsCount: number;
  };
  scores: Array<{
    date: string;
    score: number;
    rationale: string;
    socialMessage: string;
  }>;
}

export default function Home() {
  // Date State
  const [selectedDate, setSelectedDate] = useState<string>("");
  
  // App States
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
  const [weekRange, setWeekRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
  
  // Current user's daily status
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [dailyScore, setDailyScore] = useState<DailyScore | null>(null);

  // Loading States
  const [usersLoading, setUsersLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [syncingStrava, setSyncingStrava] = useState(false);

  // Tab State ("activity" or "food")
  const [activeTab, setActiveTab] = useState<"activity" | "food" | "settings">("activity");

  // Manual Logging Inputs
  const [inputSteps, setInputSteps] = useState<number>(0);
  const [inputActiveMinutes, setInputActiveMinutes] = useState<number>(0);
  const [inputCaloriesBurned, setInputCaloriesBurned] = useState<number>(0);

  const [inputFoodLog, setInputFoodLog] = useState<string>("");
  const [inputCaloriesConsumed, setInputCaloriesConsumed] = useState<number>(0);
  const [inputProteinConsumed, setInputProteinConsumed] = useState<number>(0);
  const [inputCarbsConsumed, setInputCarbsConsumed] = useState<number>(0);
  const [inputFatConsumed, setInputFatConsumed] = useState<number>(0);

  // Manual Workout Inputs
  const [workoutTitle, setWorkoutTitle] = useState("");
  const [workoutType, setWorkoutType] = useState("Run");
  const [workoutDuration, setWorkoutDuration] = useState<number>(30);
  const [workoutDistance, setWorkoutDistance] = useState<string>("");
  const [workoutHeartRate, setWorkoutHeartRate] = useState<string>("");
  const [workoutCalories, setWorkoutCalories] = useState<string>("");

  // Target Settings Inputs
  const [targetCalories, setTargetCalories] = useState<number>(2000);
  const [targetActiveMinutes, setTargetActiveMinutes] = useState<number>(30);
  const [targetSteps, setTargetSteps] = useState<number>(10000);
  const [updateName, setUpdateName] = useState("");

  // New User Inputs
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");

  // Toast Notification
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Setup initial date in local timezone YYYY-MM-DD on client mount
  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    setSelectedDate(`${year}-${month}-${day}`);
    
    // Check URL params for redirect status
    const params = new URLSearchParams(window.location.search);
    const urlUserId = params.get("userId");
    const connectionStatus = params.get("connected");
    
    if (connectionStatus) {
      showToast(
        connectionStatus === "strava-mock" 
          ? "Mock Strava connection registered successfully!" 
          : "Strava connected successfully!", 
        "success"
      );
      // Clean url query params without reloading
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Fetch users on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  // Fetch data whenever user or date changes
  useEffect(() => {
    if (selectedUser && selectedDate) {
      fetchDailyData(selectedUser.id, selectedDate);
    }
  }, [selectedUser, selectedDate]);

  // Fetch leaderboard whenever date changes (or on load)
  useEffect(() => {
    if (selectedDate) {
      fetchLeaderboard();
    }
  }, [selectedDate]);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const res = await fetch("/api/users");
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsers(data);
        
        // Auto select user
        const params = new URLSearchParams(window.location.search);
        const urlUserId = params.get("userId");
        
        if (urlUserId) {
          const user = data.find((u: User) => u.id === urlUserId);
          if (user) {
            setSelectedUser(user);
            setUpdateName(user.name);
            setTargetCalories(user.targetCalories);
            setTargetActiveMinutes(user.targetActiveMinutes);
            setTargetSteps(user.targetSteps);
          } else {
            setSelectedUser(data[0] || null);
          }
        } else if (data.length > 0) {
          setSelectedUser(data[0]);
          setUpdateName(data[0].name);
          setTargetCalories(data[0].targetCalories);
          setTargetActiveMinutes(data[0].targetActiveMinutes);
          setTargetSteps(data[0].targetSteps);
        }
      }
    } catch (e) {
      showToast("Failed to load users", "error");
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      // Calculate current week boundaries based on selectedDate
      const res = await fetch(`/api/leaderboard`);
      const data = await res.json();
      if (data.leaderboard) {
        setLeaderboardData(data.leaderboard);
        setWeekRange({ start: data.startDate, end: data.endDate });
      }
    } catch (e) {
      console.error("Leaderboard error:", e);
    }
  };

  const fetchDailyData = async (userId: string, date: string) => {
    try {
      setDataLoading(true);
      const res = await fetch(`/api/log?userId=${userId}&date=${date}`);
      const data = await res.json();
      
      if (data.dailyLog) {
        const log = data.dailyLog as DailyLog;
        setDailyLog(log);
        setInputSteps(log.steps);
        setInputActiveMinutes(log.activeMinutes);
        setInputCaloriesBurned(log.caloriesBurned);
        setInputFoodLog(log.foodLog || "");
        setInputCaloriesConsumed(log.caloriesConsumed);
        setInputProteinConsumed(log.proteinConsumed);
        setInputCarbsConsumed(log.carbsConsumed);
        setInputFatConsumed(log.fatConsumed);
      }
      
      setWorkouts(data.workouts || []);
      setDailyScore(data.dailyScore || null);
    } catch (e) {
      showToast("Failed to load daily logs", "error");
    } finally {
      setDataLoading(false);
    }
  };

  // Date Navigation Helpers
  const changeDate = (days: number) => {
    if (!selectedDate) return;
    const current = new Date(`${selectedDate}T12:00:00`);
    current.setDate(current.getDate() + days);
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const day = String(current.getDate()).padStart(2, "0");
    setSelectedDate(`${year}-${month}-${day}`);
  };

  // Submit Activity Logs
  const saveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          date: selectedDate,
          type: "activity",
          data: {
            steps: inputSteps,
            activeMinutes: inputActiveMinutes,
            caloriesBurned: inputCaloriesBurned,
          },
        }),
      });
      if (res.ok) {
        showToast("Activity targets updated!", "success");
        fetchDailyData(selectedUser.id, selectedDate);
        fetchLeaderboard();
      }
    } catch (e) {
      showToast("Failed to save activity", "error");
    }
  };

  // Submit Food Logs
  const saveFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          date: selectedDate,
          type: "food",
          data: {
            foodLog: inputFoodLog,
            caloriesConsumed: inputCaloriesConsumed,
            proteinConsumed: inputProteinConsumed,
            carbsConsumed: inputCarbsConsumed,
            fatConsumed: inputFatConsumed,
          },
        }),
      });
      if (res.ok) {
        showToast("Nutrition log updated!", "success");
        fetchDailyData(selectedUser.id, selectedDate);
      }
    } catch (e) {
      showToast("Failed to save food", "error");
    }
  };

  // Add Manual Workout
  const addWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          date: selectedDate,
          type: "workout",
          data: {
            title: workoutTitle,
            workoutType,
            duration: workoutDuration,
            distance: workoutDistance || undefined,
            avgHeartRate: workoutHeartRate || undefined,
            calories: workoutCalories || undefined,
          },
        }),
      });
      if (res.ok) {
        showToast("Workout logged successfully!", "success");
        setWorkoutTitle("");
        setWorkoutDistance("");
        setWorkoutHeartRate("");
        setWorkoutCalories("");
        fetchDailyData(selectedUser.id, selectedDate);
        fetchLeaderboard();
      }
    } catch (e) {
      showToast("Failed to save workout", "error");
    }
  };

  // Delete Workout
  const deleteWorkout = async (id: string) => {
    if (!selectedUser) return;
    try {
      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          date: selectedDate,
          type: "workout_delete",
          data: { id },
        }),
      });
      if (res.ok) {
        showToast("Workout deleted", "info");
        fetchDailyData(selectedUser.id, selectedDate);
        fetchLeaderboard();
      }
    } catch (e) {
      showToast("Failed to delete workout", "error");
    }
  };

  // Sync Strava
  const syncStrava = async () => {
    if (!selectedUser) return;
    try {
      setSyncingStrava(true);
      const res = await fetch("/api/strava/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          date: selectedDate,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.source === "simulator") {
          showToast(`Synced mock workout: ${data.workout.title}!`, "success");
        } else {
          showToast(`Synced ${data.workoutsSyncedCount} workouts from Strava!`, "success");
        }
        fetchDailyData(selectedUser.id, selectedDate);
        fetchLeaderboard();
      } else {
        showToast(data.error || "Strava sync failed", "error");
      }
    } catch (e) {
      showToast("Failed to sync Strava", "error");
    } finally {
      setSyncingStrava(false);
    }
  };

  // Update Targets settings
  const saveTargets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: updateName,
          targetCalories,
          targetActiveMinutes,
          targetSteps,
        }),
      });
      if (res.ok) {
        showToast("User goals updated successfully!", "success");
        fetchUsers();
      }
    } catch (e) {
      showToast("Failed to update user goals", "error");
    }
  };

  // Register New User
  const registerNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail) return;
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`User ${data.name} added!`, "success");
        setNewUserName("");
        setNewUserEmail("");
        setShowAddUser(false);
        fetchUsers();
      } else {
        showToast(data.error || "Failed to register user", "error");
      }
    } catch (e) {
      showToast("Server error registering user", "error");
    }
  };

  // Connect Strava handler (redirect helper)
  const connectStrava = () => {
    if (!selectedUser) return;
    window.location.href = `/api/strava/auth?userId=${selectedUser.id}`;
  };

  return (
    <div className={styles.page}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          backgroundColor: toast.type === "success" ? "var(--primary)" : toast.type === "error" ? "var(--danger)" : "var(--secondary)",
          color: toast.type === "success" ? "#022c22" : "#fff",
          padding: "10px 20px",
          borderRadius: "8px",
          boxShadow: "var(--shadow-lg)",
          zIndex: 999,
          fontWeight: 600,
          animation: "fadeIn 0.2s ease",
          fontSize: "0.9rem"
        }}>
          {toast.message}
        </div>
      )}

      {/* Header bar */}
      <header className={styles.header}>
        <div className={styles.headerContainer}>
          <div className={styles.logoArea}>
            <span className={styles.logoIcon}>⚡</span>
            <span className={styles.logoText}>PONGAL BOYS FITNESS</span>
          </div>

          <div className={styles.userSelectorArea}>
            {usersLoading ? (
              <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Loading competitors...</span>
            ) : (
              <>
                <select
                  className={styles.selectInput}
                  value={selectedUser?.id || ""}
                  onChange={(e) => {
                    const user = users.find((u) => u.id === e.target.value);
                    if (user) {
                      setSelectedUser(user);
                      setUpdateName(user.name);
                      setTargetCalories(user.targetCalories);
                      setTargetActiveMinutes(user.targetActiveMinutes);
                      setTargetSteps(user.targetSteps);
                    }
                  }}
                >
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
                <button
                  className={`${styles.btn} ${styles.btnSecondary} ${styles.registerBtn}`}
                  onClick={() => setShowAddUser(!showAddUser)}
                >
                  + Add User
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="container">
        {/* New User Modal (Inline Toggle) */}
        {showAddUser && (
          <div className={`${styles.card} fade-in`} style={{ marginBottom: "1.5rem", border: "1px solid var(--primary)" }}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Register New Challenger</h3>
              <button className={`${styles.btn} ${styles.btnSecondary}`} style={{ padding: "0.25rem 0.5rem" }} onClick={() => setShowAddUser(false)}>Close</button>
            </div>
            <form onSubmit={registerNewUser} style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <div className={styles.formGroup} style={{ flex: 1, minWidth: "200px" }}>
                <label className={styles.formLabel}>Name</label>
                <input
                  type="text"
                  className={styles.inputField}
                  required
                  placeholder="John Doe"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                />
              </div>
              <div className={styles.formGroup} style={{ flex: 1, minWidth: "200px" }}>
                <label className={styles.formLabel}>Email</label>
                <input
                  type="email"
                  className={styles.inputField}
                  required
                  placeholder="john@example.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: "1rem" }}>
                <button type="submit" className={styles.btn}>Register User</button>
              </div>
            </form>
          </div>
        )}

        {/* Date Selector */}
        <div className={styles.dateBar}>
          <button className={styles.dateBtn} onClick={() => changeDate(-1)}>◀</button>
          <span className={styles.dateDisplay}>
            {selectedDate === new Date().toLocaleDateString("en-CA") ? "Today 📅" : selectedDate}
          </span>
          <button className={styles.dateBtn} onClick={() => changeDate(1)}>▶</button>
        </div>

        {/* Layout Grid */}
        <div className={styles.mainGrid}>
          
          {/* Column 1: The Leaderboard */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>🏆 Weekly Standings</h2>
              {weekRange.start && (
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  {weekRange.start} to {weekRange.end}
                </span>
              )}
            </div>

            <div className={styles.leaderboardList}>
              {leaderboardData.length === 0 ? (
                <div className={styles.emptyState}>No rankings available yet.</div>
              ) : (
                leaderboardData.map((player, index) => (
                  <div
                    key={player.userId}
                    className={`${styles.leaderboardRow} ${selectedUser?.id === player.userId ? styles.leaderboardRowActive : ""}`}
                  >
                    <div className={styles.rankInfo}>
                      <div className={`${styles.rankBadge} ${
                        index === 0 ? styles.rank1 : index === 1 ? styles.rank2 : index === 2 ? styles.rank3 : styles.rankDefault
                      }`}>
                        {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                      </div>
                      <div>
                        <div className={styles.userName}>{player.name}</div>
                        <div className={styles.userSubStats}>
                          👟 {player.stats.avgSteps.toLocaleString()} steps/day | ⏱️ {player.stats.avgActiveMinutes} min/day
                        </div>
                      </div>
                    </div>
                    <div className={styles.userScoreArea}>
                      <div className={styles.userTotalScore}>{player.totalScore} pts</div>
                      <div className={styles.userTotalScoreLabel}>this week</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column 2: Log & Status Panel */}
          <div className={styles.logPanel}>
            
            {/* 1. Daily Score / Evaluation Card */}
            {dailyScore ? (
              <div className={`${styles.roastCard} fade-in`}>
                <div className={styles.scoreRow}>
                  <div>
                    <h3 className={styles.scoreDateLabel}>AI Evaluation Score</h3>
                    <div className={styles.scoreDisplay}>
                      {dailyScore.score}
                      <span className={styles.scoreMax}>/100</span>
                    </div>
                  </div>
                  <span style={{ fontSize: "1.75rem" }}>🤖</span>
                </div>
                
                <div className={styles.roastBox}>
                  <strong>🤖 AI Daily Summary: </strong> "{dailyScore.socialMessage}"
                </div>

                <div className={styles.rationaleBox}>
                  <strong>Rationale:</strong> {dailyScore.rationale}
                </div>
              </div>
            ) : (
              <div className={styles.pendingBox}>
                <span className={styles.pendingIcon}>⏳</span>
                <strong>Awaiting AI Evaluation</strong>
                <span style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
                  The local AI Agent calculates scores nightly. Complete your logs below!
                </span>
              </div>
            )}

            {/* User Logging Card */}
            <div className={styles.card}>
              <div className={styles.tabs}>
                <button
                  className={`${styles.tab} ${activeTab === "activity" ? styles.tabActive : ""}`}
                  onClick={() => setActiveTab("activity")}
                >
                  🏃 Activity & Workouts
                </button>
                <button
                  className={`${styles.tab} ${activeTab === "food" ? styles.tabActive : ""}`}
                  onClick={() => setActiveTab("food")}
                >
                  🥗 Food Logging
                </button>
                <button
                  className={`${styles.tab} ${activeTab === "settings" ? styles.tabActive : ""}`}
                  onClick={() => setActiveTab("settings")}
                >
                  ⚙️ Goals & Settings
                </button>
              </div>

              {selectedUser ? (
                <div>
                  
                  {/* Tab 1: Activity & Workouts */}
                  {activeTab === "activity" && (
                    <div className="fade-in">
                      {/* Active Targets Summary */}
                      <div className={styles.targetsSummary}>
                        <div className={styles.targetItem}>
                          <div className={styles.targetVal}>{dailyLog?.steps.toLocaleString() ?? 0}</div>
                          <div className={styles.targetLabel}>Steps (Goal: {selectedUser.targetSteps.toLocaleString()})</div>
                        </div>
                        <div className={styles.targetItem}>
                          <div className={styles.targetVal}>{dailyLog?.activeMinutes ?? 0} min</div>
                          <div className={styles.targetLabel}>Active (Goal: {selectedUser.targetActiveMinutes})</div>
                        </div>
                        <div className={styles.targetItem}>
                          <div className={styles.targetVal}>{dailyLog?.caloriesBurned ?? 0} kcal</div>
                          <div className={styles.targetLabel}>Burned</div>
                        </div>
                      </div>

                      {/* Manual Activity Log Form */}
                      <form onSubmit={saveActivity} style={{ marginBottom: "1.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "1.5rem" }}>
                        <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "var(--muted)", marginBottom: "0.75rem" }}>Log Daily Steps & Active Minutes</h4>
                        <div className={styles.formGrid}>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Steps Count</label>
                            <input
                              type="number"
                              className={styles.inputField}
                              value={inputSteps}
                              onChange={(e) => setInputSteps(parseInt(e.target.value, 10) || 0)}
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Active Minutes</label>
                            <input
                              type="number"
                              className={styles.inputField}
                              value={inputActiveMinutes}
                              onChange={(e) => setInputActiveMinutes(parseInt(e.target.value, 10) || 0)}
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Calories Burned</label>
                            <input
                              type="number"
                              className={styles.inputField}
                              value={inputCaloriesBurned}
                              onChange={(e) => setInputCaloriesBurned(parseInt(e.target.value, 10) || 0)}
                            />
                          </div>
                        </div>
                        <button type="submit" className={styles.btn}>Save Daily Activity</button>
                      </form>

                      {/* Workouts Section */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                          <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "var(--muted)" }}>Today's Workouts</h4>
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnSync}`}
                            style={{ padding: "0.375rem 0.75rem", fontSize: "0.75rem" }}
                            onClick={syncStrava}
                            disabled={syncingStrava}
                          >
                            {syncingStrava ? "Syncing..." : "🔄 Sync Strava"}
                          </button>
                        </div>

                        {workouts.length === 0 ? (
                          <div className={styles.emptyState}>No workouts logged for this date. Run Strava sync or add one manually.</div>
                        ) : (
                          <div className={styles.workoutList}>
                            {workouts.map((w) => (
                              <div key={w.id} className={styles.workoutItem}>
                                <div className={styles.workoutDetails}>
                                  <span className={styles.workoutTitle}>{w.title} ({w.type})</span>
                                  <span className={styles.workoutMeta}>
                                    ⏱️ {w.duration} min | {w.distance > 0 ? `📏 ${(w.distance / 1000).toFixed(1)} km |` : ""} 🔥 {w.calories ?? "N/A"} kcal ({w.source})
                                  </span>
                                </div>
                                <button
                                  className={`${styles.btn} ${styles.btnDanger}`}
                                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                                  onClick={() => deleteWorkout(w.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add Manual Workout Subform */}
                        <form onSubmit={addWorkout} style={{ marginTop: "1.5rem", padding: "1rem", background: "rgba(0,0,0,0.15)", borderRadius: "8px" }}>
                          <h5 style={{ fontSize: "0.8rem", color: "var(--foreground)", marginBottom: "0.75rem" }}>Add Workout Manually</h5>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Workout Title</label>
                            <input
                              type="text"
                              required
                              className={styles.inputField}
                              placeholder="Evening weightlifting session"
                              value={workoutTitle}
                              onChange={(e) => setWorkoutTitle(e.target.value)}
                            />
                          </div>
                          <div className={styles.formGrid}>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Type</label>
                              <select
                                className={styles.selectInput}
                                value={workoutType}
                                onChange={(e) => setWorkoutType(e.target.value)}
                              >
                                <option value="Run">Run</option>
                                <option value="Ride">Ride</option>
                                <option value="WeightTraining">Weight Training</option>
                                <option value="Swim">Swim</option>
                                <option value="Walk">Walk</option>
                                <option value="Yoga">Yoga</option>
                                <option value="Workout">General Workout</option>
                              </select>
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Duration (mins)</label>
                              <input
                                type="number"
                                required
                                className={styles.inputField}
                                value={workoutDuration}
                                onChange={(e) => setWorkoutDuration(parseInt(e.target.value, 10) || 0)}
                              />
                            </div>
                          </div>
                          <div className={styles.formGrid}>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Distance (meters)</label>
                              <input
                                type="number"
                                className={styles.inputField}
                                placeholder="Optional"
                                value={workoutDistance}
                                onChange={(e) => setWorkoutDistance(e.target.value)}
                              />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Est. Calories</label>
                              <input
                                type="number"
                                className={styles.inputField}
                                placeholder="Optional"
                                value={workoutCalories}
                                onChange={(e) => setWorkoutCalories(e.target.value)}
                              />
                            </div>
                          </div>
                          <button type="submit" className={`${styles.btn} ${styles.btnSecondary}`}>Add Workout</button>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Food Logging */}
                  {activeTab === "food" && (
                    <div className="fade-in">
                      <div className={styles.targetsSummary} style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                        <div className={styles.targetItem}>
                          <div className={styles.targetVal}>{dailyLog?.caloriesConsumed ?? 0} kcal</div>
                          <div className={styles.targetLabel}>Eaten (Goal: {selectedUser.targetCalories})</div>
                        </div>
                        <div className={styles.targetItem}>
                          <div className={styles.targetVal}>{dailyLog?.proteinConsumed ?? 0}g</div>
                          <div className={styles.targetLabel}>Protein</div>
                        </div>
                        <div className={styles.targetItem}>
                          <div className={styles.targetVal}>{dailyLog?.carbsConsumed ?? 0}g</div>
                          <div className={styles.targetLabel}>Carbs</div>
                        </div>
                        <div className={styles.targetItem}>
                          <div className={styles.targetVal}>{dailyLog?.fatConsumed ?? 0}g</div>
                          <div className={styles.targetLabel}>Fat</div>
                        </div>
                      </div>

                      <form onSubmit={saveFood}>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Meal Log details</label>
                          <textarea
                            className={`${styles.inputField} ${styles.textareaField}`}
                            placeholder="Describe what you ate today (e.g. Breakfast: eggs and toast, Lunch: chicken salad...)"
                            value={inputFoodLog}
                            onChange={(e) => setInputFoodLog(e.target.value)}
                          />
                        </div>

                        <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "var(--muted)", marginBottom: "0.75rem" }}>Caloric & Macronutrient Breakdown</h4>
                        <div className={styles.formGrid}>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Calories (kcal)</label>
                            <input
                              type="number"
                              className={styles.inputField}
                              value={inputCaloriesConsumed}
                              onChange={(e) => setInputCaloriesConsumed(parseInt(e.target.value, 10) || 0)}
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Protein (g)</label>
                            <input
                              type="number"
                              className={styles.inputField}
                              value={inputProteinConsumed}
                              onChange={(e) => setInputProteinConsumed(parseInt(e.target.value, 10) || 0)}
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Carbs (g)</label>
                            <input
                              type="number"
                              className={styles.inputField}
                              value={inputCarbsConsumed}
                              onChange={(e) => setInputCarbsConsumed(parseInt(e.target.value, 10) || 0)}
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Fat (g)</label>
                            <input
                              type="number"
                              className={styles.inputField}
                              value={inputFatConsumed}
                              onChange={(e) => setInputFatConsumed(parseInt(e.target.value, 10) || 0)}
                            />
                          </div>
                        </div>

                        <button type="submit" className={styles.btn}>Save Food Log</button>
                      </form>
                    </div>
                  )}

                  {/* Tab 3: Goals & Settings */}
                  {activeTab === "settings" && (
                    <div className="fade-in">
                      <form onSubmit={saveTargets} style={{ marginBottom: "1.5rem" }}>
                        <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "var(--muted)", marginBottom: "0.75rem" }}>Update Personal Fitness Goals</h4>
                        
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Display Name</label>
                          <input
                            type="text"
                            required
                            className={styles.inputField}
                            value={updateName}
                            onChange={(e) => setUpdateName(e.target.value)}
                          />
                        </div>

                        <div className={styles.formGrid}>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Step Goal</label>
                            <input
                              type="number"
                              className={styles.inputField}
                              value={targetSteps}
                              onChange={(e) => setTargetSteps(parseInt(e.target.value, 10) || 0)}
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Active Minutes Goal</label>
                            <input
                              type="number"
                              className={styles.inputField}
                              value={targetActiveMinutes}
                              onChange={(e) => setTargetActiveMinutes(parseInt(e.target.value, 10) || 0)}
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Calorie Goal</label>
                            <input
                              type="number"
                              className={styles.inputField}
                              value={targetCalories}
                              onChange={(e) => setTargetCalories(parseInt(e.target.value, 10) || 0)}
                            />
                          </div>
                        </div>

                        <button type="submit" className={styles.btn}>Update Goals</button>
                      </form>

                      {/* Strava Connection settings */}
                      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "1.5rem" }}>
                        <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "var(--muted)", marginBottom: "0.75rem" }}>Strava Integration</h4>
                        <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "1rem" }}>
                          Connect your account to auto-sync workouts. If client keys are not set up in the `.env` file, this will connect a simulated mock tracker profile for testing.
                        </p>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnSync}`}
                          onClick={connectStrava}
                        >
                          {selectedUser.stravaAccessToken ? "🔄 Reconnect Strava" : "🧡 Connect Strava"}
                        </button>
                        {selectedUser.stravaAccessToken && (
                          <span style={{ fontSize: "0.8rem", color: "var(--primary)", marginLeft: "1rem", fontWeight: 500 }}>
                            ✓ Integrated
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <div className={styles.emptyState}>Please select or create a competitor first.</div>
              )}
            </div>

          </div>

        </div>
      </main>
      
      <footer style={{ marginTop: "auto", borderTop: "1px solid rgba(255,255,255,0.03)", padding: "1.5rem 0", color: "var(--muted)", fontSize: "0.85rem", textAlign: "center" }}>
        Pongal Boys Fitness • Built for local hosting & distributed fun 🚀
      </footer>
    </div>
  );
}
