'use strict';
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { newGame, applyMove, sanitize } = require('./game');
const { chooseComMove } = require('./com');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/** rooms: Map<roomId, {id, players:[{token}], phase, game, updated}> */
const rooms = new Map();
const ROOM_TTL = 1000 * 60 * 60 * 12; // 12時間

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newRoomId() {
  let id;
  do {
    id = Array.from({ length: 6 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join('');
  } while (rooms.has(id));
  return id;
}

function getRoom(req, res) {
  const room = rooms.get(String(req.params.id || '').toUpperCase());
  if (!room) { res.status(404).json({ error: '部屋が見つかりません' }); return null; }
  room.updated = Date.now();
  return room;
}

function seatOf(room, token) {
  if (!token) return -1;
  return room.players.findIndex(p => p.token === token);
}

function comSeatOf(room) {
  return room.players.findIndex(p => p.isCom);
}

// COMの手番なら、少し間を置いてから着手させる(考えている演出も兼ねる)
function scheduleComTurn(room) {
  const comSeat = comSeatOf(room);
  if (comSeat < 0) return;
  const step = () => {
    if (!rooms.has(room.id)) return;
    if (!room.game || room.game.winner != null || room.game.turn !== comSeat) return;
    const names = ['プレイヤー1', 'COM'];
    const move = chooseComMove(room.game, comSeat);
    applyMove(room.game, comSeat, move, names);
    room.updated = Date.now();
    if (room.game.winner != null) { room.phase = 'finished'; return; }
    setTimeout(step, 500 + Math.floor(Math.random() * 700));
  };
  setTimeout(step, 500 + Math.floor(Math.random() * 700));
}

app.post('/api/rooms', (req, res) => {
  const id = newRoomId();
  const token = crypto.randomBytes(16).toString('hex');
  const players = [{ token }];
  if (req.body && req.body.vsCom) players.push({ token: null, isCom: true });
  rooms.set(id, { id, players, phase: 'waiting', game: null, updated: Date.now() });
  res.json({ roomId: id, token, seat: 0 });
});

app.post('/api/rooms/:id/join', (req, res) => {
  const room = getRoom(req, res); if (!room) return;
  const existing = seatOf(room, req.body && req.body.token);
  if (existing >= 0) return res.json({ roomId: room.id, token: room.players[existing].token, seat: existing });
  if (room.players.length >= 2) return res.status(403).json({ error: 'この部屋は満員です' });
  const token = crypto.randomBytes(16).toString('hex');
  room.players.push({ token });
  res.json({ roomId: room.id, token, seat: 1 });
});

app.post('/api/rooms/:id/start', (req, res) => {
  const room = getRoom(req, res); if (!room) return;
  const seat = seatOf(room, req.body && req.body.token);
  if (seat < 0) return res.status(403).json({ error: 'この部屋の参加者ではありません' });
  if (room.players.length < 2) return res.status(400).json({ error: '対戦相手がまだ参加していません' });
  if (room.phase === 'playing') return res.status(400).json({ error: 'すでに開始しています' });
  room.game = newGame();
  room.phase = 'playing';
  scheduleComTurn(room);
  res.json({ ok: true });
});

app.get('/api/rooms/:id/state', (req, res) => {
  const room = getRoom(req, res); if (!room) return;
  const seat = seatOf(room, req.query.token);
  if (seat < 0) return res.status(403).json({ error: 'この部屋の参加者ではありません' });
  const base = { roomId: room.id, phase: room.phase, seat, playerCount: room.players.length };
  if (!room.game) return res.json(base);
  res.json({ ...base, game: sanitize(room.game, seat) });
});

app.post('/api/rooms/:id/move', (req, res) => {
  const room = getRoom(req, res); if (!room) return;
  const seat = seatOf(room, req.body && req.body.token);
  if (seat < 0) return res.status(403).json({ error: 'この部屋の参加者ではありません' });
  if (room.phase !== 'playing' || !room.game) return res.status(400).json({ error: 'ゲームが開始されていません' });
  const names = comSeatOf(room) >= 0 ? ['プレイヤー1', 'COM'] : ['プレイヤー1', 'プレイヤー2'];
  const result = applyMove(room.game, seat, req.body.move || {}, names);
  if (result.error) return res.status(400).json({ error: result.error });
  if (room.game.winner != null) room.phase = 'finished';
  else scheduleComTurn(room);
  res.json({ ok: true, game: sanitize(room.game, seat) });
});

// SPA ルーティング
app.get(['/', '/room/:id'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 古い部屋の掃除
setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms) if (now - room.updated > ROOM_TTL) rooms.delete(id);
}, 1000 * 60 * 10);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Battle Line server: http://localhost:${PORT}`));
