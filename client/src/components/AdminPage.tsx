import { useEffect, useState } from 'react';
import { ThemeProvider } from './theme-provider';
import { AdminLogin } from './AdminLogin';
import { AdminDashboard } from './AdminDashboard';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing token in localStorage
    const savedToken = localStorage.getItem('adminToken');
    if (savedToken) {
      // Verify token is still valid
      fetch(`${API_URL}/api/admin/status`, {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
        .then(res => {
          if (res.ok) {
            setToken(savedToken);
          } else {
            localStorage.removeItem('adminToken');
          }
        })
        .catch(() => {
          localStorage.removeItem('adminToken');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('adminToken');
  };

  if (loading) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <div className="h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border border-primary border-t-transparent mx-auto mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      {!token ? (
        <div className="h-screen flex items-center justify-center bg-background">
          <div className="w-full max-w-sm">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold">CodeRunner Admin</h1>
              <p className="text-muted-foreground mt-2">Access the admin dashboard</p>
            </div>
            <AdminLogin
              isOpen={!token}
              onLoginSuccess={setToken}
              apiUrl={API_URL}
            />
          </div>
        </div>
      ) : (
        <AdminDashboard token={token} apiUrl={API_URL} onLogout={handleLogout} />
      )}
    </ThemeProvider>
  );
}
