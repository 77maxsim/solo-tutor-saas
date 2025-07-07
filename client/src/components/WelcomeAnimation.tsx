import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { 
  Sun, 
  Moon, 
  Sunset, 
  Coffee, 
  Star,
  Sparkles,
  TrendingUp,
  Calendar,
  Users
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
}

export default function WelcomeAnimation({ 
  tutorInfo, 
  dashboardStats, 
  isLoading = false 
}: WelcomeAnimationProps) {
  const [showPersonalizedGreeting, setShowPersonalizedGreeting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false);

  // Update time every minute for dynamic greeting
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
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

  // Get personalized stats message
  const getPersonalizedMessage = () => {
    if (!dashboardStats) return null;
    
    const { sessionsThisWeek = 0, activeStudents = 0, weeklySessionsDelta = 0 } = dashboardStats;
    
    if (weeklySessionsDelta > 0) {
      return {
        message: `You're up ${weeklySessionsDelta} session${weeklySessionsDelta > 1 ? 's' : ''} from last week! 🚀`,
        type: 'positive' as const
      };
    } else if (sessionsThisWeek === 0) {
      return {
        message: "Ready to make this week amazing? Let's schedule some sessions! 💪",
        type: 'motivational' as const
      };
    } else if (activeStudents > 5) {
      return {
        message: `You're inspiring ${activeStudents} students this month! Keep up the great work! ⭐`,
        type: 'achievement' as const
      };
    } else {
      return {
        message: "Every great tutoring session starts with one step forward! ✨",
        type: 'encouraging' as const
      };
    }
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

  return (
    <div className="relative">
      {/* Main Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="flex items-center gap-4 p-6"
      >
        {/* Animated Avatar */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ 
            type: "spring", 
            stiffness: 200, 
            damping: 15,
            delay: 0.3 
          }}
          className="relative"
        >
          <Avatar className="w-16 h-16 border-4 border-white shadow-lg ring-2 ring-primary/20">
            <AvatarImage src={tutorInfo?.avatar_url || ''} alt={tutorInfo?.full_name || 'Tutor'} />
            <AvatarFallback className={`bg-gradient-to-br ${greeting.gradient} text-white text-lg font-bold`}>
              {tutorInfo?.full_name 
                ? tutorInfo.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
                : 'TU'
              }
            </AvatarFallback>
          </Avatar>
          
          {/* Floating time icon */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md"
          >
            <IconComponent className="w-3 h-3 text-gray-600" />
          </motion.div>
        </motion.div>

        {/* Main Greeting */}
        <div className="flex-1">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                {greeting.text}
              </motion.span>
              <motion.span
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1, type: "spring" }}
                className="inline-block ml-2"
              >
                {greeting.emoji}
              </motion.span>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="ml-2"
              >
                {firstName}!
              </motion.span>
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.5 }}
            className="text-sm text-muted-foreground mt-1"
          >
            Here's what's happening with your tutoring business today.
          </motion.p>
        </div>

        {/* Floating sparkles animation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute top-2 right-8"
        >
          <motion.div
            animate={{ 
              y: [0, -8, 0],
              rotate: [0, 180, 360]
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <Sparkles className="w-4 h-4 text-yellow-400" />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Personalized Stats Message */}
      <AnimatePresence>
        {showPersonalizedGreeting && personalizedMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ 
              type: "spring",
              stiffness: 200,
              damping: 20
            }}
            className="mx-6 mb-4"
          >
            <Card className={`p-4 border-l-4 ${
              personalizedMessage.type === 'positive' 
                ? 'border-l-green-500 bg-green-50 dark:bg-green-900/20' 
                : personalizedMessage.type === 'achievement'
                ? 'border-l-purple-500 bg-purple-50 dark:bg-purple-900/20'
                : personalizedMessage.type === 'motivational'
                ? 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-l-orange-500 bg-orange-50 dark:bg-orange-900/20'
            }`}>
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {personalizedMessage.type === 'positive' && <TrendingUp className="w-5 h-5 text-green-600" />}
                  {personalizedMessage.type === 'achievement' && <Star className="w-5 h-5 text-purple-600" />}
                  {personalizedMessage.type === 'motivational' && <Calendar className="w-5 h-5 text-blue-600" />}
                  {personalizedMessage.type === 'encouraging' && <Users className="w-5 h-5 text-orange-600" />}
                </motion.div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {personalizedMessage.message}
                </p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}