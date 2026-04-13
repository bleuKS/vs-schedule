import { useState } from 'react';

const ADMIN_PW = import.meta.env.VITE_ADMIN_PASSWORD || 'vibeseoul2026';
const VIEWER_PW = import.meta.env.VITE_VIEWER_PASSWORD || 'schedule2026';

export function checkAuth() {
  const saved = sessionStorage.getItem('vibeseoul-auth');
  if (saved === 'admin') return 'admin';
  if (saved === 'viewer') return 'viewer';
  return null;
}

export function logout() {
  sessionStorage.removeItem('vibeseoul-auth');
}

export default function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === ADMIN_PW) {
      sessionStorage.setItem('vibeseoul-auth', 'admin');
      onLogin('admin');
    } else if (password === VIEWER_PW) {
      sessionStorage.setItem('vibeseoul-auth', 'viewer');
      onLogin('viewer');
    } else {
      setError('비밀번호가 올바르지 않습니다.');
    }
  };

  return (
    <div className="login-screen">
      <div className="login-box">
        <h1>바이브서울</h1>
        <h2>스케줄 관리</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            placeholder="비밀번호 입력"
            autoFocus
          />
          <button type="submit">로그인</button>
        </form>
        {error && <p className="login-error">{error}</p>}
        <p className="login-hint">관리자 또는 뷰어 비밀번호를 입력하세요</p>
      </div>
    </div>
  );
}
