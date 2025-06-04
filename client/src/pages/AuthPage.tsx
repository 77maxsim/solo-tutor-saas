import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

const authSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().optional(),
  currency: z.string().optional(),
  confirmPassword: z.string().optional(),
  rememberMe: z.boolean().default(false),
}).refine((data) => {
  // Only validate confirm password if it exists (signup mode)
  if (data.confirmPassword !== undefined && data.confirmPassword !== "") {
    return data.password === data.confirmPassword;
  }
  return true;
}, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine((data) => {
  // Validate full name is required for signup (when confirmPassword exists)
  if (data.confirmPassword !== undefined && data.confirmPassword !== "") {
    return data.fullName && data.fullName.trim().length > 0;
  }
  return true;
}, {
  message: "Full name is required for signup",
  path: ["fullName"],
}).refine((data) => {
  // Validate currency is required for signup (when confirmPassword exists)
  if (data.confirmPassword !== undefined && data.confirmPassword !== "") {
    return data.currency && data.currency.trim().length > 0;
  }
  return true;
}, {
  message: "Currency selection is required for signup",
  path: ["currency"],
});

type AuthForm = z.infer<typeof authSchema>;

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authMessage, setAuthMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<AuthForm>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: "",
      password: "",
      fullName: "",
      currency: "USD",
      confirmPassword: "",
      rememberMe: false,
    },
    mode: "onChange",
  });

  // Clear form errors when switching between login/signup modes
  useEffect(() => {
    form.clearErrors();
  }, [isLogin, form]);

  const onSubmit = async (data: AuthForm) => {
    console.log('Form submitted with data:', data);
    setIsLoading(true);
    setAuthMessage(null);

    try {
      if (isLogin) {
        // Login
        const { data: authData, error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

        if (error) {
          setAuthMessage({
            type: 'error',
            message: error.message
          });
          toast({
            variant: "destructive",
            title: "Login Failed",
            description: error.message,
          });
        } else if (authData.user) {
          setAuthMessage({
            type: 'success',
            message: 'Login successful! Redirecting...'
          });
          toast({
            title: "Welcome back!",
            description: "Login successful.",
          });
          setTimeout(() => {
            setLocation('/dashboard');
          }, 1000);
        }
      } else {
        // Signup
        const { data: authData, error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
        });

        if (error) {
          setAuthMessage({
            type: 'error',
            message: error.message
          });
          toast({
            variant: "destructive",
            title: "Signup Failed",
            description: error.message,
          });
        } else if (authData.user) {
          // Check if tutor record already exists
          const { data: existingTutor } = await supabase
            .from('tutors')
            .select('id')
            .eq('user_id', authData.user.id)
            .single();

          // Only create tutor record if it doesn't exist
          if (!existingTutor) {
            const { error: tutorError } = await supabase
              .from('tutors')
              .insert([{
                user_id: authData.user.id,
                email: authData.user.email,
                full_name: data.fullName?.trim() || data.email.split('@')[0],
                currency: data.currency || 'USD',
                created_at: new Date().toISOString(),
              }]);

            if (tutorError) {
              console.error('Error creating tutor record:', tutorError);
              toast({
                variant: "destructive",
                title: "Setup Error",
                description: "Account created but profile setup failed. Please contact support.",
              });
              return;
            }
          }

          setAuthMessage({
            type: 'success',
            message: 'Account created successfully! Please check your email to verify your account.'
          });
          toast({
            title: "Account Created",
            description: "Please check your email to verify your account.",
          });
          setTimeout(() => {
            setIsLogin(true);
            form.reset();
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      setAuthMessage({
        type: 'error',
        message: 'An unexpected error occurred. Please try again.'
      });
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setAuthMessage(null);
    // Clear all form errors and reset form state completely
    form.clearErrors();
    form.reset({
      email: "",
      password: "",
      fullName: "",
      confirmPassword: "",
      rememberMe: false,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </CardTitle>
            <CardDescription>
              {isLogin 
                ? 'Sign in to access your TutorTrack dashboard' 
                : 'Start managing your tutoring business today'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {authMessage && (
              <Alert className={authMessage.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
                {authMessage.type === 'error' ? (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                )}
                <AlertDescription className={authMessage.type === 'error' ? 'text-red-700' : 'text-green-700'}>
                  {authMessage.message}
                </AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Enter your email"
                          disabled={isLoading}
                          autoComplete={isLogin ? "email" : "new-email"}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!isLogin && (
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Enter your full name"
                            disabled={isLoading}
                            autoComplete="name"
                            value={field.value || ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {!isLogin && (
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value || "USD"}
                            onValueChange={field.onChange}
                            disabled={isLoading}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select your currency" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USD">USD - US Dollar</SelectItem>
                              <SelectItem value="EUR">EUR - Euro</SelectItem>
                              <SelectItem value="UAH">UAH - Ukrainian Hryvnia</SelectItem>
                              <SelectItem value="GBP">GBP - British Pound</SelectItem>
                              <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                              <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                              <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            disabled={isLoading}
                            autoComplete={isLogin ? "current-password" : "new-password"}
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            disabled={isLoading}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-gray-500" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-500" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!isLogin && (
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="Confirm your password"
                              disabled={isLoading}
                              autoComplete="new-password"
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              disabled={isLoading}
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-4 w-4 text-gray-500" />
                              ) : (
                                <Eye className="h-4 w-4 text-gray-500" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {isLogin && (
                  <FormField
                    control={form.control}
                    name="rememberMe"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm font-normal">
                            Remember me for 30 days
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  onClick={() => {
                    console.log('Button clicked');
                    console.log('Form state:', form.formState);
                    console.log('Form values:', form.getValues());
                  }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isLogin ? 'Signing in...' : 'Creating account...'}
                    </>
                  ) : (
                    isLogin ? 'Sign In' : 'Create Account'
                  )}
                </Button>
              </form>
            </Form>

            <div className="text-center text-sm">
              <span className="text-muted-foreground">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
              </span>
              <Button
                variant="link"
                className="p-0 h-auto font-normal"
                onClick={toggleMode}
                disabled={isLoading}
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </Button>
            </div>

            {isLogin && (
              <div className="text-center">
                <Button
                  variant="link"
                  className="p-0 h-auto text-sm text-muted-foreground"
                  disabled={isLoading}
                >
                  Forgot your password?
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground mt-4">
          <p>© 2025 TutorTrack. Manage your tutoring business with ease.</p>
        </div>
      </div>
    </div>
  );
}