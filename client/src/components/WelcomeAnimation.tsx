import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Sun, 
  Moon, 
  Sunset, 
  Coffee, 
  Star,
  Sparkles,
  TrendingUp,
  Calendar,
  Users,
  ArrowUpRight
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface WelcomeAnimationProps {
  tutorInfo: {
    full_name?: string;
    avatar_url?: string | null;
  } | null;
  dashboardStats?: {
    sessionsThisWeek?: number;
    activeStudents?: number;
    currentWeekEarnings?: number;
    weeklySessionsDelta?: number;
  } | null;
  isLoading?: boolean;
  openScheduleModal?: () => void;
}

export default function WelcomeAnimation({ 
  tutorInfo, 
  dashboardStats, 
  isLoading = false,
  openScheduleModal
}: WelcomeAnimationProps) {
  const [showPersonalizedGreeting, setShowPersonalizedGreeting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false);
  const [isCompact, setIsCompact] = useState(false);

  // Update time every minute for dynamic greeting
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Handle scroll for compact header
  useEffect(() => {
    const handleScroll = () => {
      setIsCompact(window.scrollY > 80);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Show personalized greeting after initial load
  useEffect(() => {
    if (!isLoading && tutorInfo) {
      const timer = setTimeout(() => {
        setShowPersonalizedGreeting(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isLoading, tutorInfo]);

  // Trigger celebration confetti for positive weekly delta
  useEffect(() => {
    if (!isLoading && dashboardStats && !hasTriggeredConfetti) {
      const weeklyDelta = dashboardStats.weeklySessionsDelta || 0;
      if (weeklyDelta > 0) {
        setTimeout(() => {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.3, x: 0.1 },
            colors: ['#3B82F6', '#10B981', '#8B5CF6']
          });
          setHasTriggeredConfetti(true);
        }, 2000);
      }
    }
  }, [isLoading, dashboardStats, hasTriggeredConfetti]);

  // Get time-based greeting
  const getTimeBasedGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) {
      return {
        text: 'Good morning',
        icon: Sun,
        gradient: 'from-amber-400 to-orange-500',
        bgGradient: 'from-amber-50 to-orange-50',
        emoji: '☀️'
      };
    } else if (hour < 17) {
      return {
        text: 'Good afternoon',
        icon: Coffee,
        gradient: 'from-blue-500 to-cyan-500',
        bgGradient: 'from-blue-50 to-cyan-50',
        emoji: '☕'
      };
    } else if (hour < 20) {
      return {
        text: 'Good evening',
        icon: Sunset,
        gradient: 'from-orange-500 to-red-500',
        bgGradient: 'from-orange-50 to-red-50',
        emoji: '🌅'
      };
    } else {
      return {
        text: 'Good evening',
        icon: Moon,
        gradient: 'from-indigo-500 to-purple-600',
        bgGradient: 'from-indigo-50 to-purple-50',
        emoji: '🌙'
      };
    }
  };

  const greeting = getTimeBasedGreeting();
  const IconComponent = greeting.icon;
  const firstName = tutorInfo?.full_name?.split(' ')[0] || 'Tutor';
  
  // Get simple time of day for compact header
  const getTimeOfDay = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  };

  // Get personalized stats message - only show when delta exists or meaningful data
  const getPersonalizedMessage = () => {
    if (!dashboardStats) return null;
    
    const { sessionsThisWeek = 0, activeStudents = 0, weeklySessionsDelta = 0 } = dashboardStats;
    
    // Only show banner when there's a delta or meaningful achievement
    if (weeklySessionsDelta > 0) {
      return {
        message: `You're up ${weeklySessionsDelta} session${weeklySessionsDelta > 1 ? 's' : ''} from last week!`,
        type: 'positive' as const,
        icon: TrendingUp
      };
    } else if (weeklySessionsDelta < 0) {
      return {
        message: `You're down ${Math.abs(weeklySessionsDelta)} session${Math.abs(weeklySessionsDelta) > 1 ? 's' : ''} from last week`,
        type: 'neutral' as const,
        icon: TrendingUp
      };
    } else if (activeStudents > 10) {
      return {
        message: `You're inspiring ${activeStudents} students this month! Keep up the great work!`,
        type: 'achievement' as const,
        icon: Star
      };
    }
    
    // Return null for no banner when delta is 0 and no achievements
    return null;
  };

  const personalizedMessage = getPersonalizedMessage();

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 p-6"
      >
        <div className="w-16 h-16 bg-gray-200 rounded-full animate-pulse" />
        <div className="space-y-2">
          <div className="h-6 bg-gray-200 rounded w-48 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-64 animate-pulse" />
        </div>
      </motion.div>
    );
  }

  const sessionDelta = dashboardStats?.weeklySessionsDelta || 0;

  return (
    <div className="relative">
      {/* Unified Responsive Header */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="flex flex-col md:flex-row items-start md:items-center justify-between px-6 pt-6 gap-4"
      >
        <div className="flex items-center gap-4">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ 
              type: "spring", 
              stiffness: 200, 
              damping: 15,
              delay: 0.3 
            }}
          >
            <Avatar className="h-12 w-12">
              <AvatarImage src={tutorInfo?.avatar_url || ''} alt={tutorInfo?.full_name || 'Tutor'} />
              <AvatarFallback className={`bg-gradient-to-br ${greeting.gradient} text-white font-bold`}>
                {tutorInfo?.full_name 
                  ? tutorInfo.full_name.split(' ').map(name => name[0]).join('').toUpperCase()
                  : 'T'
                }
              </AvatarFallback>
            </Avatar>
          </motion.div>
          
          <div className="flex flex-col">
            <motion.h1 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-xl font-bold"
            >
              Good {getTimeOfDay()}, <span className="font-semibold">{firstName}</span>!
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="text-sm text-muted-foreground"
            >
              Here's what's happening with your tutoring business today.
            </motion.p>
          </div>
        </div>

        {openScheduleModal && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.1 }}
          >
            <Button className="mt-2 md:mt-0" onClick={openScheduleModal}>
              + Schedule a Session
            </Button>
          </motion.div>
        )}
      </motion.div>

      {/* Session Delta Banner - Only if delta exists */}
      {sessionDelta !== 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3 }}
          className={`mx-6 mt-4 px-4 py-2 rounded-md border text-sm font-medium flex items-center gap-2 ${
            sessionDelta > 0 
              ? 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300' 
              : 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300'
          }`}
        >
          <ArrowUpRight className="h-4 w-4" />
          You're {sessionDelta > 0 ? `up ${sessionDelta}` : `down ${Math.abs(sessionDelta)}`} from last week!
        </motion.div>
      )}


    </div>
  );
}