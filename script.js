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
const errorMsg    = document.getElementById('errorMsg');
const resultSec   = document.getElementById('resultSection');

// ===== EVENT LISTENERS =====
searchBtn.addEventListener('click', handleSearch);
input.addEventListener('keydown', e => { if (e.key === 'Enter') handleSearch(); });

// ===== MAIN HANDLER =====
async function handleSearch() {
  const username = input.value.trim();
  if (!username) {
    showError('กรุณาใส่ Username ก่อนนะ!');
    return;
  }

  setLoading(true);
  hideError();
  resultSec.classList.add('hidden');

  try {
    const userId = await getUserId(username);
    if (!userId) {
      showError(`ไม่พบผู้เล่นชื่อ "${username}" — กรุณาตรวจสอบการสะกด`);
      return;
    }

    const [userInfo, avatarUrl, friends, followers, following] = await Promise.all([
      fetchUserInfo(userId),
      fetchAvatar(userId),
      fetchCount(API.friends(userId)),
      fetchCount(API.followers(userId)),
      fetchCount(API.following(userId)),
    ]);

    renderResult(userInfo, avatarUrl, friends, followers, following);

  } catch (err) {
    console.error(err);
    showError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
  } finally {
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
function renderResult(user, avatarUrl, friends, followers, following) {
  // Avatar
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

  // Banned status
  const status = document.getElementById('onlineStatus');
  if (user.isBanned) {
    status.className = 'avatar-status offline';
    status.title = 'ถูกแบน';
  } else {
    status.className = 'avatar-status online';
    status.title = 'ปกติ';
  }

  // Profile link
  document.getElementById('profileLink').href = `https://www.roblox.com/users/${user.id}/profile`;

  resultSec.classList.remove('hidden');
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