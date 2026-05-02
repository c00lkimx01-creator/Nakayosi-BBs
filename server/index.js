const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// Static client build (for production)
app.use(express.static(path.join(__dirname, "../client/build")));

const ADMIN_PASSWORD = "yuj88433";

// In-memory data stores
const users = {}; // { username: { passwordHash, createdAt } }
const rooms = {}; // { roomId: { name, createdBy, createdAt, messages: [] } }
const onlineUsers = {}; // { socketId: { username, roomId } }
const kickedUsers = {}; // { username: { until: timestamp } }
const bannedUsers = new Set(); // Set of usernames

// Default room
rooms["general"] = {
  id: "general",
  name: "一般",
  createdBy: "システム",
  createdAt: new Date(),
  messages: [
    {
      id: uuidv4(),
      username: "システム",
      text: "Nakayosi Chatへようこそ！",
      timestamp: new Date(),
      isSystem: true,
    },
  ],
};

// Helper: get online count per room
function getRoomOnlineCount(roomId) {
  return Object.values(onlineUsers).filter((u) => u.roomId === roomId).length;
}

// Helper: broadcast room list
function broadcastRoomList() {
  const roomList = Object.values(rooms).map((r) => ({
    id: r.id,
    name: r.name,
    createdBy: r.createdBy,
    onlineCount: getRoomOnlineCount(r.id),
    messageCount: r.messages.length,
  }));
  io.emit("room_list", roomList);
}

// Helper: broadcast user list in room
function broadcastRoomUsers(roomId) {
  const users = Object.values(onlineUsers)
    .filter((u) => u.roomId === roomId)
    .map((u) => u.username);
  io.to(roomId).emit("room_users", users);
}

// Omikuji results
const omikujiResults = [
  { result: "大吉", desc: "素晴らしい運勢です！何事も上手くいくでしょう。" },
  { result: "中吉", desc: "良い運勢です。積極的に行動しましょう。" },
  { result: "小吉", desc: "まずまずの運勢。油断せず丁寧に過ごしましょう。" },
  { result: "吉", desc: "普通の運勢。コツコツと努力が実を結びます。" },
  { result: "末吉", desc: "運気は上向き。焦らずじっくり取り組みましょう。" },
  { result: "凶", desc: "少し注意が必要。慎重に行動してください。" },
  { result: "大凶", desc: "今日は慎重に。でも、明日はきっと良くなります！" },
];

// Auth endpoints
app.post("/api/signup", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "名前とパスワードが必要です" });
  if (username.length < 2 || username.length > 20)
    return res.status(400).json({ error: "名前は2〜20文字にしてください" });
  if (password.length < 4)
    return res.status(400).json({ error: "パスワードは4文字以上にしてください" });
  if (users[username])
    return res.status(400).json({ error: "この名前はすでに使われています" });
  if (bannedUsers.has(username))
    return res.status(403).json({ error: "このアカウントはBANされています" });

  const passwordHash = await bcrypt.hash(password, 10);
  users[username] = { passwordHash, createdAt: new Date() };
  res.json({ success: true, message: "登録完了！" });
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!users[username])
    return res.status(401).json({ error: "ユーザーが見つかりません" });
  if (bannedUsers.has(username))
    return res.status(403).json({ error: "このアカウントはBANされています" });

  // Check kick
  if (kickedUsers[username]) {
    const now = Date.now();
    if (kickedUsers[username].until > now) {
      const remaining = Math.ceil((kickedUsers[username].until - now) / 86400000);
      return res.status(403).json({ error: `あなたは${remaining}日間KICKされています` });
    } else {
      delete kickedUsers[username];
    }
  }

  const valid = await bcrypt.compare(password, users[username].passwordHash);
  if (!valid) return res.status(401).json({ error: "パスワードが違います" });

  res.json({ success: true, username });
});

