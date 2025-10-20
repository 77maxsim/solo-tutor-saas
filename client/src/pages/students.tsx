import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { sanitizeText } from "@/lib/sanitize";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import { formatCurrency } from "@/lib/utils";
import { formatUtcToTutorTimezone, calculateDurationMinutes } from "@/lib/dateUtils";
import { useTimezone } from "@/contexts/TimezoneContext";
import { useToast } from "@/hooks/use-toast";
import CreatableSelect from "react-select/creatable";
import { shouldUseOptimizedQuery, getOptimizedSessions, getStandardSessions } from "@/lib/queryOptimizer";
import { 
  User, 
  Calendar,
  Coins,
  Clock,
  Plus,
  Trash2,
  Star,
  Tag,
  X,
  MoreHorizontal
} from "lucide-react";
import { EditStudentModal } from "@/components/modals/edit-student-modal";
import { AvatarEditorModal } from "@/components/modals/avatar-editor-modal";
import { StudentSessionHistoryModal } from "@/components/modals/student-session-history-modal";
import { getAvatarDisplay } from "@/lib/avatarUtils";
import StudentFilters, { SortKey } from "@/components/students/StudentFilters";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface Session {
  id: string;
  student_id: string;
  student_name: string;
  session_start: string;
  session_end: string;
  duration: number;
  rate: number;
  paid: boolean;
  created_at: string;
}

interface StudentSummary {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  tags?: string[];
  avatarUrl?: string;
  isFavorite?: boolean;
  pastSessions: number;
  totalEarnings: number;
  lastSessionDate: string;
  avgSessionDuration: number;
  upcomingSessions: number;
}

