import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import "./App.css";

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "";
const ADMIN_PASSWORD = "yuj88433";

let socket;

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");
  const [page, setPage] = useState("login"); // login | signup | lobby | chat
  const [username, setUsername] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [roomUsers, setRoomUsers] = useState([]);
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [ttsEnabled, setTtsEnabled] = useState(() => localStorage.getItem("tts") === "true");
  const [loginForm, setLoginForm] = useState({ username: "", password: "", adminPw: "" });
  const [signupForm, setSignupForm] = useState({ username: "", password: "", confirm: "" });
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("tts", ttsEnabled);
  }, [ttsEnabled]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const speak = useCallback((text) => {
    if (!ttsEnabled) return;
    const clean = text.replace(/[🎋🏮]/g, "");
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = "ja-JP";
    utter.rate = 1.0;
    window.speechSynthesis.speak(utter);
  }, [ttsEnabled]);

  const initSocket = useCallback((user, admin) => {
    socket = io(SERVER_URL || window.location.origin, { transports: ["websocket"] });

    socket.on("room_list", (list) => setRooms(list));
    socket.on("message_history", (msgs) => setMessages(msgs));
    socket.on("new_message", (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (!msg.isSystem) speak(`${msg.username}: ${msg.text}`);
      else if (msg.isOmikuji) speak(msg.text);
    });
    socket.on("room_users", (users) => setRoomUsers(users));
    socket.on("room_created", ({ id, name }) => {
      joinRoom({ id, name });
    });
    socket.on("kicked", ({ days }) => {
      alert(`あなたは${days}日間KICKされました`);
      setPage("login");
      setCurrentRoom(null);
      setMessages([]);
      socket.disconnect();
    });
    socket.on("banned", () => {
      alert("あなたはBANされました");
      setPage("login");
      setCurrentRoom(null);
      setMessages([]);
      socket.disconnect();
    });

    fetch(`${SERVER_URL}/api/rooms`)
      .then((r) => r.json())
      .then((list) => setRooms(list))
      .catch(() => {});
  }, [speak]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { username: u, password: p, adminPw } = loginForm;
    const admin = adminPw === ADMIN_PASSWORD;

    try {
      const res = await fetch(`${SERVER_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setLoading(false); return; }
      setUsername(u);
      setIsAdmin(admin);
      initSocket(u, admin);
      setPage("lobby");
    } catch {
      setError("サーバーに接続できません");
    }
    setLoading(false);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    const { username: u, password: p, confirm } = signupForm;
    if (p !== confirm) { setError("パスワードが一致しません"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setLoading(false); return; }
      setError("");
      alert("登録完了！ログインしてください");
      setPage("login");
    } catch {
      setError("サーバーに接続できません");
    }
    setLoading(false);
  };

  const joinRoom = (room) => {
    setCurrentRoom(room);
    setMessages([]);
    socket.emit("join_room", { username, roomId: room.id });
    setPage("chat");
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    socket.emit("send_message", { text: inputText.trim(), roomId: currentRoom.id, isAdmin });
    setInputText("");
    inputRef.current?.focus();
  };

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    socket.emit("create_room", { name: newRoomName.trim(), username });
    setNewRoomName("");
    setShowCreateRoom(false);
  };

  const logout = () => {
    socket?.disconnect();
    setPage("login");
    setUsername("");
    setIsAdmin(false);
    setCurrentRoom(null);
    setMessages([]);
    setRooms([]);
    setLoginForm({ username: "", password: "", adminPw: "" });
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  };

  // ---- PAGES ----

  if (page === "login") return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="logo">
          <span className="logo-icon">🏮</span>
          <h1>Nakayosi Chat</h1>
          <p className="logo-sub">なかよしチャット</p>
        </div>
        <form onSubmit={handleLogin} className="auth-form">
          <div className="field-group">
            <label>ユーザー名</label>
            <input type="text" placeholder="名前を入力" value={loginForm.username}
              onChange={e => setLoginForm(f => ({...f, username: e.target.value}))} required />
          </div>
          <div className="field-group">
            <label>パスワード</label>
            <input type="password" placeholder="パスワードを入力" value={loginForm.password}
              onChange={e => setLoginForm(f => ({...f, password: e.target.value}))} required />
          </div>
          <div className="field-group">
            <label>管理者パスワード <span className="optional">(任意)</span></label>
            <input type="password" placeholder="管理者の場合のみ入力" value={loginForm.adminPw}
              onChange={e => setLoginForm(f => ({...f, adminPw: e.target.value}))} />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>
        <p className="auth-switch">
          アカウントをお持ちでない方は
          <button className="link-btn" onClick={() => { setPage("signup"); setError(""); }}>新規登録</button>
        </p>
        <button className="theme-btn" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}>
          {theme === "dark" ? "☀️ ライトモード" : "🌙 ダークモード"}
        </button>
      </div>
    </div>
  );

  if (page === "signup") return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="logo">
          <span className="logo-icon">🏮</span>
          <h1>新規登録</h1>
          <p className="logo-sub">アカウントを作成</p>
        </div>
        <form onSubmit={handleSignup} className="auth-form">
          <div className="field-group">
            <label>ユーザー名 <span className="optional">(2〜20文字)</span></label>
            <input type="text" placeholder="名前を入力" value={signupForm.username}
              onChange={e => setSignupForm(f => ({...f, username: e.target.value}))} required />
          </div>
          <div className="field-group">
            <label>パスワード <span className="optional">(4文字以上)</span></label>
            <input type="password" placeholder="パスワードを入力" value={signupForm.password}
              onChange={e => setSignupForm(f => ({...f, password: e.target.value}))} required />
          </div>
          <div className="field-group">
            <label>パスワード確認</label>
            <input type="password" placeholder="もう一度入力" value={signupForm.confirm}
              onChange={e => setSignupForm(f => ({...f, confirm: e.target.value}))} required />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "登録中..." : "登録する"}
          </button>
        </form>
        <p className="auth-switch">
          すでにアカウントをお持ちの方は
          <button className="link-btn" onClick={() => { setPage("login"); setError(""); }}>ログイン</button>
        </p>
      </div>
    </div>
  );

  if (page === "lobby") return (
    <div className="lobby-bg">
      <header className="lobby-header">
        <div className="lobby-title">
          <span className="logo-icon-sm">🏮</span>
          <span>Nakayosi Chat</span>
        </div>
        <div className="lobby-header-right">
          <span className="user-badge">{isAdmin && <span className="admin-star">★</span>}{username}</span>
          <button className="icon-btn" title="設定" onClick={() => setShowSettings(true)}>⚙</button>
          <button className="icon-btn" title="ログアウト" onClick={logout}>🚪</button>
        </div>
      </header>

      <div className="lobby-body">
        <div className="lobby-top">
          <h2 className="section-title">チャットルーム一覧</h2>
          <button className="btn-create" onClick={() => setShowCreateRoom(true)}>＋ 部屋を作る</button>
        </div>

        <div className="room-grid">
          {rooms.map(room => (
            <div className="room-card" key={room.id} onClick={() => joinRoom(room)}>
              <div className="room-card-header">
                <span className="room-name">{room.name}</span>
                <span className="room-online">● {room.onlineCount}</span>
              </div>
              <div className="room-card-footer">
                <span className="room-by">作成者: {room.createdBy}</span>
                <span className="room-msgs">{room.messageCount} メッセージ</span>
              </div>
            </div>
          ))}
          {rooms.length === 0 && <p className="empty-state">部屋がありません</p>}
        </div>
      </div>

      {showCreateRoom && (
        <div className="modal-overlay" onClick={() => setShowCreateRoom(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>新しい部屋を作る</h3>
            <form onSubmit={handleCreateRoom}>
              <input type="text" placeholder="部屋の名前" value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)} autoFocus required />
              <div className="modal-btns">
                <button type="button" className="btn-cancel" onClick={() => setShowCreateRoom(false)}>キャンセル</button>
                <button type="submit" className="btn-primary">作成</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>⚙ 設定</h3>
            <div className="settings-row">
              <span>テーマ</span>
              <div className="toggle-group">
                <button className={`toggle-btn ${theme === "light" ? "active" : ""}`} onClick={() => setTheme("light")}>☀️ ライト</button>
                <button className={`toggle-btn ${theme === "dark" ? "active" : ""}`} onClick={() => setTheme("dark")}>🌙 ダーク</button>
              </div>
            </div>
            <div className="settings-row">
              <span>読み上げ</span>
              <button className={`toggle-pill ${ttsEnabled ? "on" : "off"}`} onClick={() => setTtsEnabled(v => !v)}>
                {ttsEnabled ? "ON" : "OFF"}
              </button>
            </div>
            <button className="btn-primary" style={{marginTop: "1rem"}} onClick={() => setShowSettings(false)}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  );

  if (page === "chat") return (
    <div className="chat-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="logo-icon-sm">🏮</span>
          <span className="sidebar-title">Nakayosi</span>
          <button className="icon-btn" onClick={() => setShowSettings(true)}>⚙</button>
        </div>
        <div className="sidebar-user">
          {isAdmin && <span className="admin-badge">管理者</span>}
          <span className="sidebar-username">{username}</span>
          <button className="link-btn small" onClick={() => { setPage("lobby"); setCurrentRoom(null); }}>ロビーへ</button>
        </div>
        <div className="sidebar-room-info">
          <div className="room-name-header">#{currentRoom?.name}</div>
        </div>
        <div className="sidebar-users-section">
          <div className="sidebar-section-label">オンライン ({roomUsers.length})</div>
          <ul className="user-list">
            {roomUsers.map(u => (
              <li key={u} className="user-item">
                <span className="online-dot"></span>
                {u}
              </li>
            ))}
          </ul>
        </div>
        <div className="sidebar-help">
          <div className="sidebar-section-label">コマンド</div>
          <div className="cmd-list">
            <div className="cmd">/おみくじ</div>
            <div className="cmd">/help</div>
            {isAdmin && <>
              <div className="cmd">/kick [名前] [日数]</div>
              <div className="cmd">/ban [名前]</div>
              <div className="cmd">/unban [名前]</div>
              <div className="cmd">/unkick [名前]</div>
            </>}
          </div>
        </div>
        <button className="logout-btn" onClick={logout}>🚪 ログアウト</button>
      </aside>

      <main className="chat-main">
        <div className="chat-header">
          <span className="chat-room-name">#{currentRoom?.name}</span>
          <div className="chat-header-actions">
            <button className={`tts-btn ${ttsEnabled ? "on" : ""}`} onClick={() => setTtsEnabled(v => !v)}
              title={ttsEnabled ? "読み上げON (クリックでOFF)" : "読み上げOFF (クリックでON)"}>
              {ttsEnabled ? "🔊 読み上げON" : "🔇 読み上げOFF"}
            </button>
          </div>
        </div>

        <div className="messages-area">
          {messages.map(msg => (
            <div key={msg.id} className={`message ${msg.isSystem ? "system-msg" : ""} ${msg.isOmikuji ? "omikuji-msg" : ""} ${msg.username === username ? "own-msg" : ""}`}>
              {!msg.isSystem && (
                <div className="msg-header">
                  <span className="msg-username">{msg.username}</span>
                  <span className="msg-time">{formatTime(msg.timestamp)}</span>
                </div>
              )}
              <div className="msg-bubble">
                {msg.isSystem && <span className="msg-time-inline">{formatTime(msg.timestamp)}</span>}
                <span className="msg-text">{msg.text}</span>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input-area" onSubmit={handleSend}>
          <input
            ref={inputRef}
            type="text"
            className="chat-input"
            placeholder={`#${currentRoom?.name} にメッセージを送る... (/help でコマンド確認)`}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            autoFocus
          />
          <button type="submit" className="send-btn" disabled={!inputText.trim()}>送信</button>
        </form>
      </main>

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>⚙ 設定</h3>
            <div className="settings-row">
              <span>テーマ</span>
              <div className="toggle-group">
                <button className={`toggle-btn ${theme === "light" ? "active" : ""}`} onClick={() => setTheme("light")}>☀️ ライト</button>
                <button className={`toggle-btn ${theme === "dark" ? "active" : ""}`} onClick={() => setTheme("dark")}>🌙 ダーク</button>
              </div>
            </div>
            <div className="settings-row">
              <span>読み上げ</span>
              <button className={`toggle-pill ${ttsEnabled ? "on" : "off"}`} onClick={() => setTtsEnabled(v => !v)}>
                {ttsEnabled ? "ON" : "OFF"}
              </button>
            </div>
            <button className="btn-primary" style={{marginTop: "1rem"}} onClick={() => setShowSettings(false)}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  );

  return null;
}

export default App;
