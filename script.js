// ===== ROBLOX USER CHECKER =====
// ใช้ Roblox Public API (ไม่ต้องการ API Key)

const PROXY = 'https://corsproxy.io/?';

const API = {
  searchUser: 'https://users.roblox.com/v1/usernames/users',
  getUser:    id => `https://users.roblox.com/v1/users/${id}`,
  avatar:     id => `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png`,
  friends:    id => `https://friends.roblox.com/v1/users/${id}/friends/count`,
  followers:  id => `https://friends.roblox.com/v1/users/${id}/followers/count`,
  following:  id => `https://friends.roblox.com/v1/users/${id}/followings/count`,
  presence:   'https://presence.roblox.com/v1/presence/users',
};

// ===== DOM ELEMENTS =====
const input       = document.getElementById('usernameInput');
const searchBtn   = document.getElementById('searchBtn');
const btnText     = searchBtn.querySelector('.btn-text');
const btnLoader   = searchBtn.querySelector('.btn-loader');
const clearBtn    = document.getElementById('clearBtn');
const errorMsg    = document.getElementById('errorMsg');
const resultSec   = document.getElementById('resultSection');
const recentSearches = document.getElementById('recentSearches');
const recentList = document.getElementById('recentList');
const savedSection = document.getElementById('savedSection');
const savedList = document.getElementById('savedList');
const clearAllBtn = document.getElementById('clearAllBtn');

// Storage keys
const STORAGE_KEY_RECENT = 'rbx_recent_searches';
const STORAGE_KEY_FAVORITES = 'rbx_favorites';

// Search state
let isSearching = false;

// ===== EVENT LISTENERS =====
searchBtn.addEventListener('click', handleSearch);
input.addEventListener('keydown', e => { if (e.key === 'Enter') handleSearch(); });
input.addEventListener('input', updateRecentSearchUI);
clearBtn.addEventListener('click', handleClear);
clearAllBtn.addEventListener('click', clearAllFavorites);

// ===== MAIN HANDLER =====
async function handleSearch() {
  const username = input.value.trim();
  if (!username) {
    showError('กรุณาใส่ Username ก่อนนะ!');
    return;
  }

  // ป้องกัน multiple requests
  if (isSearching) {
    showError('รีบเกินไป กรุณารอสักครู่...');
    return;
  }

  isSearching = true;
  setLoading(true);
  hideError();
  resultSec.classList.add('hidden');

  try {
    const userId = await getUserId(username);
    if (!userId) {
      showError(`ไม่พบผู้เล่นชื่อ "${username}" — กรุณาตรวจสอบการสะกด`);
      return;
    }

    const [userInfo, avatarUrl, friends, followers, following, presenceType] = await Promise.all([
      fetchUserInfo(userId),
      fetchAvatar(userId),
      fetchCount(API.friends(userId)),
      fetchCount(API.followers(userId)),
      fetchCount(API.following(userId)),
      fetchPresence(userId),
    ]);

    renderResult(userInfo, avatarUrl, friends, followers, following, presenceType);

  } catch (err) {
    console.error(err);
    showError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
  } finally {
    isSearching = false;
    setLoading(false);
  }
}

// ===== API FUNCTIONS =====
async function getUserId(username) {
  const res = await fetchWithProxy(API.searchUser, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
  });
  const data = await res.json();
  return data?.data?.[0]?.id ?? null;
}

async function fetchUserInfo(userId) {
  const res = await fetchWithProxy(API.getUser(userId));
  return await res.json();
}

async function fetchAvatar(userId) {
  try {
    const res = await fetchWithProxy(API.avatar(userId));
    const data = await res.json();
    return data?.data?.[0]?.imageUrl ?? '';
  } catch {
    return '';
  }
}

async function fetchPresence(userId) {
  // userPresenceType: 0=Offline, 1=Online, 2=InGame, 3=InStudio
  try {
    const res = await fetchWithProxy(API.presence, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: [userId] }),
    });
    const data = await res.json();
    return data?.userPresences?.[0]?.userPresenceType ?? 0;
  } catch {
    return 0;
  }
}

async function fetchCount(url) {
  try {
    const res = await fetchWithProxy(url);
    const data = await res.json();
    return data?.count ?? data?.total ?? '—';
  } catch {
    return '—';
  }
}

