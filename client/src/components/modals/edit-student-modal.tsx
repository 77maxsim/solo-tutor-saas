import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import CreatableSelect from "react-select/creatable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// Validation schema
const editStudentSchema = z.object({
  name: z.string().min(1, "Student name is required"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  tags: z.array(z.string()).optional(),
});

type EditStudentForm = z.infer<typeof editStudentSchema>;

interface Student {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  tags?: string[];
}

interface EditStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
}

interface TagOption {
  value: string;
  label: string;
}

export function EditStudentModal({ isOpen, onClose, student }: EditStudentModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTags, setSelectedTags] = useState<TagOption[]>([]);

  const form = useForm<EditStudentForm>({
    resolver: zodResolver(editStudentSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      tags: [],
    },
  });

  // Reset form when student changes
  useEffect(() => {
    if (student && isOpen) {
      form.reset({
        name: student.name || "",
        phone: student.phone || "",
        email: student.email || "",
        tags: student.tags || [],
      });
      
      // Set selected tags for react-select
      const tagOptions = (student.tags || []).map(tag => ({
        value: tag,
        label: tag,
      }));
      setSelectedTags(tagOptions);
    }
  }, [student, isOpen, form]);

  // Update student mutation
  const updateStudentMutation = useMutation({
    mutationFn: async (data: EditStudentForm) => {
      if (!student) throw new Error("No student selected");

      const { error } = await supabase
        .from('students')
        .update({
          name: data.name,
          phone: data.phone || null,
          email: data.email || null,
          tags: data.tags || [],
        })
        .eq('id', student.id);

      if (error) {
        console.error('Error updating student:', error);
        throw error;
      }

      return { studentName: data.name };
    },
    onSuccess: (data) => {
      toast({
        title: "Student Updated",
        description: `${data.studentName}'s information has been updated successfully.`,
      });
      
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['student-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update student. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditStudentForm) => {
    // Include tags from react-select state
    const formDataWithTags = {
      ...data,
      tags: selectedTags.map(tag => tag.value),
    };
    updateStudentMutation.mutate(formDataWithTags);
  };

  const handleTagsChange = (newValue: readonly TagOption[] | null) => {
    const tags = newValue ? Array.from(newValue) : [];
    setSelectedTags(tags);
    form.setValue('tags', tags.map(tag => tag.value));
  };

  const handleClose = () => {
    form.reset();
    setSelectedTags([]);
    onClose();
  };

  // Custom styles for react-select to match shadcn theme
  const selectStyles = {
    control: (provided: any, state: any) => ({
      ...provided,
      minHeight: '40px',
      borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--border))',
      borderRadius: '6px',
      boxShadow: state.isFocused ? '0 0 0 2px hsl(var(--ring))' : 'none',
      '&:hover': {
        borderColor: 'hsl(var(--border))',
      },
    }),
    valueContainer: (provided: any) => ({
      ...provided,
      padding: '2px 8px',
    }),
    input: (provided: any) => ({
      ...provided,
      margin: '0px',
    }),
    indicatorSeparator: () => ({
      display: 'none',
    }),
    indicatorsContainer: (provided: any) => ({
      ...provided,
      height: '40px',
    }),
    menu: (provided: any) => ({
      ...provided,
      backgroundColor: 'hsl(var(--background))',
      border: '1px solid hsl(var(--border))',
      borderRadius: '6px',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    }),
    option: (provided: any, state: any) => ({
      ...provided,
      backgroundColor: state.isSelected 
        ? 'hsl(var(--accent))' 
        : state.isFocused 
        ? 'hsl(var(--accent))' 
        : 'transparent',
      color: 'hsl(var(--foreground))',
      '&:hover': {
        backgroundColor: 'hsl(var(--accent))',
      },
    }),
    multiValue: (provided: any) => ({
      ...provided,
      backgroundColor: 'hsl(var(--accent))',
      borderRadius: '4px',
    }),
    multiValueLabel: (provided: any) => ({
      ...provided,
      color: 'hsl(var(--accent-foreground))',
      fontSize: '14px',
    }),
    multiValueRemove: (provided: any) => ({
      ...provided,
      color: 'hsl(var(--accent-foreground))',
      '&:hover': {
        backgroundColor: 'hsl(var(--destructive))',
        color: 'white',
      },
    }),
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📝 Edit Student
          </DialogTitle>
          <DialogDescription>
            Update student information and tags.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter student name" 
                      {...field} 
                      disabled={updateStudentMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter phone number" 
                      {...field} 
                      disabled={updateStudentMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input 
                      type="email"
                      placeholder="Enter email address" 
                      {...field} 
                      disabled={updateStudentMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={() => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <CreatableSelect
                      isMulti
                      value={selectedTags}
                      onChange={handleTagsChange}
                      placeholder="Add tags..."
                      noOptionsMessage={() => "Type to create a new tag"}
                      formatCreateLabel={(inputValue) => `Create "${inputValue}"`}
                      styles={selectStyles}
                      isDisabled={updateStudentMutation.isPending}
                      className="react-select-container"
                      classNamePrefix="react-select"
                    />
                  </FormControl>
                  <FormDescription>
                    Create custom tags to organize and categorize students.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={updateStudentMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateStudentMutation.isPending}
                className="flex items-center gap-2"
              >
                {updateStudentMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}