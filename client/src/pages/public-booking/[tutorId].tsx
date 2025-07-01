import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { Calendar, Clock, User, CheckCircle, AlertCircle, X, Globe } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, parseISO, isFuture } from "date-fns";
import { TIMEZONE_GROUPS, getBrowserTimezone, getTimezoneDisplayName } from "@/lib/timezones";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

// Helper function to get initials from full name
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .substring(0, 2)
    .toUpperCase();
};

// Form validation schema
const bookingFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name too long"),
  selectedSlotId: z.string().min(1, "Please select a time slot"),
  selectedStartTime: z.string().min(1, "Please select a start time"),
  selectedDuration: z.number().min(30, "Duration must be at least 30 minutes"),
});

type BookingFormData = z.infer<typeof bookingFormSchema>;

interface BookingSlot {
  id: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  tutor_id: string;
}

interface Tutor {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
}

interface ExistingSession {
  start_time: string;
  status: string;
}

export default function PublicBookingPage() {
  const params = useParams();
  const tutorId = params.tutorId;
  const { toast } = useToast();

  const [tutor, setTutor] = useState<Tutor | null>(null);
  const [bookingSlots, setBookingSlots] = useState<BookingSlot[]>([]);
  const [existingSessions, setExistingSessions] = useState<ExistingSession[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [selectedStartTime, setSelectedStartTime] = useState<string>("");
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  const [availableStartTimes, setAvailableStartTimes] = useState<string[]>([]);
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  
  // Student timezone handling
  const [studentTimezone, setStudentTimezone] = useState<string>(() => {
    // Try to get from localStorage first, then browser detection
    const saved = localStorage.getItem('studentTimezone');
    const detected = saved || getBrowserTimezone();
    console.log('Initial student timezone setup:', {
      saved,
      browserDetected: getBrowserTimezone(),
      final: detected
    });
    return detected;
  });
  const [showTimezoneSelector, setShowTimezoneSelector] = useState(false);

  // Save student timezone to localStorage when changed
  useEffect(() => {
    localStorage.setItem('studentTimezone', studentTimezone);
    console.log('Student timezone updated:', {
      newTimezone: studentTimezone,
      displayName: getTimezoneDisplayName(studentTimezone),
      browserDetected: getBrowserTimezone()
    });
  }, [studentTimezone]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      name: "",
      selectedSlotId: "",
      selectedStartTime: "",
      selectedDuration: 60,
    },
  });

  const watchedSlotId = watch("selectedSlotId");
  const watchedStartTime = watch("selectedStartTime");
  const watchedDuration = watch("selectedDuration");

  useEffect(() => {
    if (!tutorId) return;
    
    // Log Supabase configuration for debugging mobile issues
    console.log('Mobile booking page - Supabase config:', {
      url: import.meta.env.VITE_SUPABASE_URL?.substring(0, 30) + '...',
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Present' : 'Missing',
      anonKeyPrefix: import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 10) + '...',
      tutorId: tutorId,
      userAgent: navigator.userAgent,
      isMobile: /Mobi|Android/i.test(navigator.userAgent)
    });
    
    fetchTutorAndSlots();
  }, [tutorId]);

  const fetchTutorAndSlots = async (retryCount = 0) => {
    try {
      setLoading(true);
      console.log(`Mobile booking - Attempt ${retryCount + 1} for tutor ID: ${tutorId}`);

      // Retry logic with progressive delays for mobile reliability
      const maxRetries = 3;
      let tutorData = null;
      let tutorError = null;

      // Fetch tutor details with retry
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          console.log(`Fetching tutor data - attempt ${attempt + 1}, tutorId: ${tutorId}`);
          
          // Add timeout for mobile reliability
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 10000)
          );
          
          const fetchPromise = supabase
            .from('tutors')
            .select('id, full_name, email, avatar_url')
            .eq('id', tutorId)
            .single();
          
          const result = await Promise.race([fetchPromise, timeoutPromise]);

          if (result.error) {
            tutorError = result.error;
            console.error(`Tutor fetch attempt ${attempt + 1} failed:`, {
              error: result.error,
              code: result.error.code,
              message: result.error.message,
              details: result.error.details
            });
            
            // Wait before retry (except on last attempt)
            if (attempt < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
              continue;
            }
          } else {
            tutorData = result.data;
            console.log('Tutor data fetched successfully:', tutorData);
            break;
          }
        
        } catch (err) {
          console.error(`Tutor fetch attempt ${attempt + 1} exception:`, {
            error: err,
            message: err.message,
            stack: err.stack
          });
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
          tutorError = err;
        }
      }

      if (!tutorData) {
        throw tutorError || new Error('Failed to fetch tutor data after all attempts');
      }

      // Fetch booking slots
      const { data: slotsData, error: slotsError } = await supabase
        .from('booking_slots')
        .select('*')
        .eq('tutor_id', tutorId)
        .eq('is_active', true)
        .gte('end_time', new Date().toISOString());

      if (slotsError) {
        console.error('Error fetching booking slots:', slotsError);
        throw slotsError;
      }

      // Fetch existing sessions to check availability
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('session_start, status')
        .eq('tutor_id', tutorId)
        .gte('session_start', new Date().toISOString());

      if (sessionsError) {
        console.error('Error fetching existing sessions:', sessionsError);
        throw sessionsError;
      }

      // Transform session data to match expected format
      const transformedSessions = sessionsData.map(session => ({
        start_time: session.session_start,
        status: session.status
      }));

      setTutor(tutorData);
      setBookingSlots(slotsData || []);
      setExistingSessions(transformedSessions || []);

      console.log('Mobile booking - Data fetched successfully:', {
        tutor: tutorData?.full_name,
        slotsCount: slotsData?.length || 0,
        sessionsCount: transformedSessions?.length || 0,
        studentTimezone
      });

    } catch (error) {
      console.error('Mobile booking - Error fetching data:', {
        error,
        message: error.message,
        retryCount,
        tutorId
      });
      
      // Always show toast immediately for user feedback
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Could not load booking information. Please check your connection and try again.",
      });
      
      // Only auto-retry on first failure
      if (retryCount === 0) {
        console.log('Mobile booking - Auto-retrying after error...');
        setTimeout(() => {
          fetchTutorAndSlots(1);
        }, 2000);
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <User className="h-6 w-6" />
              Book a Session with {tutor?.full_name || 'Loading...'}
            </CardTitle>
            <p className="text-gray-600 dark:text-gray-400">
              Select an available time slot and enter your name to request a booking.
            </p>
          </CardHeader>
          
          <CardContent className="pt-0">
            {/* Tutor Profile Section - Only show when tutor is loaded */}
            {tutor && (
              <div className="flex items-center gap-4 mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg border border-blue-100 dark:border-blue-800">
                <Avatar className="h-16 w-16 sm:h-20 sm:w-20 ring-4 ring-white dark:ring-gray-800 shadow-lg">
                  <AvatarImage 
                    src={tutor.avatar_url} 
                    alt={tutor.full_name}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold text-lg sm:text-xl">
                    {getInitials(tutor.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    {tutor.full_name}
                  </h2>
                  <p className="text-blue-600 dark:text-blue-400 text-sm sm:text-base font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Certified tutor – Book a session below
                  </p>
                </div>
              </div>
            )}

            {/* Loading state */}
            {loading && (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            )}

            {/* Error/No slots state */}
            {!loading && !tutor && (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Tutor Not Found
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  The requested tutor could not be found. Please check the link and try again.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}