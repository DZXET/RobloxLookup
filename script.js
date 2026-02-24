// ===== ROBLOX USER CHECKER =====
// !! เปลี่ยน WORKER_URL เป็น URL ของ Cloudflare Worker คุณ !!
const WORKER_URL = 'https://dzxet.tueftyk.workers.dev';

// ===== DOM =====
const input     = document.getElementById('usernameInput');
const searchBtn = document.getElementById('searchBtn');
const btnText   = searchBtn.querySelector('.btn-text');
const btnLoader = searchBtn.querySelector('.btn-loader');
const errorMsg  = document.getElementById('errorMsg');
const resultSec = document.getElementById('resultSection');

searchBtn.addEventListener('click', handleSearch);
input.addEventListener('keydown', e => { if (e.key === 'Enter') handleSearch(); });

// ===== FETCH ผ่าน Worker =====
async function api(url) {
  const res = await fetch(WORKER_URL + '?url=' + encodeURIComponent(url));
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res;
}
async function getJSON(url) { return (await api(url)).json(); }
async function getText(url) { return (await api(url)).text(); }

// ===== MAIN =====
async function handleSearch() {
  const username = input.value.trim();
  if (!username) { showError('กรุณาใส่ Username ก่อนนะ!'); return; }

  setLoading(true);
  hideError();
  resultSec.classList.add('hidden');

  try {
    const userData = await getJSON(
      'https://api.roblox.com/users/get-by-username?username=' + encodeURIComponent(username)
    );

    if (!userData || userData.errorMessage || !userData.Id) {
      showError('ไม่พบผู้เล่นชื่อ "' + username + '" — อาจสะกดผิด หรือบัญชีถูกลบไปแล้ว');
      return;
    }

    const id = userData.Id;

    const [userInfo, avatarUrl, friends, followers, following, isPremium] = await Promise.all([
      getJSON('https://users.roblox.com/v1/users/' + id),
      getAvatar(id),
      getStat('https://friends.roblox.com/v1/users/' + id + '/friends/count'),
      getStat('https://friends.roblox.com/v1/users/' + id + '/followers/count'),
      getStat('https://friends.roblox.com/v1/users/' + id + '/followings/count'),
      getPremium(id),
    ]);

    render(userInfo, avatarUrl, friends, followers, following, isPremium);

  } catch (err) {
    console.error(err);
    showError('เชื่อมต่อ API ไม่ได้ กรุณาลองใหม่');
  } finally {
    setLoading(false);
  }
}

// ===== API HELPERS =====
async function getAvatar(id) {
  try {
    const data = await getJSON(
      'https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=' + id + '&size=150x150&format=Png'
    );
    return data?.data?.[0]?.imageUrl ?? '';
  } catch { return ''; }
}

async function getStat(url) {
  try {
    const data = await getJSON(url);
    return data?.count ?? data?.total ?? '—';
  } catch { return '—'; }
}

async function getPremium(id) {
  try {
    const text = await getText(
      'https://premiumfeatures.roblox.com/v1/users/' + id + '/validate-membership'
    );
    return text.trim() === 'true';
  } catch { return false; }
}

// ===== RENDER =====
function render(user, avatarUrl, friends, followers, following, isPremium) {
  const img = document.getElementById('avatarImg');
  img.src = avatarUrl || '';
  img.onerror = function() { this.src = ''; };

  document.getElementById('displayName').textContent = user.displayName || user.name;
  document.getElementById('username').textContent    = '@' + user.name;

  document.getElementById('verifiedBadge').classList.toggle('hidden', !user.hasVerifiedBadge);
  document.getElementById('premiumBadge').classList.toggle('hidden', !isPremium);
  document.getElementById('bannedBadge').classList.toggle('hidden', !user.isBanned);

  const isDeleted = (user.name || '').toLowerCase().includes('deleted') || user.isDeleted === true;
  document.getElementById('deletedBadge').classList.toggle('hidden', !isDeleted);

  document.getElementById('userId').textContent         = user.id;
  document.getElementById('friendCount').textContent    = fmt(friends);
  document.getElementById('followerCount').textContent  = fmt(followers);
  document.getElementById('followingCount').textContent = fmt(following);

  document.getElementById('bioText').textContent =
    (user.description || '').trim() || '(ไม่มีคำอธิบาย)';
  document.getElementById('createdDate').textContent =
    user.created ? fmtDate(user.created) : '—';

  const dot = document.getElementById('onlineStatus');
  dot.className = 'avatar-status ' + (user.isBanned ? 'offline' : 'online');
  dot.title     = user.isBanned ? 'ถูกแบน' : 'บัญชีปกติ';

  document.getElementById('profileLink').href =
    'https://www.roblox.com/users/' + user.id + '/profile';

  resultSec.classList.remove('hidden');
}

// ===== UTILS =====
function fmt(n) {
  if (n === '—' || n == null) return '—';
  return Number(n).toLocaleString('th-TH');
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('th-TH', {
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