async function fetchWithProxy(url, options = {}) {
  // ลองเรียกตรงก่อน ถ้าล้มเหลว ใช้ proxy
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error('direct failed');
    return res;
  } catch {
    return fetch(PROXY + encodeURIComponent(url), options);
  }
}

// ===== RENDER =====
function renderResult(user, avatarUrl, friends, followers, following, presenceType = 0) {
  // Headshot avatar
  const avatarImg = document.getElementById('avatarImg');
  if (avatarUrl) {
    avatarImg.src = avatarUrl;
    avatarImg.onerror = () => { avatarImg.src = ''; };
  } else {
    avatarImg.src = '';
  }

  // Names
  document.getElementById('displayName').textContent = user.displayName || user.name;
  document.getElementById('username').textContent = '@' + user.name;

  // Badges
  const verifiedBadge = document.getElementById('verifiedBadge');
  const premiumBadge  = document.getElementById('premiumBadge');
  verifiedBadge.classList.toggle('hidden', !user.hasVerifiedBadge);
  premiumBadge.classList.toggle('hidden', !(user.isPremium ?? false));

  // Stats
  document.getElementById('userId').textContent       = user.id;
  document.getElementById('friendCount').textContent   = formatNum(friends);
  document.getElementById('followerCount').textContent = formatNum(followers);
  document.getElementById('followingCount').textContent= formatNum(following);

  // Bio
  const bio = (user.description || '').trim();
  document.getElementById('bioText').textContent = bio || '(ไม่มีคำอธิบาย)';

  // Created date
  const createdDate = user.created ? formatDate(user.created) : '—';
  document.getElementById('createdDate').textContent = createdDate;

  // Status dot — ใช้ข้อมูล Presence จริง
  const status = document.getElementById('onlineStatus');
  if (user.isBanned) {
    status.className = 'avatar-status banned';
    status.title = 'ถูกแบน';
  } else {
    // 0=Offline, 1=Online, 2=InGame, 3=InStudio
    const map = {
      0: { cls: 'offline', label: 'ออฟไลน์' },
      1: { cls: 'online',  label: 'ออนไลน์' },
      2: { cls: 'ingame',  label: 'กำลังเล่น' },
      3: { cls: 'ingame',  label: 'กำลังสร้าง' },
    };
    const s = map[presenceType] ?? map[0];
    status.className = 'avatar-status ' + s.cls;
    status.title = s.label;
  }

  // Profile link
  document.getElementById('profileLink').href = `https://www.roblox.com/users/${user.id}/profile`;

  // Topbar strip ID
  const stripId = document.getElementById('stripId');
  if (stripId) stripId.textContent = 'ID: ' + user.id;

  // Favorite button
  const favBtn = document.getElementById('favoriteBtn');
  if (favBtn) {
    const isFav = isFavorited(user.id);
    updateFavoriteButton(user.id, isFav);
    favBtn.onclick = () => {
      if (isFav) {
        removeFavorite(user.id);
      } else {
        saveFavorite(user, avatarUrl);
      }
    };
  }

  resultSec.classList.remove('hidden');
  clearBtn.classList.remove('hidden');
  addRecentSearch(user.name);
  updateRecentSearchUI();
}

// ===== HELPERS =====
function formatNum(n) {
  if (n === '—' || n === undefined || n === null) return '—';
  return Number(n).toLocaleString('th-TH');
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function setLoading(state) {
  searchBtn.disabled = state;
  btnText.classList.toggle('hidden', state);
  btnLoader.classList.toggle('hidden', !state);
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
}

function hideError() {
  errorMsg.classList.add('hidden');
}

// ===== CLEAR FUNCTION =====
function handleClear() {
  input.value = '';
  resultSec.classList.add('hidden');
  clearBtn.classList.add('hidden');
  recentSearches.classList.add('hidden');
  isSearching = false;
  hideError();
  input.focus();
}

// ===== RECENT SEARCHES =====
function addRecentSearch(username) {
  let recent = JSON.parse(localStorage.getItem(STORAGE_KEY_RECENT) || '[]');
  recent = recent.filter(u => u.toLowerCase() !== username.toLowerCase());
  recent.unshift(username);
  recent = recent.slice(0, 10);
  localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(recent));
}

