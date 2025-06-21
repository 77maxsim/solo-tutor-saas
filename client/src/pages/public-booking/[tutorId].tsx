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
            .select('id, full_name, email')
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
        throw new Error(`Tutor not found after ${maxRetries} attempts: ${tutorError?.message || 'Unknown error'}`);
      }

      setTutor(tutorData);

      // Fetch available booking slots with retry
      let slotsData = [];
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          console.log(`Fetching booking slots - attempt ${attempt + 1}`);
          const result = await supabase
            .from('booking_slots')
            .select('id, start_time, end_time, is_active, tutor_id')
            .eq('tutor_id', tutorId)
            .eq('is_active', true)
            .order('start_time', { ascending: true });

          if (result.error) {
            console.error(`Slots fetch attempt ${attempt + 1} failed:`, result.error);
            if (attempt < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
              continue;
            }
          } else {
            slotsData = result.data || [];
            console.log('Booking slots fetched successfully:', slotsData.length);
            break;
          }
        } catch (err) {
          console.error(`Slots fetch attempt ${attempt + 1} exception:`, err);
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
            continue;
          }
        }
      }

      // Filter out past slots - check against student's timezone
      const futureSlots = slotsData.filter(slot => {
        const utcSlotTime = dayjs.utc(slot.start_time);
        const localSlotTime = utcSlotTime.tz(studentTimezone);
        const isInFuture = localSlotTime.isAfter(dayjs().tz(studentTimezone));
        
        console.log('Slot time check:', {
          slotId: slot.id,
          utcTime: utcSlotTime.format(),
          localTime: localSlotTime.format(),
          currentTime: dayjs().tz(studentTimezone).format(),
          isInFuture,
          studentTimezone
        });
        
        return isInFuture;
      });
      setBookingSlots(futureSlots);

      // Fetch existing sessions to check for conflicts (with retry)
      let sessionsData = [];
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          console.log(`Fetching existing sessions - attempt ${attempt + 1}`);
          const result = await supabase
            .from('sessions')
            .select('date, time')
            .eq('tutor_id', tutorId);

          if (result.error) {
            console.error(`Sessions fetch attempt ${attempt + 1} failed:`, result.error);
            if (attempt < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
              continue;
            }
          } else {
            sessionsData = result.data || [];
            console.log('Existing sessions fetched successfully:', sessionsData.length);
            break;
          }
        } catch (err) {
          console.error(`Sessions fetch attempt ${attempt + 1} exception:`, err);
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
            continue;
          }
        }
      }

      // Convert date/time format to match booking slots
      const sessions = sessionsData.map(session => ({
        start_time: `${session.date}T${session.time}:00`,
        status: 'booked',
      }));
      setExistingSessions(sessions);

      console.log('Mobile booking - All data fetched successfully');

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

  const handleSlotSelect = (slotId: string) => {
    setSelectedSlot(slotId);
    setValue("selectedSlotId", slotId);
    
    // Generate available start times for this slot
    const slot = bookingSlots.find(s => s.id === slotId);
    if (slot) {
      const startTimes = generateAvailableStartTimes(slot);
      setAvailableStartTimes(startTimes);
      
      // Reset time selection
      setSelectedStartTime("");
      setSelectedDuration(60);
      setValue("selectedStartTime", "");
      setValue("selectedDuration", 60);
      
      // Open time picker modal
      setShowTimePickerModal(true);
    }
  };

  const generateAvailableStartTimes = (slot: BookingSlot): string[] => {
    const startDateTime = parseISO(slot.start_time);
    const endDateTime = parseISO(slot.end_time);
    const times: string[] = [];
    
    // Generate 30-minute intervals
    let current = new Date(startDateTime);
    while (current < endDateTime) {
      const timeString = format(current, 'HH:mm');
      times.push(timeString);
      current.setMinutes(current.getMinutes() + 30);
    }
    
    return times;
  };

  const getAvailableDurations = (startTime: string): number[] => {
    if (!selectedSlot || !startTime) return [];
    
    const slot = bookingSlots.find(s => s.id === selectedSlot);
    if (!slot) return [];
    
    const slotStartDateTime = parseISO(slot.start_time);
    const slotEndDateTime = parseISO(slot.end_time);
    
    // Create selected start datetime
    const selectedStartDateTime = new Date(slotStartDateTime);
    const [hours, minutes] = startTime.split(':').map(Number);
    selectedStartDateTime.setHours(hours, minutes, 0, 0);
    
    // Calculate available durations
    const maxMinutes = Math.floor((slotEndDateTime.getTime() - selectedStartDateTime.getTime()) / (1000 * 60));
    const durations: number[] = [];
    
    // Add 30-minute intervals up to the maximum
    for (let duration = 30; duration <= maxMinutes && duration <= 120; duration += 30) {
      durations.push(duration);
    }
    
    return durations;
  };

  const handleStartTimeSelect = (startTime: string) => {
    setSelectedStartTime(startTime);
    setValue("selectedStartTime", startTime);
    
    // Reset duration and set to maximum available or 60 minutes
    const availableDurations = getAvailableDurations(startTime);
    const defaultDuration = availableDurations.includes(60) ? 60 : availableDurations[0] || 30;
    setSelectedDuration(defaultDuration);
    setValue("selectedDuration", defaultDuration);
  };

  const handleDurationSelect = (duration: number) => {
    setSelectedDuration(duration);
    setValue("selectedDuration", duration);
  };

  const isTimeSlotAvailable = (startTime: string, duration: number): boolean => {
    if (!selectedSlot) return false;
    
    const slot = bookingSlots.find(s => s.id === selectedSlot);
    if (!slot) return false;
    
    const slotDate = format(parseISO(slot.start_time), 'yyyy-MM-dd');
    const sessionStartTime = `${slotDate}T${startTime}:00`;
    
    // Check if this exact time conflicts with existing sessions
    return !existingSessions.some(session => {
      const sessionStart = new Date(session.start_time);
      const requestedStart = new Date(sessionStartTime);
      const requestedEnd = new Date(requestedStart.getTime() + duration * 60 * 1000);
      
      // Simple overlap check - for now we'll just check start times
      return Math.abs(sessionStart.getTime() - requestedStart.getTime()) < 30 * 60 * 1000; // 30 min buffer
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

  const onSubmit = async (data: BookingFormData) => {
    try {
      setSubmitting(true);
      console.log('Form submission started:', data);

      const slot = bookingSlots.find(s => s.id === data.selectedSlotId);
      if (!slot) {
        throw new Error('Selected slot not found');
      }

      // Validate that start time and duration are selected
      if (!data.selectedStartTime || !data.selectedDuration) {
        throw new Error('Please select a start time and duration');
      }

      // Check if the selected time is still available
      if (!isTimeSlotAvailable(data.selectedStartTime, data.selectedDuration)) {
        toast({
          variant: "destructive",
          title: "Time Slot Unavailable",
          description: "This time slot is no longer available. Please select a different time.",
        });
        return;
      }

      // Use selected date from slot and selected time from user
      const slotDate = format(parseISO(slot.start_time), 'yyyy-MM-dd');
      const date = slotDate;
      const time = data.selectedStartTime;
      const duration = data.selectedDuration;

      // Prepare session payload
      const sessionPayload = {
        tutor_id: tutorId,
        student_id: null,
        date: date,
        time: time,
        duration: duration,
        rate: 0, // Default rate, tutor can update later
        paid: false,
        unassigned_name: data.name,
        notes: `Booking request from ${data.name}`,
        status: 'pending'
      };

      console.log("Submitting session:", sessionPayload);
      
      // Add debug toast
      toast({
        title: "Submitting Booking...",
        description: `Booking ${data.name} for ${time} (${duration} min)`,
      });

      // Create session record
      const { error: sessionError } = await supabase
        .from('sessions')
        .insert(sessionPayload);

      if (sessionError) {
        throw sessionError;
      }

      setBookingSuccess(true);
      toast({
        title: "Booking Request Submitted!",
        description: "Your booking request has been sent to the tutor. They will contact you soon.",
      });

      // Refresh available slots
      await fetchTutorAndSlots();

    } catch (error) {
      console.error('Error submitting booking:', error);
      toast({
        variant: "destructive",
        title: "Booking Failed",
        description: "Could not submit your booking request. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <div className="text-center text-sm text-gray-500 mt-4">
                Loading booking information...
                <br />
                <span className="text-xs">This may take a moment on mobile devices</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!tutor) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <Card>
            <CardContent className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Tutor Not Found
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                The tutor you're looking for could not be found.
              </p>
              <p className="text-sm text-red-500 mb-6">
                Error: Could not load booking information. Please try again.
              </p>
              <Button 
                onClick={() => {
                  setTutor(null);
                  setLoading(true);
                  fetchTutorAndSlots();
                }}
                variant="outline"
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
                Thank you for your booking request. {tutor.full_name} will review your request and contact you soon.
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
              Book a Session with {tutor.full_name}
            </CardTitle>
            <p className="text-gray-600 dark:text-gray-400">
              Select an available time slot and enter your name to request a booking.
            </p>
            
            {/* Student Timezone Selector */}
            <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
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
                            <SelectValue placeholder="Select your timezone" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px]">
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
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </CardHeader>

          <CardContent>
            {availableSlots.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  No Available Slots
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  There are currently no available booking slots. Please check back later.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Available Time Slots */}
                <div>
                  <Label className="text-base font-semibold mb-4 block">
                    Available Time Slots
                  </Label>
                  <div className="grid gap-3">
                    {availableSlots.map((slot) => {
                      // Convert UTC times to student's local timezone
                      const utcStartTime = dayjs.utc(slot.start_time);
                      const utcEndTime = dayjs.utc(slot.end_time);
                      const localStartTime = utcStartTime.tz(studentTimezone);
                      const localEndTime = utcEndTime.tz(studentTimezone);
                      
                      // Debug logging for each slot
                      console.log("Booking slot:", {
                        slotId: slot.id,
                        utc: slot.start_time,
                        studentTZ: studentTimezone,
                        localTime: localStartTime.format(),
                        displayTime: `${localStartTime.format('h:mm A')} - ${localEndTime.format('h:mm A')}`,
                        rawUTC: utcStartTime.format(),
                        convertedLocal: localStartTime.format('YYYY-MM-DD HH:mm A')
                      });
                      
                      const isSelected = watchedSlotId === slot.id;

                      return (
                        <Card
                          key={slot.id}
                          className={`cursor-pointer transition-all hover:shadow-md ${
                            isSelected
                              ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950"
                              : "hover:bg-gray-50 dark:hover:bg-gray-800"
                          }`}
                          onClick={() => handleSlotSelect(slot.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Clock className="h-5 w-5 text-gray-500" />
                                <div>
                                  <div className="font-medium">
                                    {localStartTime.format('dddd, MMMM D, YYYY')}
                                  </div>
                                  <div className="text-sm text-gray-600 dark:text-gray-400">
                                    {localStartTime.format('h:mm A')} - {localEndTime.format('h:mm A')}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {getTimezoneDisplayName(studentTimezone)}
                                  </div>
                                </div>
                              </div>
                              {isSelected && (
                                <Badge variant="default">Selected</Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                  {errors.selectedSlotId && (
                    <p className="text-sm text-red-600 mt-2">
                      {errors.selectedSlotId.message}
                    </p>
                  )}
                </div>

                {/* Name Input */}
                <div>
                  <Label htmlFor="name" className="text-base font-semibold">
                    Your Name
                  </Label>
                  <Input
                    id="name"
                    {...register("name")}
                    placeholder="Enter your full name"
                    className="mt-2"
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.name.message}
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={submitting || !watchedSlotId || !watchedStartTime || !watchedDuration}
                  className="w-full"
                  size="lg"
                >
                  {submitting ? "Submitting..." : "Submit Booking Request"}
                </Button>

                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  By submitting this request, you agree that the tutor will contact you 
                  to confirm the booking details.
                </p>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Time Picker Modal */}
        <Dialog open={showTimePickerModal} onOpenChange={setShowTimePickerModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Select Your Session Time
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 pt-4">
              {selectedSlot && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Selected Date
                  </p>
                  {(() => {
                    const selectedSlotData = bookingSlots.find(s => s.id === selectedSlot);
                    if (selectedSlotData) {
                      const localStartTime = dayjs.utc(selectedSlotData.start_time).tz(studentTimezone);
                      const localEndTime = dayjs.utc(selectedSlotData.end_time).tz(studentTimezone);
                      return (
                        <>
                          <p className="text-blue-600 dark:text-blue-300">
                            {localStartTime.format('dddd, MMMM D, YYYY')}
                          </p>
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            Available: {localStartTime.format('h:mm A')} - {localEndTime.format('h:mm A')} ({getTimezoneDisplayName(studentTimezone)})
                          </p>
                        </>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

              {/* Start Time Selection */}
              <div>
                <Label className="text-base font-semibold mb-3 block">
                  Choose Start Time
                </Label>
                <Select value={selectedStartTime} onValueChange={setSelectedStartTime}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select start time..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStartTimes.map((time) => {
                      const isAvailable = isTimeSlotAvailable(time, selectedDuration);
                      
                      // Convert the time to student's timezone for display
                      const selectedSlotData = bookingSlots.find(s => s.id === selectedSlot);
                      let displayTime = format(new Date(`2000-01-01T${time}`), 'h:mm a');
                      
                      if (selectedSlotData) {
                        // Create a datetime with the slot's date and selected time
                        const slotDate = dayjs.utc(selectedSlotData.start_time).format('YYYY-MM-DD');
                        const utcDateTime = dayjs.utc(`${slotDate}T${time}:00`);
                        const localDateTime = utcDateTime.tz(studentTimezone);
                        displayTime = localDateTime.format('h:mm A');
                        
                        console.log('Time picker conversion:', {
                          originalTime: time,
                          slotDate,
                          utcDateTime: utcDateTime.format(),
                          localDateTime: localDateTime.format(),
                          displayTime,
                          studentTimezone
                        });
                      }
                      
                      return (
                        <SelectItem 
                          key={time} 
                          value={time}
                          disabled={!isAvailable}
                        >
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {displayTime}
                            {!isAvailable && <span className="text-xs text-red-500">(Unavailable)</span>}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Duration Selection */}
              {selectedStartTime && (
                <div>
                  <Label className="text-base font-semibold mb-3 block">
                    Choose Duration
                  </Label>
                  <Select value={selectedDuration.toString()} onValueChange={(value) => setSelectedDuration(parseInt(value))}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select duration..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableDurations(selectedStartTime).map((duration) => (
                        <SelectItem key={duration} value={duration.toString()}>
                          {duration} minutes
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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
                          const slotDate = dayjs.utc(selectedSlotData.start_time).format('YYYY-MM-DD');
                          const utcStartDateTime = dayjs.utc(`${slotDate}T${selectedStartTime}:00`);
                          const localStartDateTime = utcStartDateTime.tz(studentTimezone);
                          const localEndDateTime = localStartDateTime.add(selectedDuration, 'minute');
                          
                          return (
                            <p className="text-sm text-green-600 dark:text-green-300">
                              {localStartDateTime.format('h:mm A')} - {localEndDateTime.format('h:mm A')} ({selectedDuration} minutes)
                              <br />
                              <span className="text-xs">
                                {getTimezoneDisplayName(studentTimezone)}
                              </span>
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex gap-3 pt-4">
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
                  Confirm Time
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}