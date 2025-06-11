import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useToast } from "@/hooks/use-toast";
import { 
  User, 
  Calendar,
  Coins,
  Clock,
  Plus,
  Trash2,
  Edit
} from "lucide-react";
import { EditStudentModal } from "@/components/modals/edit-student-modal";

interface Session {
  id: string;
  student_id: string;
  student_name: string;
  date: string;
  time: string;
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
  totalSessions: number;
  totalEarnings: number;
  lastSessionDate: string;
  avgSessionDuration: number;
  upcomingSessions: number;
}

export default function Students() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Modal states
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isEditStudentOpen, setIsEditStudentOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<string>('');
  const [studentToEdit, setStudentToEdit] = useState<StudentSummary | null>(null);
  const [newStudentName, setNewStudentName] = useState('');

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

  // Mutation for deleting a student
  const deleteStudentMutation = useMutation({
    mutationFn: async (studentName: string) => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated or tutor record not found');
      }

      // First, get the student ID
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('name', studentName)
        .eq('tutor_id', tutorId)
        .single();

      if (studentError) {
        console.error('Error finding student:', studentError);
        throw studentError;
      }

      // Delete all sessions for this student first (if any exist)
      const { error: sessionsError } = await supabase
        .from('sessions')
        .delete()
        .eq('student_id', student.id);

      if (sessionsError) {
        console.error('Error deleting student sessions:', sessionsError);
        throw sessionsError;
      }

      // Then delete the student
      const { error: deleteError } = await supabase
        .from('students')
        .delete()
        .eq('id', student.id);

      if (deleteError) {
        console.error('Error deleting student:', deleteError);
        throw deleteError;
      }

      return { studentName };
    },
    onSuccess: (data) => {
      toast({
        title: "Student Deleted",
        description: `${data.studentName} and all their sessions have been deleted.`,
      });
      setIsDeleteDialogOpen(false);
      setStudentToDelete('');
      queryClient.invalidateQueries({ queryKey: ['student-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete student. Please try again.",
        variant: "destructive",
      });
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

  const handleDeleteStudent = (studentName: string) => {
    setStudentToDelete(studentName);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteStudent = () => {
    if (studentToDelete) {
      deleteStudentMutation.mutate(studentToDelete);
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

  // Fetch students data
  const { data: students, isLoading: isLoadingStudents } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated or tutor record not found');
      }

      const { data, error } = await supabase
        .from('students')
        .select('id, name, phone, email, tags')
        .eq('tutor_id', tutorId)
        .order('name');

      if (error) {
        console.error('Error fetching students:', error);
        throw error;
      }

      return data || [];
    },
  });

  // Fetch sessions data
  const { data: sessions, isLoading: isLoadingSessions, error } = useQuery({
    queryKey: ['student-sessions'],
    queryFn: async () => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated or tutor record not found');
      }

      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          student_id,
          date,
          time,
          duration,
          rate,
          paid,
          created_at,
          students (
            id,
            name,
            phone,
            email,
            tags
          )
        `)
        .eq('tutor_id', tutorId)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching student data:', error);
        throw error;
      }

      // Transform the data to include student_name
      const sessionsWithNames = data?.map((session: any) => ({
        ...session,
        student_name: session.students?.name || 'Unknown Student'
      })) || [];

      return sessionsWithNames as Session[];
    },
  });

  const isLoading = isLoadingStudents || isLoadingSessions;

  // Set up Supabase realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('student-sessions-changes')
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Calculate student summaries with correct business logic
  const calculateStudentSummaries = (students: any[], sessions: Session[]): StudentSummary[] => {
    if (!students || students.length === 0) return [];

    const now = new Date();
    const sessionsByStudentId = new Map<string, Session[]>();

    // Group sessions by student_id
    sessions?.forEach(session => {
      if (!sessionsByStudentId.has(session.student_id)) {
        sessionsByStudentId.set(session.student_id, []);
      }
      sessionsByStudentId.get(session.student_id)!.push(session);
    });

    return students.map(student => {
      const studentSessions = sessionsByStudentId.get(student.id) || [];
      let totalEarnings = 0;
      let totalDuration = 0;
      let upcomingSessions = 0;

      studentSessions.forEach(session => {
        const sessionDate = new Date(session.date);
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

      const sortedSessions = studentSessions.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      return {
        id: student.id,
        name: student.name,
        phone: student.phone,
        email: student.email,
        tags: student.tags || [],
        totalSessions: studentSessions.length,
        totalEarnings,
        lastSessionDate: sortedSessions[0]?.date || '',
        avgSessionDuration: studentSessions.length > 0 ? totalDuration / studentSessions.length : 0,
        upcomingSessions
      };
    }).sort((a, b) => b.totalEarnings - a.totalEarnings);
  };

  const studentSummaries = students && sessions ? calculateStudentSummaries(students, sessions) : [];

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto">
        <header className="bg-white border-b border-border px-6 py-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">🧑‍🎓 Students</h1>
            <p className="text-sm text-muted-foreground mt-1">
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
        <header className="bg-white border-b border-border px-6 py-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">🧑‍🎓 Students</h1>
            <p className="text-sm text-muted-foreground mt-1">
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
      {/* Header */}
      <header className="bg-white border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">🧑‍🎓 Students</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your student profiles and session history.
            </p>
          </div>
          <Button onClick={() => setIsAddStudentOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Student
          </Button>
        </div>
      </header>

      {/* Students Content */}
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Student Overview ({studentSummaries.length} students)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {studentSummaries.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No students found. Start by scheduling your first session.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead className="text-center">Total Sessions</TableHead>
                    <TableHead className="text-center">Upcoming</TableHead>
                    <TableHead className="text-center">Avg Duration</TableHead>
                    <TableHead className="text-center">Last Session</TableHead>
                    <TableHead className="text-right">Total Earnings</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentSummaries.map((student) => (
                    <TableRow key={student.name}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <User className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">{student.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {student.phone && (
                                <span className="text-xs text-muted-foreground">📞 {student.phone}</span>
                              )}
                              {student.email && (
                                <span className="text-xs text-muted-foreground">✉️ {student.email}</span>
                              )}
                            </div>
                            {student.tags && student.tags.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {student.tags.slice(0, 2).map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    {tag}
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
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {student.totalSessions}
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
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditStudent(student)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteStudent(student.name)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
              disabled={deleteStudentMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteStudentMutation.isPending ? "Deleting..." : "Delete Student"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}