function updateRecentSearchUI() {
  const value = input.value.trim().toLowerCase();
  
  // ถ้า input ว่าง → ซ่อน recent searches
  if (!value) {
    recentSearches.classList.add('hidden');
    return;
  }
  
  let recent = JSON.parse(localStorage.getItem(STORAGE_KEY_RECENT) || '[]');
  const filtered = recent.filter(u => u.toLowerCase().includes(value));
  
  if (filtered.length === 0) {
    recentSearches.classList.add('hidden');
    return;
  }
  
  recentList.innerHTML = filtered.map(username => `
    <div class="recent-item" onclick="selectRecentSearch('${username}')">
      <span>${username}</span>
      <button class="recent-item-remove" onclick="removeRecentSearch('${username}', event)">×</button>
    </div>
  `).join('');
  
  recentSearches.classList.remove('hidden');
}

function selectRecentSearch(username) {
  input.value = username;
  recentSearches.classList.add('hidden');
  handleSearch();
}

function removeRecentSearch(username, event) {
  event.stopPropagation();
  let recent = JSON.parse(localStorage.getItem(STORAGE_KEY_RECENT) || '[]');
  recent = recent.filter(u => u !== username);
  localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(recent));
  updateRecentSearchUI();
}

// ===== FAVORITES =====
function saveFavorite(user, avatarUrl) {
  let favorites = JSON.parse(localStorage.getItem(STORAGE_KEY_FAVORITES) || '{}');
  favorites[user.id] = {
    id: user.id,
    name: user.name,
    displayName: user.displayName || user.name,
    avatarUrl: avatarUrl
  };
  localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(favorites));
  updateFavoriteButton(user.id, true);
  renderFavorites();
}

function removeFavorite(userId) {
  let favorites = JSON.parse(localStorage.getItem(STORAGE_KEY_FAVORITES) || '{}');
  delete favorites[userId];
  localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(favorites));
  updateFavoriteButton(userId, false);
  renderFavorites();
}

function isFavorited(userId) {
  let favorites = JSON.parse(localStorage.getItem(STORAGE_KEY_FAVORITES) || '{}');
  return !!favorites[userId];
}

function updateFavoriteButton(userId, isFav) {
  const favBtn = document.getElementById('favoriteBtn');
  if (!favBtn) return;
  if (isFav) {
    favBtn.classList.add('favorited');
  } else {
    favBtn.classList.remove('favorited');
  }
}

function renderFavorites() {
  let favorites = JSON.parse(localStorage.getItem(STORAGE_KEY_FAVORITES) || '{}');
  const favArray = Object.values(favorites);
  
  if (favArray.length === 0) {
    savedSection.classList.add('hidden');
    return;
  }
  
  savedSection.classList.remove('hidden');
  savedList.innerHTML = favArray.map(fav => `
    <div class="saved-card" onclick="searchPlayerById('${fav.name}')">
      <button class="saved-remove" onclick="removeFavoriteCard(${fav.id}, event)">×</button>
      <img src="${fav.avatarUrl}" alt="${fav.name}" class="saved-avatar" onerror="this.src=''">
      <div class="saved-name">${fav.displayName}</div>
      <div class="saved-username">@${fav.name}</div>
    </div>
  `).join('');
}

function removeFavoriteCard(userId, event) {
  event.stopPropagation();
  removeFavorite(userId);
}

function searchPlayerById(username) {
  input.value = username;
  handleSearch();
}

function clearAllFavorites() {
  if (confirm('ต้องการลบผู้เล่นที่บันทึกทั้งหมดหรือไม่?')) {
    localStorage.setItem(STORAGE_KEY_FAVORITES, '{}');
    renderFavorites();
  }
}

// ===== COPY ID =====
document.getElementById('copyIdBtn').addEventListener('click', () => {
  const id = document.getElementById('userId').textContent;
  if (!id) return;
  navigator.clipboard.writeText(id).then(() => {
    const copyIcon = document.getElementById('copyIcon');
    const checkIcon = document.getElementById('checkIcon');
    copyIcon.classList.add('hidden');
    checkIcon.classList.remove('hidden');
    setTimeout(() => {
      copyIcon.classList.remove('hidden');
      checkIcon.classList.add('hidden');
    }, 1800);
  });
});

// ===== DRAGGABLE AVATAR — REMOVED =====

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  renderFavorites();
});