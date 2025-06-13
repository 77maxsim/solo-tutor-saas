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
import { Loader2, Save, User } from "lucide-react";

const profileSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  currency: z.string().min(1, "Currency is required"),
  time_format: z.enum(["24h", "12h"], {
    required_error: "Time format is required",
  }),
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function Profile() {
  const [isLoading, setIsLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current tutor profile
  const { data: tutorProfile, isLoading: isProfileLoading, error } = useQuery({
    queryKey: ['tutor-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('tutors')
        .select('id, full_name, email, currency, time_format, avatar_url')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching tutor profile:', error);
        throw error;
      }

      return data;
    },
  });

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: "",
      currency: "USD",
      time_format: "24h",
    },
  });

  // Update form values when profile data loads
  useEffect(() => {
    if (tutorProfile) {
      form.reset({
        full_name: tutorProfile.full_name || "",
        currency: tutorProfile.currency || "USD",
        time_format: tutorProfile.time_format || "24h",
      });
    }
  }, [tutorProfile, form]);

  // Avatar upload mutation
  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      setIsUploadingAvatar(true);

      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('tutor-avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('tutor-avatars')
        .getPublicUrl(fileName);

      // Update avatar_url in database
      const { error: updateError } = await supabase
        .from('tutors')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Database update error:', updateError);
        throw updateError;
      }

      return publicUrl;
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

      const { error } = await supabase
        .from('tutors')
        .update({
          full_name: data.full_name.trim(),
          currency: data.currency,
          time_format: data.time_format,
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating profile:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile settings have been saved successfully.",
      });
      // Invalidate and refetch profile data
      queryClient.invalidateQueries({ queryKey: ['tutor-profile'] });
      queryClient.invalidateQueries({ queryKey: ['tutor-info'] });
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
        </div>
      </div>
    </div>
  );
}