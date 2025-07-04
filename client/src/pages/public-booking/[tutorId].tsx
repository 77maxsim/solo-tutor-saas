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

  const isSlotBooked = (slotStartTime: string) => {
    return existingSessions.some(session => 
      session.start_time === slotStartTime
    );
  };

  const getAvailableSlots = () => {
    const filtered = bookingSlots.filter(slot => !isSlotBooked(slot.start_time));
    console.log('Available slots filtered:', {
      totalSlots: bookingSlots.length,
      availableSlots: filtered.length,
      studentTimezone,
      sampleConversion: filtered[0] ? {
        utc: filtered[0].start_time,
        local: dayjs.utc(filtered[0].start_time).tz(studentTimezone).format('YYYY-MM-DD HH:mm A')
      } : null
    });
    return filtered;
  };

  const generateTimeSlots = (startTime: string, endTime: string) => {
    const slots = [];
    const start = dayjs.utc(startTime).tz(studentTimezone);
    const end = dayjs.utc(endTime).tz(studentTimezone);
    
    let current = start;
    while (current.isBefore(end)) {
      slots.push(current.format('HH:mm'));
      current = current.add(15, 'minute');
    }
    
    return slots;
  };

  const isTimeSlotAvailable = (startTime: string, duration: number) => {
    if (!selectedSlot) return false;
    
    const slot = bookingSlots.find(s => s.id === selectedSlot);
    if (!slot) return false;
    
    const slotDate = dayjs.utc(slot.start_time).format('YYYY-MM-DD');
    const localDateTime = dayjs.tz(`${slotDate}T${startTime}:00`, studentTimezone);
    const utcDateTime = localDateTime.utc();
    const requestedStartUTC = utcDateTime.toDate();
    const requestedEndUTC = new Date(requestedStartUTC.getTime() + duration * 60 * 1000);
    
    return !existingSessions.some(session => {
      if (!session.start_time) return false;
      const sessionStart = new Date(session.start_time);
      return Math.abs(sessionStart.getTime() - requestedStartUTC.getTime()) < 30 * 60 * 1000;
    });
  };

  const handleTimePickerSubmit = () => {
    if (!selectedStartTime || !selectedDuration) {
      toast({
        variant: "destructive",
        title: "Missing Selection",
        description: "Please select both start time and duration.",
      });
      return;
    }
    
    setValue("selectedStartTime", selectedStartTime);
    setValue("selectedDuration", selectedDuration);
    setShowTimePickerModal(false);
    
    console.log('Time picker selection:', {
      startTime: selectedStartTime,
      duration: selectedDuration,
      slot: selectedSlot
    });
  };

  // Sanitize payload to ensure only valid session fields are included
  const sanitizePayloadForSessionInsert = (payload: any) => {
    const allowedFields = [
      'tutor_id',
      'student_id', 
      'unassigned_name',
      'session_start',
      'session_end', 
      'duration',
      'rate',
      'status',
      'notes',
      'color',
      'paid',
      'recurrence_id',
      'recurrence_group_id'
    ];

    const sanitized = {};
    allowedFields.forEach(field => {
      if (payload[field] !== undefined) {
        sanitized[field] = payload[field];
      }
    });

    // Ensure required fields match the working deployed version
    sanitized.status = payload.status || 'pending';
    sanitized.student_id = null; // Always null for public bookings
    sanitized.paid = payload.paid !== undefined ? payload.paid : false;
    
    // Rate must be string for decimal field compatibility
    if (payload.rate !== undefined) {
      sanitized.rate = typeof payload.rate === 'string' ? payload.rate : String(payload.rate);
    }
    
    // Ensure unassigned_name is present
    if (payload.unassigned_name && payload.unassigned_name.trim() !== '') {
      sanitized.unassigned_name = payload.unassigned_name.trim();
    }

    console.log('Payload sanitization:', {
      original: payload,
      sanitized: sanitized,
      removedFields: Object.keys(payload).filter(key => !allowedFields.includes(key)),
      requiredFieldsSet: {
        status: sanitized.status,
        student_id: sanitized.student_id,
        unassigned_name: sanitized.unassigned_name
      }
    });

    console.log("🧪 Final Booking Payload", sanitized);

    return sanitized;
  };

  const onSubmit = async (data: BookingFormData) => {
    try {
      setSubmitting(true);
      console.log('Form submission started:', data);

      const slot = bookingSlots.find(s => s.id === data.selectedSlotId);
      if (!slot) {
        throw new Error('Selected slot not found');
      }

      if (!data.selectedStartTime || !data.selectedDuration) {
        throw new Error('Please select a start time and duration');
      }

      if (!isTimeSlotAvailable(data.selectedStartTime, data.selectedDuration)) {
        toast({
          variant: "destructive",
          title: "Time Slot Unavailable",
          description: "This time slot is no longer available. Please select a different time.",
        });
        return;
      }

      const slotDate = dayjs.utc(slot.start_time).format('YYYY-MM-DD');
      const localDateTime = dayjs.tz(`${slotDate}T${data.selectedStartTime}:00`, studentTimezone);
      const utcDateTime = localDateTime.utc();
      
      console.log('Booking submission timezone conversion:', {
        studentTimezone,
        selectedTime: data.selectedStartTime,
        slotDate,
        localDateTime: localDateTime.format(),
        utcDateTime: utcDateTime.format(),
        duration: data.selectedDuration
      });

      const sessionStartUTC = utcDateTime.toISOString();
      const sessionEndUTC = utcDateTime.add(data.selectedDuration, 'minute').toISOString();

      // Create payload matching the working deployed version
      const bookingData = {
        tutor_id: tutorId,
        student_id: null,
        session_start: sessionStartUTC,
        session_end: sessionEndUTC,
        duration: data.selectedDuration,
        rate: "0", // Must be string for decimal field - this was the missing piece!
        paid: false,
        unassigned_name: data.name.trim(),
        notes: `Booking request from ${data.name.trim()}`,
        status: 'pending'
      };

      console.log("Submitting session:", bookingData);
      
      // Add debug toast
      toast({
        title: "Submitting Booking...",
        description: `Booking ${data.name} for ${data.selectedStartTime} (${data.selectedDuration} min)`,
      });

      // Create session record using exact same approach as working version
      const { error } = await supabase
        .from('sessions')
        .insert(bookingData);

      if (error) {
        throw error;
      }

      setBookingSuccess(true);
      toast({
        title: "Booking Request Submitted!",
        description: "Your booking request has been sent to the tutor. They will contact you soon.",
      });

      // Refresh available slots
      await fetchTutorAndSlots();

    } catch (error) {
      console.error('Booking submission failed:', {
        error,
        bookingData
      });
      toast({
        variant: "destructive",
        title: "Booking Failed",
        description: `Could not submit your booking request. ${error.message || 'Please try again.'}`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle success state
  if (bookingSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <Card>
            <CardContent className="text-center py-12">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Booking Request Submitted!
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
                Thank you for your booking request. {tutor?.full_name} will review your request and contact you soon.
              </p>
              <Button 
                onClick={() => setBookingSuccess(false)}
                variant="outline"
              >
                Book Another Session
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const availableSlots = getAvailableSlots();

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

            {/* Student Timezone Selector */}
            <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800 mb-6">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Your Timezone</p>
                        <p className="text-xs text-blue-700 dark:text-blue-400">
                          All times shown in: {getTimezoneDisplayName(studentTimezone)}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowTimezoneSelector(!showTimezoneSelector)}
                        className="text-blue-700 border-blue-300 hover:bg-blue-100 dark:text-blue-300 dark:border-blue-600 dark:hover:bg-blue-900"
                      >
                        Change
                      </Button>
                    </div>
                    
                    {showTimezoneSelector && (
                      <div className="mt-3">
                        <Select
                          value={studentTimezone}
                          onValueChange={(value) => {
                            setStudentTimezone(value);
                            setShowTimezoneSelector(false);
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select timezone" />
                          </SelectTrigger>
                          <SelectContent>
                            {TIMEZONE_GROUPS.map((group) => (
                              <div key={group.label}>
                                <div className="px-2 py-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400">
                                  {group.label}
                                </div>
                                {group.timezones.map((tz) => (
                                  <SelectItem key={tz.value} value={tz.value}>
                                    {tz.label}
                                  </SelectItem>
                                ))}
                              </div>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

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

            {/* No available slots */}
            {!loading && tutor && bookingSlots.length === 0 && (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  No Available Slots
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  There are currently no available booking slots. Please check back later.
                </p>
              </div>
            )}

            {/* Booking Form */}
            {!loading && tutor && bookingSlots.length > 0 && (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Student Name */}
                <div>
                  <Label htmlFor="name">Your Name *</Label>
                  <Input
                    id="name"
                    {...register("name")}
                    placeholder="Enter your full name"
                    className="mt-1"
                  />
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
                  )}
                </div>

                {/* Available Time Slots */}
                <div>
                  <Label>Available Time Slots *</Label>
                  <div className="grid gap-3 mt-2">
                    {availableSlots.map((slot) => {
                        const slotDateTime = dayjs.utc(slot.start_time).tz(studentTimezone);
                        const endDateTime = dayjs.utc(slot.end_time).tz(studentTimezone);
                        const isSelected = watchedSlotId === slot.id;
                        
                        return (
                          <div
                            key={slot.id}
                            className={`p-4 border rounded-lg cursor-pointer transition-all ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                                : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
                            }`}
                            onClick={() => {
                              setValue("selectedSlotId", slot.id);
                              setSelectedSlot(slot.id);
                              setShowTimePickerModal(true);
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                  {slotDateTime.format('dddd, MMMM D')}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  {slotDateTime.format('h:mm A')} - {endDateTime.format('h:mm A')}
                                </p>
                              </div>
                              {isSelected && (
                                <CheckCircle className="h-5 w-5 text-blue-500" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  {errors.selectedSlotId && (
                    <p className="text-red-500 text-sm mt-1">{errors.selectedSlotId.message}</p>
                  )}
                </div>

                {/* Session Summary */}
                {selectedStartTime && selectedDuration && (
                  <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-green-800 dark:text-green-200">
                          Session Summary
                        </p>
                        <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                          You are booking with {tutor?.full_name}
                        </p>
                        {(() => {
                          const selectedSlotData = bookingSlots.find(s => s.id === selectedSlot);
                          if (selectedSlotData) {
                            const slotDate = dayjs.utc(selectedSlotData.start_time).tz(studentTimezone).format('YYYY-MM-DD');
                            const localStartDateTime = dayjs.tz(`${slotDate}T${selectedStartTime}:00`, studentTimezone);
                            const localEndDateTime = localStartDateTime.add(selectedDuration, 'minute');

                            return (
                              <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                                <p>📅 {localStartDateTime.format('dddd, MMMM D, YYYY')}</p>
                                <p>🕒 {localStartDateTime.format('h:mm A')} - {localEndDateTime.format('h:mm A')} ({getTimezoneDisplayName(studentTimezone)})</p>
                                <p>⏱️ Duration: {selectedDuration} minutes</p>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={submitting || !watchedSlotId || !selectedStartTime}
                >
                  {submitting ? "Submitting Request..." : "Request Booking"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Time Picker Modal */}
        <Dialog open={showTimePickerModal} onOpenChange={setShowTimePickerModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Select Session Time</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Selected Slot Info */}
              {selectedSlot && (() => {
                const slot = bookingSlots.find(s => s.id === selectedSlot);
                if (!slot) return null;
                
                const slotDateTime = dayjs.utc(slot.start_time).tz(studentTimezone);
                const endDateTime = dayjs.utc(slot.end_time).tz(studentTimezone);
                
                return (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="font-medium text-blue-900 dark:text-blue-200">
                      {slotDateTime.format('dddd, MMMM D')}
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                      Available: {slotDateTime.format('h:mm A')} - {endDateTime.format('h:mm A')}
                    </p>
                  </div>
                );
              })()}

              {/* Start Time Selection */}
              <div>
                <Label htmlFor="startTime">Start Time *</Label>
                <Select
                  value={selectedStartTime}
                  onValueChange={setSelectedStartTime}
                >
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Select start time" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedSlot && (() => {
                      const slot = bookingSlots.find(s => s.id === selectedSlot);
                      if (!slot) return [];
                      
                      const timeSlots = generateTimeSlots(slot.start_time, slot.end_time);
                      
                      return timeSlots.map((time) => (
                        <SelectItem key={time} value={time}>
                          {dayjs(`2024-01-01T${time}`).format('h:mm A')}
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>

              {/* Duration Selection */}
              <div>
                <Label htmlFor="duration">Session Duration *</Label>
                <Select
                  value={selectedDuration.toString()}
                  onValueChange={(value) => setSelectedDuration(parseInt(value))}
                >
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Preview */}
              {selectedStartTime && selectedDuration && selectedSlot && (() => {
                const slot = bookingSlots.find(s => s.id === selectedSlot);
                if (!slot) return null;
                
                const slotDate = dayjs.utc(slot.start_time).tz(studentTimezone).format('YYYY-MM-DD');
                const startDateTime = dayjs.tz(`${slotDate}T${selectedStartTime}:00`, studentTimezone);
                const endDateTime = startDateTime.add(selectedDuration, 'minute');
                
                return (
                  <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      Session Preview
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-300">
                      {startDateTime.format('h:mm A')} - {endDateTime.format('h:mm A')} ({selectedDuration} min)
                    </p>
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowTimePickerModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleTimePickerSubmit}
                  disabled={!selectedStartTime || !selectedDuration}
                  className="flex-1"
                >
                  Confirm Selection
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}