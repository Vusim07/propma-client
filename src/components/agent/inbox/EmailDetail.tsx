
import React from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Star, Flag } from "lucide-react";
import EmailMessage from "./EmailMessage";
import AISuggestion from "./AISuggestion";
import ReplyBox from "./ReplyBox";

interface Email {
  id: string;
  sender: string;
  email: string;
  subject: string;
  preview: string;
  time: string;
  isUnread: boolean;
  hasAttachment: boolean;
  avatar: string;
  leadSource?: string;
  needsFollowUp?: boolean;
}

interface EmailDetailProps {
  email: Email | null;
}

const getLeadSourceColor = (source: string) => {
  switch (source.toLowerCase()) {
    case 'property24':
      return 'bg-blue-100 text-blue-800';
    case 'privateproperty':
      return 'bg-green-100 text-green-800';
    case 'gumtree':
      return 'bg-orange-100 text-orange-800';
    case 'olx':
      return 'bg-purple-100 text-purple-800';
    case 'website':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const EmailDetail: React.FC<EmailDetailProps> = ({ email }) => {
  if (!email) {
    return (
      <div className="flex-1 bg-white flex items-center justify-center">
        <p className="text-gray-500">Select an email to view details</p>
      </div>
    );
  }

  const handleMarkPriority = () => {
    console.log("Marked as high priority");
  };

  const handleSendMessage = (message: string) => {
    console.log("Sending message:", message);
  };

  return (
    <div className="flex-1 bg-white flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12">
              <AvatarImage src={email.avatar} alt={email.sender} />
              <AvatarFallback>{email.sender.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{email.sender}</h2>
              <p className="text-sm text-gray-500">{email.email}</p>
              <p className="text-sm text-gray-700 mt-1">{email.subject}</p>
              {email.leadSource && (
                <Badge className={`text-xs mt-1 ${getLeadSourceColor(email.leadSource)}`}>
                  {email.leadSource}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon">
              <Star className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Flag className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Email Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* First Message - Initial Inquiry */}
        <EmailMessage
          sender={email.sender}
          avatar={email.avatar}
          content={`Hi,

Is this apartment still available. I'm interested in viewing it on Friday after 4pm.

Best,
${email.sender.split(' ')[0]}`}
          timestamp="April 10, 2025, 2:13 PM"
        />
        
        {/* Response from Amara AI */}
        <EmailMessage
          sender="Amara AI"
          avatar="https://api.dicebear.com/7.x/avataaars/svg?seed=Amara"
          content={`Hi ${email.sender.split(' ')[0]},

Thanks for reaching out. Yes the apartment is still available. Please use this link to schedule a viewing appointment: https://app.agentamara.com/apply/prop_1743022717719_uksv6uxm

Please note you'll need to have your latest 3 months bank statement, payslip and copy of ID to complete the booking on the portal.

Looking forward to meeting you!

Best,
Amara (on behalf of Jane, Urban Rentals)`}
          timestamp="April 10, 2025, 2:15 PM"
          isFromUser={true}
        />
        
        {/* AI Suggestion */}
        <div className="mb-6">
          <AISuggestion
            type="status"
            title="Lead Status Update:"
            message="This lead has been automatically qualified based on their response time and inquiry details. Consider following up if no viewing is scheduled within 24 hours."
            actionText="Mark as High Priority"
            onAction={handleMarkPriority}
          />
        </div>
        
        {/* Follow-up Reminder */}
        <AISuggestion
          type="reminder"
          title="Reminder:"
          message="Follow up if no viewing appointment is scheduled by tomorrow 5 PM."
        />
      </div>
      
      {/* Reply Box */}
      <ReplyBox onSend={handleSendMessage} />
    </div>
  );
};

export default EmailDetail;
