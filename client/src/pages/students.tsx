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
  Trash2
} from "lucide-react";

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
  name: string;
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<string>('');
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

  const { data: sessions, isLoading, error } = useQuery({
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
            name
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
  const calculateStudentSummaries = (sessions: Session[]): StudentSummary[] => {
    if (!sessions || sessions.length === 0) return [];

    const now = new Date();
    const studentMap = new Map<string, {
      sessions: Session[];
      totalEarnings: number;
      totalDuration: number;
      upcomingSessions: number;
    }>();

    sessions.forEach(session => {
      const sessionDate = new Date(session.date);
      const earnings = (session.duration / 60) * session.rate;
      const isPaid = session.paid === true;
      
      if (!studentMap.has(session.student_name)) {
        studentMap.set(session.student_name, {
          sessions: [],
          totalEarnings: 0,
          totalDuration: 0,
          upcomingSessions: 0
        });
      }

      const studentData = studentMap.get(session.student_name)!;
      studentData.sessions.push(session);
      
      // Only count earnings from paid sessions
      if (isPaid) {
        studentData.totalEarnings += earnings;
      }
      
      studentData.totalDuration += session.duration;
      
      if (sessionDate >= now) {
        studentData.upcomingSessions++;
      }
    });

    return Array.from(studentMap.entries()).map(([name, data]) => {
      const sortedSessions = data.sessions.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      return {
        name,
        totalSessions: data.sessions.length,
        totalEarnings: data.totalEarnings,
        lastSessionDate: sortedSessions[0]?.date || '',
        avgSessionDuration: data.totalDuration / data.sessions.length,
        upcomingSessions: data.upcomingSessions
      };
    }).sort((a, b) => b.totalEarnings - a.totalEarnings);
  };

  const studentSummaries = sessions ? calculateStudentSummaries(sessions) : [];

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto">
        <header className="bg-white border-b border-border px-6 py-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Students</h1>
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
            <h1 className="text-2xl font-semibold text-foreground">Students</h1>
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
            <h1 className="text-2xl font-semibold text-foreground">Students</h1>
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
                            <p className="text-sm text-muted-foreground">
                              Active student
                            </p>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteStudent(student.name)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
