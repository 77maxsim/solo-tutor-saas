import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Student {
  id: string;
  name: string;
  avatarUrl?: string;
}

interface AvatarEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
}

// Preset avatar options
const presetAvatars = [
  { key: "preset-boy1", emoji: "👦", label: "Boy 1" },
  { key: "preset-girl1", emoji: "👧", label: "Girl 1" },
  { key: "preset-boy2", emoji: "🧒", label: "Boy 2" },
  { key: "preset-girl2", emoji: "👩", label: "Girl 2" },
  { key: "preset-man", emoji: "👨", label: "Man" },
  { key: "preset-woman", emoji: "👩‍🦰", label: "Woman" },
  { key: "emoji-star", emoji: "⭐", label: "Star" },
  { key: "emoji-rocket", emoji: "🚀", label: "Rocket" },
  { key: "emoji-book", emoji: "📚", label: "Book" },
  { key: "emoji-brain", emoji: "🧠", label: "Brain" },
];

export function AvatarEditorModal({ isOpen, onClose, student }: AvatarEditorModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [activeTab, setActiveTab] = useState("presets");

  // Reset state when modal opens/closes
  const handleClose = () => {
    setSelectedPreset("");
    setUploadedFile(null);
    setPreviewUrl("");
    setActiveTab("presets");
    onClose();
  };

  // Update avatar mutation
  const updateAvatarMutation = useMutation({
    mutationFn: async (avatarUrl: string) => {
      if (!student) throw new Error("No student selected");

      const { error } = await supabase
        .from('students')
        .update({ avatar_url: avatarUrl })
        .eq('id', student.id);

      if (error) {
        console.error('Error updating avatar:', error);
        throw error;
      }

      return { studentName: student.name, avatarUrl };
    },
    onSuccess: (data) => {
      toast({
        title: "Avatar Updated",
        description: `${data.studentName}'s avatar has been updated successfully.`,
      });
      
      // Invalidate and refetch queries to refresh data immediately
      queryClient.invalidateQueries({ queryKey: ['student-sessions'], refetchType: 'active' });
      queryClient.refetchQueries({ queryKey: ['student-sessions'] });
      
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update avatar. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!student) throw new Error("No student selected");

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${student.id}-${Date.now()}.${fileExt}`;
      const filePath = `student-avatars/${fileName}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('student-avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('student-avatars')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    },
    onSuccess: (publicUrl) => {
      updateAvatarMutation.mutate(publicUrl);
    },
    onError: (error: any) => {
      toast({
        title: "Upload Error",
        description: error.message || "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please select a PNG, JPG, or JPEG file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (1MB = 1024 * 1024 bytes)
    if (file.size > 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select a file smaller than 1MB.",
        variant: "destructive",
      });
      return;
    }

    setUploadedFile(file);
    
    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleSavePreset = () => {
    if (selectedPreset) {
      updateAvatarMutation.mutate(selectedPreset);
    }
  };

  const handleSaveUpload = () => {
    if (uploadedFile) {
      uploadFileMutation.mutate(uploadedFile);
    }
  };

  const isLoading = updateAvatarMutation.isPending || uploadFileMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🎨 Edit Avatar
          </DialogTitle>
          <DialogDescription>
            Choose a new avatar for {student?.name}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="presets">Preset Icons</TabsTrigger>
            <TabsTrigger value="upload">Upload Image</TabsTrigger>
          </TabsList>

          <TabsContent value="presets" className="space-y-4">
            <div className="grid grid-cols-5 gap-3">
              {presetAvatars.map((avatar) => (
                <button
                  key={avatar.key}
                  onClick={() => setSelectedPreset(avatar.key)}
                  className={cn(
                    "aspect-square rounded-full border-2 border-gray-200 flex items-center justify-center text-2xl hover:border-blue-500 transition-colors",
                    selectedPreset === avatar.key && "border-blue-500 bg-blue-50"
                  )}
                  disabled={isLoading}
                  title={avatar.label}
                >
                  {avatar.emoji}
                </button>
              ))}
            </div>
            
            {selectedPreset && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                <Check className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-800">
                  Selected: {presetAvatars.find(a => a.key === selectedPreset)?.label}
                </span>
              </div>
            )}
          </TabsContent>

          <TabsContent value="upload" className="space-y-4">
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground bg-gray-50 p-3 rounded-lg">
                <h4 className="font-medium mb-2">Requirements:</h4>
                <ul className="space-y-1 text-xs">
                  <li>• File size: max 1MB</li>
                  <li>• File types: .png, .jpg, .jpeg</li>
                  <li>• Recommended: square image (e.g. 200×200px)</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="avatar-upload">Select Image</Label>
                <Input
                  id="avatar-upload"
                  type="file"
                  accept=".png,.jpg,.jpeg"
                  onChange={handleFileSelect}
                  disabled={isLoading}
                />
              </div>

              {previewUrl && (
                <div className="flex justify-center">
                  <div className="relative">
                    <img
                      src={previewUrl}
                      alt="Avatar preview"
                      className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                    />
                    <div className="absolute inset-0 rounded-full bg-green-500 bg-opacity-20 flex items-center justify-center">
                      <Check className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          
          {activeTab === "presets" ? (
            <Button 
              onClick={handleSavePreset}
              disabled={!selectedPreset || isLoading}
              className="flex items-center gap-2"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Preset
            </Button>
          ) : (
            <Button 
              onClick={handleSaveUpload}
              disabled={!uploadedFile || isLoading}
              className="flex items-center gap-2"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              <Upload className="h-4 w-4" />
              Upload & Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}