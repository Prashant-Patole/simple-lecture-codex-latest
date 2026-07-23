import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MessageSquarePlus } from "lucide-react";

interface SupportTicketFormProps {
  onSubmit: (category: string, subject: string, message: string) => Promise<void>;
  isLoading: boolean;
}

const TICKET_CATEGORIES = [
  { value: 'technical', label: 'Technical Issue' },
  { value: 'payment', label: 'Payment / Billing' },
  { value: 'account', label: 'Account / Login' },
  { value: 'course_access', label: 'Course Access' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'other', label: 'Other' },
];

export const SupportTicketForm = ({ onSubmit, isLoading }: SupportTicketFormProps) => {
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !subject.trim() || !message.trim()) return;
    await onSubmit(category, subject.trim(), message.trim());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquarePlus className="h-5 w-5 text-primary" />
          Start a New Conversation
        </CardTitle>
        <CardDescription>
          Can't find your answer in the FAQs? Chat with our AI assistant.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select issue type" />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                placeholder="Brief description of your issue"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Describe your issue *</Label>
            <Textarea
              id="message"
              placeholder="Please provide details about your issue so we can help you better..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>
          <Button 
            type="submit" 
            disabled={isLoading || !category || !subject.trim() || !message.trim()}
            className="w-full md:w-auto"
          >
            {isLoading ? "Starting..." : "Start Chat"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
