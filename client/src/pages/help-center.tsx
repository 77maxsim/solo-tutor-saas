import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Mail, MessageCircle, Book, Calendar, Users, DollarSign, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FeedbackModal } from "@/components/FeedbackModal";

export default function HelpCenter() {
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  
  return (
    <div className="bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>

        <h1 className="text-3xl font-bold mb-2">Help Center</h1>
        <p className="text-muted-foreground mb-8">
          Find answers to common questions and learn how to get the most out of Classterly.
        </p>

        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <Calendar className="h-8 w-8 text-blue-600 mb-2" />
              <CardTitle className="text-lg">Scheduling</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Learn how to schedule and manage your tutoring sessions</CardDescription>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <Users className="h-8 w-8 text-green-600 mb-2" />
              <CardTitle className="text-lg">Students</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Manage your student roster and their information</CardDescription>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <DollarSign className="h-8 w-8 text-purple-600 mb-2" />
              <CardTitle className="text-lg">Earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Track your income and payment history</CardDescription>
            </CardContent>
          </Card>
        </div>

        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <HelpCircle className="h-5 w-5" />
          Frequently Asked Questions
        </h2>
        
        <Accordion type="single" collapsible className="mb-8">
          <AccordionItem value="item-1">
            <AccordionTrigger>How do I schedule a new session?</AccordionTrigger>
            <AccordionContent>
              Click the "Schedule Session" button in the sidebar. Select a student, choose the date and time, 
              set the duration and rate, then click "Schedule" to confirm. The session will appear on your 
              dashboard and calendar.
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-2">
            <AccordionTrigger>How do I add a new student?</AccordionTrigger>
            <AccordionContent>
              Go to the Students page from the sidebar. Click "Add Student" and fill in their details 
              including name, email (optional), and default hourly rate. You can also add notes about 
              each student.
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-3">
            <AccordionTrigger>How do I mark a session as paid?</AccordionTrigger>
            <AccordionContent>
              On the Dashboard or Calendar, find the session you want to mark as paid. Click on the session 
              and select "Mark as Paid" or use the payment icon. The session will be moved from unpaid to 
              paid in your earnings tracking.
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-4">
            <AccordionTrigger>How do I connect Google Calendar?</AccordionTrigger>
            <AccordionContent>
              Go to your Profile page and scroll down to find the Google Calendar section. Click "Connect 
              Google Calendar" and follow the authorization steps. Once connected, your sessions will 
              automatically sync with your Google Calendar.
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-5">
            <AccordionTrigger>How do I set my availability?</AccordionTrigger>
            <AccordionContent>
              Navigate to the Availability page from the sidebar. Here you can set your weekly recurring 
              availability, block off specific dates, and manage your booking preferences for when students 
              book through your public booking link.
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-6">
            <AccordionTrigger>How do I share my booking link with students?</AccordionTrigger>
            <AccordionContent>
              Your public booking page is available at app.classterly.com/booking/[your-id]. You can find and copy 
              your unique booking link from your Profile page. Share this link with students so they can 
              book sessions with you directly.
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Still need help?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Can't find what you're looking for? We're here to help.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => setFeedbackModalOpen(true)}>
                <Mail className="h-4 w-4 mr-2" />
                Contact Support
              </Button>
              <a href="https://classterly.com" target="_blank" rel="noopener noreferrer">
                <Button variant="outline">
                  <Book className="h-4 w-4 mr-2" />
                  Visit Website
                </Button>
              </a>
              <a href="https://calendly.com/classterly_demo/30min" target="_blank" rel="noopener noreferrer">
                <Button variant="outline">
                  <Calendar className="h-4 w-4 mr-2" />
                  Book a Demo
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        <FeedbackModal 
          open={feedbackModalOpen} 
          onOpenChange={setFeedbackModalOpen}
          defaultType="help"
        />
      </div>
    </div>
  );
}