export default function Students() {
  const queryClient = useQueryClient();
  const { tutorTimezone } = useTimezone();
  const { toast } = useToast();

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkAddTagsOpen, setIsBulkAddTagsOpen] = useState(false);
  const [bulkSelectedTags, setBulkSelectedTags] = useState<{value: string, label: string}[]>([]);

  // Get tutor ID for queries
  const { data: tutorId } = useQuery({
    queryKey: ['current-tutor-id'],
    queryFn: getCurrentTutorId,
  });

  // Query to fetch all existing tags for the dropdown
  const { data: existingTagsData } = useQuery({
    queryKey: ['existing-tags', tutorId],
    queryFn: async () => {
      if (!tutorId) return [];
      
      const { data, error } = await supabase
        .from('students')
        .select('tags')
        .eq('tutor_id', tutorId)
        .not('tags', 'is', null);

      if (error) {
        console.error('Error fetching existing tags:', error);
        throw error;
      }

      // Extract unique tags from all students
      const allTags = new Set<string>();
      data.forEach(student => {
        if (student.tags && Array.isArray(student.tags)) {
          student.tags.forEach(tag => allTags.add(tag));
        }
      });

      console.log('Fetched existing tags:', Array.from(allTags));
      return Array.from(allTags).map(tag => ({ value: tag, label: tag }));
    },
    enabled: !!tutorId,
  });

  const existingTagOptions = existingTagsData || [];

  // Modal states
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isEditStudentOpen, setIsEditStudentOpen] = useState(false);
  const [isAvatarEditorOpen, setIsAvatarEditorOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<string>('');
  const [studentToEdit, setStudentToEdit] = useState<StudentSummary | null>(null);
  const [studentForAvatar, setStudentForAvatar] = useState<StudentSummary | null>(null);
  const [studentForHistory, setStudentForHistory] = useState<StudentSummary | null>(null);
  const [newStudentName, setNewStudentName] = useState('');
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  
  // Confirmation dialog state
  const [confirm, setConfirm] = useState<null | {
    kind: "archive" | "delete";
    ids: string[];
  }>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Mutation for adding a new student
  const addStudentMutation = useMutation({
    mutationFn: async (studentName: string) => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated or tutor record not found');
      }

      const { data, error } = await supabase
        .from('students')
        .insert([
          {
            name: studentName.trim(),
            tutor_id: tutorId
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('Error adding student:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      toast({
        title: "Student Added",
        description: "New student has been successfully added.",
      });
      setNewStudentName('');
      setIsAddStudentOpen(false);
      queryClient.invalidateQueries({ queryKey: ['student-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add student. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Safe delete mutation for individual students
  const safeDeleteStudentMutation = useMutation({
    mutationFn: async (studentIds: string[]) => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated');
      }

      if (!studentIds || studentIds.length === 0) {
        throw new Error('No students selected');
      }

      // Check which students have sessions (scoped to current tutor)
      const { data: studentsWithSessions, error: sessionCheckError } = await supabase
        .from('sessions')
        .select('student_id')
        .in('student_id', studentIds)
        .eq('tutor_id', tutorId);

      if (sessionCheckError) {
        throw sessionCheckError;
      }

      const studentIdsWithSessions = new Set(studentsWithSessions.map(s => s.student_id));
      const studentIdsWithoutSessions = studentIds.filter(id => !studentIdsWithSessions.has(id));

      // Delete only students without sessions
      let deletedCount = 0;
      if (studentIdsWithoutSessions.length > 0) {
        const { data, error } = await supabase
          .from('students')
          .delete()
          .in('id', studentIdsWithoutSessions)
          .eq('tutor_id', tutorId)
          .select('id');

        if (error) {
          throw error;
        }
        deletedCount = data?.length || 0;
      }

      return { 
        deletedCount,
        blockedCount: studentIdsWithSessions.size,
        totalAttempted: studentIds.length
      };
    },
    onSuccess: (data) => {
      setIsDeleteDialogOpen(false);
      setStudentToDelete('');
      clearSelection(); // Clear selection after successful delete
      
      // Show appropriate success message based on results
      if (data.blockedCount === 0) {
        toast({
          title: "Students Deleted",
          description: `Successfully deleted ${data.deletedCount} student${data.deletedCount !== 1 ? 's' : ''}.`,
        });
      } else if (data.deletedCount === 0) {
        toast({
          title: "No students deleted",
          description: `${data.blockedCount} student${data.blockedCount !== 1 ? 's have' : ' has'} sessions and were kept. Use Archive instead.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Some not deleted",
          description: `${data.deletedCount} deleted. ${data.blockedCount} had sessions and were kept. Use Archive instead.`,
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-sessions'] });
    },
    onError: (error: any) => {
      setIsDeleteDialogOpen(false);
      setStudentToDelete('');
      
      toast({
        title: "Error",
        description: error.message || "Failed to delete student. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Archive mutations
  const archiveStudentsMutation = useMutation({
    mutationFn: async (studentIds: string[]) => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated');
      }
      
      if (!studentIds || studentIds.length === 0) {
        throw new Error('No students selected');
      }

      const { data, error } = await supabase
        .from('students')
        .update({ archived_at: new Date().toISOString() })
        .in('id', studentIds)
        .eq('tutor_id', tutorId)
        .select('id, name');

      if (error) {
        console.error('Error archiving students:', error);
        throw error;
      }

      return { archivedStudents: data || [], archivedCount: data?.length || 0 };
    },
    onSuccess: (data) => {
      clearSelection();
      
      const archivedIds = data.archivedStudents.map(s => s.id);
      
      toast({
        title: "Archived", 
        description: `${data.archivedCount} student${data.archivedCount !== 1 ? 's' : ''} archived.`,
        action: (
          <button
            onClick={() => unarchiveStudentsMutation.mutate(archivedIds)}
            disabled={unarchiveStudentsMutation.isPending}
            className="underline hover:no-underline"
            data-testid="button-undo-archive"
          >
            Undo
          </button>
        ),
        duration: 8000, // Give user 8 seconds to undo
      });
      
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-sessions'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to archive students. Please try again.",
        variant: "destructive",
      });
    },
  });

  const unarchiveStudentsMutation = useMutation({
    mutationFn: async (studentIds: string[]) => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated');
      }
      
      if (!studentIds || studentIds.length === 0) return { data: [], error: null };
      
      const { data, error } = await supabase
        .from('students')
        .update({ archived_at: null })
        .in('id', studentIds)
        .eq('tutor_id', tutorId)
        .select('id, name');

      if (error) {
        console.error('Error unarchiving students:', error);
        throw error;
      }

      return { unarchivedStudents: data || [], unarchivedCount: data?.length || 0 };
    },
    onSuccess: (data) => {
      toast({
        title: "Unarchived", 
        description: `${data.unarchivedCount} student${data.unarchivedCount !== 1 ? 's' : ''} restored.`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-sessions'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unarchive students. Please try again.",
        variant: "destructive",
      });
    },
  });


  // Helper functions for confirmation dialogs
  const openArchive = (studentIds: string[]) => {
    if (!studentIds.length) return;
    setConfirm({ kind: "archive", ids: studentIds });
  };

  const openDelete = (studentIds: string[]) => {
    if (!studentIds.length) return;
    setConfirm({ kind: "delete", ids: studentIds });
  };

  // Bulk add tags mutation
  const bulkAddTagsMutation = useMutation({
    mutationFn: async (tagNames: string[]) => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated');
      }

      const selectedStudentIds = Array.from(selectedIds);
      if (selectedStudentIds.length === 0) {
        throw new Error('No students selected');
      }

      // Fetch current tags for selected students (scoped to current tutor)
      const { data: studentsData, error: fetchError } = await supabase
        .from('students')
        .select('id, tags')
        .in('id', selectedStudentIds)
        .eq('tutor_id', tutorId);

      if (fetchError) {
        console.error('Error fetching student tags:', fetchError);
        throw fetchError;
      }

      // Update each student with merged tags and track results
      const results = {
        successful: [] as string[],
        failed: [] as string[]
      };

      for (const student of studentsData) {
        const currentTags = student.tags || [];
        const nextTags = Array.from(new Set([...currentTags, ...tagNames]));
        
        const { error } = await supabase
          .from('students')
          .update({ tags: nextTags })
          .eq('id', student.id)
          .eq('tutor_id', tutorId);

        if (error) {
          console.error(`Error updating tags for student ${student.id}:`, error);
          results.failed.push(student.id);
        } else {
          results.successful.push(student.id);
        }
      }

      return { 
        successCount: results.successful.length,
        failedCount: results.failed.length,
        totalAttempted: selectedStudentIds.length,
        tags: tagNames 
      };
    },
    onSuccess: (data) => {
      setIsBulkAddTagsOpen(false);
      setBulkSelectedTags([]);
      clearSelection();
      
      // Show appropriate success message based on results
      if (data.failedCount === 0) {
        toast({
          title: "Tags Added",
          description: `Added ${data.tags.join(', ')} to ${data.successCount} student${data.successCount !== 1 ? 's' : ''}.`,
        });
      } else if (data.successCount === 0) {
        toast({
          title: "Failed to add tags",
          description: `Failed to add tags to ${data.failedCount} student${data.failedCount !== 1 ? 's' : ''}. Please try again.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Tags partially added",
          description: `Added tags to ${data.successCount}/${data.totalAttempted} students. ${data.failedCount} failed.`,
        });
      }
      
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add tags. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutation for toggling favorite status
  const toggleFavorite = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: boolean }) => {
      const { error } = await supabase.from("students").update({ is_favorite: next }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, next }) => {
      await queryClient.cancelQueries({ queryKey: ["students"] });
      const prev = queryClient.getQueryData<any>(["students"]);
      if (prev) {
        const copy = Array.isArray(prev) ? [...prev] : { ...prev };
        const list = Array.isArray(copy) ? copy : (copy?.data ?? []);
        const idx = list.findIndex((s: any) => s.id === id);
        if (idx >= 0) {
          const row = { ...(list[idx]) };
          row.is_favorite = next; row.isFavorite = next;
          list[idx] = row;
        }
        queryClient.setQueryData(["students"], copy);
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(["students"], context.prev);
      toast({
        title: "Error",
        description: "Failed to update favorite status. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });

  // Handle functions
  const handleAddStudent = () => {
    if (!newStudentName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a student name.",
        variant: "destructive",
      });
      return;
    }
    addStudentMutation.mutate(newStudentName);
  };

  const handleEditStudent = (student: StudentSummary) => {
    setStudentToEdit(student);
    setIsEditStudentOpen(true);
  };

  const handleEditAvatar = (student: StudentSummary) => {
    setStudentForAvatar(student);
    setIsAvatarEditorOpen(true);
  };

  const handleViewHistory = (student: StudentSummary) => {
    setStudentForHistory(student);
    setIsHistoryModalOpen(true);
  };

  const handleDeleteStudent = (studentName: string) => {
    setStudentToDelete(studentName);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteStudent = () => {
    if (studentToDelete) {
      // Convert student name to ID for safe delete
      const student = students?.find(s => s.name === studentToDelete);
      if (student) {
        safeDeleteStudentMutation.mutate([student.id]);
      }
    }
  };

  // Fetch tutor's currency preference
  const { data: tutorCurrency = 'USD' } = useQuery({
    queryKey: ['tutor-currency'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('tutors')
        .select('currency')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching tutor currency:', error);
        return 'USD'; // Fallback to USD on error
      }

      return data?.currency || 'USD';
    },
  });

  // Fetch students data (hide archived by default)
  const { data: students, isLoading: isLoadingStudents } = useQuery({
    queryKey: ['students', tutorId],
    queryFn: async () => {
      if (!tutorId) {
        throw new Error('Tutor ID not available');
      }

      console.log('Fetching students for tutor:', tutorId);
      const { data, error } = await supabase
        .from('students')
        .select('id, name, phone, email, tags, avatar_url, is_favorite, archived_at')
        .eq('tutor_id', tutorId)
        .is('archived_at', null) // Hide archived students by default
        .order('name');

      if (error) {
        console.error('Error fetching students:', error);
        throw error;
      }

      console.log('Students data fetched:', data);
      return data || [];
    },
    enabled: !!tutorId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Fetch sessions data using query optimizer
  const { data: sessions, isLoading: isLoadingSessions, error } = useQuery({
    queryKey: ['student-sessions'],
    queryFn: async () => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated or tutor record not found');
      }

      console.log('Students page - fetching sessions for tutor:', tutorId);

      // Use the query optimizer to determine the best approach
      const useOptimizedQuery = await shouldUseOptimizedQuery(tutorId);

      if (useOptimizedQuery) {
        console.log('Students page - using optimized query pattern');
        return await getOptimizedSessions(tutorId);
      } else {
        console.log('Students page - using standard query pattern');
        return await getStandardSessions(tutorId);
      }
    },
  });



  const isLoading = isLoadingStudents; // Only wait for students, sessions can be empty

  // Set up Supabase realtime subscription for both students and sessions
  useEffect(() => {
    const channel = supabase
      .channel('students-and-sessions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions'
        },
        (payload) => {
          console.log('Sessions updated, refreshing student data:', payload);
          queryClient.invalidateQueries({ queryKey: ['student-sessions'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'students'
        },
        (payload) => {
          console.log('Students updated, refreshing student data:', payload);
          queryClient.invalidateQueries({ queryKey: ['students'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Calculate student summaries with correct business logic - includes ALL students
  const calculateStudentSummaries = (students: any[], sessions: Session[]): StudentSummary[] => {
    if (!students || students.length === 0) return [];

    const now = new Date();

    // Group sessions by student_id
    const sessionsByStudentId = new Map<string, Session[]>();
    sessions?.forEach(session => {
      if (!sessionsByStudentId.has(session.student_id)) {
        sessionsByStudentId.set(session.student_id, []);
      }
      sessionsByStudentId.get(session.student_id)!.push(session);
    });

    // Process ALL students from the students query, not just those with sessions
    return students.map(student => {
      const studentSessions = sessionsByStudentId.get(student.id) || [];
      let totalEarnings = 0;
      let totalDuration = 0;
      let upcomingSessions = 0;

      studentSessions.forEach(session => {
        const sessionDate = new Date(session.session_start);
        const earnings = (session.duration / 60) * session.rate;
        const isPaid = session.paid === true;

        // Only count earnings from paid sessions
        if (isPaid) {
          totalEarnings += earnings;
        }

        totalDuration += session.duration;

        if (sessionDate >= now) {
          upcomingSessions++;
        }
      });

      // Calculate past sessions (sessions that occurred before current date/time)
      const pastSessions = studentSessions.filter(session => new Date(session.session_start) < now).length;

      const sortedSessions = studentSessions.sort((a, b) => 
        new Date(b.session_start).getTime() - new Date(a.session_start).getTime()
      );

      return {
        id: student.id,
        name: student.name,
        phone: student.phone,
        email: student.email,
        tags: student.tags || [],
        avatarUrl: student.avatar_url,
        isFavorite: student.is_favorite || false,
        pastSessions,
        totalEarnings,
        lastSessionDate: sortedSessions[0]?.session_start || '',
        avgSessionDuration: studentSessions.length > 0 ? totalDuration / studentSessions.length : 0,
        upcomingSessions
      };
    }).sort((a, b) => a.name.localeCompare(b.name)); // Sort by name instead of earnings to show all students consistently
  };

  const studentSummaries = students ? calculateStudentSummaries(students, sessions || []) : [];

  // Adapter and helpers for filtering
  type RawStudent = StudentSummary; // existing type

  function parseMoneyToNumber(v: unknown): number {
    // Accept number or strings like "¥1,200.00" "$1,275.00" "₴540.00"
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const cleaned = v.replace(/[^0-9.,-]/g, "").replace(/,/g, "");
      const num = Number(cleaned);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  }

  function normalizeStudent(row: RawStudent) {
    // Map YOUR real keys to these canonical keys:
    const name = row.name ?? "";
    const pastSessions = row.pastSessions ?? 0;
    const upcomingCount = row.upcomingSessions ?? 0;
    const createdAtRaw = undefined; // No created_at in StudentSummary
    const createdAt = createdAtRaw ? new Date(createdAtRaw) : undefined;
    const totalEarningsNum = parseMoneyToNumber(row.totalEarnings);
    const isFavorite = !!(row.isFavorite ?? false);
    return { ...row, __norm: { name, pastSessions, upcomingCount, createdAt, totalEarningsNum, isFavorite } };
  }

  // Filter state
  const [sortKey, setSortKey] = useState<SortKey>("top_earners");
  const [query, setQuery] = useState("");

  // Build the derived array
  const normalized = useMemo(() => (studentSummaries ?? []).map(normalizeStudent), [studentSummaries]);

  const filteredAndSorted = useMemo(() => {
    const q = query.trim().toLowerCase();

    let arr = normalized.filter(s => {
      const { name } = s.__norm;
      const passesName = q === "" || name.toLowerCase().includes(q);
      return passesName;
    });

    const baseCmp = {
      top_earners: (a: any, b: any) => b.__norm.totalEarningsNum - a.__norm.totalEarningsNum,
      time_newest: (a: any, b: any) => {
        const ad = a.__norm.createdAt?.getTime() ?? -Infinity;
        const bd = b.__norm.createdAt?.getTime() ?? -Infinity;
        return bd - ad; // newest first
      },
      time_oldest: (a: any, b: any) => {
        const ad = a.__norm.createdAt?.getTime() ?? Infinity;
        const bd = b.__norm.createdAt?.getTime() ?? Infinity;
        return ad - bd; // oldest first
      },
      most_sessions: (a: any, b: any) => b.__norm.pastSessions - a.__norm.pastSessions,
      most_upcoming: (a: any, b: any) => b.__norm.upcomingCount - a.__norm.upcomingCount,
      name_asc: (a: any, b: any) => a.__norm.name.localeCompare(b.__norm.name),
      name_desc: (a: any, b: any) => b.__norm.name.localeCompare(a.__norm.name),
    }[sortKey];

    // Wrapper to prioritize favorites first
    const sorter = (a: any, b: any) => {
      // Primary: favorites first
      const favCmp = Number(b.__norm.isFavorite) - Number(a.__norm.isFavorite);
      if (favCmp !== 0) return favCmp;

      // Secondary: existing sort comparator
      return baseCmp(a, b);
    };

    arr.sort(sorter);
    return arr;
  }, [normalized, sortKey, query]);

  // Update count to reflect filtered results
  const count = filteredAndSorted.length;

  // Selection handlers (moved after filteredAndSorted definition)
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSelected = new Set(filteredAndSorted.map(s => s.id));
      setSelectedIds(newSelected);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (studentId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(studentId);
    } else {
      newSelected.delete(studentId);
    }
    setSelectedIds(newSelected);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Check if all visible rows are selected
  const allVisibleSelected = filteredAndSorted.length > 0 && 
    filteredAndSorted.every(student => selectedIds.has(student.id));
    
  // Check if some visible rows are selected (for indeterminate state)
  const someVisibleSelected = filteredAndSorted.some(student => selectedIds.has(student.id));



  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto">
        <header className="bg-white dark:bg-gray-900 border-b border-border dark:border-gray-700 px-6 py-4 transition-colors duration-300 shadow-sm dark:shadow-gray-900/20">
          <div>
            <h1 className="text-2xl font-semibold text-foreground dark:text-gray-100 flex items-center gap-2">🧑‍🎓 Students</h1>
            <p className="text-sm text-muted-foreground dark:text-gray-400 mt-1">
              Manage your student profiles and session history.
            </p>
          </div>
        </header>

        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Student Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex justify-between items-center p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 overflow-auto">
        <header className="bg-white dark:bg-gray-900 border-b border-border dark:border-gray-700 px-6 py-4 transition-colors duration-300 shadow-sm dark:shadow-gray-900/20">
          <div>
            <h1 className="text-2xl font-semibold text-foreground dark:text-gray-100 flex items-center gap-2">🧑‍🎓 Students</h1>
            <p className="text-sm text-muted-foreground dark:text-gray-400 mt-1">
              Manage your student profiles and session history.
            </p>
          </div>
        </header>

        <div className="p-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <p className="text-red-500">
                  Error loading student data. Please try again.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* Header with Enhanced Styling */}
      <header className="bg-white dark:bg-gray-900 border-b border-border dark:border-gray-700 px-6 py-4 animate-fade-in transition-colors duration-300 shadow-sm dark:shadow-gray-900/20">
        <div className="flex items-center justify-between">
          <div className="animate-slide-up">
            <h1 className="text-2xl font-semibold text-foreground dark:text-gray-100 flex items-center gap-2 hover:text-primary dark:hover:text-blue-400 transition-colors duration-200">
              🧑‍🎓 Students
            </h1>
            <p className="text-sm text-muted-foreground dark:text-gray-400 mt-1 animate-slide-up" style={{animationDelay: '0.1s'}}>
              Manage your student profiles and session history.
            </p>
          </div>
          <Button 
            onClick={() => setIsAddStudentOpen(true)}
            className="hover-lift click-scale bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg transition-all duration-200 animate-scale-in"
          >
            <Plus className="w-4 h-4 mr-2 animate-bounce-subtle" />
            Add Student
          </Button>
        </div>
      </header>

      {/* Students Content */}
      <div className="p-6">
        <Card className="dark:bg-card dark:shadow-lg dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 dark:text-gray-100">
              <User className="h-5 w-5 dark:text-gray-300" />
              Student Overview ({count} students)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {studentSummaries.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No students found. Click "Add Student" to create your first student profile.
                </p>
              </div>
            ) : (
              <>
                <StudentFilters
                  sortKey={sortKey}
                  onSortKeyChange={setSortKey}
                  query={query}
                  onQueryChange={setQuery}
                  onReset={() => {
                    setSortKey("top_earners");
                    setQuery("");
                  }}
                />
                
                {/* Bulk Actions Bar */}
                {selectedIds.size > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 mb-4 animate-slide-down">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                          {selectedIds.size} student{selectedIds.size !== 1 ? 's' : ''} selected
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setIsBulkAddTagsOpen(true)}
                          disabled={bulkAddTagsMutation.isPending || safeDeleteStudentMutation.isPending || archiveStudentsMutation.isPending}
                          data-testid="button-bulk-add-tags"
                        >
                          <Tag className="h-4 w-4 mr-1" />
                          Add tags
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            const studentIds = Array.from(selectedIds);
                            // TODO: Add favorite functionality
                            console.log('Favorite students:', studentIds);
                          }}
                          disabled={bulkAddTagsMutation.isPending || safeDeleteStudentMutation.isPending || archiveStudentsMutation.isPending}
                          data-testid="button-bulk-favorite"
                        >
                          <Star className="h-4 w-4 mr-1" />
                          Favorite
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const studentIds = Array.from(selectedIds);
                            openArchive(studentIds);
                          }}
                          disabled={bulkAddTagsMutation.isPending || safeDeleteStudentMutation.isPending || archiveStudentsMutation.isPending}
                          data-testid="button-bulk-archive"
                        >
                          Archive…
                        </Button>
                        <div className="ml-auto" />
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            const studentIds = Array.from(selectedIds);
                            openDelete(studentIds);
                          }}
                          disabled={bulkAddTagsMutation.isPending || safeDeleteStudentMutation.isPending || archiveStudentsMutation.isPending}
                          data-testid="button-bulk-delete"
                        >
                          Delete…
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all students on page"
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead className="text-center">Past Sessions</TableHead>
                    <TableHead className="text-center">Upcoming</TableHead>
                    <TableHead className="text-center">Avg Duration</TableHead>
                    <TableHead className="text-center">Last Session</TableHead>
                    <TableHead className="text-right">Total Earnings</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSorted.map((student, index) => (
                    <TableRow 
                      key={student.id} 
                      className={`group hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/50 dark:hover:from-blue-900/20 dark:hover:to-purple-900/20 transition-all duration-300 hover:shadow-md hover-lift animate-fade-in cursor-pointer ${
                        selectedIds.has(student.id) ? "bg-blue-50/50 dark:bg-blue-900/20" : ""
                      }`}
                      style={{animationDelay: `${index * 0.1}s`}}
                      onClick={() => handleEditStudent(student)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        // Only handle keyboard events when the row itself is focused
                        if (e.currentTarget !== e.target) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleEditStudent(student);
                        }
                      }}
                      aria-label={`Edit student ${sanitizeText(student.name)}`}
                      data-testid={`row-student-${student.id}`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(student.id)}
                          onCheckedChange={(checked) => handleSelectRow(student.id, checked as boolean)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          aria-label={`Select ${sanitizeText(student.name)}`}
                          data-testid={`checkbox-student-${student.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditAvatar(student);
                              }}
                              onKeyDown={(e) => e.stopPropagation()}
                              className="h-10 w-10 rounded-full hover-scale transition-all duration-300 cursor-pointer group-hover:shadow-lg hover:ring-2 hover:ring-blue-200"
                              title="Click to edit avatar"
                            >
                              {(() => {
                                const avatarDisplay = getAvatarDisplay(student.avatarUrl);

                                if (avatarDisplay.type === 'image') {
                                  return (
                                    <img
                                      src={`${avatarDisplay.content}?t=${Date.now()}`}
                                      alt="avatar"
                                      className="w-10 h-10 rounded-full object-cover"
                                      key={`avatar-${student.id}-${student.avatarUrl}`}
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = '/default-avatar.svg';
                                      }}
                                    />
                                  );
                                } else if (avatarDisplay.type === 'emoji') {
                                  return (
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                      <span className="text-lg">{avatarDisplay.content}</span>
                                    </div>
                                  );
                                } else {
                                  return (
                                    <img
                                      src="/default-avatar.svg"
                                      alt="avatar"
                                      className="w-10 h-10 rounded-full object-cover"
                                    />
                                  );
                                }
                              })()}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite.mutate({ id: student.id, next: !student.__norm.isFavorite });
                              }}
                              onKeyDown={(e) => e.stopPropagation()}
                              title={student.__norm.isFavorite ? "Unstar" : "Star"}
                              aria-label={student.__norm.isFavorite ? "Unstar student" : "Star student"}
                              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              aria-pressed={student.__norm.isFavorite}
                              data-testid={`button-star-${student.id}`}
                            >
                              <Star 
                                className={student.__norm.isFavorite 
                                  ? "fill-yellow-400 stroke-yellow-500" 
                                  : "stroke-gray-400"
                                } 
                                size={18} 
                              />
                            </button>
                            <div>
                              <p className="font-medium">{sanitizeText(student.name)}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {student.phone && (
                                  <span className="text-xs text-muted-foreground">📞 {sanitizeText(student.phone)}</span>
                                )}
                                {student.email && (
                                  <span className="text-xs text-muted-foreground">✉️ {sanitizeText(student.email)}</span>
                                )}
                              </div>
                              {student.tags && student.tags.length > 0 && (
                                <div className="flex gap-1 mt-1">
                                  {student.tags.slice(0, 2).map((tag) => (
                                    <Badge key={tag} variant="outline" className="text-xs">
                                      {sanitizeText(tag)}
                                    </Badge>
                                  ))}
                                  {student.tags.length > 2 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{student.tags.length - 2}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>


                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {student.pastSessions}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {student.upcomingSessions > 0 ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            {student.upcomingSessions}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">0</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {Math.round(student.avgSessionDuration)}m
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {student.lastSessionDate ? (
                          <span className="text-sm">
                            {new Date(student.lastSessionDate).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Coins className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-600">
                            {formatCurrency(student.totalEarnings, tutorCurrency)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1 opacity-100 transition-all duration-300">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewHistory(student);
                            }}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50 hover-scale click-scale transition-all duration-200 hover:shadow-md"
                            title="View session history"
                          >
                            <Calendar className="h-4 w-4 hover:animate-bounce-subtle transition-transform duration-200" />
                          </Button>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                                className="text-gray-600 hover:text-gray-700 hover:bg-gray-50 hover-scale click-scale transition-all duration-200 hover:shadow-md"
                                title="More actions"
                                data-testid={`button-more-${student.id}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleEditStudent(student);
                              }}>
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                // TODO: Add schedule session functionality
                                console.log('Schedule session for:', student.name);
                              }}>
                                Schedule session
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                openArchive([student.id]);
                              }}>
                                Archive…
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDelete([student.id]);
                                }}
                              >
                                Delete…
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Student Modal */}
      <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
            <DialogDescription>
              Enter the name of the new student you'd like to add to your roster.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="student-name">Student Name</Label>
              <Input
                id="student-name"
                placeholder="Enter student name"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddStudent();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddStudentOpen(false);
                setNewStudentName('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddStudent}
              disabled={addStudentMutation.isPending}
            >
              {addStudentMutation.isPending ? "Adding..." : "Add Student"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Student Modal */}
      <EditStudentModal
        isOpen={isEditStudentOpen}
        onClose={() => {
          setIsEditStudentOpen(false);
          setStudentToEdit(null);
        }}
        student={studentToEdit}
      />

      {/* Avatar Editor Modal */}
      <AvatarEditorModal
        isOpen={isAvatarEditorOpen}
        onClose={() => {
          setIsAvatarEditorOpen(false);
          setStudentForAvatar(null);
        }}
        student={studentForAvatar}
      />

      {/* Student Session History Modal */}
      <StudentSessionHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setStudentForHistory(null);
        }}
        student={studentForHistory}
      />

      {/* Bulk Add Tags Dialog */}
      <Dialog open={isBulkAddTagsOpen} onOpenChange={setIsBulkAddTagsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Add Tags to {selectedIds.size} Student{selectedIds.size !== 1 ? 's' : ''}
            </DialogTitle>
            <DialogDescription>
              Select or create tags to add to the selected students. Existing tags will be preserved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Tags</Label>
              <CreatableSelect
                isMulti
                value={bulkSelectedTags}
                onChange={(newValue) => setBulkSelectedTags(Array.from(newValue || []))}
                options={existingTagOptions}
                placeholder="Select or create tags..."
                noOptionsMessage={() => "Type to create a new tag"}
                formatCreateLabel={(inputValue) => `Create "${inputValue}"`}
                styles={{
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
                }}
                isDisabled={bulkAddTagsMutation.isPending}
                className="react-select-container"
                classNamePrefix="react-select"
                data-testid="select-bulk-tags"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Create custom tags to organize and categorize students.
              </p>
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsBulkAddTagsOpen(false);
                setBulkSelectedTags([]);
              }}
              disabled={bulkAddTagsMutation.isPending}
              data-testid="button-cancel-bulk-tags"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (bulkSelectedTags.length > 0) {
                  bulkAddTagsMutation.mutate(bulkSelectedTags.map(tag => tag.value));
                }
              }}
              disabled={bulkAddTagsMutation.isPending || bulkSelectedTags.length === 0}
              className="flex items-center gap-2"
              data-testid="button-confirm-bulk-tags"
            >
              {bulkAddTagsMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Adding...
                </>
              ) : (
                <>
                  <Tag className="h-4 w-4" />
                  Add Tags
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Delete Student Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{studentToDelete}</strong> and all their sessions?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setStudentToDelete('');
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteStudent}
              disabled={safeDeleteStudentMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {safeDeleteStudentMutation.isPending ? "Deleting..." : "Delete Student"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New UI-friendly Confirmation Dialog */}
      {confirm && (
        <ConfirmDialog
          open={!!confirm}
          onOpenChange={(v) => !v && setConfirm(null)}
          title={
            confirm.kind === "archive"
              ? `Archive ${confirm.ids.length} student${confirm.ids.length > 1 ? "s" : ""}?`
              : `Delete ${confirm.ids.length} student${confirm.ids.length > 1 ? "s" : ""}?`
          }
          description={
            confirm.kind === "archive"
              ? "They will be hidden from lists but remain in reports."
              : "Only students with zero sessions will be deleted. Others will remain. Consider archiving instead."
          }
          confirmLabel={confirm.kind === "archive" ? "Archive" : "Delete"}
          variant={confirm.kind === "archive" ? "default" : "destructive"}
          loading={confirmLoading}
          onConfirm={async () => {
            try {
              setConfirmLoading(true);
              if (confirm.kind === "archive") {
                await archiveStudentsMutation.mutateAsync(confirm.ids);
              } else {
                await safeDeleteStudentMutation.mutateAsync(confirm.ids);
              }
              setConfirm(null);
            } catch (error) {
              // Error handling is already in the mutations
              console.error('Confirmation action failed:', error);
            } finally {
              setConfirmLoading(false);
            }
          }}
        />
      )}
    </div>
  );
}