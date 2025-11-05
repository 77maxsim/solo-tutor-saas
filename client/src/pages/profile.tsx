import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, Save, User, Send, CheckCircle2, ExternalLink, Calendar, RefreshCw } from "lucide-react";
import { ALL_TIMEZONES, TIMEZONE_GROUPS, getBrowserTimezone } from "@/lib/timezones";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";

const profileSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  currency: z.string().min(1, "Currency is required"),
  time_format: z.enum(["24h", "12h"], {
    required_error: "Time format is required",
  }),
  timezone: z.string().min(1, "Timezone is required"),
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function Profile() {
  const [isLoading, setIsLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; success: number; failed: number } | null>(null);
  const [syncEventSource, setSyncEventSource] = useState<EventSource | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (syncEventSource) {
        syncEventSource.close();
      }
    };
  }, [syncEventSource]);

  const { data: telegramStatus, isLoading: isTelegramLoading } = useQuery({
    queryKey: ['telegram-status'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const response = await fetch(`/api/telegram/status?userId=${user.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch telegram status');
      }
      return response.json();
    },
  });

  // Fetch current tutor profile
  const { data: tutorProfile, isLoading: isProfileLoading, error } = useQuery({
    queryKey: ['tutor-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('tutors')
        .select('id, full_name, email, currency, time_format, timezone, avatar_url, sync_google_calendar, google_calendar_connected')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching tutor profile:', error);
        throw error;
      }

      return data;
    },
  });

  // Google Calendar connection mutations
  const connectGoogleCalendarMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/auth/google/connect', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get authorization URL');
      }

      const { authUrl } = await response.json();
      return authUrl;
    },
    onSuccess: (authUrl) => {
      window.location.href = authUrl;
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: "Failed to connect Google Calendar. Please try again.",
      });
    },
  });

  const disconnectGoogleCalendarMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/auth/google/disconnect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect Google Calendar');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Google Calendar Disconnected",
        description: "Your Google Calendar has been disconnected successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['tutor-profile'] });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Disconnection Failed",
        description: "Failed to disconnect Google Calendar. Please try again.",
      });
    },
  });

  // Google Calendar sync toggle mutation
  const toggleGoogleCalendarMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('tutors')
        .update({ sync_google_calendar: enabled })
        .eq('user_id', user.id);

      if (error) {
        console.error('❌ Failed to update Google Calendar sync:', error);
        throw error;
      }

      console.log("✅ Google Calendar sync preference updated:", enabled);
      return { enabled };
    },
    onSuccess: (data) => {
      toast({
        title: data.enabled ? "Google Calendar Sync Enabled" : "Google Calendar Sync Disabled",
        description: data.enabled 
          ? "New sessions will be automatically added to your Google Calendar." 
          : "Sessions will no longer sync to Google Calendar.",
      });
      queryClient.invalidateQueries({ queryKey: ['tutor-profile'] });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Failed to update Google Calendar sync preference. Please try again.",
      });
    },
  });

  // Bulk sync with progress tracking
  const handleBulkSync = async () => {
    if (!tutorProfile?.id) return;

    // Close any existing EventSource
    if (syncEventSource) {
      syncEventSource.close();
    }

    setIsSyncing(true);
    setSyncProgress(null);

    try {
      const eventSource = new EventSource(`/api/google-calendar/bulk-sync-stream/${tutorProfile.id}`);
      setSyncEventSource(eventSource);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.done) {
          eventSource.close();
          setSyncEventSource(null);
          setIsSyncing(false);
          setSyncProgress(null);
          
          if (data.error) {
            toast({
              variant: "destructive",
              title: "Sync Failed",
              description: "Failed to sync sessions to Google Calendar. Please try again.",
            });
          } else {
            toast({
              title: "Sync Complete",
              description: `${data.success} session(s) synced to Google Calendar.${data.failed > 0 ? ` ${data.failed} failed.` : ''}`,
            });
          }
        } else {
          setSyncProgress(data);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        setSyncEventSource(null);
        setIsSyncing(false);
        setSyncProgress(null);
        toast({
          variant: "destructive",
          title: "Sync Failed",
          description: "Failed to sync sessions to Google Calendar. Please try again.",
        });
      };
    } catch (error) {
      setIsSyncing(false);
      setSyncProgress(null);
      toast({
        variant: "destructive",
        title: "Sync Failed",
        description: "Failed to sync sessions to Google Calendar. Please try again.",
      });
    }
  };

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: "",
      currency: "USD",
      time_format: "24h",
      timezone: getBrowserTimezone(),
    },
  });

  // Update form values when profile data loads
  useEffect(() => {
    if (tutorProfile) {
      form.reset({
        full_name: tutorProfile.full_name || "",
        currency: tutorProfile.currency || "USD",
        time_format: tutorProfile.time_format || "24h",
        timezone: tutorProfile.timezone || getBrowserTimezone(),
      });
    }
  }, [tutorProfile, form]);

  // Avatar upload mutation
  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      setIsUploadingAvatar(true);

      console.log('User ID for upload:', user.id);

      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('avatar', file);
      formData.append('userId', user.id);

      // Upload through backend API
      const response = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      console.log('Upload successful:', result);

      return result.avatarUrl;
    },
    onSuccess: (avatarUrl) => {
      toast({
        title: "Avatar Updated",
        description: "Your profile picture has been updated successfully.",
      });
      setAvatarPreview(avatarUrl);
      queryClient.invalidateQueries({ queryKey: ['tutor-profile'] });
      queryClient.invalidateQueries({ queryKey: ['tutor-info'] });
    },
    onError: (error) => {
      console.error('Avatar upload error:', error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "Failed to upload profile picture. Please try again.",
      });
    },
    onSettled: () => {
      setIsUploadingAvatar(false);
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileForm) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const updatePayload = {
        full_name: data.full_name.trim(),
        currency: data.currency,
        time_format: data.time_format,
        timezone: data.timezone, // ✅ Include timezone in update
      };

      console.log("✅ Tutor profile update payload:", updatePayload);

      const { error } = await supabase
        .from('tutors')
        .update(updatePayload)
        .eq('user_id', user.id);

      if (error) {
        console.error('❌ Failed to update tutor:', error);
        throw error;
      } else {
        console.log("✅ Tutor profile updated with timezone:", data.timezone);
      }

      return data;
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile settings have been saved successfully.",
      });
      // Invalidate and refetch profile data and timezone cache
      queryClient.invalidateQueries({ queryKey: ['tutor-profile'] });
      queryClient.invalidateQueries({ queryKey: ['tutor-info'] });
      queryClient.invalidateQueries({ queryKey: ['tutor-timezone'] });
    },
    onError: (error) => {
      console.error('Profile update error:', error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Failed to update your profile. Please try again.",
      });
    },
  });

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Invalid File",
        description: "Please select an image file.",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File Too Large",
        description: "Please select an image smaller than 5MB.",
      });
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    uploadAvatarMutation.mutate(file);
  };

  const onSubmit = async (data: ProfileForm) => {
    setIsLoading(true);
    try {
      await updateProfileMutation.mutateAsync(data);
    } finally {
      setIsLoading(false);
    }
  };

  if (isProfileLoading) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="flex items-center justify-center min-h-64">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Loading profile...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-destructive">Failed to load profile data</p>
                <Button 
                  variant="outline" 
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['tutor-profile'] })}
                  className="mt-4"
                >
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <header className="bg-white border-b border-border px-6 py-4">
        <div className="flex items-center">
          <User className="w-6 h-6 mr-3 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Profile Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your personal information and preferences.
            </p>
          </div>
        </div>
      </header>

      {/* Profile Content */}
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Update your name and currency preferences for session rates and earnings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Avatar Upload Section */}
                  <div className="space-y-4">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Profile Picture
                    </label>
                    <div className="flex items-center space-x-4">
                      {/* Avatar Preview */}
                      <div className="relative">
                        <div className="w-20 h-20 rounded-full overflow-hidden bg-muted border-2 border-border">
                          {avatarPreview || tutorProfile?.avatar_url ? (
                            <img
                              src={avatarPreview || tutorProfile?.avatar_url || ''}
                              alt="Profile"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <User className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        {isUploadingAvatar && (
                          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                      
                      {/* Upload Button */}
                      <div className="flex-1">
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            disabled={isUploadingAvatar}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                            id="avatar-upload"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isUploadingAvatar}
                            className="w-full"
                            asChild
                          >
                            <label htmlFor="avatar-upload" className="cursor-pointer">
                              {isUploadingAvatar ? "Uploading..." : "Choose Photo"}
                            </label>
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          JPG, PNG or GIF. Max size 5MB.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Email Display (Read-only) */}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={tutorProfile?.email || ""}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email cannot be changed. Contact support if you need to update your email.
                    </p>
                  </div>

                  {/* Full Name */}
                  <FormField
                    control={form.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter your full name"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Currency */}
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tuition Fee Currency</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={isLoading}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select your currency" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USD">USD - US Dollar</SelectItem>
                              <SelectItem value="EUR">EUR - Euro</SelectItem>
                              <SelectItem value="UAH">UAH - Ukrainian Hryvnia</SelectItem>
                              <SelectItem value="GBP">GBP - British Pound</SelectItem>
                              <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                              <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                              <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                              <SelectItem value="CNY">CNY - Chinese Yuan</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">
                          This currency will be used for all session rates and earnings calculations.
                        </p>
                      </FormItem>
                    )}
                  />

                  {/* Time Format */}
                  <FormField
                    control={form.control}
                    name="time_format"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preferred Time Format</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={isLoading}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select time format" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="24h">24-Hour (e.g., 14:00)</SelectItem>
                              <SelectItem value="12h">12-Hour (e.g., 2:00 PM)</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">
                          This will be used throughout the app for displaying times.
                        </p>
                      </FormItem>
                    )}
                  />

                  {/* Timezone */}
                  <FormField
                    control={form.control}
                    name="timezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Timezone</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={isLoading}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select your timezone" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              {Object.entries(TIMEZONE_GROUPS).map(([region, timezones]) => (
                                <div key={region}>
                                  <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                                    {region}
                                  </div>
                                  {timezones.map((timezone) => (
                                    <SelectItem key={timezone.value} value={timezone.value}>
                                      {timezone.label}
                                    </SelectItem>
                                  ))}
                                </div>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">
                          This timezone will be used to display all your session times correctly.
                        </p>
                      </FormItem>
                    )}
                  />

                  {/* Submit Button */}
                  <div className="flex justify-end pt-4">
                    <Button
                      type="submit"
                      disabled={isLoading || updateProfileMutation.isPending}
                    >
                      {isLoading || updateProfileMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Telegram Notifications</CardTitle>
              <CardDescription>
                Get daily summaries of your earnings and upcoming sessions via Telegram.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isTelegramLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : telegramStatus?.subscribed ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-green-900 dark:text-green-100">
                        You're subscribed to daily updates!
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                        You'll receive a notification every day at 9 PM (your local time) with:
                      </p>
                      <ul className="text-sm text-green-700 dark:text-green-300 mt-2 space-y-1 list-disc list-inside">
                        <li>Today's earnings summary</li>
                        <li>Tomorrow's scheduled sessions</li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <Send className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-blue-900 dark:text-blue-100">
                        Subscribe to daily updates
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        Get notified at 9 PM every day with your earnings summary and tomorrow's schedule.
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      To subscribe:
                    </p>
                    <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                      <li>Open Telegram and search for our bot</li>
                      <li>Start a chat with the bot</li>
                      <li>Send your email address ({tutorProfile?.email})</li>
                      <li>You'll receive a confirmation message</li>
                    </ol>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      data-testid="button-telegram-bot"
                      onClick={() => {
                        window.open('https://t.me/classter_daily_bot', '_blank');
                      }}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Telegram Bot
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Google Calendar Integration</CardTitle>
              <CardDescription>
                Connect your Google Calendar to automatically sync tutoring sessions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isProfileLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : !tutorProfile?.google_calendar_connected ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-blue-900 dark:text-blue-100">
                        Connect Your Google Calendar
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        Link your Google Calendar to automatically sync all your tutoring sessions. Each session will appear as an event in your personal calendar.
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Benefits:</p>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Automatic synchronization of all scheduled sessions</li>
                      <li>View your tutoring schedule alongside personal events</li>
                      <li>Receive Google Calendar notifications for upcoming sessions</li>
                      <li>Access your schedule from any device</li>
                    </ul>
                  </div>

                  <Button
                    onClick={() => connectGoogleCalendarMutation.mutate()}
                    disabled={connectGoogleCalendarMutation.isPending}
                    data-testid="button-connect-google-calendar"
                  >
                    {connectGoogleCalendarMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Calendar className="w-4 h-4 mr-2" />
                        Connect Google Calendar
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Connection Status */}
                  <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-green-900 dark:text-green-100">
                        Google Calendar Connected
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                        Your Google Calendar is successfully linked and ready to sync sessions.
                      </p>
                    </div>
                  </div>

                  {/* Sync Toggle */}
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">
                          Auto-Sync Sessions
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Automatically sync all scheduled sessions to your Google Calendar
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={tutorProfile?.sync_google_calendar || false}
                      onCheckedChange={(checked) => toggleGoogleCalendarMutation.mutate(checked)}
                      disabled={toggleGoogleCalendarMutation.isPending}
                      data-testid="switch-google-calendar-sync"
                    />
                  </div>

                  {/* Bulk Sync Section */}
                  {tutorProfile?.sync_google_calendar && (
                    <div className="space-y-3">
                      <div className="space-y-3 p-4 border border-border rounded-lg">
                        <p className="text-sm font-medium text-foreground">Sync Existing Sessions</p>
                        <p className="text-xs text-muted-foreground">
                          Use this to sync all your previously scheduled sessions to Google Calendar.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleBulkSync}
                          disabled={isSyncing}
                          data-testid="button-bulk-sync-calendar"
                        >
                          {isSyncing ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Syncing...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Sync All Sessions
                            </>
                          )}
                        </Button>
                        
                        {syncProgress && (
                          <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium text-blue-900 dark:text-blue-100">
                                Syncing session {syncProgress.current} of {syncProgress.total}
                              </span>
                              <span className="text-blue-700 dark:text-blue-300">
                                {Math.round((syncProgress.current / syncProgress.total) * 100)}%
                              </span>
                            </div>
                            <Progress 
                              value={(syncProgress.current / syncProgress.total) * 100} 
                              className="h-2"
                            />
                            <div className="flex gap-4 text-xs text-blue-700 dark:text-blue-300">
                              <span>✓ Success: {syncProgress.success}</span>
                              {syncProgress.failed > 0 && <span>✗ Failed: {syncProgress.failed}</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Disconnect Button */}
                  <div className="pt-2 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnectGoogleCalendarMutation.mutate()}
                      disabled={disconnectGoogleCalendarMutation.isPending}
                      data-testid="button-disconnect-google-calendar"
                      className="text-destructive hover:text-destructive"
                    >
                      {disconnectGoogleCalendarMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Disconnecting...
                        </>
                      ) : (
                        'Disconnect Google Calendar'
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      This will remove the connection to your Google Calendar. Existing synced events will remain in your calendar.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}