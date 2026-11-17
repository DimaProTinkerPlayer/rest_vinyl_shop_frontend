const API_BASE_URL = 'http://127.0.0.1:8000';

// 1. Робота з токенами в localStorage
function getAccessToken() {
    return localStorage.getItem('access_token');
}

function getRefreshToken() {
    return localStorage.getItem('refresh_token');
}

function saveTokens(access, refresh) {
    localStorage.setItem('access_token', access);
    if (refresh) {
        localStorage.setItem('refresh_token', refresh);
    }
}

function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.href = 'login.html';
}

// 2. Оновлення access токена через refresh токен
async function refreshAccessToken() {
    const refresh = getRefreshToken();
    if (!refresh) return false;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh }),
        });

        if (!response.ok) {
            return false;
        }

        const data = await response.json();
        saveTokens(data.access, null);
        return true;
    } catch {
        return false;
    }
}

// 3. Обгортка над fetch з автоматичним підставлянням токена та перехопленням 401
async function authFetch(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };

    const token = getAccessToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    let response = await fetch(url, { ...options, headers });

    // Якщо access токен прострочений (401) — пробуємо оновити його через refresh
    if (response.status === 401 && getRefreshToken()) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            headers['Authorization'] = `Bearer ${getAccessToken()}`;
            response = await fetch(url, { ...options, headers });
        } else {
            logout();
        }
    }

    return response;
}

// 4. Отримання профілю поточного користувача
async function fetchCurrentUser() {
    if (!getAccessToken()) return null;

    const response = await authFetch('/auth/me');
    if (!response.ok) return null;
    return await response.json();
}

// 5. Захист маршрутів (Route Guards)
async function requireAuth() {
    const user = await fetchCurrentUser();
    if (!user) {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        window.location.href = `login.html?next=${encodeURIComponent(currentPage)}`;
        return null;
    }
    return user;
}

async function requireGuest() {
    const user = await fetchCurrentUser();
    if (user) {
        window.location.href = 'index.html';
    }
}

// 6. Рендер навігаційної панелі (Navbar)
async function renderNavbar() {
    const navEl = document.getElementById('navbar');
    if (!navEl) return;

    const user = await fetchCurrentUser();

    if (user) {
        navEl.innerHTML = `
            <div class="nav-links">
                <a href="index.html">Каталог</a>
                <a href="manage.html">Керування магазином</a>
            </div>
            <div class="nav-user">
                <span>Привіт, <strong>${user.username}</strong> (${user.role})</span>
                <button id="logout-btn" class="btn-logout">Вийти</button>
            </div>
        `;
        document.getElementById('logout-btn').addEventListener('click', logout);
    } else {
        navEl.innerHTML = `
            <div class="nav-links">
                <a href="index.html">Каталог</a>
            </div>
            <div class="nav-user">
                <a href="login.html" class="btn-link">Увійти</a>
                <a href="register.html" class="btn-primary">Реєстрація</a>
            </div>
        `;
    }
}