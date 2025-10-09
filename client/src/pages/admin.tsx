import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Users, DollarSign, Calendar, AlertCircle, TrendingUp, Send } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function AdminDashboard() {
  const { toast } = useToast();
  const [broadcastMessage, setBroadcastMessage] = useState("");

  const { data: metrics, isLoading: metricsLoading } = useQuery<any>({
    queryKey: ['/api/admin/metrics'],
    refetchInterval: 30000,
  });

  const { data: earningsTrend } = useQuery<any[]>({
    queryKey: ['/api/admin/earnings-trend?period=week'],
  });

  const { data: topTutors } = useQuery<any[]>({
    queryKey: ['/api/admin/top-tutors'],
  });

  const broadcastMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest('POST', '/api/admin/broadcast', { message });
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Broadcast sent!",
        description: `Sent to ${data.sent} users. ${data.failed > 0 ? `Failed: ${data.failed}` : ''}`,
      });
      setBroadcastMessage("");
    },
    onError: () => {
      toast({
        title: "Broadcast failed",
        description: "Failed to send broadcast message",
        variant: "destructive",
      });
    },
  });

  if (metricsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-admin-title">Admin Dashboard</h1>
          <p className="text-muted-foreground">Platform analytics and management</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-total-tutors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tutors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-tutors">{metrics?.totalTutors || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.weeklyActiveUsers || 0} active this week
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-active-students">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-students">{metrics?.activeStudents || 0}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card data-testid="card-sessions-this-week">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions This Week</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-sessions-week">{metrics?.sessionsThisWeek || 0}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-total-earnings">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings (USD)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-earnings">
              {formatCurrency(metrics?.totalEarnings || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.unpaidSessions || 0} unpaid sessions • All currencies converted
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="card-user-engagement">
          <CardHeader>
            <CardTitle>User Engagement</CardTitle>
            <CardDescription>Weekly vs Monthly Active Users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Weekly Active Users (WAU)</span>
                <span className="text-2xl font-bold" data-testid="text-wau">{metrics?.weeklyActiveUsers || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Monthly Active Users (MAU)</span>
                <span className="text-2xl font-bold" data-testid="text-mau">{metrics?.monthlyActiveUsers || 0}</span>
              </div>
              {metrics?.monthlyActiveUsers && metrics?.monthlyActiveUsers > 0 && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">WAU/MAU Ratio</span>
                  <span className="text-lg font-semibold">
                    {Math.round((metrics.weeklyActiveUsers / metrics.monthlyActiveUsers) * 100)}%
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-earnings-trend">
          <CardHeader>
            <CardTitle>Earnings Trend (USD)</CardTitle>
            <CardDescription>Last 7 days • All currencies converted to USD</CardDescription>
          </CardHeader>
          <CardContent>
            {earningsTrend && earningsTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={earningsTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => formatCurrency(Number(value))}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  />
                  <Line type="monotone" dataKey="earnings" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No earnings data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Tutors */}
      <Card data-testid="card-top-tutors">
        <CardHeader>
          <CardTitle>Top Tutors by Earnings (USD)</CardTitle>
          <CardDescription>Based on paid sessions • All currencies converted to USD</CardDescription>
        </CardHeader>
        <CardContent>
          {topTutors && topTutors.length > 0 ? (
            <div className="space-y-4">
              {topTutors.map((tutor: any, index: number) => (
                <div key={tutor.tutorId} className="flex items-center justify-between" data-testid={`row-tutor-${index}`}>
                  <div className="flex items-center space-x-4">
                    <div className="font-semibold text-muted-foreground">#{index + 1}</div>
                    <div>
                      <div className="font-medium" data-testid={`text-tutor-name-${index}`}>{tutor.name}</div>
                      <div className="text-sm text-muted-foreground">{tutor.email}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold" data-testid={`text-tutor-earnings-${index}`}>
                      {formatCurrency(tutor.totalEarnings)}
                    </div>
                    <div className="text-sm text-muted-foreground">{tutor.sessionCount} sessions</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No tutor data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Telegram Broadcast */}
      <Card data-testid="card-broadcast">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Telegram Broadcast
          </CardTitle>
          <CardDescription>Send announcements to all subscribed tutors</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Type your announcement here... (supports *bold* and _italic_ formatting)"
            value={broadcastMessage}
            onChange={(e) => setBroadcastMessage(e.target.value)}
            rows={4}
            data-testid="input-broadcast-message"
          />
          <Button
            onClick={() => broadcastMutation.mutate(broadcastMessage)}
            disabled={!broadcastMessage.trim() || broadcastMutation.isPending}
            data-testid="button-send-broadcast"
          >
            {broadcastMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Broadcast
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
