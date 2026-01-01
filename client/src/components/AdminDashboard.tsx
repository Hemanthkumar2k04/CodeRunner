import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { AlertCircle, RefreshCw, LogOut, Server, Users, Box } from 'lucide-react';

interface Container {
  id: string;
  image: string;
  status: string;
}

interface AdminStatus {
  containers: Container[];
  poolStatus: Record<string, number>;
  totalWarmContainers: number;
  activeContainers: number;
  connectedClients: number;
  timestamp: number;
}

interface AdminDashboardProps {
  token: string;
  apiUrl: string;
  onLogout: () => void;
}

export function AdminDashboard({ token, apiUrl, onLogout }: AdminDashboardProps) {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${apiUrl}/api/admin/status`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 401) {
          onLogout();
          return;
        }
        throw new Error('Failed to fetch status');
      }

      const data = await response.json();
      setStatus(data);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [token]);

  const getStatusColor = (status: string) => {
    if (status.includes('Up')) return 'bg-green-100 text-green-800';
    if (status.includes('Exited')) return 'bg-red-100 text-red-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const getLanguageFromImage = (image: string): string => {
    const match = image.match(/(\w+)-runtime/);
    return match ? match[1].toUpperCase() : image;
  };

  // Group containers by language
  const groupedContainers = status?.containers.reduce((acc, container) => {
    const lang = getLanguageFromImage(container.image);
    if (!acc[lang]) acc[lang] = [];
    acc[lang].push(container);
    return acc;
  }, {} as Record<string, Container[]>) || {};

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              System Status & Container Management
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Refresh Button and Last Updated */}
          <div className="flex items-center justify-between">
            <Button 
              onClick={fetchStatus} 
              disabled={loading} 
              variant="outline" 
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>

          {status && (
            <>
              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Connected Clients Card */}
                <div className="bg-card border rounded-lg p-6">
                  <div className="flex items-center gap-3">
                    <Users className="h-8 w-8 text-blue-600" />
                    <div>
                      <h2 className="text-sm font-medium text-muted-foreground">
                        Connected Clients
                      </h2>
                      <p className="text-3xl font-bold mt-1">
                        {status.connectedClients}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Warm Containers (Total in Pool) */}
                <div className="bg-card border rounded-lg p-6">
                  <div className="flex items-center gap-3">
                    <Server className="h-8 w-8 text-purple-600" />
                    <div>
                      <h2 className="text-sm font-medium text-muted-foreground">
                        Warm Containers
                      </h2>
                      <p className="text-3xl font-bold mt-1">
                        {status.totalWarmContainers}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Active Containers (Currently Executing) */}
                <div className="bg-card border rounded-lg p-6">
                  <div className="flex items-center gap-3">
                    <Box className="h-8 w-8 text-green-600" />
                    <div>
                      <h2 className="text-sm font-medium text-muted-foreground">
                        Active Containers
                      </h2>
                      <p className="text-3xl font-bold mt-1">
                        {status.activeContainers}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Container Pools
                </h2>
                
                {status.containers.length === 0 ? (
                  <div className="text-center py-12 border rounded-lg bg-card/50 border-dashed">
                    <p className="text-muted-foreground">No containers running</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(groupedContainers).map(([lang, containers]) => (
                      <Dialog key={lang}>
                        <DialogTrigger asChild>
                          <div className="bg-card border rounded-lg p-6 cursor-pointer hover:bg-accent/50 transition-all hover:shadow-md group">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="font-bold text-lg">{lang}</h3>
                              <Badge variant="secondary" className="text-sm px-2 py-0.5">
                                {containers.length}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                              <span>Active: {containers.filter(c => c.status.includes('Up')).length}</span>
                              <span className="group-hover:text-primary transition-colors">View Details →</span>
                            </div>
                          </div>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-xl">
                              <Badge variant="outline" className="text-lg py-1">{lang}</Badge>
                              Container Pool
                            </DialogTitle>
                          </DialogHeader>
                          
                          <div className="flex-1 overflow-y-auto pr-2 mt-4">
                            <div className="space-y-3">
                              {containers.map((container) => (
                                <div
                                  key={container.id}
                                  className="flex items-center justify-between p-4 border rounded-lg bg-card/50 hover:bg-accent/20 transition-colors"
                                >
                                  <div className="flex-1 min-w-0 mr-4">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-mono text-sm font-medium truncate select-all">
                                        {container.id}
                                      </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground font-mono">
                                      {container.image}
                                    </p>
                                  </div>
                                  <Badge className={`flex-shrink-0 ${getStatusColor(container.status)}`}>
                                    {container.status}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {loading && !status && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