app.get("/api/rooms", (req, res) => {
  const roomList = Object.values(rooms).map((r) => ({
    id: r.id,
    name: r.name,
    createdBy: r.createdBy,
    onlineCount: getRoomOnlineCount(r.id),
    messageCount: r.messages.length,
  }));
  res.json(roomList);
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/build", "index.html"));
});

// Socket.io
io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // Join room
  socket.on("join_room", ({ username, roomId }) => {
    if (!rooms[roomId]) {
      socket.emit("error_msg", "部屋が存在しません");
      return;
    }
    if (kickedUsers[username] && kickedUsers[username].until > Date.now()) {
      socket.emit("error_msg", "あなたはKICKされています");
      return;
    }

    // Leave previous room
    const prev = onlineUsers[socket.id];
    if (prev && prev.roomId) {
      socket.leave(prev.roomId);
      broadcastRoomUsers(prev.roomId);
    }

    socket.join(roomId);
    onlineUsers[socket.id] = { username, roomId };

    // Send history
    socket.emit("message_history", rooms[roomId].messages.slice(-50));

    // Notify room
    const sysMsg = {
      id: uuidv4(),
      username: "システム",
      text: `${username} が入室しました`,
      timestamp: new Date(),
      isSystem: true,
    };
    rooms[roomId].messages.push(sysMsg);
    io.to(roomId).emit("new_message", sysMsg);

    broadcastRoomUsers(roomId);
    broadcastRoomList();
  });

  // Send message
  socket.on("send_message", ({ text, roomId, isAdmin }) => {
    const user = onlineUsers[socket.id];
    if (!user) return;

    const username = user.username;

    // Admin commands
    if (text.startsWith("/")) {
      const parts = text.trim().split(/\s+/);
      const cmd = parts[0].toLowerCase();

      // Omikuji (anyone can use)
      if (cmd === "/おみくじ") {
        const pick = omikujiResults[Math.floor(Math.random() * omikujiResults.length)];
        const msg = {
          id: uuidv4(),
          username: "おみくじ",
          text: `🎋 ${username} のおみくじ結果：【${pick.result}】\n${pick.desc}`,
          timestamp: new Date(),
          isSystem: true,
          isOmikuji: true,
        };
        rooms[roomId].messages.push(msg);
        io.to(roomId).emit("new_message", msg);
        return;
      }

      // Admin commands
      if (!isAdmin) {
        const errMsg = {
          id: uuidv4(),
          username: "システム",
          text: "管理者権限が必要なコマンドです",
          timestamp: new Date(),
          isSystem: true,
        };
        socket.emit("new_message", errMsg);
        return;
      }

      if (cmd === "/kick") {
        const target = parts[1];
        const days = parseInt(parts[2]) || 1;
        if (!target) {
          socket.emit("new_message", { id: uuidv4(), username: "システム", text: "使い方: /kick ユーザー名 日数", timestamp: new Date(), isSystem: true });
          return;
        }
        if (!users[target]) {
          socket.emit("new_message", { id: uuidv4(), username: "システム", text: `ユーザー「${target}」は存在しません`, timestamp: new Date(), isSystem: true });
          return;
        }
        kickedUsers[target] = { until: Date.now() + days * 86400000 };
        // Disconnect target if online
        for (const [sid, u] of Object.entries(onlineUsers)) {
          if (u.username === target) {
            io.to(sid).emit("kicked", { days });
            io.sockets.sockets.get(sid)?.disconnect();
            delete onlineUsers[sid];
          }
        }
        const sysMsg = { id: uuidv4(), username: "システム", text: `${target} を ${days}日間KICKしました`, timestamp: new Date(), isSystem: true };
        rooms[roomId].messages.push(sysMsg);
        io.to(roomId).emit("new_message", sysMsg);
        broadcastRoomUsers(roomId);
        return;
      }

      if (cmd === "/ban") {
        const target = parts[1];
        if (!target) {
          socket.emit("new_message", { id: uuidv4(), username: "システム", text: "使い方: /ban ユーザー名", timestamp: new Date(), isSystem: true });
          return;
        }
        bannedUsers.add(target);
        for (const [sid, u] of Object.entries(onlineUsers)) {
          if (u.username === target) {
            io.to(sid).emit("banned");
            io.sockets.sockets.get(sid)?.disconnect();
            delete onlineUsers[sid];
          }
        }
        const sysMsg = { id: uuidv4(), username: "システム", text: `${target} をBANしました`, timestamp: new Date(), isSystem: true };
        rooms[roomId].messages.push(sysMsg);
        io.to(roomId).emit("new_message", sysMsg);
        broadcastRoomUsers(roomId);
        return;
      }

      if (cmd === "/unban") {
        const target = parts[1];
        bannedUsers.delete(target);
        const sysMsg = { id: uuidv4(), username: "システム", text: `${target} のBANを解除しました`, timestamp: new Date(), isSystem: true };
        rooms[roomId].messages.push(sysMsg);
        io.to(roomId).emit("new_message", sysMsg);
        return;
      }

      if (cmd === "/unkick") {
        const target = parts[1];
        delete kickedUsers[target];
        const sysMsg = { id: uuidv4(), username: "システム", text: `${target} のKICKを解除しました`, timestamp: new Date(), isSystem: true };
        rooms[roomId].messages.push(sysMsg);
        io.to(roomId).emit("new_message", sysMsg);
        return;
      }

      if (cmd === "/users") {
        const list = Object.values(onlineUsers).filter(u => u.roomId === roomId).map(u => u.username).join(", ");
        socket.emit("new_message", { id: uuidv4(), username: "システム", text: `オンラインユーザー: ${list}`, timestamp: new Date(), isSystem: true });
        return;
      }

      if (cmd === "/help") {
        const help = isAdmin
          ? "管理者コマンド:\n/kick ユーザー名 日数 - KICKする\n/ban ユーザー名 - BANする\n/unban ユーザー名 - BAN解除\n/unkick ユーザー名 - KICK解除\n/users - オンラインユーザー一覧\n一般:\n/おみくじ - おみくじを引く"
          : "コマンド一覧:\n/おみくじ - おみくじを引く\n/help - ヘルプ";
        socket.emit("new_message", { id: uuidv4(), username: "システム", text: help, timestamp: new Date(), isSystem: true });
        return;
      }

      socket.emit("new_message", { id: uuidv4(), username: "システム", text: "不明なコマンドです。/help でコマンド一覧を確認してください", timestamp: new Date(), isSystem: true });
      return;
    }

    const msg = {
      id: uuidv4(),
      username,
      text,
      timestamp: new Date(),
      isSystem: false,
    };
    rooms[roomId].messages.push(msg);
    if (rooms[roomId].messages.length > 200) rooms[roomId].messages.shift();
    io.to(roomId).emit("new_message", msg);
  });

  // Create room
  socket.on("create_room", ({ name, username }) => {
    if (!name || name.trim().length === 0) return;
    const id = uuidv4().slice(0, 8);
    rooms[id] = {
      id,
      name: name.trim(),
      createdBy: username,
      createdAt: new Date(),
      messages: [
        {
          id: uuidv4(),
          username: "システム",
          text: `部屋「${name.trim()}」が作成されました`,
          timestamp: new Date(),
          isSystem: true,
        },
      ],
    };
    broadcastRoomList();
    socket.emit("room_created", { id, name: name.trim() });
  });

  socket.on("disconnect", () => {
    const user = onlineUsers[socket.id];
    if (user) {
      const { username, roomId } = user;
      delete onlineUsers[socket.id];
      if (rooms[roomId]) {
        const sysMsg = {
          id: uuidv4(),
          username: "システム",
          text: `${username} が退室しました`,
          timestamp: new Date(),
          isSystem: true,
        };
        rooms[roomId].messages.push(sysMsg);
        io.to(roomId).emit("new_message", sysMsg);
        broadcastRoomUsers(roomId);
      }
      broadcastRoomList();
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Nakayosi Chat server running on port ${PORT}`);
});
