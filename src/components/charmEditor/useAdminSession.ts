import { useEffect, useState } from 'react';

export function useAdminSession() {
  const [ownerMode, setOwnerMode] = useState(false);

  useEffect(() => {
    fetch('/api/admin/session')
      .then(r => r.json())
      .then(data => setOwnerMode(!!data.authenticated))
      .catch(() => {});
  }, []);

  const login = async () => {
    const password = window.prompt('Enter password:');
    if (!password) return;
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setOwnerMode(true);
      } else {
        alert('Wrong password');
      }
    } catch {
      alert('Login failed. Please try again.');
    }
  };

  return { ownerMode, login };
}
