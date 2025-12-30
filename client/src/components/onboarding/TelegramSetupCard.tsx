import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MessageCircle, 
  CheckCircle2, 
  Copy, 
  ExternalLink,
  Bell,
  Calendar,
  DollarSign
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface TelegramSetupCardProps {
  compact?: boolean;
}

export function TelegramSetupCard({ compact = false }: TelegramSetupCardProps) {
  const { toast } = useToast();
  const [copiedEmail, setCopiedEmail] = useState(false);

  const { data: tutorData } = useQuery({
    queryKey: ['tutor-telegram-status'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('tutors')
        .select('email, telegram_chat_id')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching tutor telegram status:', error);
        return null;
      }

      return data;
    },
  });

  const isConnected = !!tutorData?.telegram_chat_id;
  const tutorEmail = tutorData?.email;

  const handleCopyEmail = async () => {
    if (tutorEmail) {
      await navigator.clipboard.writeText(tutorEmail);
      setCopiedEmail(true);
      toast({
        title: "Email copied!",
        description: "Send this to the Telegram bot to connect your account.",
      });
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  const handleOpenTelegram = () => {
    window.open('https://t.me/ClassterHQBot', '_blank');
  };

  if (isConnected) {
    return (
      <Card className={cn("border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30", compact && "p-4")} data-testid="telegram-connected-card">
        <CardHeader className={cn(compact && "p-0 pb-2")}>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base text-green-700 dark:text-green-400">Telegram Connected</CardTitle>
              <CardDescription className="text-green-600 dark:text-green-500">
                You'll receive daily summaries and booking alerts
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card className="border-primary/20" data-testid="telegram-setup-compact">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Connect Telegram</p>
              <p className="text-xs text-muted-foreground">Get booking alerts on your phone</p>
            </div>
            <Button size="sm" onClick={handleOpenTelegram} data-testid="button-setup-telegram-compact">
              Connect
              <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20" data-testid="telegram-setup-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <MessageCircle className="h-6 w-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg">Connect Telegram Notifications</CardTitle>
            <CardDescription>
              Get instant alerts and daily summaries on Telegram
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center text-center p-3 rounded-lg bg-muted/50">
            <Bell className="h-5 w-5 text-primary mb-2" />
            <span className="text-xs font-medium">Booking Alerts</span>
          </div>
          <div className="flex flex-col items-center text-center p-3 rounded-lg bg-muted/50">
            <Calendar className="h-5 w-5 text-primary mb-2" />
            <span className="text-xs font-medium">Daily Summary</span>
          </div>
          <div className="flex flex-col items-center text-center p-3 rounded-lg bg-muted/50">
            <DollarSign className="h-5 w-5 text-primary mb-2" />
            <span className="text-xs font-medium">Earnings Report</span>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="rounded-full px-3">1</Badge>
            <span className="text-sm">Open the Classter Telegram Bot</span>
          </div>
          <Button 
            variant="outline" 
            className="w-full justify-center gap-2" 
            onClick={handleOpenTelegram}
            data-testid="button-open-telegram-bot"
          >
            <MessageCircle className="h-4 w-4" />
            Open @ClassterHQBot
            <ExternalLink className="h-3 w-3 ml-1" />
          </Button>

          <div className="flex items-center gap-2 pt-2">
            <Badge variant="outline" className="rounded-full px-3">2</Badge>
            <span className="text-sm">Send your email to the bot</span>
          </div>
          {tutorEmail && (
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono truncate">
                {tutorEmail}
              </code>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleCopyEmail}
                data-testid="button-copy-email"
              >
                {copiedEmail ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground pt-2">
            The bot will verify your email and start sending you notifications. You'll receive daily summaries at 9 PM in your timezone.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
