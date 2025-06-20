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
import { Calendar, Clock, User, CheckCircle, AlertCircle } from "lucide-react";
import { format, parseISO, isFuture } from "date-fns";

// Form validation schema
const bookingFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name too long"),
  selectedSlotId: z.string().min(1, "Please select a time slot"),
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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

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
    },
  });

  const watchedSlotId = watch("selectedSlotId");

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

      // Filter out past slots
      const futureSlots = slotsData.filter(slot => 
        isFuture(parseISO(slot.start_time))
      );
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
    return bookingSlots.filter(slot => !isSlotBooked(slot.start_time));
  };

  const handleSlotSelect = (slotId: string) => {
    setSelectedSlot(slotId);
    setValue("selectedSlotId", slotId);
  };

  const onSubmit = async (data: BookingFormData) => {
    try {
      setSubmitting(true);

      const slot = bookingSlots.find(s => s.id === data.selectedSlotId);
      if (!slot) {
        throw new Error('Selected slot not found');
      }

      // Split start_time into date and time components
      const startDateTime = parseISO(slot.start_time);
      const endDateTime = parseISO(slot.end_time);
      const date = format(startDateTime, 'yyyy-MM-dd');
      const time = format(startDateTime, 'HH:mm');

      // Calculate duration in minutes
      const duration = Math.round((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60));

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
                      const startTime = parseISO(slot.start_time);
                      const endTime = parseISO(slot.end_time);
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
                                    {format(startTime, 'EEEE, MMMM d, yyyy')}
                                  </div>
                                  <div className="text-sm text-gray-600 dark:text-gray-400">
                                    {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
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
                  disabled={submitting || !watchedSlotId}
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
      </div>
    </div>
  );
}